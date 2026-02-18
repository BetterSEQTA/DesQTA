<script lang="ts">
  import { Icon, ArrowDownTray, TableCells, DocumentText, CalendarDays } from 'svelte-hero-icons';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { _ } from '$lib/i18n';

  interface Props {
    showExportMenu: boolean;
    onExportCsv: () => void;
    onExportPdf: () => void;
    onExportIcal: () => void;
  }

  let { showExportMenu = $bindable(false), onExportCsv, onExportPdf, onExportIcal }: Props = $props();
</script>

<div class="inline-block relative text-left export-dropdown-container">
  <button
    class="group flex gap-2 items-center px-4 py-2 rounded-xl border transition-all duration-200 bg-white hover:accent-bg hover:text-white dark:bg-zinc-700 dark:hover:accent-bg border-zinc-200 dark:border-zinc-600 hover:border-transparent hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring shadow-sm"
    onclick={() => (showExportMenu = !showExportMenu)}
    aria-label={$_('timetable.export_options') || 'Export options'}
    aria-expanded={showExportMenu}>
    <Icon src={ArrowDownTray} class="w-4 h-4 text-zinc-700 dark:text-zinc-300 group-hover:text-white" />
    <span class="font-medium text-sm text-zinc-900 dark:text-white group-hover:text-white">
      {$_('timetable.export') || 'Export'}
    </span>
  </button>

  {#if showExportMenu}
    <div
      class="absolute right-0 z-50 mt-2 w-52 rounded-2xl border shadow-2xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
      transition:fly={{ y: -8, duration: 200, opacity: 0, easing: cubicInOut }}>
      <div class="p-2">
        <button
          class="flex gap-3 items-center px-3 py-2.5 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 dark:text-zinc-200 hover:accent-bg hover:text-white group focus:outline-none focus:ring-2 accent-ring"
          onclick={() => {
            showExportMenu = false;
            onExportCsv();
          }}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white/20 shrink-0">
            <Icon src={TableCells} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
          </div>
          <span class="font-medium text-sm truncate">
            {$_('timetable.export_csv') || 'Export as CSV'}
          </span>
        </button>

        <button
          class="flex gap-3 items-center px-3 py-2.5 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 dark:text-zinc-200 hover:accent-bg hover:text-white group focus:outline-none focus:ring-2 accent-ring"
          onclick={() => {
            showExportMenu = false;
            onExportPdf();
          }}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white/20 shrink-0">
            <Icon src={DocumentText} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
          </div>
          <span class="font-medium text-sm truncate">
            {$_('timetable.export_pdf') || 'Export as PDF'}
          </span>
        </button>

        <button
          class="flex gap-3 items-center px-3 py-2.5 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 dark:text-zinc-200 hover:accent-bg hover:text-white group focus:outline-none focus:ring-2 accent-ring"
          onclick={() => {
            showExportMenu = false;
            onExportIcal();
          }}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 group-hover:bg-white/20 shrink-0">
            <Icon src={CalendarDays} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
          </div>
          <span class="font-medium text-sm truncate">
            {$_('timetable.export_ical') || 'Export as iCal'}
          </span>
        </button>
      </div>
    </div>
  {/if}
</div>
