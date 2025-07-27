<script lang="ts">
  import { Icon, ArrowDownTray, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import TimetableExport from './TimetableExport.svelte';
  import { onMount } from 'svelte';

  const {
    weekStart,
    loadingLessons,
    onPrevWeek,
    onNextWeek,
    onExportCsv,
    onExportPdf,
    onExportIcal
  } = $props<{
    weekStart: Date;
    loadingLessons: boolean;
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onExportCsv: () => void;
    onExportPdf: () => void;
    onExportIcal: () => void;
  }>();

  let showExportMenu = $state(false);

  function weekRangeLabel() {
    const end = new Date(weekStart.valueOf() + 4 * 86400000);
    const startMonth = weekStart.toLocaleString('default', { month: 'short' });
    const endMonth = end.toLocaleString('default', { month: 'short' });
    const year = weekStart.getFullYear();
    
    if (startMonth === endMonth) {
      return `${weekStart.getDate()} - ${end.getDate()} ${startMonth} ${year}`;
    } else {
      return `${weekStart.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${year}`;
    }
  }

  function handleExportClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.export-dropdown-container')) {
      showExportMenu = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleExportClickOutside);
    return () => {
      document.removeEventListener('click', handleExportClickOutside);
    };
  });
</script>

<div class="flex justify-between items-center px-6 py-4 shadow-lg border-b border-slate-200 dark:border-slate-700" style="background: var(--background-color);">
  <div class="flex gap-4 items-center">
    <button
      class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 bg-white/80 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      on:click={onPrevWeek}
      disabled={loadingLessons}
      aria-label="Previous week">
      <Icon src={ChevronLeft} class="w-5 h-5 text-slate-700 dark:text-slate-300" />
    </button>
    
    <div class="text-center">
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">{weekRangeLabel()}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Weekly Schedule</p>
    </div>
    
    <button
      class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 bg-white/80 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      on:click={onNextWeek}
      disabled={loadingLessons}
      aria-label="Next week">
      <Icon src={ChevronRight} class="w-5 h-5 text-slate-700 dark:text-slate-300" />
    </button>
  </div>
  
  <TimetableExport 
    bind:showExportMenu
    {onExportCsv}
    {onExportPdf}
    {onExportIcal}
  />
</div> 