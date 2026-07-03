<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { invoke } from '@tauri-apps/api/core';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import {
    Icon,
    ChevronLeft,
    ChevronRight,
    AcademicCap,
    Clock,
    DocumentText,
    BookOpen,
    BuildingOffice,
    CalendarDays,
  } from 'svelte-hero-icons';
  import { Button } from '$lib/components/ui';
  import T from './T.svelte';
  import { _ } from '../i18n';
  import { TIMETABLE_DEFAULT_LESSON_COLOUR } from '../utils/timetableUtils';

  const studentId = 69; //! literally changes nothing but was used in the original seqta code.

  let currentSelectedDate: Date = $state(startOfLocalDay(new Date()));

  let lessons = $state<any[]>([]);
  let lessonColours = $state<any[]>([]);
  let loadingLessons = $state<boolean>(true);
  /** Rust setting `dashboard_today_schedule_fit_width` — equal-width cards, no horizontal scroll */
  let scheduleFitWidthInWidget = $state(true);

  let lessonInterval: ReturnType<typeof setInterval> | null = null;

  function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function daysFromToday(selected: Date): number {
    const today = startOfLocalDay(new Date());
    const target = startOfLocalDay(selected);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  let scheduleDayOffset = $derived(daysFromToday(currentSelectedDate));
  let isViewingToday = $derived(scheduleDayOffset === 0);

  let lessonsSubtitle = $derived.by(() => {
    if (scheduleDayOffset === 0) return $_('dashboard.todays_lessons') || "Today's Lessons";
    if (scheduleDayOffset === 1) return $_('dashboard.tomorrows_lessons') || "Tomorrow's Lessons";
    if (scheduleDayOffset === -1) return $_('dashboard.yesterdays_lessons') || "Yesterday's Lessons";
    return currentSelectedDate.toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  });

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function loadLessonColours() {
    if (lessonColours.length) return lessonColours;
    const res = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { request: 'userPrefs', asArray: true, user: studentId },
    });
    lessonColours = JSON.parse(res).payload;
    return lessonColours;
  }

  async function loadLessons() {
    loadingLessons = true;
    const dateStr = formatDate(currentSelectedDate);

    const res = await seqtaFetch('/seqta/student/load/timetable?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { from: dateStr, until: dateStr, student: studentId },
    });

    const colours = await loadLessonColours();

    lessons = JSON.parse(res)
      .payload.items.sort((a: any, b: any) => a.from.localeCompare(b.from))
      .map((lesson: any) => {
        const colourPrefName = `timetable.subject.colour.${lesson.code}`;
        const subjectColour = colours.find((c: any) => c.name === colourPrefName);

        lesson.colour = subjectColour ? `${subjectColour.value}` : TIMETABLE_DEFAULT_LESSON_COLOUR;

        lesson.from = lesson.from.substring(0, 5);
        lesson.until = lesson.until.substring(0, 5);

        lesson.attendanceTitle = lesson.attendance ? lesson.attendance.label : ' ';
        return lesson;
      });

    loadingLessons = false;

    if (lessonInterval) clearInterval(lessonInterval);
    checkCurrentLessons();
    lessonInterval = setInterval(checkCurrentLessons, 60_000);

    // Update Android home screen widget with next lesson (any day)
    try {
      const { updateNextLessonWidget } = await import('$lib/services/warmupService');
      await updateNextLessonWidget();
    } catch {
      /* ignore */
    }
  }

  function checkCurrentLessons() {
    const now = new Date();
    const selectedDay = startOfLocalDay(currentSelectedDate);
    lessons = lessons.map((l: any) => {
      const [sh, sm] = l.from.split(':').map(Number);
      const [eh, em] = l.until.split(':').map(Number);

      const start = new Date(selectedDay);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(selectedDay);
      end.setHours(eh, em, 0, 0);

      l.active = isViewingToday && now >= start && now <= end;
      return l;
    });
  }

  function prevDay() {
    const d = startOfLocalDay(currentSelectedDate);
    d.setDate(d.getDate() - 1);
    currentSelectedDate = d;
    loadLessons();
  }

  function nextDay() {
    const d = startOfLocalDay(currentSelectedDate);
    d.setDate(d.getDate() + 1);
    currentSelectedDate = d;
    loadLessons();
  }

  function onDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.value) {
      const [y, m, day] = target.value.split('-').map(Number);
      currentSelectedDate = new Date(y, m - 1, day);
      loadLessons();
    }
  }

  function goToToday() {
    currentSelectedDate = startOfLocalDay(new Date());
    loadLessons();
  }

  function formatLessonDate(date: string | Date): string {
    if (typeof date === 'string') {
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // Otherwise, parse and format
      return formatDate(new Date(date));
    }
    return formatDate(date);
  }

  onMount(async () => {
    try {
      const subset = await invoke<Record<string, unknown>>('get_settings_subset', {
        keys: ['dashboard_today_schedule_fit_width'],
      });
      scheduleFitWidthInWidget =
        (subset.dashboard_today_schedule_fit_width as boolean | undefined) ?? true;
    } catch {
      scheduleFitWidthInWidget = true;
    }
    await loadLessons();
  });

  onDestroy(() => {
    if (lessonInterval) clearInterval(lessonInterval);
  });
</script>

<div
  class="flex flex-col h-full w-full min-h-0 overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xs bg-white/80 dark:bg-zinc-800/30 border-zinc-300/50 dark:border-zinc-700/50">
  <div
    class="flex flex-col gap-3 sm:gap-4 justify-between items-start px-3 py-3 shrink-0 bg-linear-to-r border-b sm:flex-row sm:items-center sm:px-4 border-zinc-300/50 dark:border-zinc-700/50 from-zinc-100/70 dark:from-zinc-800/70 to-zinc-100/30 dark:to-zinc-800/30">
    <span class="text-xl font-semibold text-zinc-900 dark:text-white shrink-0">{lessonsSubtitle}</span>
    <!-- Mobile: date + Today + nav on one row for more vertical space for lessons -->
    <div class="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
      <!-- Date Picker + Today Button (side by side on mobile) -->
      <div class="flex flex-row items-center gap-2 flex-1 min-w-0 sm:flex-initial">
        <div class="relative flex-1 min-w-0 sm:w-auto">
          <input
            type="date"
            value={formatDate(currentSelectedDate)}
            onchange={onDateChange}
            class="w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 bg-white/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white border-zinc-300/50 dark:border-zinc-700/50 focus:outline-hidden focus:ring-2 focus:ring-accent-500 focus:border-accent-500 hover:border-accent-400 dark:hover:border-accent-400"
            title={$_('dashboard.select_date') || 'Select a date'} />
          <Icon
            src={CalendarDays}
            class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        </div>
        <button
          onclick={goToToday}
          disabled={isViewingToday}
          class="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border transition-all duration-200 text-zinc-700 dark:text-zinc-300 bg-zinc-200/70 dark:bg-zinc-800/70 hover:accent-bg-hover hover:text-white border-zinc-300/50 dark:border-zinc-700/50 hover:accent-border disabled:opacity-50 disabled:pointer-events-none disabled:hover:text-zinc-700 dark:disabled:hover:text-zinc-300"
          title={$_('dashboard.go_to_today') || 'Go to today'}>
          <T key="dashboard.today" fallback="Today" />
        </button>
      </div>
      <!-- Navigation Buttons -->
      <div class="flex gap-1 shrink-0">
        <button
          onclick={prevDay}
          class="flex justify-center items-center w-8 h-8 rounded-lg border transition-all duration-300 text-zinc-600 hover:accent-bg-hover dark:text-zinc-400 hover:text-white border-zinc-300/50 dark:border-zinc-700/50 hover:accent-border hover:accent-shadow"
          title={$_('dashboard.previous_day') || 'Previous day'}>
          <Icon src={ChevronLeft} class="w-4 h-4" />
        </button>
        <button
          onclick={nextDay}
          class="flex justify-center items-center w-8 h-8 rounded-lg border transition-all duration-300 text-zinc-600 hover:accent-bg-hover dark:text-zinc-400 hover:text-white border-zinc-300/50 dark:border-zinc-700/50 hover:accent-border hover:accent-shadow"
          title={$_('dashboard.next_day') || 'Next day'}>
          <Icon src={ChevronRight} class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>

  {#if loadingLessons}
    <div class="flex flex-col justify-center items-center py-16">
      <div
        class="w-16 h-16 rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500">
      </div>
      <p class="mt-4 text-zinc-600 dark:text-zinc-400">
        <T key="dashboard.loading_schedule" fallback="Loading your schedule..." />
      </p>
    </div>
  {:else if lessons.length === 0}
    <div
      class="flex flex-col gap-6 justify-center items-center px-4 py-16 w-full sm:flex-row sm:gap-12 sm:px-14 sm:py-20">
      <div
        class="flex justify-center items-center w-20 h-20 text-white rounded-full shadow-lg sm:w-28 sm:h-28 accent-bg">
        <span class="text-4xl sm:text-6xl">📚</span>
      </div>
      <div class="flex flex-col items-center">
        <p class="mb-2 text-2xl font-bold text-center text-zinc-800 dark:text-white">
          {#if isViewingToday}
            <T key="dashboard.no_lessons_today" fallback="No lessons today!" />
          {:else}
            <T key="dashboard.no_lessons_on_day" fallback="No lessons on this day" />
          {/if}
        </p>
        <p class="text-lg text-center text-zinc-600 dark:text-zinc-300">
          <T
            key="dashboard.enjoy_free_time"
            fallback="Enjoy your free time or check your other tasks." />
        </p>
      </div>
    </div>
  {:else}
    <div
      class="flex flex-1 min-h-0 w-full min-w-0 overflow-y-hidden {scheduleFitWidthInWidget
        ? 'gap-1.5 sm:gap-2 overflow-x-hidden'
        : 'gap-0 overflow-x-auto'}">
      {#each lessons as lesson, i}
        <div
          class="flex relative flex-col rounded-lg overflow-hidden border border-t-4 border-zinc-200/50 dark:border-zinc-600/40 group min-h-0 {scheduleFitWidthInWidget
            ? 'flex-1 min-w-0 basis-0'
            : 'w-64 sm:w-72 shrink-0'}"
          style="border-top-color: {lesson.colour}; box-shadow: inset 0px 10px 10px -10px {lesson.colour};">
          <div
            class="flex relative flex-col flex-1 backdrop-blur-xs min-h-0 {scheduleFitWidthInWidget
              ? 'gap-1.5 p-2 sm:p-3'
              : 'gap-2 p-3 sm:p-4'}">
            <div class="flex justify-between items-center gap-1 min-w-0">
              <span class="text-base font-bold truncate text-zinc-900 sm:text-lg dark:text-white min-w-0"
                >{lesson.description}</span>
              {#if lesson.active}
                <span
                  class="px-2.5 py-1 ml-2 text-xs font-medium text-white shrink-0 bg-linear-to-r from-green-500 to-emerald-600 rounded-full shadow-xs animate-gradient"
                  >Now</span>
              {/if}
            </div>
            <div
              class="flex items-center mt-1 text-sm text-zinc-700 sm:text-base dark:text-zinc-300">
              <Icon src={AcademicCap} class="mr-1.5 w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span class="truncate">{lesson.staff}</span>
            </div>
            <div class="flex items-center text-sm text-zinc-700 sm:text-base dark:text-zinc-300">
              <Icon src={BuildingOffice} class="mr-1.5 w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span class="truncate">{lesson.room}</span>
            </div>
            <div
              class="inline-flex items-center px-3 py-1.5 mt-3 mb-auto font-mono text-sm rounded-lg bg-zinc-200/50 dark:bg-zinc-800/50 w-fit">
              <Icon src={Clock} class="mr-1.5 w-4 h-4 text-indigo-400" />
              {lesson.from} – {lesson.until}
            </div>
            {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
              <div class="text-xs text-zinc-600 dark:text-zinc-400">
                {lesson.attendanceTitle}
              </div>
            {/if}

            {#if lesson.programmeID !== 0}
              {@const formattedDate = formatLessonDate(lesson.date)}
              {@const lessonYear = new Date(formattedDate).getFullYear()}
              <div class="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={DocumentText}
                  ariaLabel={$_('dashboard.view_assessment') || 'View Assessment'}
                  onclick={async () => {
                    await goto(
                      `/assessments?code=${lesson.code}&date=${formattedDate}&year=${lessonYear}`,
                    );
                  }}
                  class="w-9 h-9 p-0 bg-zinc-200/70 dark:bg-zinc-800/70 hover:bg-accent-500 hover:text-white border border-zinc-300/50 dark:border-zinc-700/50" />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={BookOpen}
                  ariaLabel={$_('dashboard.view_course') || 'View Course'}
                  onclick={async () => {
                    await goto(`/courses?code=${lesson.code}&date=${formattedDate}`);
                  }}
                  class="w-9 h-9 p-0 bg-zinc-200/70 dark:bg-zinc-800/70 hover:bg-accent-500 hover:text-white border border-zinc-300/50 dark:border-zinc-700/50" />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={CalendarDays}
                  ariaLabel={$_('dashboard.view_timetable') || 'View Timetable'}
                  onclick={async () => {
                    await goto(`/timetable?date=${formattedDate}`);
                  }}
                  class="w-9 h-9 p-0 bg-zinc-200/70 dark:bg-zinc-800/70 hover:bg-accent-500 hover:text-white border border-zinc-300/50 dark:border-zinc-700/50" />
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
