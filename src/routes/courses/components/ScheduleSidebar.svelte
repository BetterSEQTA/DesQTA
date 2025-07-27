<script lang="ts">
  import { formatLessonDate, formatTime, isLessonReleased } from '../utils';
  import type { TermSchedule, Lesson, CoursePayload } from '../types';
  import { onMount, createEventDispatcher } from 'svelte';

  let {
    schedule = [],
    selectedLesson = null,
    showingOverview = false,
    coursePayload = null,
    onSelectLesson,
    onSelectOverview,
    onClose,
    closeOnMainSidebar = false
  } = $props();

  const dispatch = createEventDispatcher();

  let isMobile = $state(false);
  onMount(() => {
    const checkMobile = () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
      if (tauri_platform == "ios" || tauri_platform == "android") {
        isMobile = true;
      } else {
        isMobile = false;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Add a reactive prop to listen for main sidebar close
  $effect(() => {
    if (closeOnMainSidebar && isMobile) {
      dispatch('close');
    }
  });

  let filteredSchedule = $derived(
    schedule
      .map((termSchedule) => ({
        ...termSchedule,
        l: termSchedule.l.filter(isLessonReleased),
      }))
      .filter((termSchedule) => termSchedule.l.length > 0),
  );

  function findTodayLesson() {
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];

    // First, look for lessons happening today that are released
    for (const termSchedule of filteredSchedule) {
      for (let lessonIndex = 0; lessonIndex < termSchedule.l.length; lessonIndex++) {
        const lesson = termSchedule.l[lessonIndex];
        const lessonDate = new Date(lesson.d).toISOString().split('T')[0];

        if (lessonDate === todayDateString) {
          const lessonDateTime = new Date(`${lesson.d}T${lesson.s}`);
          const lessonEndTime = new Date(`${lesson.d}T${lesson.e}`);

          // If lesson is currently happening or hasn't started yet today
          if (lessonEndTime >= today) {
            // Find the original termSchedule and lessonIndex from the unfiltered schedule
            const originalTermSchedule = schedule.find(
              (ts) => ts.t === termSchedule.t && ts.w === termSchedule.w,
            );
            if (originalTermSchedule) {
              const originalLessonIndex = originalTermSchedule.l.findIndex((l: Lesson) => l === lesson);
              if (originalLessonIndex >= 0) {
                return {
                  termSchedule: originalTermSchedule,
                  lesson,
                  lessonIndex: originalLessonIndex,
                  type: 'today',
                };
              }
            }
          }
        }
      }
    }

    // If no lesson found for today, try to find next upcoming released lesson
    for (const termSchedule of filteredSchedule) {
      for (let lessonIndex = 0; lessonIndex < termSchedule.l.length; lessonIndex++) {
        const lesson = termSchedule.l[lessonIndex];
        const lessonDateTime = new Date(`${lesson.d}T${lesson.s}`);

        if (lessonDateTime > today) {
          // Find the original termSchedule and lessonIndex
          const originalTermSchedule = schedule.find(
            (ts) => ts.t === termSchedule.t && ts.w === termSchedule.w,
          );
          if (originalTermSchedule) {
            const originalLessonIndex = originalTermSchedule.l.findIndex((l: Lesson) => l === lesson);
            if (originalLessonIndex >= 0) {
              return {
                termSchedule: originalTermSchedule,
                lesson,
                lessonIndex: originalLessonIndex,
                type: 'upcoming',
              };
            }
          }
        }
      }
    }

    // If no upcoming lessons, find the last (most recent) lesson
    let lastLesson = null;
    for (const termSchedule of filteredSchedule) {
      for (let lessonIndex = 0; lessonIndex < termSchedule.l.length; lessonIndex++) {
        const lesson = termSchedule.l[lessonIndex];
        const originalTermSchedule = schedule.find(
          (ts) => ts.t === termSchedule.t && ts.w === termSchedule.w,
        );
        if (originalTermSchedule) {
          const originalLessonIndex = originalTermSchedule.l.findIndex((l: Lesson) => l === lesson);
          if (originalLessonIndex >= 0) {
            lastLesson = {
              termSchedule: originalTermSchedule,
              lesson,
              lessonIndex: originalLessonIndex,
              type: 'last',
            };
          }
        }
      }
    }

    return lastLesson;
  }

  function jumpToToday() {
    const todayLesson = findTodayLesson();
    if (todayLesson) {
      onSelectLesson({
        termSchedule: todayLesson.termSchedule,
        lesson: todayLesson.lesson,
        lessonIndex: todayLesson.lessonIndex,
      });
    }
  }

  let jumpTarget = $derived(findTodayLesson());

  function getJumpButtonText(target: any) {
    if (!target) return { title: '', subtitle: '' };

    switch (target.type) {
      case 'today':
        return {
          title: "Jump to: Today's Lesson",
          subtitle: target.lesson.p,
        };
      case 'upcoming':
        return {
          title: 'Jump to: Next Lesson',
          subtitle: `${target.lesson.p} ${formatLessonDate(target.lesson.d)}`,
        };
      case 'last':
        return {
          title: 'Jump to: Latest Lesson',
          subtitle: `${target.lesson.p} ${formatLessonDate(target.lesson.d)}`,
        };
      default:
        return { title: '', subtitle: '' };
    }
  }
</script>

<aside
  class="flex flex-col w-64 h-[calc(100vh-4rem)] border-r bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-slate-300/50 dark:border-slate-700/50 {isMobile ? 'fixed inset-0 z-40 w-full' : ''}">
  <div class="px-4 py-3 border-b border-slate-300/50 dark:border-slate-700/50 shrink-0">
    <div class="flex justify-between items-center">
      {#if isMobile}
        <div class="flex flex-col items-center w-full mb-2">
          <button
            onclick={() => dispatch('close')}
            class="mb-2 p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 text-2xl"
            aria-label="Back"
          >
            <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
        </div>
      {/if}
      <h3 class="text-lg font-bold text-slate-900 dark:text-white">Course Content</h3>
      {#if isMobile}
        <button
          onclick={() => dispatch('close')}
          class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
          aria-label="Close sidebar"
        >
          ✕
        </button>
      {/if}
    </div>
  </div>
  <div class="overflow-y-auto flex-1 min-h-0">
    <div
      class="z-10 border-b bg-white/90 dark:bg-slate-800/80 border-slate-300/50 dark:border-slate-700/50">
      <button
        class="overflow-hidden px-4 py-3 w-full text-left border-l-2 border-transparent transition-all duration-200 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:accent-border group"
        onclick={onSelectOverview}>
        <div
          class="text-sm font-medium transition-all duration-300 text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1">
          📚 Course Overview
        </div>
        <div
          class="mt-1 text-xs transition-all duration-300 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300 group-hover:translate-x-1">
          Main course content and resources
        </div>
      </button>

      {#if jumpTarget}
        {@const buttonText = getJumpButtonText(jumpTarget)}
        <button
          class="overflow-hidden px-4 py-3 w-full text-left border-l-2 border-transparent transition-all duration-200 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:accent-border group"
          onclick={jumpToToday}>
          <div
            class="text-sm font-medium transition-all duration-300 text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1">
            🕐 {buttonText.title}
          </div>
          <div
            class="mt-1 text-xs transition-all duration-300 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300 group-hover:translate-x-1">
            {buttonText.subtitle}
          </div>
        </button>
      {/if}
    </div>

    {#each filteredSchedule as termSchedule, i}
      <div class="mb-4">
        <div
          class="px-4 py-2 text-sm font-semibold text-white border backdrop-blur-sm transition-all duration-300 accent-bg border-slate-300/50 dark:border-slate-700/50 group-hover:brightness-110">
          Term {termSchedule.t} - Week {termSchedule.w}
        </div>
        {#each termSchedule.l as lesson, lessonIndex}
          {@const currentLessonContent = coursePayload?.w?.[termSchedule.n]?.[lessonIndex]}
          <button
            class="w-full px-4 py-2 text-left text-sm hover:bg-white/50 dark:hover:bg-slate-800/50 border-l-2 border-transparent hover:accent-border transition-all duration-200 overflow-hidden group {selectedLesson ===
              lesson && !showingOverview
              ? 'bg-white/50 dark:bg-slate-800/50 accent-border'
              : ''}"
            onclick={() => onSelectLesson({ termSchedule, lesson, lessonIndex })}>
            <div
              class="text-sm font-medium transition-all duration-300 text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1">
              {lesson.p}
              {formatLessonDate(lesson.d)}
            </div>
            <div
              class="mt-1 text-xs transition-all duration-300 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300 group-hover:translate-x-1">
              {#if currentLessonContent?.t}
                {currentLessonContent.t}
              {:else}
                {formatTime(lesson.s)}-{formatTime(lesson.e)}
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/each}

    {#if filteredSchedule.length === 0}
      <div class="px-4 py-8 text-sm text-center text-slate-600 dark:text-slate-400">
        <div
          class="mx-auto mb-4 w-16 h-16 rounded-full border-4 animate-spin border-accent/30 border-t-accent">
        </div>
        No released lessons available
      </div>
    {/if}
  </div>
</aside>
