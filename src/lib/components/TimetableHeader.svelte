<script lang="ts">
  import { Icon, ArrowDownTray, ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import TimetableExport from './TimetableExport.svelte';
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui';

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
    <Button
      variant="ghost"
      size="sm"
      icon={ChevronLeft}
      onclick={onPrevWeek}
      disabled={loadingLessons}
      ariaLabel="Previous week"
      class="w-10 h-10 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 shadow-md hover:shadow-lg"
    />
    
    <div class="text-center">
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">{weekRangeLabel()}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Weekly Schedule</p>
    </div>
    
    <Button
      variant="ghost"
      size="sm"
      icon={ChevronRight}
      onclick={onNextWeek}
      disabled={loadingLessons}
      ariaLabel="Next week"
      class="w-10 h-10 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-700/80 dark:hover:bg-slate-600 shadow-md hover:shadow-lg"
    />
  </div>
  
  <TimetableExport 
    bind:showExportMenu
    {onExportCsv}
    {onExportPdf}
    {onExportIcal}
  />
</div> 