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
  import {
    getMonday,
    formatDate,
    parseDate,
    getDayIndex,
    collectSeqtaLoadTimetableRows,
    normalizeTimeToHm,
    mergeAdjacentTimetableLessons,
    normalizeSeqtaEventsPayloadRows,
    timetableLessonsFromSeqtaEventsRows,
    TIMETABLE_DEFAULT_LESSON_COLOUR,
  } from '../../utils/timetableUtils';
  import { authService } from '$lib/services/authService';
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
    hideHeader?: boolean; // If true, don't render header (for page-level header)
    /** Controlled mode: when provided, widget uses these instead of internal state */
    weekStart?: Date;
    viewMode?: 'week' | 'day' | 'month' | 'list';
    selectedDate?: Date;
    onWeekStartChange?: (d: Date) => void;
    onViewModeChange?: (mode: 'week' | 'day' | 'month' | 'list') => void;
    onSelectedDateChange?: (d: Date) => void;
    /** Called when widget is ready for page-level header (handlers + loading state) */
    onPageHeaderStateReady?: (state: {
      loadingLessons: boolean;
      onExportCsv: () => void;
      onExportPdf: () => void;
      onExportIcal: () => void;
    }) => void;
  }

  let {
    widget,
    isTemporary = false,
    initialWeekStart,
    initialViewMode,
    reloadKey = 0,
    forceReload = false,
    hideHeader = false,
    weekStart: controlledWeekStart,
    viewMode: controlledViewMode,
    selectedDate: controlledSelectedDate,
    onWeekStartChange,
    onViewModeChange,
    onSelectedDateChange,
    onPageHeaderStateReady,
  }: Props = $props();

  /** Resolved from session profile; defaults until `onMount` runs. */
  let effectiveStudentId = $state(69);

  let lessons = $state<TimetableLesson[]>([]);
  let lessonColours = $state<LessonColour[]>([]);
  let loadingLessons = $state(true);
  let isLoadingFromNavigation = $state(false); // Track if loading is from navigation (back/forward)
  let error = $state<string | null>(null);
  let internalWeekStart = $state(getMonday(new Date()));
  let internalSelectedDate = $state(new Date());
  let internalViewMode = $state<'week' | 'day' | 'month' | 'list'>('week');
  let selectedLesson = $state<TimetableLesson | null>(null);
  let showLessonPopout = $state(false);
  let lessonAnchorElement = $state<HTMLElement | null>(null);
  let lessonAnchorRect = $state<{
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null>(null);

  const isControlled = $derived(
    !!(controlledWeekStart !== undefined && controlledViewMode !== undefined),
  );
  const weekStart = $derived(
    isControlled && controlledWeekStart ? getMonday(controlledWeekStart) : internalWeekStart,
  );
  const selectedDate = $derived(
    isControlled && controlledSelectedDate ? controlledSelectedDate : internalSelectedDate,
  );
  const viewMode = $derived(
    isControlled && controlledViewMode !== undefined ? controlledViewMode : internalViewMode,
  );

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
    if (isControlled) return;
    if (initialViewMode) {
      internalViewMode = initialViewMode;
    } else if (!isTemporary && settings.viewMode) {
      internalViewMode = settings.viewMode;
    }
  });

  async function loadLessonColours(studentIdForPrefs: number): Promise<LessonColour[]> {
    const colourCacheKey = `lesson_colours_${studentIdForPrefs}`;
    const cachedColours = cache.get<LessonColour[]>(colourCacheKey);
    if (cachedColours) {
      lessonColours = cachedColours;
      return lessonColours;
    }

    try {
      const res = await seqtaFetch('/seqta/student/load/prefs?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { request: 'userPrefs', asArray: true, user: studentIdForPrefs },
      });
      lessonColours = JSON.parse(res).payload;
      cache.set(colourCacheKey, lessonColours, 30);
      return lessonColours;
    } catch (e) {
      logger.error('TimetableWidget', 'loadLessonColours', `Failed to load lesson colours: ${e}`, {
        error: e,
      });
      return [];
    }
  }

  async function fetchLessons(from: string, until: string, studentIdForApi: number): Promise<TimetableLesson[]> {
    const colours = await loadLessonColours(studentIdForApi);

    const [timetableMapped, eventsMapped] = await Promise.all([
      (async (): Promise<TimetableLesson[]> => {
        const res = await seqtaFetch('/seqta/student/load/timetable?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { from, until, student: studentIdForApi },
        });
        const parsed = JSON.parse(res) as { payload?: unknown };
        const payload = parsed.payload;
        if (payload && typeof payload === 'object' && import.meta.env.DEV) {
          const keys = Object.keys(payload as object);
          if (keys.some((k) => k !== 'items' && k !== 'cycles')) {
            logger.debug('TimetableWidget', 'fetchLessons', 'Timetable payload keys', {
              keys,
            });
          }
        }
        const rawRows = collectSeqtaLoadTimetableRows(payload);

        const mapped: TimetableLesson[] = [];
        for (const row of rawRows) {
          if (!row || typeof row !== 'object') continue;
          const item = row as Record<string, unknown>;
          if (
            typeof item.date !== 'string' ||
            typeof item.from !== 'string' ||
            typeof item.until !== 'string'
          ) {
            continue;
          }
          const code =
            typeof item.code === 'string' ? item.code : String(item.description ?? '').slice(0, 32) || '—';
          const colourPrefName = `timetable.subject.colour.${code}`;
          const subjectColour = colours.find((c) => c.name === colourPrefName);
          const color = subjectColour ? subjectColour.value : TIMETABLE_DEFAULT_LESSON_COLOUR;

          const dateObj = parseDate(item.date);
          const dayIdx = getDayIndex(dateObj);
          const uid = typeof item.uid === 'string' ? item.uid : undefined;
          const ci =
            typeof item.ci === 'number'
              ? item.ci
              : typeof item.ci === 'string'
                ? item.ci
                : undefined;
          const slotType = typeof item.type === 'string' ? item.type : undefined;
          const metaID =
            typeof item.metaID === 'number'
              ? item.metaID
              : typeof item.metaID === 'string'
                ? item.metaID
                : undefined;
          const fromHm = normalizeTimeToHm(item.from);
          const untilHm = normalizeTimeToHm(item.until);
          const fallbackIdParts = [
            item.date,
            fromHm,
            untilHm,
            code,
            slotType && slotType !== 'class' ? slotType : '',
            ci !== undefined ? String(ci) : '',
            metaID !== undefined ? String(metaID) : '',
          ].filter(Boolean);
          const lessonId =
            uid && uid.length > 0 ? uid : fallbackIdParts.join('-') || `${item.date}-${fromHm}`;

          mapped.push({
            id: lessonId,
            code,
            description: (typeof item.description === 'string' ? item.description : null) || code,
            date: item.date,
            from: fromHm,
            until: untilHm,
            staff: typeof item.staff === 'string' ? item.staff : '',
            room: typeof item.room === 'string' ? item.room : '',
            colour: color,
            attendanceTitle:
              item.attendance && typeof item.attendance === 'object' && item.attendance !== null
                ? (item.attendance as { label?: string }).label
                : undefined,
            programmeID: typeof item.programmeID === 'number' ? item.programmeID : 0,
            dayIdx,
            uid,
            slotType,
          });
        }
        return mapped;
      })(),
      (async (): Promise<TimetableLesson[]> => {
        try {
          const res = await seqtaFetch('/seqta/student/events/load?', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: {
              dateFrom: from,
              dateTo: until,
              person: studentIdForApi,
              personType: 'student',
            },
          });
          const raw = JSON.parse(res) as { payload?: unknown };
          const rows = normalizeSeqtaEventsPayloadRows(raw.payload);
          if (import.meta.env.DEV && rows.length > 0) {
            const first = rows[0];
            logger.debug('TimetableWidget', 'fetchLessons', 'Merged student/events/load', {
              rowCount: rows.length,
              firstKeys:
                typeof first === 'object' && first !== null ? Object.keys(first as object) : [],
            });
          }
          return timetableLessonsFromSeqtaEventsRows(rows, colours);
        } catch (e) {
          logger.debug(
            'TimetableWidget',
            'fetchLessons',
            'student/events/load failed; continuing with timetable only',
            { error: String(e) },
          );
          return [];
        }
      })(),
    ]);

    return [...timetableMapped, ...eventsMapped];
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
      const sid = effectiveStudentId;
      const cacheKey = `timetable_${sid}_${fromStr}_${untilStr}`;

      const items = await useDataLoader<TimetableLesson[]>({
        cacheKey,
        ttlMinutes: 30,
        context: 'timetable',
        functionName: 'loadLessons',
        fetcher: async () => {
          const mapped = await fetchLessons(fromStr, untilStr, sid);
          return mergeAdjacentTimetableLessons(mapped);
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
    if (isControlled && onWeekStartChange) {
      onWeekStartChange(newWeekStart);
      onSelectedDateChange?.(newWeekStart);
    } else {
      internalWeekStart = newWeekStart;
      internalSelectedDate = newWeekStart;
    }
    if (isTemporary) {
      await updateUrlParam('date', formatDate(newWeekStart));
    }
  }

  async function handleNextWeek() {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + 7);
    const newWeekStart = getMonday(newDate);
    if (isControlled && onWeekStartChange) {
      onWeekStartChange(newWeekStart);
      onSelectedDateChange?.(newWeekStart);
    } else {
      internalWeekStart = newWeekStart;
      internalSelectedDate = newWeekStart;
    }
    if (isTemporary) {
      await updateUrlParam('date', formatDate(newWeekStart));
    }
  }

  async function handleToday() {
    const today = new Date();
    const todayWeekStart = getMonday(today);
    if (isControlled && onWeekStartChange) {
      onWeekStartChange(todayWeekStart);
      onSelectedDateChange?.(today);
    } else {
      internalWeekStart = todayWeekStart;
      internalSelectedDate = today;
    }
    if (isTemporary) {
      await updateUrlParam('date', formatDate(today));
    }
  }

  function handleViewModeChange(mode: 'week' | 'day' | 'month' | 'list') {
    if (isControlled && onViewModeChange) {
      onViewModeChange(mode);
    } else {
      internalViewMode = mode;
    }
  }

  function handleLessonClick(
    lesson: TimetableLesson,
    element: HTMLElement,
    anchorRect?: {
      top: number;
      left: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    },
  ) {
    if (showLessonPopout && selectedLesson?.id === lesson.id) {
      showLessonPopout = false;
      selectedLesson = null;
      lessonAnchorElement = null;
      lessonAnchorRect = null;
      return;
    }

    selectedLesson = lesson;
    lessonAnchorElement = element;
    lessonAnchorRect = anchorRect ?? (() => {
      const r = element.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    })();
    showLessonPopout = true;
  }

  function handleExportCsv() {
    const weekLessons = lessons.filter((lesson) => {
      const lessonDate = parseDate(lesson.date);
      return lessonDate >= weekStart && lessonDate <= new Date(weekStart.getTime() + 4 * 86400000);
    });
    if (exportToCSV(weekLessons, weekStart)) {
      toastStore.success(
        $_('timetable.download_csv_success') || 'Timetable downloaded to Downloads',
      );
    }
  }

  function handleExportPdf() {
    const weekLessons = lessons.filter((lesson) => {
      const lessonDate = parseDate(lesson.date);
      return lessonDate >= weekStart && lessonDate <= new Date(weekStart.getTime() + 4 * 86400000);
    });
    if (exportToPDF(weekLessons, weekStart, { timeRange: settings.timeRange })) {
      toastStore.success(
        $_('timetable.download_pdf_success') || 'Timetable downloaded to Downloads',
      );
    }
  }

  function handleExportIcal() {
    const weekLessons = lessons.filter((lesson) => {
      const lessonDate = parseDate(lesson.date);
      return lessonDate >= weekStart && lessonDate <= new Date(weekStart.getTime() + 4 * 86400000);
    });
    if (exportToiCal(weekLessons, weekStart)) {
      toastStore.success(
        $_('timetable.download_ical_success') || 'Timetable downloaded to Downloads',
      );
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

  // Update weekStart when initialWeekStart changes (uncontrolled only)
  $effect(() => {
    const init = initialWeekStart;
    if (isControlled || !init || !isTemporary) return;
    const newWeekStart = getMonday(init);
    if (newWeekStart.getTime() !== internalWeekStart.getTime()) {
      internalWeekStart = newWeekStart;
      internalSelectedDate = init;
    }
  });

  $effect(() => {
    if (hideHeader && onPageHeaderStateReady) {
      onPageHeaderStateReady({
        loadingLessons: loadingLessons && !isLoadingFromNavigation,
        onExportCsv: handleExportCsv,
        onExportPdf: handleExportPdf,
        onExportIcal: handleExportIcal,
      });
    }
  });

  onMount(async () => {
    try {
      const u = await authService.loadUserInfo();
      if (u?.id != null && Number.isFinite(u.id)) {
        effectiveStudentId = u.id;
      } else {
        logger.warn(
          'TimetableWidget',
          'onMount',
          'UserInfo.id missing; timetable requests use fallback student id 69',
        );
      }
    } catch (e) {
      logger.warn('TimetableWidget', 'onMount', 'Could not load UserInfo for student id', {
        error: e,
      });
    }

    if (!isControlled && initialWeekStart) {
      internalWeekStart = getMonday(initialWeekStart);
      internalSelectedDate = initialWeekStart;
    }
    await loadLessons();
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
        onclick={() => {
          loadLessons();
        }}>
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
      <h3 class="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Loading Timetable</h3>
      <p class="text-zinc-600 dark:text-zinc-400">Please wait while we fetch your schedule...</p>
    </div>
  {:else}
    {#if !hideHeader}
      <!-- Header (inside widget card when not using page-level header) -->
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
    {/if}

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
          {selectedDate}
          {selectedLesson}
          onLessonClick={handleLessonClick}
          onDateChange={(date) => {
            if (isControlled && onSelectedDateChange && onWeekStartChange) {
              onSelectedDateChange(date);
              onWeekStartChange(getMonday(date));
            } else {
              internalSelectedDate = date;
              internalWeekStart = getMonday(date);
            }
          }}
          {settings} />
      {:else if viewMode === 'month'}
        <TimetableMonthView
          {lessons}
          {selectedDate}
          {selectedLesson}
          onLessonClick={handleLessonClick}
          onDateSelect={(date) => {
            if (isControlled && onSelectedDateChange && onWeekStartChange && onViewModeChange) {
              onSelectedDateChange(date);
              onWeekStartChange(getMonday(date));
              onViewModeChange('day');
            } else {
              internalSelectedDate = date;
              internalWeekStart = getMonday(date);
              internalViewMode = 'day';
            }
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

  {/if}
</div>

<!-- Keep popout outside the overflow-hidden widget shell -->
<TimetableLessonPopout
  lesson={selectedLesson}
  open={showLessonPopout}
  anchorElement={lessonAnchorElement}
  anchorRect={lessonAnchorRect}
  onClose={() => {
    showLessonPopout = false;
    selectedLesson = null;
    lessonAnchorElement = null;
    lessonAnchorRect = null;
  }} />
