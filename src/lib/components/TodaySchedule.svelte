<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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

  const studentId = 69; //! literally changes nothing but was used in the original seqta code.

  let currentSelectedDate: Date = new Date();

  let lessons = $state<any[]>([]);
  let lessonColours = $state<any[]>([]);
  let loadingLessons = $state<boolean>(true);

  let lessonInterval: ReturnType<typeof setInterval> | null = null;

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

        lesson.colour = subjectColour ? `${subjectColour.value}` : `transparent`;

        lesson.from = lesson.from.substring(0, 5);
        lesson.until = lesson.until.substring(0, 5);

        lesson.attendanceTitle = lesson.attendance ? lesson.attendance.label : ' ';
        return lesson;
      });

    loadingLessons = false;

    if (lessonInterval) clearInterval(lessonInterval);
    checkCurrentLessons();
    lessonInterval = setInterval(checkCurrentLessons, 60_000);
  }

  function checkCurrentLessons() {
    const now = new Date();
    lessons = lessons.map((l: any) => {
      const [sh, sm] = l.from.split(':').map(Number);
      const [eh, em] = l.until.split(':').map(Number);

      const start = new Date(currentSelectedDate);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(currentSelectedDate);
      end.setHours(eh, em, 0, 0);

      l.active =
        now >= start && now <= end && now.toDateString() === currentSelectedDate.toDateString();
      return l;
    });
  }

  function prevDay() {
    currentSelectedDate = new Date(currentSelectedDate.valueOf() - 86_400_000);
    loadLessons();
  }

  function nextDay() {
    currentSelectedDate = new Date(currentSelectedDate.valueOf() + 86_400_000);
    loadLessons();
  }

  function onDateChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.value) {
      currentSelectedDate = new Date(target.value);
      loadLessons();
    }
  }

  function goToToday() {
    currentSelectedDate = new Date();
    loadLessons();
  }

  function lessonsSubtitle() {
    const today = new Date();
    const diff = ~~((today.getTime() - currentSelectedDate.getTime()) / 86_400_000);
    if (diff === 0) return "Today's Lessons";
    if (diff === -1) return "Tomorrow's Lessons";
    if (diff === 1) return "Yesterday's Lessons";
    return currentSelectedDate.toLocaleDateString('en-AU', {
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }

  onMount(async () => {
    await loadLessons();
  });

  onDestroy(() => {
    if (lessonInterval) clearInterval(lessonInterval);
  });
</script>

<div
  class="overflow-hidden rounded-2xl border shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
  <div
    class="flex flex-col gap-4 justify-between items-start px-3 py-3 bg-gradient-to-r border-b sm:flex-row sm:items-center sm:px-4 border-slate-300/50 dark:border-slate-700/50 from-slate-100/70 dark:from-slate-800/70 to-slate-100/30 dark:to-slate-800/30">
    <span class="text-xl font-semibold text-slate-900 dark:text-white">{lessonsSubtitle()}</span>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
      <!-- Date Picker -->
      <div class="relative w-full sm:w-auto">
        <input
          type="date"
          value={formatDate(currentSelectedDate)}
          onchange={onDateChange}
          class="w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border transition-all duration-200 bg-white/80 dark:bg-slate-800/80 text-slate-900 dark:text-white border-slate-300/50 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 hover:border-accent-400 dark:hover:border-accent-400"
          title="Select a date"
        />
        <Icon 
          src={CalendarDays} 
          class="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" 
        />
      </div>
      
      <!-- Today Button -->
      <button
        onclick={goToToday}
        class="w-full sm:w-auto px-3 py-1.5 text-sm font-medium rounded-lg border transition-all duration-200 text-slate-700 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800/70 hover:accent-bg-hover hover:text-white border-slate-300/50 dark:border-slate-700/50 hover:accent-border"
        title="Go to today">
        Today
      </button>
      
      <!-- Navigation Buttons -->
      <div class="flex gap-1 justify-center sm:justify-start">
        <button
          onclick={prevDay}
          class="flex justify-center items-center w-8 h-8 rounded-lg border transition-all duration-300 text-slate-600 hover:accent-bg-hover dark:text-slate-400 hover:text-white border-slate-300/50 dark:border-slate-700/50 hover:accent-border hover:accent-shadow"
          title="Previous day">
          <Icon src={ChevronLeft} class="w-4 h-4" />
        </button>
        <button
          onclick={nextDay}
          class="flex justify-center items-center w-8 h-8 rounded-lg border transition-all duration-300 text-slate-600 hover:accent-bg-hover dark:text-slate-400 hover:text-white border-slate-300/50 dark:border-slate-700/50 hover:accent-border hover:accent-shadow"
          title="Next day">
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
      <p class="mt-4 text-slate-600 dark:text-slate-400">Loading your schedule...</p>
    </div>
  {:else if lessons.length === 0}
    <div
      class="flex flex-col gap-6 justify-center items-center px-4 py-16 w-full sm:flex-row sm:gap-12 sm:px-14 sm:py-20">
      <div
        class="flex justify-center items-center w-20 h-20 text-white rounded-full shadow-lg sm:w-28 sm:h-28 accent-bg">
        <span class="text-4xl sm:text-6xl">📚</span>
      </div>
      <div class="flex flex-col items-center">
        <p class="mb-2 text-2xl font-bold text-center text-slate-800 dark:text-white">
          No lessons today!
        </p>
        <p class="text-lg text-center text-slate-600 dark:text-slate-300">
          Enjoy your free time or check your other tasks.
        </p>
      </div>
    </div>
  {:else}
    <div class="flex overflow-x-scroll">
      {#each lessons as lesson, i}
        <div
          class="flex relative flex-col w-full max-w-xs border-t-4 group"
          style="border-color: {lesson.colour}; box-shadow: inset 0px 10px 10px -10px {lesson.colour};">
          <div class="flex relative flex-col flex-1 gap-2 p-3 backdrop-blur-sm sm:p-4">
            <div class="flex justify-between items-center">
              <span
                class="text-base font-bold truncate text-slate-900 sm:text-lg dark:text-white"
                >{lesson.description}</span>
              {#if lesson.active}
                <span
                  class="px-2.5 py-1 ml-2 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-sm animate-gradient"
                  >Now</span>
              {/if}
            </div>
            <div
              class="flex items-center mt-1 text-sm text-slate-700 sm:text-base dark:text-slate-300">
              <Icon
                src={AcademicCap}
                class="mr-1.5 w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span class="truncate">{lesson.staff}</span>
            </div>
            <div
              class="flex items-center text-sm text-slate-700 sm:text-base dark:text-slate-300">
              <Icon
                src={BuildingOffice}
                class="mr-1.5 w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span class="truncate">{lesson.room}</span>
            </div>
            <div
              class="inline-flex items-center px-3 py-1.5 mt-3 mb-auto font-mono text-sm rounded-lg bg-slate-200/50 dark:bg-slate-800/50 w-fit">
              <Icon src={Clock} class="mr-1.5 w-4 h-4 text-indigo-400" />
              {lesson.from} – {lesson.until}
            </div>
            {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
              <div class="text-xs text-slate-600 dark:text-slate-400">
                {lesson.attendanceTitle}
              </div>
            {/if}

            {#if lesson.programmeID !== 0}
              <div class="flex gap-3">
                <button
                  class="flex justify-center items-center w-9 h-9 rounded-lg border transition-all duration-300 text-slate-700 bg-slate-200/70 dark:bg-slate-800/70 hover:accent-bg-hover dark:text-slate-300 hover:text-white border-slate-300/50 dark:border-slate-700/50 hover:accent-border"
                  aria-label="View Assessment"
                  onclick={() =>
                    (location.href = `/assessments?code=${lesson.code}&date=${lesson.date}`)}>
                  <Icon src={DocumentText} class="w-5 h-5" />
                </button>
                <button
                  class="flex justify-center items-center w-9 h-9 rounded-lg border transition-all duration-300 text-slate-700 bg-slate-200/70 dark:bg-slate-800/70 hover:accent-bg-hover dark:text-slate-300 hover:text-white border-slate-300/50 dark:border-slate-700/50 hover:accent-border"
                  aria-label="View Course"
                  onclick={() =>
                    (location.href = `/courses?code=${lesson.code}&date=${lesson.date}`)}>
                  <Icon src={BookOpen} class="w-5 h-5" />
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div> 