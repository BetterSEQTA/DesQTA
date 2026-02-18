<script lang="ts">
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import {
    Icon,
    BookOpen,
    DocumentText,
    AcademicCap,
    BuildingOffice,
    Clock,
  } from 'svelte-hero-icons';
  import type { TimetableLesson } from '$lib/types/timetable';
  import { formatDate, parseDate } from '$lib/utils/timetableUtils';
  import { tick } from 'svelte';

  interface Props {
    lesson: TimetableLesson | null;
    open: boolean;
    anchorElement: HTMLElement | null;
    onClose: () => void;
  }

  let { lesson, open = $bindable(false), anchorElement, onClose }: Props = $props();

  let popoutElement: HTMLDivElement | null = $state(null);
  let position = $state({ top: 0, left: 0 });
  let transitionDirection = $state<'up' | 'down'>('down');

  function formatLessonDate(date: string | Date): string {
    if (typeof date === 'string') {
      const d = parseDate(date);
      return d.toLocaleDateString('en-AU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return date.toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function updatePosition() {
    if (!anchorElement || !popoutElement) return;

    const anchorRect = anchorElement.getBoundingClientRect();
    const popoutRect = popoutElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const spacing = 8;
    const margin = 16;

    // Try positioning below first
    let top = anchorRect.bottom + spacing;
    let left = anchorRect.left;

    // Check if it fits below
    const fitsBelow = top + popoutRect.height <= viewportHeight - margin;
    let direction: 'up' | 'down' = 'down';

    // If it doesn't fit below, try above
    if (!fitsBelow) {
      top = anchorRect.top - popoutRect.height - spacing;
      direction = 'up';
      // If it doesn't fit above either, center it vertically in viewport
      if (top < margin) {
        top = Math.max(
          margin,
          Math.min(
            viewportHeight - popoutRect.height - margin,
            (viewportHeight - popoutRect.height) / 2,
          ),
        );
        direction = 'down'; // Default direction when centered
      }
    }

    // Align horizontally - align with left edge of anchor
    // If it doesn't fit to the right, align with right edge of anchor
    if (left + popoutRect.width > viewportWidth - margin) {
      left = anchorRect.right - popoutRect.width;
      // If still doesn't fit, center horizontally
      if (left < margin) {
        left = Math.max(
          margin,
          Math.min(
            viewportWidth - popoutRect.width - margin,
            (viewportWidth - popoutRect.width) / 2,
          ),
        );
      }
    }

    // Ensure it doesn't go off-screen on the left
    if (left < margin) {
      left = margin;
    }

    // Ensure it doesn't go off-screen on the right
    if (left + popoutRect.width > viewportWidth - margin) {
      left = viewportWidth - popoutRect.width - margin;
    }

    position = { top, left };
    transitionDirection = direction;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      popoutElement &&
      anchorElement &&
      !popoutElement.contains(event.target as Node) &&
      !anchorElement.contains(event.target as Node)
    ) {
      onClose();
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  $effect(() => {
    if (open && anchorElement) {
      // Wait for element to be rendered before calculating position
      tick().then(() => {
        if (popoutElement) {
          updatePosition();
        }
      });
    }
  });

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  });

  async function handleViewCourse() {
    if (!lesson) return;
    const formattedDate = formatDate(parseDate(lesson.date));
    await goto(`/courses?code=${lesson.code}&date=${formattedDate}`);
    onClose();
  }

  async function handleViewAssessments() {
    if (!lesson) return;
    const formattedDate = formatDate(parseDate(lesson.date));
    const lessonYear = parseDate(lesson.date).getFullYear();
    await goto(`/assessments?code=${lesson.code}&date=${formattedDate}&year=${lessonYear}`);
    onClose();
  }

</script>

{#if open && lesson && anchorElement}
  {#key lesson.id}
    <div
      bind:this={popoutElement}
      class="fixed z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 max-h-[calc(100vh-2rem)] overflow-y-auto"
      style="top: {position.top}px; left: {position.left}px; border-left: 4px solid {lesson.colour};"
      transition:fly={{
        y: transitionDirection === 'down' ? -10 : 10,
        duration: 200,
        easing: cubicInOut,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-popout-title">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <h2
          id="lesson-popout-title"
          class="text-base font-bold text-zinc-900 dark:text-white truncate">
          {lesson.description}
        </h2>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{lesson.code}</p>
      </div>

      <!-- Content - compact info grid -->
      <div class="p-3 space-y-2">
        <div class="flex items-center gap-2.5 text-sm">
          <div class="flex justify-center items-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-700 shrink-0">
            <Icon src={Clock} class="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-zinc-900 dark:text-white truncate">{formatLessonDate(lesson.date)}</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">{lesson.from} – {lesson.until}</p>
          </div>
        </div>

        {#if lesson.staff}
          <div class="flex items-center gap-2.5 text-sm">
            <div class="flex justify-center items-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-700 shrink-0">
              <Icon src={AcademicCap} class="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <p class="text-zinc-900 dark:text-white truncate flex-1">{lesson.staff}</p>
          </div>
        {/if}

        {#if lesson.room}
          <div class="flex items-center gap-2.5 text-sm">
            <div class="flex justify-center items-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-700 shrink-0">
              <Icon src={BuildingOffice} class="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <p class="text-zinc-900 dark:text-white">Room {lesson.room}</p>
          </div>
        {/if}

        {#if lesson.attendanceTitle && lesson.attendanceTitle.trim()}
          <div class="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <p class="text-xs font-medium text-amber-800 dark:text-amber-200">Attendance</p>
            <p class="text-xs text-amber-700 dark:text-amber-300 truncate">{lesson.attendanceTitle}</p>
          </div>
        {/if}
      </div>

      <!-- Actions - consolidated DesQTA style -->
      <div class="p-2 border-t border-zinc-200 dark:border-zinc-700 space-y-1">
        {#if lesson.programmeID !== 0}
          <button
            type="button"
            class="flex gap-3 items-center px-3 py-2.5 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 dark:text-zinc-200 hover:accent-bg hover:text-white group focus:outline-none focus:ring-2 accent-ring"
            onclick={handleViewCourse}>
            <div class="flex justify-center items-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white/20 shrink-0">
              <Icon src={BookOpen} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
            </div>
            <span class="font-medium text-sm">View Course</span>
          </button>
          <button
            type="button"
            class="flex gap-3 items-center px-3 py-2.5 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 dark:text-zinc-200 hover:accent-bg hover:text-white group focus:outline-none focus:ring-2 accent-ring"
            onclick={handleViewAssessments}>
            <div class="flex justify-center items-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white/20 shrink-0">
              <Icon src={DocumentText} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
            </div>
            <span class="font-medium text-sm">View Assessments</span>
          </button>
        {/if}
      </div>
    </div>
  {/key}
{/if}
