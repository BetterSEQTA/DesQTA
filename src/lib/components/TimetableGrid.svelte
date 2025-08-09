<script lang="ts">
  import TimetableLesson from './TimetableLesson.svelte';
  import { Icon, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import { onMount } from 'svelte';

  const {
    lessons,
    selectedDay,
    loadingLessons,
    error,
    onRetry
  } = $props<{
    lessons: any[];
    selectedDay: number;
    loadingLessons: boolean;
    error: string | null;
    onRetry: () => void;
  }>();

  let selectedDayState = $state(selectedDay);

  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let gridHeight = $state(800); // default fallback
  let gridContainer: HTMLDivElement | null = null;

  onMount(() => {
    if (gridContainer) {
      gridHeight = gridContainer.clientHeight;
    }
    const handleResize = () => {
      if (gridContainer) gridHeight = gridContainer.clientHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  function getLessonsFor(dayIdx: number) {
    return lessons.filter((l: any) => l.dayIdx === dayIdx).sort((a: any, b: any) => a.from.localeCompare(b.from));
  }

  function getLessonsGroupedByTime(dayIdx: number) {
    const dayLessons = getLessonsFor(dayIdx);
    const grouped: { [key: string]: any[] } = {};
    
    dayLessons.forEach((lesson: any) => {
      const timeKey = `${lesson.from}-${lesson.until}`;
      if (!grouped[timeKey]) {
        grouped[timeKey] = [];
      }
      grouped[timeKey].push(lesson);
    });
    
    return Object.entries(grouped).map(([timeKey, lessons]) => ({
      timeKey,
      lessons,
      from: lessons[0].from,
      until: lessons[0].until
    }));
  }

  function getUniqueTimes() {
    const times = Array.from(new Set(lessons.map((l: any) => l.from)));
    return times.sort((a: any, b: any) => (a as string).localeCompare(b as string));
  }

  function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function getTimeBounds() {
    if (!lessons.length) return { min: 8 * 60, max: 16 * 60 };
    const allTimes = lessons.flatMap((l: any) => [timeToMinutes(l.from), timeToMinutes(l.until)]);
    return {
      min: Math.min(...allTimes),
      max: Math.max(...allTimes),
    };
  }

  function timeToY(time: number, min: number, max: number): number {
    return ((time - min) / (max - min)) * gridHeight;
  }

  const timeBounds = $derived(getTimeBounds());

  function prevDay() {
    selectedDayState = selectedDayState === 1 ? 5 : selectedDayState - 1;
  }

  function nextDay() {
    selectedDayState = selectedDayState === 5 ? 1 : selectedDayState + 1;
  }

  function formatTime(time: string): string {
    const [hour, minute] = time.split(':');
    const hourNum = parseInt(hour);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum % 12 || 12;
    return `${displayHour}:${minute} ${ampm}`;
  }
</script>

<style>
  .timetable-header-row {
    min-height: 36px;
    height: 36px;
    font-size: 0.98rem;
    padding-top: 0;
    padding-bottom: 0;
  }
  .timetable-day-label {
    padding: 0.25rem 0.25rem 0.1rem 0.25rem;
    font-size: 0.98rem;
    font-weight: 600;
    line-height: 1.1;
  }
  .timetable-today-label {
    font-size: 0.7rem;
    color: var(--tw-prose-invert-bullets, #60a5fa);
    margin-top: 0.1rem;
    font-weight: 500;
    letter-spacing: 0.01em;
  }
  .timetable-time-label {
    width: 56px;
    min-width: 56px;
    max-width: 56px;
    padding: 0.1rem 0.1rem;
    font-size: 0.92rem;
  }
  .timetable-grid-cols {
    grid-template-columns: 56px repeat(5, 1fr);
    gap: 0.5rem;
  }
  .timetable-lesson-col {
    gap: 0.25rem;
    padding: 0.1rem 0.1rem;
  }
</style>

<div class="flex overflow-hidden flex-1 items-stretch">
  <div class="flex flex-col flex-1 w-full min-h-0 justify-stretch">
    <!-- Desktop Header Row -->
    <div
      class="timetable-header-row grid timetable-grid-cols w-full border-b border-slate-300 dark:border-slate-700" style="background: var(--background-color);">
      <div class="timetable-time-label bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700"></div>
      {#each dayLabels as day, index}
        <div
          class="timetable-day-label text-center bg-slate-100 dark:bg-slate-800 border-l border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white/90 {new Date().getDay() === index + (1 % 7) ? 'bg-blue-500 text-white font-bold shadow-lg' : ''} hidden sm:block">
          <div>{day}</div>
          {#if new Date().getDay() === index + (1 % 7)}
            <div class="timetable-today-label">Today</div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Mobile Day Navigation -->
    <div
      class="flex justify-between items-center px-4 py-2 border-b border-slate-300 sm:hidden dark:border-slate-700" style="background: var(--background-color);">
      <button
        class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 bg-white/80 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        on:click={prevDay}
        disabled={loadingLessons}
        aria-label="Previous day">
        <Icon src={ChevronLeft} class="w-4 h-4 text-slate-700 dark:text-slate-300" />
      </button>
      <div class="text-center">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">{dayLabels[selectedDayState - 1]}</h2>
        <p class="text-xs text-slate-600 dark:text-slate-400">
          {selectedDayState === Math.min(5, Math.max(1, new Date().getDay() === 0 ? 1 : new Date().getDay())) ? 'Today' : ''}
        </p>
      </div>
      <button
        class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 bg-white/80 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        on:click={nextDay}
        disabled={loadingLessons}
        aria-label="Next day">
        <Icon src={ChevronRight} class="w-4 h-4 text-slate-700 dark:text-slate-300" />
      </button>
    </div>

    <!-- Time grid and lessons -->
    {#if error}
      <div class="flex flex-col justify-center items-center py-16">
        <div class="w-20 h-20 rounded-full border-4 animate-spin border-red-500/30 border-t-red-500 mb-4"></div>
        <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Failed to Load Timetable</h3>
        <p class="text-red-500 dark:text-red-400 mb-4 text-center max-w-md">{error}</p>
        <button
          class="px-6 py-3 text-sm font-semibold bg-red-600 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400 text-white rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-md"
          on:click={onRetry}>
          Try Again
        </button>
      </div>
    {:else if loadingLessons}
      <div class="flex flex-col justify-center items-center py-16">
        <div class="w-20 h-20 rounded-full border-4 animate-spin border-blue-500/30 border-t-blue-500 mb-4"></div>
        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Loading Timetable</h3>
        <p class="text-slate-600 dark:text-slate-400">Please wait while we fetch your schedule...</p>
      </div>
    {:else if lessons.length}
      <div class="overflow-y-auto relative flex-1 w-full min-h-0">
        <div class="relative w-full h-full" bind:this={gridContainer}>
          <!-- Time labels -->
          <div class="absolute top-0 left-0 z-10 timetable-time-label h-full pointer-events-none">
            {#each getUniqueTimes() as time}
              <div
                class="absolute left-0 w-full border-t border-slate-300 dark:border-slate-700"
                style="top: {timeToY(
                  timeToMinutes(time as string),
                  timeBounds.min,
                  timeBounds.max,
                )}px;">
                <div class="flex items-center justify-center h-5">
                  <span class="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-1 rounded">
                    {formatTime(time as string)}
                  </span>
                </div>
              </div>
            {/each}
          </div>
          <!-- Day columns -->
          <div class="grid absolute top-0 right-0 left-[56px] grid-cols-1 h-full sm:grid-cols-5 gap-x-2 gap-y-1">
            {#each Array(5) as _, dayIdx}
              <div
                class="relative h-full border-l border-slate-300 dark:border-slate-700 timetable-lesson-col {dayIdx + 1 !== selectedDayState ? 'hidden sm:block' : ''}">
                {#each getLessonsGroupedByTime(dayIdx) as lessonGroup}
                  <div
                    class="absolute right-0 left-0"
                    style="
                    top: {timeToY(
                      timeToMinutes(lessonGroup.from),
                      timeBounds.min,
                      timeBounds.max,
                    )}px;
                    height: {timeToY(
                      timeToMinutes(lessonGroup.until),
                      timeBounds.min,
                      timeBounds.max,
                    ) -
                      timeToY(timeToMinutes(lessonGroup.from), timeBounds.min, timeBounds.max)}px;
                  ">
                    {#if lessonGroup.lessons.length === 1}
                      <TimetableLesson lesson={lessonGroup.lessons[0]} />
                    {:else}
                      <div class="flex gap-1 h-full p-1">
                        {#each lessonGroup.lessons as lesson}
                          <div class="flex-1 min-w-0">
                            <TimetableLesson lesson={lesson} overlap={true} />
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="flex flex-col justify-center items-center py-16">
        <div
          class="w-24 h-24 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-4xl shadow-[0_0_30px_rgba(99,102,241,0.3)] animate-pulse mb-6">
          📚
        </div>
        <h3 class="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
          No Lessons This Week
        </h3>
        <p class="text-slate-600 dark:text-slate-400 text-center max-w-md">
          It looks like there are no scheduled lessons for this week. Check back later or try a different week.
        </p>
      </div>
    {/if}
  </div>
</div> 