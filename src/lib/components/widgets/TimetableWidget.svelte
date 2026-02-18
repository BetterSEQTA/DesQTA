<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { seqtaFetch } from '../../../utils/netUtil';
  import { cache } from '../../../utils/cache';
  import { useDataLoader } from '../../utils/useDataLoader';
  import { logger } from '../../../utils/logger';
  import type { WidgetConfig } from '../../types/widgets';
  import type { TimetableLesson, TimetableWidgetSettings } from '../../types/timetable';
  import type { LessonColour } from '../../types';
  import { getMonday, formatDate, parseDate, getDayIndex } from '../../utils/timetableUtils';
  import { exportToCSV, exportToPDF, exportToiCal } from '../../utils/timetableExport';
  import { updateUrlParam } from '../../utils/urlParams';
  import { toastStore } from '../../stores/toast';
  import { _ } from '../../i18n';
  import TimetableHeader from './timetable/TimetableHeader.svelte';
  import TimetableWeekView from './timetable/TimetableWeekView.svelte';
  import TimetableDayView from './timetable/TimetableDayView.svelte';
  import TimetableMonthView from './timetable/TimetableMonthView.svelte';
  import TimetableListView from './timetable/TimetableListView.svelte';
  import TimetableLessonPopout from './timetable/TimetableLessonPopout.svelte';

  interface Props {
    widget: WidgetConfig;
    isTemporary?: boolean; // If true, don't save widget config changes
    initialWeekStart?: Date; // Initial week start date
    initialViewMode?: 'week' | 'day' | 'month' | 'list'; // Initial view mode
    reloadKey?: number; // Key to force reload when changed
    forceReload?: boolean; // If true, force fresh API query (for back navigation)
  }

  let { widget, isTemporary = false, initialWeekStart, initialViewMode, reloadKey = 0, forceReload = false }: Props = $props();

  const studentId = 69; // From existing code

  let lessons = $state<TimetableLesson[]>([]);
  let lessonColours = $state<LessonColour[]>([]);
  let loadingLessons = $state(true);
  let isLoadingFromNavigation = $state(false); // Track if loading is from navigation (back/forward)
  let error = $state<string | null>(null);
  let weekStart = $state(initialWeekStart ? getMonday(initialWeekStart) : getMonday(new Date()));
  let selectedDate = $state(initialWeekStart || new Date());
  let viewMode = $state<'week' | 'day' | 'month' | 'list'>('week');
  let selectedLesson = $state<TimetableLesson | null>(null);
  let showLessonPopout = $state(false);
  let lessonAnchorElement = $state<HTMLElement | null>(null);

  const settings = $derived<TimetableWidgetSettings>({
    viewMode: widget.settings?.viewMode || 'week',
    timeRange: widget.settings?.timeRange || { start: '08:00', end: '16:00' },
    showTeacher: widget.settings?.showTeacher ?? true,
    showRoom: widget.settings?.showRoom ?? true,
    showAttendance: widget.settings?.showAttendance ?? true,
    showEmptyPeriods: widget.settings?.showEmptyPeriods ?? false,
    density: widget.settings?.density || 'normal',
    defaultView: widget.settings?.defaultView || 'week',
  });

  // Initialize view mode: use initialViewMode if provided, otherwise use settings (only if not temporary)
  $effect(() => {
    if (initialViewMode) {
      viewMode = initialViewMode;
    } else if (!isTemporary && settings.viewMode) {
      viewMode = settings.viewMode;
    }
  });

  async function loadLessonColours(): Promise<LessonColour[]> {
    const cachedColours = cache.get<LessonColour[]>('lesson_colours');
    if (cachedColours) {
      lessonColours = cachedColours;
      return lessonColours;
    }

    try {
      const res = await seqtaFetch('/seqta/student/load/prefs?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { request: 'userPrefs', asArray: true, user: studentId },
      });
      lessonColours = JSON.parse(res).payload;
      cache.set('lesson_colours', lessonColours, 30);
      return lessonColours;
    } catch (e) {
      logger.error('TimetableWidget', 'loadLessonColours', `Failed to load lesson colours: ${e}`, {
        error: e,
      });
      return [];
    }
  }

  async function fetchLessons(from: string, until: string): Promise<TimetableLesson[]> {
    const res = await seqtaFetch('/seqta/student/load/timetable?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { from, until, student: studentId },
    });
    const items = JSON.parse(res).payload.items;
    
    const colours = await loadLessonColours();
    
    return items.map((item: any): TimetableLesson => {
      const colourPrefName = `timetable.subject.colour.${item.code}`;
      const subjectColour = colours.find((c) => c.name === colourPrefName);
      const color = subjectColour ? subjectColour.value : 'var(--accent)';
      
      const date = parseDate(item.date);
      const dayIdx = getDayIndex(date);
      
      return {
        id: item.uid || `${item.date}-${item.from}-${item.code}`,
        code: item.code,
        description: item.description || item.code,
        date: item.date,
        from: item.from.substring(0, 5),
        until: item.until.substring(0, 5),
        staff: item.staff || '',
        room: item.room || '',
        colour: color,
        attendanceTitle: item.attendance?.label,
        programmeID: item.programmeID || 0,
        dayIdx,
        uid: item.uid,
      };
    });
  }

  async function loadLessons(forceReload = false) {
    loadingLessons = true;
    error = null;

    try {
      // Load a wide range (e.g., +/- 2 months from now) to populate the calendar
      // But if forceReload is true and we have a weekStart, load around that week
      let start: Date;
      let end: Date;
      
      if (forceReload && isTemporary && weekStart) {
        // Load 4 weeks before and after the current week
        start = new Date(weekStart);
        start.setDate(start.getDate() - 28);
        end = new Date(weekStart);
        end.setDate(end.getDate() + 28);
      } else {
        // Default: load a wide range from now
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      }

      const fromStr = formatDate(start);
      const untilStr = formatDate(end);
      const cacheKey = `timetable_${fromStr}_${untilStr}`;

      const items = await useDataLoader<TimetableLesson[]>({
        cacheKey,
        ttlMinutes: 30,
        context: 'timetable',
        functionName: 'loadLessons',
        fetcher: async () => {
          return await fetchLessons(fromStr, untilStr);
        },
        skipCache: forceReload, // Bypass cache when force reloading (back/forward navigation)
      });

      if (items) {
        lessons = items;
      }
    } catch (e) {
      logger.error('TimetableWidget', 'loadLessons', `Error loading timetable: ${e}`, { error: e });
      error = 'Failed to load timetable. Please try again.';
    } finally {
      loadingLessons = false;
    }
  }

  async function handlePrevWeek() {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() - 7);
    const newWeekStart = getMonday(newDate);
    weekStart = newWeekStart;
    selectedDate = newWeekStart;
    // Update URL for back/forward navigation
    if (isTemporary) {
      await updateUrlParam('date', formatDate(newWeekStart));
    }
  }

  async function handleNextWeek() {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + 7);
    const newWeekStart = getMonday(newDate);
    weekStart = newWeekStart;
    selectedDate = newWeekStart;
    // Update URL for back/forward navigation
    if (isTemporary) {
      await updateUrlParam('date', formatDate(newWeekStart));
    }
  }

  async function handleToday() {
    const today = new Date();
    const todayWeekStart = getMonday(today);
    weekStart = todayWeekStart;
    selectedDate = today;
    // Update URL for back/forward navigation
    if (isTemporary) {
      await updateUrlParam('date', formatDate(today));
    }
  }

  function handleViewModeChange(mode: 'week' | 'day' | 'month' | 'list') {
    viewMode = mode;
  }

  function handleLessonClick(lesson: TimetableLesson, element: HTMLElement) {
    selectedLesson = lesson;
    lessonAnchorElement = element;
    showLessonPopout = true;
  }

  function handleExportCsv() {
    const weekLessons = lessons.filter((lesson) => {
      const lessonDate = parseDate(lesson.date);
      return lessonDate >= weekStart && lessonDate <= new Date(weekStart.getTime() + 4 * 86400000);
    });
    if (exportToCSV(weekLessons, weekStart)) {
      toastStore.success($_('timetable.download_csv_success') || 'Timetable downloaded to Downloads');
    }
  }

  function handleExportPdf() {
    const weekLessons = lessons.filter((lesson) => {
      const lessonDate = parseDate(lesson.date);
      return lessonDate >= weekStart && lessonDate <= new Date(weekStart.getTime() + 4 * 86400000);
    });
    if (exportToPDF(weekLessons, weekStart)) {
      toastStore.success($_('timetable.download_pdf_success') || 'Timetable downloaded to Downloads');
    }
  }

  function handleExportIcal() {
    const weekLessons = lessons.filter((lesson) => {
      const lessonDate = parseDate(lesson.date);
      return lessonDate >= weekStart && lessonDate <= new Date(weekStart.getTime() + 4 * 86400000);
    });
    if (exportToiCal(weekLessons, weekStart)) {
      toastStore.success($_('timetable.download_ical_success') || 'Timetable downloaded to Downloads');
    }
  }

  // Reload lessons when reloadKey changes (for back/forward navigation)
  $effect(() => {
    if (reloadKey > 0 && isTemporary) {
      // Only reload if forceReload is true (back navigation)
      // Forward navigation will use existing cached data, no need to reload
      if (forceReload) {
        isLoadingFromNavigation = true;
        loadLessons(true).finally(() => {
          isLoadingFromNavigation = false;
        });
      }
      // If not forceReload, we don't need to reload - the existing lessons data should already cover the new week
    }
  });

  // Update weekStart when initialWeekStart changes
  $effect(() => {
    if (initialWeekStart && isTemporary) {
      const newWeekStart = getMonday(initialWeekStart);
      if (newWeekStart.getTime() !== weekStart.getTime()) {
        weekStart = newWeekStart;
        selectedDate = initialWeekStart;
      }
    }
  });

  onMount(() => {
    loadLessons();
  });
</script>

<div
  class="flex flex-col h-full w-full overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xs bg-white/80 dark:bg-zinc-800/30 border-zinc-300/50 dark:border-zinc-700/50"
  transition:fade={{ duration: 400 }}>
  {#if error}
    <div
      class="flex flex-col justify-center items-center py-16 px-4"
      transition:fade={{ duration: 200 }}>
      <div
        class="w-20 h-20 rounded-full border-4 animate-spin border-red-500/30 border-t-red-500 mb-4">
      </div>
      <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
        Failed to Load Timetable
      </h3>
      <p class="text-red-500 dark:text-red-400 mb-4 text-center max-w-md">{error}</p>
      <button
        class="px-6 py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 text-white rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-red-500/50 shadow-md"
        onclick={() => { loadLessons(); }}>
        Try Again
      </button>
    </div>
  {:else if loadingLessons && !isLoadingFromNavigation}
    <div
      class="flex flex-col justify-center items-center py-16 px-4"
      transition:fade={{ duration: 200 }}>
      <div
        class="w-20 h-20 rounded-full border-4 animate-spin border-blue-500/30 border-t-blue-500 mb-4">
      </div>
      <h3 class="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
        Loading Timetable
      </h3>
      <p class="text-zinc-600 dark:text-zinc-400">Please wait while we fetch your schedule...</p>
    </div>
  {:else}
    <!-- Header -->
    <TimetableHeader
      {weekStart}
      loadingLessons={loadingLessons && !isLoadingFromNavigation}
      {viewMode}
      onPrevWeek={handlePrevWeek}
      onNextWeek={handleNextWeek}
      onToday={handleToday}
      onViewModeChange={handleViewModeChange}
      onExportCsv={handleExportCsv}
      onExportPdf={handleExportPdf}
      onExportIcal={handleExportIcal} />

    <!-- View Content -->
    <div class="flex-1 min-h-0 overflow-hidden">
      {#if viewMode === 'week'}
        <TimetableWeekView
          {lessons}
          {weekStart}
          {selectedLesson}
          onLessonClick={handleLessonClick}
          {settings} />
      {:else if viewMode === 'day'}
        <TimetableDayView
          {lessons}
          selectedDate={selectedDate}
          {selectedLesson}
          onLessonClick={handleLessonClick}
          onDateChange={(date) => {
            selectedDate = date;
            weekStart = getMonday(date);
          }}
          {settings} />
      {:else if viewMode === 'month'}
        <TimetableMonthView
          {lessons}
          selectedDate={selectedDate}
          {selectedLesson}
          onLessonClick={handleLessonClick}
          onDateSelect={(date) => {
            selectedDate = date;
            weekStart = getMonday(date);
            viewMode = 'day';
          }}
          {settings} />
      {:else if viewMode === 'list'}
        <TimetableListView
          {lessons}
          {selectedLesson}
          onLessonClick={handleLessonClick}
          {settings} />
      {/if}
    </div>

    <!-- Lesson Popout -->
    <TimetableLessonPopout
      lesson={selectedLesson}
      open={showLessonPopout}
      anchorElement={lessonAnchorElement}
      onClose={() => {
        showLessonPopout = false;
        selectedLesson = null;
        lessonAnchorElement = null;
      }} />
  {/if}
</div>
