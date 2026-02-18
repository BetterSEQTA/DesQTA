<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { TimetableLesson } from '$lib/types/timetable';
  import { isLessonActive } from '$lib/utils/timetableUtils';

  interface Props {
    lesson: TimetableLesson;
    onClick?: (lesson: TimetableLesson, element: HTMLElement) => void;
    showTeacher?: boolean;
    showRoom?: boolean;
    showAttendance?: boolean;
    density?: 'compact' | 'normal' | 'comfortable';
    overlap?: boolean;
  }

  let {
    lesson,
    onClick,
    showTeacher = true,
    showRoom = true,
    showAttendance = true,
    density = 'normal',
    overlap = false,
  }: Props = $props();

  let blockElement: HTMLButtonElement | null = $state(null);

  const active = $derived(isLessonActive(lesson));
  const densityClasses = $derived({
    compact: 'p-1.5 text-xs',
    normal: 'p-2 text-sm',
    comfortable: 'p-3 text-base',
  }[density]);

  function handleClick() {
    if (onClick && blockElement) {
      onClick(lesson, blockElement);
    }
  }
</script>

<button
  bind:this={blockElement}
  type="button"
  class="lesson-block flex flex-col justify-start rounded-xl border-l-4 shadow-lg hover:shadow-xl transition-all duration-200 bg-white dark:bg-zinc-800 group cursor-pointer select-none h-full w-full text-left {densityClasses}"
  style="border-color: {lesson.colour}; min-height: 54px;"
  class:active={active}
  class:overlap={overlap}
  onclick={handleClick}
  aria-label="Lesson: {lesson.description} from {lesson.from} to {lesson.until}">
  <!-- Subject and Time Header -->
  <div class="flex justify-between items-center mb-0.5">
    <h3
      class="font-bold text-zinc-900 dark:text-white break-words whitespace-normal flex-1 mr-2 truncate">
      {lesson.description}
    </h3>
    {#if !overlap}
      <span class="font-mono font-semibold text-zinc-700 dark:text-zinc-300 text-xs shrink-0">
        {lesson.from} - {lesson.until}
      </span>
    {/if}
  </div>

  <!-- Teacher and Room: always visible -->
  {#if showTeacher || showRoom}
    <div class="flex flex-col gap-0.5 mb-0.5">
      {#if showTeacher && lesson.staff}
        <span class="text-zinc-600 dark:text-zinc-400 break-words whitespace-normal truncate">
          {lesson.staff}
        </span>
      {/if}
      {#if showRoom && lesson.room}
        <span class="text-zinc-600 dark:text-zinc-400 break-words whitespace-normal truncate">
          Room {lesson.room}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Attendance: hidden by default, shown on hover/click -->
  {#if showAttendance && lesson.attendanceTitle && lesson.attendanceTitle.trim()}
    <div class="attendance-details mt-1 border-t border-zinc-200 dark:border-zinc-700 pt-1">
      <span class="text-xs italic text-amber-600 dark:text-amber-400 truncate">
        {lesson.attendanceTitle}
      </span>
    </div>
  {/if}

  <!-- Active indicator -->
  {#if active}
    <div class="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-pulse mt-1 mr-1"></div>
  {/if}
</button>

<style>
  .lesson-block {
    transform-origin: center center;
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .lesson-block:hover {
    transform: scale(1.02);
    z-index: 10;
  }

  .lesson-block:active {
    transform: scale(0.98);
  }

  .lesson-block.active {
    animation: pulse-border 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .lesson-block.overlap {
    min-width: 0;
  }

  .attendance-details {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition:
      max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .lesson-block:hover .attendance-details,
  .lesson-block:focus-within .attendance-details {
    max-height: 100px;
    opacity: 1;
  }

  @keyframes pulse-border {
    0%,
    100% {
      box-shadow:
        0 4px 6px -1px rgb(0 0 0 / 0.1),
        0 2px 4px -2px rgb(0 0 0 / 0.1),
        0 0 0 0 var(--border-color);
    }
    50% {
      box-shadow:
        0 4px 6px -1px rgb(0 0 0 / 0.1),
        0 2px 4px -2px rgb(0 0 0 / 0.1),
        0 0 0 3px color-mix(in srgb, var(--border-color) 30%, transparent);
    }
  }
</style>
