<script lang="ts">
  import { Button } from '../../ui';
  import { Icon, ChevronLeft, ChevronRight, CalendarDays, ViewColumns, Calendar, ListBullet } from 'svelte-hero-icons';
  import TimetableExport from './TimetableExport.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { _ } from '$lib/i18n';
  import { getMonday, formatDate } from '$lib/utils/timetableUtils';

  interface Props {
    weekStart: Date;
    loadingLessons: boolean;
    viewMode: 'week' | 'day' | 'month' | 'list';
    onPrevWeek: () => void;
    onNextWeek: () => void;
    onToday: () => void;
    onViewModeChange: (mode: 'week' | 'day' | 'month' | 'list') => void;
    onExportCsv: () => void;
    onExportPdf: () => void;
    onExportIcal: () => void;
  }

  let {
    weekStart,
    loadingLessons,
    viewMode,
    onPrevWeek,
    onNextWeek,
    onToday,
    onViewModeChange,
    onExportCsv,
    onExportPdf,
    onExportIcal,
  }: Props = $props();

  let showExportMenu = $state(false);
  let isMobile = $state(false);

  // Check if mobile
  function checkMobile() {
    const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
    const isNativeMobile = tauriPlatform === 'ios' || tauriPlatform === 'android';
    const mql = window.matchMedia('(max-width: 640px)');
    const isSmallViewport = mql.matches;
    isMobile = isNativeMobile || isSmallViewport;
  }

  function weekRangeLabel(): string {
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
    checkMobile();
    document.addEventListener('click', handleExportClickOutside);
    
    const mql = window.matchMedia('(max-width: 640px)');
    const onMqlChange = () => checkMobile();
    
    try {
      mql.addEventListener('change', onMqlChange);
    } catch {
      // Safari fallback
      // @ts-ignore
      mql.addListener(onMqlChange);
    }
    
    window.addEventListener('resize', checkMobile);
    
    return () => {
      document.removeEventListener('click', handleExportClickOutside);
      window.removeEventListener('resize', checkMobile);
      try {
        mql.removeEventListener('change', onMqlChange);
      } catch {
        // @ts-ignore
        mql.removeListener(onMqlChange);
      }
    };
  });

  const viewModeOptions = [
    { value: 'week' as const, label: $_('timetable.week') || 'Week', icon: ViewColumns },
    { value: 'day' as const, label: $_('timetable.day') || 'Day', icon: CalendarDays },
    { value: 'month' as const, label: $_('timetable.month') || 'Month', icon: Calendar },
    { value: 'list' as const, label: $_('timetable.list') || 'List', icon: ListBullet },
  ];
</script>

<div class="relative z-[100] flex justify-between items-center gap-4 px-4 py-4 border-b border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
  <!-- Week Navigation (hidden on mobile when in day view) -->
  {#if !(isMobile && viewMode === 'day')}
    <div class="flex gap-2 items-center">
    <Button
      variant="ghost"
      size="sm"
      icon={ChevronLeft}
      onclick={onPrevWeek}
      disabled={loadingLessons}
      ariaLabel={$_('timetable.previous_week') || 'Previous week'}
      class="w-10 h-10 rounded-xl bg-white/80 hover:bg-white dark:bg-zinc-700/80 dark:hover:bg-zinc-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" />
    
    <div class="text-center min-w-[200px]">
      <h1 class="text-xl font-bold text-zinc-900 dark:text-white">{weekRangeLabel()}</h1>
      <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
        {$_('timetable.weekly_schedule') || 'Weekly Schedule'}
      </p>
    </div>
    
    <Button
      variant="ghost"
      size="sm"
      icon={ChevronRight}
      onclick={onNextWeek}
      disabled={loadingLessons}
      ariaLabel={$_('timetable.next_week') || 'Next week'}
      class="w-10 h-10 rounded-xl bg-white/80 hover:bg-white dark:bg-zinc-700/80 dark:hover:bg-zinc-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" />
    
    <Button
      variant="ghost"
      size="sm"
      onclick={onToday}
      disabled={loadingLessons}
      class="px-4 py-2 rounded-xl bg-white/80 hover:bg-white dark:bg-zinc-700/80 dark:hover:bg-zinc-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95">
      {$_('timetable.today') || 'Today'}
    </Button>
  </div>
  {/if}

  <!-- View Mode Switcher -->
  <div class="flex gap-2 items-center">
    <span class="text-sm font-medium text-zinc-600 dark:text-zinc-400 mr-1 hidden sm:inline">
      {$_('timetable.view') || 'View:'}
    </span>
    <div class="flex gap-1 items-center bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl">
      {#each viewModeOptions as option}
        <button
          type="button"
          data-onboarding-view={option.value}
          class="flex gap-1.5 items-center px-3 py-1.5 rounded-lg transition-all duration-200 font-medium text-xs sm:text-sm {viewMode === option.value 
            ? 'bg-accent-500 text-white shadow-sm' 
            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'} hover:scale-105 active:scale-95"
          onclick={() => onViewModeChange(option.value)}
          aria-label={option.label}
          aria-pressed={viewMode === option.value}>
          <Icon src={option.icon} class="w-4 h-4" />
          <span class="hidden sm:inline">{option.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Export Button -->
  <TimetableExport 
    bind:showExportMenu={showExportMenu}
    onExportCsv={onExportCsv}
    onExportPdf={onExportPdf}
    onExportIcal={onExportIcal} />
</div>
