<script lang="ts">
  // Svelte imports
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // $lib/ imports
  import { platformStore } from '$lib/stores/platform';
  import { useDataLoader } from '$lib/utils/useDataLoader';
  import { clickOutside } from '$lib/actions/clickOutside.js';
  import { Icon } from 'svelte-hero-icons';
  import { ChevronDown } from 'svelte-hero-icons';

  let isMobile = $derived($platformStore.isMobile);
  import { EmptyState, LoadingSpinner } from '$lib/components/ui';
  import { ExclamationTriangle, DocumentText } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '$lib/i18n';
  import { getUrlParam, updateUrlParams } from '$lib/utils/urlParams';

  // Relative imports
  import { seqtaFetch } from '../../utils/netUtil';
  import { sanitizeHtml } from '../../utils/sanitization';
  import { logger } from '../../utils/logger';

  interface Notice {
    id: number;
    title: string;
    subtitle: string;
    author: string;
    color: string;
    labelId: number;
    content: string;
  }
  interface Label {
    id: number;
    title: string;
    color: string;
  }

  let notices: Notice[] = $state([]);
  let labels: Label[] = $state([]);
  let selectedLabel: number | null = $state(null);
  let showLabelDropdown = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedDate = $state(new Date());

  // Notice row height for virtual scrolling (estimated)
  const NOTICE_ROW_HEIGHT = 420; // h-96 + gap-6

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function fetchLabels() {
    const data = await useDataLoader<Label[]>({
      cacheKey: 'notices_labels',
      ttlMinutes: 60,
      context: 'notices',
      functionName: 'fetchLabels',
      fetcher: async () => {
        const response = await seqtaFetch('/seqta/student/load/notices?', {
          method: 'POST',
          body: { mode: 'labels' },
        });
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        if (Array.isArray(data?.payload)) {
          return data.payload.map((l: any) => ({
            id: l.id,
            title: l.title,
            color: l.colour,
          }));
        }
        return [];
      },
      onDataLoaded: (data) => {
        labels = data;
      },
    });

    if (!data) {
      labels = [];
    }
  }

  async function fetchNotices() {
    loading = true;
    error = null;

    const key = `notices_${formatDate(selectedDate)}`;
    const { isOfflineMode } = await import('../../lib/utils/offlineMode');

    const data = await useDataLoader<Notice[]>({
      cacheKey: key,
      ttlMinutes: 30,
      context: 'notices',
      functionName: 'fetchNotices',
      fetcher: async () => {
        const response = await seqtaFetch('/seqta/student/load/notices?', {
          method: 'POST',
          body: { date: formatDate(selectedDate) },
        });
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        if (Array.isArray(data?.payload)) {
          return data.payload.map((n: any, i: number) => ({
            id: i + 1,
            title: n.title.replace(/\[\[theme::[^\]]+\]\]/g, ''), // remove all unnecessary theme strings
            subtitle: n.label_title.replace(/\[\[theme::[^\]]+\]\]/g, ''),
            author: n.staff,
            color: n.colour,
            labelId: n.label,
            content: n.contents.replace(/\[\[theme::[^\]]+\]\]/g, ''),
          }));
        }
        return [];
      },
      onDataLoaded: (data) => {
        notices = data;
        loading = false;
      },
      reportSyncState: (state) => {
        if (state === 'failed') loading = false;
      },
    });

    if (!data) {
      loading = false;
      const offline = await isOfflineMode();
      error = offline
        ? $_('notices.offline_no_cache') ||
          'No cached notices available. Please go online to fetch notices.'
        : $_('notices.failed_to_load') || 'Failed to load notices.';
      notices = [];
    }
  }

  async function updateDate(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedDate = new Date(input.value);
    await updateUrlParams({
      date: formatDate(selectedDate),
      category: selectedLabel ? selectedLabel.toString() : null,
    });
    fetchNotices();
  }

  onMount(async () => {
    // Read URL parameters
    const dateParam = getUrlParam('date');
    if (dateParam) {
      const parsedDate = new Date(dateParam);
      if (!isNaN(parsedDate.getTime())) {
        selectedDate = parsedDate;
      }
    }

    const categoryParam = getUrlParam('category');
    if (categoryParam) {
      const labelId = parseInt(categoryParam, 10);
      if (!isNaN(labelId)) {
        selectedLabel = labelId;
      }
    }

    await Promise.all([fetchLabels(), fetchNotices()]);

    // Check for item parameter to scroll to specific notice
    const itemParam = getUrlParam('item');
    if (itemParam && filteredNotices.length > 0) {
      const noticeId = parseInt(itemParam, 10);
      if (!isNaN(noticeId)) {
        setTimeout(() => {
          const notice = filteredNotices.find((n) => n.id === noticeId);
          if (notice) {
            const element = document.querySelector(`[data-notice-id="${notice.id}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 500);
      }
    }
  });

  // Get color for a notice from the label
  function getLabelColor(labelId: number): string {
    return labels.find((l) => l.id === labelId)?.color || '#910048';
  }
  function getLabelTitle(labelId: number): string {
    return labels.find((l) => l.id === labelId)?.title || '';
  }

  // Luminance check for text color
  function isColorDark(hex: string): boolean {
    hex = hex.replace('#', '');
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((x) => x + x)
        .join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Filter notices based on selected label
  const filteredNotices = $derived(
    notices.filter((n) => !selectedLabel || n.labelId === selectedLabel),
  );

  // Create unique key for notices to force re-render with animations
  const noticesKey = $derived.by(() => {
    const ids = filteredNotices.map((n) => n.id).join(',');
    return `${selectedDate.getTime()}-${selectedLabel}-${filteredNotices.length}-${ids}`;
  });
</script>

<div class="container max-w-none w-full p-5 mx-auto space-y-6">
  <div class="flex justify-between items-start">
    <div>
      <h1 class="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
        <T key="navigation.notices" fallback="Notices" />
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        <T key="notices.description" fallback="View notices and announcements" />
      </p>
    </div>
    <div class="flex gap-4 items-center shrink-0">
      <input
        type="date"
        value={formatDate(selectedDate)}
        onchange={updateDate}
        class="px-4 py-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-colors duration-200" />
    </div>
  </div>

  <!-- Label filter dropdown (same style as analytics) -->
  {#if labels.length > 0}
    <div class="flex flex-wrap items-center gap-4">
      <div class="relative" use:clickOutside={() => (showLabelDropdown = false)}>
        <button
          type="button"
          class="flex gap-2 items-center min-h-[44px] w-44 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 accent-ring transition-all duration-200"
          onclick={() => (showLabelDropdown = !showLabelDropdown)}
          aria-expanded={showLabelDropdown}
          aria-haspopup="listbox">
          <span class="truncate flex-1 text-left text-sm">
            {#if selectedLabel === null}
              <T key="notices.all" fallback="All" />
            {:else}
              {labels.find((l) => l.id === selectedLabel)?.title || ''}
            {/if}
          </span>
          <Icon
            src={ChevronDown}
            class="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-200 {showLabelDropdown
              ? 'rotate-180'
              : ''}" />
        </button>
        {#if showLabelDropdown}
          <div
            class="absolute left-0 z-50 mt-2 w-56 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            role="listbox"
            transition:fly={{ y: -6, duration: 150, easing: cubicOut }}>
            <button
              type="button"
              role="option"
              aria-selected={selectedLabel === null}
              class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors {selectedLabel ===
              null
                ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
              onclick={async () => {
                selectedLabel = null;
                showLabelDropdown = false;
                await updateUrlParams({
                  category: null,
                  date: formatDate(selectedDate),
                });
              }}>
              <span class="w-4 shrink-0 flex justify-center"
                >{selectedLabel === null ? '✓' : ''}</span>
              <T key="notices.all" fallback="All" />
            </button>
            {#each labels as label}
              {@const isSelected = selectedLabel === label.id}
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                class="flex gap-2 items-center w-full px-3 py-2 text-left text-sm transition-colors {isSelected
                  ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
                onclick={async () => {
                  selectedLabel = label.id;
                  showLabelDropdown = false;
                  await updateUrlParams({
                    category: label.id.toString(),
                    date: formatDate(selectedDate),
                  });
                }}>
                <span class="w-4 shrink-0 flex justify-center">{isSelected ? '✓' : ''}</span>
                <span class="truncate">{label.title}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center items-center py-12">
      <LoadingSpinner size="md" message={$_('notices.loading') || 'Loading notices...'} />
    </div>
  {:else if error}
    <EmptyState
      title={$_('notices.error_title') || 'Error loading notices'}
      message={error}
      icon={ExclamationTriangle}
      size="md" />
  {:else if filteredNotices.length === 0}
    <EmptyState
      title={$_('notices.no_notices_found') || 'No notices found'}
      message={$_('notices.no_notices_message') || 'No notices found for the selected criteria.'}
      icon={DocumentText}
      size="md" />
  {:else}
    <!-- Use regular grid -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#key noticesKey}
        {#each filteredNotices as notice, i}
          <div
            data-notice-id={notice.id}
            class="rounded-xl shadow-lg bg-white/10 text-(--text) border-t-8 flex flex-col h-96 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-xl notice-card-animate"
            style={`border-top-color: ${getLabelColor(notice.labelId)}; border-top-width: 8px; animation-delay: ${i * 50}ms;`}>
            <div
              class="flex overflow-y-auto flex-col flex-1 min-h-0 p-5 overscroll-contain"
              style="overscroll-behavior: contain; -webkit-overflow-scrolling: touch;">
              <h2 class="mb-1 text-2xl font-bold">{notice.title}</h2>
              <div
                class="mb-1 text-sm font-semibold"
                style={`color: ${getLabelColor(notice.labelId)}`}
                class:text-white={isColorDark(getLabelColor(notice.labelId))}>
                {getLabelTitle(notice.labelId)}
              </div>
              <div class="text-xs text-(--text-muted) mb-2 uppercase tracking-wide">
                {notice.author}
              </div>
              <div class="flex-1 text-base">{@html sanitizeHtml(notice.content)}</div>
            </div>
          </div>
        {/each}
      {/key}
    </div>
  {/if}
</div>

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .notice-card-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
