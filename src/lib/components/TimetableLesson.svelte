<script lang="ts">
  import { onMount } from 'svelte';
  const { lesson, overlap = false } = $props<{
    lesson: {
      description: string;
      staff: string;
      room: string;
      attendanceTitle?: string;
      from: string;
      until: string;
      colour: string;
    };
    overlap?: boolean;
  }>();

  let expanded = $state(false);
  let isTouch = false;

  // Detect touch device for click-to-expand
  onMount(() => {
    isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  function handleClick() {
    if (isTouch) expanded = !expanded;
  }
</script>

<style>
  .attendance-details {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    transition: max-height 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
  }
  .lesson-block:hover .attendance-details,
  .lesson-block:focus-within .attendance-details,
  .lesson-block.expanded .attendance-details {
    max-height: 100px;
    opacity: 1;
  }
</style>

<button
  type="button"
  class="lesson-block flex flex-col justify-start p-2 bg-white/95 backdrop-blur-sm rounded-xl border-l-4 shadow-lg hover:shadow-xl transition-all duration-200 dark:bg-slate-800/95 group cursor-pointer select-none h-full w-full text-left"
  style="border-color: {lesson.colour}; min-height: 54px;"
  class:expanded={expanded}
  onclick={handleClick}
  aria-label="Lesson: {lesson.description} from {lesson.from} to {lesson.until}"
>
  <!-- Subject and Time Header -->
  <div class="flex justify-between items-center mb-0.5">
    <h3 class="text-sm font-bold text-slate-900 dark:text-white break-words whitespace-normal flex-1 mr-2">
      {lesson.description}
    </h3>
    {#if !overlap}
    <span class="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
      {lesson.from} - {lesson.until}
    </span>
    {/if}
  </div>

  <!-- Teacher and Room: always visible -->
  <div class="flex flex-col gap-0.5 mb-0.5">
    {#if lesson.staff}
      <span class="text-xs text-slate-600 dark:text-slate-400 break-words whitespace-normal">
        {lesson.staff}
      </span>
    {/if}
    {#if lesson.room}
      <span class="text-xs text-slate-600 dark:text-slate-400 break-words whitespace-normal">
        Room {lesson.room}
      </span>
    {/if}
  </div>

  <!-- Attendance: hidden by default, shown on hover/click -->
  {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
    <div class="attendance-details mt-1 border-t border-slate-200 dark:border-slate-700 pt-1">
      <span class="text-xs italic text-amber-600 dark:text-amber-400 truncate">
        {lesson.attendanceTitle}
      </span>
    </div>
  {/if}
</button> 