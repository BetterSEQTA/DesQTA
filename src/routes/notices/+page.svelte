<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import VirtualList from '$lib/components/VirtualList.svelte';

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
    try {
      const memCached = cache.get<Label[]>('notices_labels');
      if (memCached) {
        console.info('[CACHE] notices_labels hit (memory)', { count: memCached.length });
        labels = memCached;
        return;
      }
      
      const idbCached = await getWithIdbFallback<Label[]>('notices_labels', 'notices_labels', () => null);
      if (idbCached) {
        console.info('[CACHE] notices_labels hit (IndexedDB fallback)', { count: idbCached.length });
        labels = idbCached;
        // Restore to memory cache with remaining TTL estimation
        cache.set('notices_labels', idbCached, 60);
        return;
      }
      
      console.info('[CACHE] notices_labels miss - fetching from API');
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { mode: 'labels' },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (Array.isArray(data?.payload)) {
        labels = data.payload.map((l: any) => ({
          id: l.id,
          title: l.title,
          color: l.colour,
        }));
        cache.set('notices_labels', labels, 60); // 60 min TTL
        await setIdb('notices_labels', labels);
        console.info('[CACHE] notices_labels stored (mem+idb)', { count: labels.length });
      } else {
        labels = [];
      }
    } catch (e) {
      console.error('[CACHE] notices_labels fetch failed', e);
      labels = [];
    }
  }

  async function fetchNotices() {
    loading = true;
    error = null;
    try {
      const key = `notices_${formatDate(selectedDate)}`;
      
      const memCached = cache.get<Notice[]>(key);
      if (memCached) {
        console.info('[CACHE] notices hit (memory)', { key, count: memCached.length });
        notices = memCached;
        loading = false;
        return;
      }
      
      const idbCached = await getWithIdbFallback<Notice[]>(key, key, () => null);
      if (idbCached) {
        console.info('[CACHE] notices hit (IndexedDB fallback)', { key, count: idbCached.length });
        notices = idbCached;
        // Restore to memory cache with remaining TTL estimation
        cache.set(key, idbCached, 30);
        loading = false;
        return;
      }
      
      console.info('[CACHE] notices miss - fetching from API', { key, date: formatDate(selectedDate) });
      const response = await seqtaFetch('/seqta/student/load/notices?', {
        method: 'POST',
        body: { date: formatDate(selectedDate) },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (Array.isArray(data?.payload)) {
        notices = data.payload.map((n: any, i: number) => ({
          id: i + 1,
          title: n.title,
          subtitle: n.label_title,
          author: n.staff,
          color: n.colour,
          labelId: n.label,
          content: n.contents,
        }));
        cache.set(key, notices, 30); // 30 min TTL
        await setIdb(key, notices);
        console.info('[CACHE] notices stored (mem+idb)', { key, count: notices.length });
      } else {
        notices = [];
      }
    } catch (e) {
      console.error('[CACHE] notices fetch failed', { key: `notices_${formatDate(selectedDate)}`, error: e });
      error = 'Failed to load notices.';
      notices = [];
    } finally {
      loading = false;
    }
  }

  function updateDate(event: Event) {
    const input = event.target as HTMLInputElement;
    selectedDate = new Date(input.value);
    fetchNotices();
  }

  onMount(async () => {
    await Promise.all([fetchLabels(), fetchNotices()]);
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
  const filteredNotices = $derived(notices.filter((n) => !selectedLabel || n.labelId === selectedLabel));
</script>

<div class="p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Notices</h1>
    <div class="flex gap-4 items-center">
      <input
        type="date"
        value={formatDate(selectedDate)}
        onchange={updateDate}
        class="px-4 py-2 bg-white rounded-lg border text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  </div>

  <!-- Label filter dropdown -->
  {#if labels.length > 0}
    <div class="flex gap-2 items-center mb-6">
      <label for="label-select" class="font-semibold text-sm mr-2">Label:</label>
      <select
        id="label-select"
        class="px-4 py-2 rounded-lg border text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        bind:value={selectedLabel}
        onchange={(e) => {
          const target = e.target as HTMLSelectElement;
          selectedLabel = target.value === '' ? null : +target.value;
        }}>
        <option value="">All</option>
        {#each labels as label}
          <option value={label.id}>{label.title}</option>
        {/each}
      </select>
    </div>
  {/if}

  {#if loading}
    <div class="p-8 text-center text-[var(--text-muted)]">Loading notices...</div>
  {:else if error}
    <div class="p-8 text-center text-red-500">{error}</div>
  {:else if filteredNotices.length === 0}
    <div class="p-8 text-center text-[var(--text-muted)]">No notices found for the selected criteria.</div>
  {:else if filteredNotices.length > 20}
    <!-- Use virtual scrolling for large lists with grid layout -->
    <div class="w-full">
      <!-- Group notices into rows for grid layout -->
      {#if filteredNotices.length > 0}
        {@const noticesPerRow = 3}
        {@const rows = Math.ceil(filteredNotices.length / noticesPerRow)}
        {@const rowHeight = 420} <!-- h-96 + gap -->
        <VirtualList
          items={Array.from({ length: rows }, (_, i) => filteredNotices.slice(i * noticesPerRow, (i + 1) * noticesPerRow))}
          itemHeight={rowHeight}
          containerHeight={800}
          keyFunction={(row, index) => `row-${index}`}
          class="w-full">
          {#snippet children({ item: row, index })}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {#each row as notice}
              <div
                class="rounded-xl shadow-lg bg-white/10 text-[var(--text)] border-t-8 flex flex-col h-96"
                style={`border-top-color: ${getLabelColor(notice.labelId)}; border-top-width: 8px;`}>
                <div class="flex overflow-y-auto flex-col flex-1 p-5">
                  <h2 class="mb-1 text-2xl font-bold">{notice.title}</h2>
                  <div
                    class="mb-1 text-sm font-semibold"
                    style={`color: ${getLabelColor(notice.labelId)}`}
                    class:text-white={isColorDark(getLabelColor(notice.labelId))}>
                    {getLabelTitle(notice.labelId)}
                  </div>
                  <div class="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                    {notice.author}
                  </div>
                  <div class="flex-1 text-base">{@html notice.content}</div>
                </div>
              </div>
            {/each}
            </div>
          {/snippet}
        </VirtualList>
      {/if}
    </div>
  {:else}
    <!-- Use regular grid for smaller lists -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredNotices as notice}
        <div
          class="rounded-xl shadow-lg bg-white/10 text-[var(--text)] border-t-8 flex flex-col h-96"
          style={`border-top-color: ${getLabelColor(notice.labelId)}; border-top-width: 8px;`}>
          <div class="flex overflow-y-auto flex-col flex-1 p-5">
            <h2 class="mb-1 text-2xl font-bold">{notice.title}</h2>
            <div
              class="mb-1 text-sm font-semibold"
              style={`color: ${getLabelColor(notice.labelId)}`}
              class:text-white={isColorDark(getLabelColor(notice.labelId))}>
              {getLabelTitle(notice.labelId)}
            </div>
            <div class="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wide">
              {notice.author}
            </div>
            <div class="flex-1 text-base">{@html notice.content}</div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
