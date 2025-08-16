<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Icon, MagnifyingGlass, XMark, AdjustmentsHorizontal, Clock, Tag, FolderOpen, Calendar, DocumentText } from 'svelte-hero-icons';
  import { fly, scale, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { NotesService } from '../../services/notesService';
  import type { Note, SearchResult, SearchFilters, NoteFolder } from './types/editor';

  // Events
  const dispatch = createEventDispatcher<{
    selectNote: { note: Note };
    close: void;
  }>();

  // Props
  export let isOpen = false;
  export let folders: NoteFolder[] = [];

  // State
  let searchQuery = '';
  let searchResults: SearchResult[] = [];
  let loading = false;
  let error: string | null = null;
  let showFilters = false;
  let searchTimeout: number | null = null;
  let recentSearches: string[] = [];

  // Search filters
  let filters: SearchFilters = {};
  let selectedFolders: string[] = [];
  let selectedTags: string[] = [];
  let dateFrom = '';
  let dateTo = '';
  let wordCountMin: number | undefined = undefined;
  let wordCountMax: number | undefined = undefined;
  let hasSeqtaReferences: boolean | undefined = undefined;

  // Available tags (extracted from search results)
  let availableTags: string[] = [];

  // Reactive search
  $: if (searchQuery.trim()) {
    scheduleSearch();
  } else {
    searchResults = [];
  }

  // Update filters when individual filter values change
  $: {
    filters = {
      folder_ids: selectedFolders.length > 0 ? selectedFolders : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      word_count_min: wordCountMin,
      word_count_max: wordCountMax,
      has_seqta_references: hasSeqtaReferences,
    };
    
    if (searchQuery.trim()) {
      scheduleSearch();
    }
  }

  function scheduleSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = window.setTimeout(() => {
      performSearch();
    }, 300); // 300ms debounce
  }

  async function performSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    try {
      loading = true;
      error = null;
      
      const results = await NotesService.searchNotesAdvanced(searchQuery.trim(), filters);
      searchResults = results;
      
      // Add to recent searches
      if (searchQuery.trim() && !recentSearches.includes(searchQuery.trim())) {
        recentSearches = [searchQuery.trim(), ...recentSearches.slice(0, 4)];
        saveRecentSearches();
      }
      
      // Extract available tags
      const tags = new Set<string>();
      results.forEach(result => {
        result.note.tags.forEach(tag => tags.add(tag));
      });
      availableTags = Array.from(tags).sort();
      
    } catch (e) {
      error = e instanceof Error ? e.message : 'Search failed';
      searchResults = [];
    } finally {
      loading = false;
    }
  }

  function selectNote(note: Note) {
    dispatch('selectNote', { note });
    dispatch('close');
  }

  function clearSearch() {
    searchQuery = '';
    searchResults = [];
    error = null;
  }

  function clearFilters() {
    selectedFolders = [];
    selectedTags = [];
    dateFrom = '';
    dateTo = '';
    wordCountMin = undefined;
    wordCountMax = undefined;
    hasSeqtaReferences = undefined;
  }

  function useRecentSearch(query: string) {
    searchQuery = query;
  }

  function removeRecentSearch(query: string) {
    recentSearches = recentSearches.filter(q => q !== query);
    saveRecentSearches();
  }

  function saveRecentSearches() {
    localStorage.setItem('notes-recent-searches', JSON.stringify(recentSearches));
  }

  function loadRecentSearches() {
    const saved = localStorage.getItem('notes-recent-searches');
    if (saved) {
      try {
        recentSearches = JSON.parse(saved);
      } catch (e) {
        recentSearches = [];
      }
    }
  }

  function getMatchIcon(field: string): any {
    switch (field) {
      case 'title': return DocumentText;
      case 'content': return DocumentText;
      case 'tags': return Tag;
      case 'seqta_references': return FolderOpen;
      default: return DocumentText;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  function highlightMatches(text: string, query: string): string {
    if (!query.trim()) return text;
    
    const terms = query.toLowerCase().split(/\s+/);
    let result = text;
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      result = result.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
    });
    
    return result;
  }

  onMount(() => {
    loadRecentSearches();
    
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  });
</script>

{#if isOpen}
  <!-- Search Modal -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm"
    transition:fly={{ y: -50, duration: 200 }}
    on:click={() => dispatch('close')}
    on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="w-full max-w-4xl mt-16 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      transition:scale={{ duration: 200, start: 0.95 }}
      on:click|stopPropagation
    >
      <!-- Search Header -->
      <div class="flex items-center p-6 border-b border-slate-200 dark:border-slate-700">
        <div class="flex-1 relative">
          <Icon src={MagnifyingGlass} class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search your notes..."
            class="w-full pl-10 pr-4 py-3 text-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring"
            bind:value={searchQuery}
            autofocus
          />
          {#if searchQuery}
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              on:click={clearSearch}
            >
              <Icon src={XMark} class="w-4 h-4" />
            </button>
          {/if}
        </div>
        
        <div class="flex items-center space-x-2 ml-4">
          <button
            class="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 {showFilters ? 'accent-bg text-white' : ''}"
            on:click={() => showFilters = !showFilters}
            title="Search filters"
          >
            <Icon src={AdjustmentsHorizontal} class="w-5 h-5" />
          </button>
          
          <button
            class="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
            on:click={() => dispatch('close')}
            title="Close search"
          >
            <Icon src={XMark} class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Search Filters -->
      {#if showFilters}
        <div class="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" transition:slide={{ duration: 200 }}>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Folders Filter -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Folders</label>
              <div class="space-y-1 max-h-32 overflow-y-auto">
                {#each folders as folder}
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      value={folder.id}
                      bind:group={selectedFolders}
                      class="rounded accent-bg focus:accent-ring"
                    />
                    <span class="ml-2 text-sm text-slate-600 dark:text-slate-400">
                      {folder.icon || '📁'} {folder.name}
                    </span>
                  </label>
                {/each}
              </div>
            </div>

            <!-- Tags Filter -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tags</label>
              <div class="space-y-1 max-h-32 overflow-y-auto">
                {#each availableTags as tag}
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      value={tag}
                      bind:group={selectedTags}
                      class="rounded accent-bg focus:accent-ring"
                    />
                    <span class="ml-2 text-sm text-slate-600 dark:text-slate-400">
                      #{tag}
                    </span>
                  </label>
                {/each}
              </div>
            </div>

            <!-- Date Range Filter -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date Range</label>
              <div class="space-y-2">
                <input
                  type="date"
                  bind:value={dateFrom}
                  class="w-full px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
                  placeholder="From date"
                />
                <input
                  type="date"
                  bind:value={dateTo}
                  class="w-full px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
                  placeholder="To date"
                />
              </div>
            </div>

            <!-- Word Count Filter -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Word Count</label>
              <div class="space-y-2">
                <input
                  type="number"
                  bind:value={wordCountMin}
                  placeholder="Min words"
                  class="w-full px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
                />
                <input
                  type="number"
                  bind:value={wordCountMax}
                  placeholder="Max words"
                  class="w-full px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
                />
              </div>
            </div>

            <!-- SEQTA References Filter -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">SEQTA References</label>
              <select
                bind:value={hasSeqtaReferences}
                class="w-full px-3 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
              >
                <option value={undefined}>Any</option>
                <option value={true}>Has SEQTA references</option>
                <option value={false}>No SEQTA references</option>
              </select>
            </div>

            <!-- Clear Filters -->
            <div class="flex items-end">
              <button
                class="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
                on:click={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Search Content -->
      <div class="flex-1 max-h-96 overflow-y-auto">
        {#if loading}
          <div class="flex items-center justify-center p-8">
            <div class="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin mr-3"></div>
            <span class="text-slate-600 dark:text-slate-400">Searching...</span>
          </div>
        {:else if error}
          <div class="p-6 text-center">
            <p class="text-red-500 dark:text-red-400">{error}</p>
          </div>
        {:else if searchQuery && searchResults.length === 0}
          <div class="p-6 text-center">
            <p class="text-slate-500 dark:text-slate-400 mb-4">No notes found for "{searchQuery}"</p>
            {#if recentSearches.length > 0}
              <div class="text-left max-w-md mx-auto">
                <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recent searches:</h4>
                <div class="flex flex-wrap gap-2">
                  {#each recentSearches as recent}
                    <button
                      class="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      on:click={() => useRecentSearch(recent)}
                    >
                      {recent}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else if searchResults.length > 0}
          <div class="p-4 space-y-3">
            {#each searchResults as result (result.note.id)}
              <div
                class="p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                on:click={() => selectNote(result.note)}
                on:keydown={(e) => e.key === 'Enter' && selectNote(result.note)}
                role="button"
                tabindex="0"
                in:fly={{ y: 20, duration: 200, delay: 50 }}
              >
                <!-- Note Header -->
                <div class="flex items-start justify-between mb-2">
                  <h3 class="font-medium text-slate-900 dark:text-white">
                    {@html highlightMatches(result.note.title || 'Untitled Note', searchQuery)}
                  </h3>
                  <div class="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Score: {result.score.toFixed(1)}</span>
                    <span>•</span>
                    <span>{formatDate(result.note.updated_at)}</span>
                  </div>
                </div>

                <!-- Search Matches -->
                {#if result.matches.length > 0}
                  <div class="space-y-1 mb-3">
                    {#each result.matches.slice(0, 3) as match}
                      <div class="flex items-start space-x-2 text-sm">
                        <Icon src={getMatchIcon(match.field)} class="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div class="flex-1">
                          <span class="text-xs text-slate-500 dark:text-slate-400 capitalize">{match.field}:</span>
                          <span class="text-slate-600 dark:text-slate-300">
                            {@html highlightMatches(match.snippet, searchQuery)}
                          </span>
                        </div>
                      </div>
                    {/each}
                    {#if result.matches.length > 3}
                      <div class="text-xs text-slate-400 ml-6">
                        +{result.matches.length - 3} more matches
                      </div>
                    {/if}
                  </div>
                {/if}

                <!-- Note Meta -->
                <div class="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <div class="flex items-center space-x-3">
                    {#if result.note.folder_path.length > 0}
                      <span class="inline-flex items-center">
                        <Icon src={FolderOpen} class="w-3 h-3 mr-1" />
                        {folders.find(f => f.id === result.note.folder_path[0])?.name || 'Unknown'}
                      </span>
                    {/if}
                    
                    {#if result.note.tags.length > 0}
                      <span class="inline-flex items-center">
                        <Icon src={Tag} class="w-3 h-3 mr-1" />
                        {result.note.tags.length} tags
                      </span>
                    {/if}

                    {#if result.note.seqta_references.length > 0}
                      <span class="inline-flex items-center text-blue-500 dark:text-blue-400">
                        <Icon src={FolderOpen} class="w-3 h-3 mr-1" />
                        {result.note.seqta_references.length} SEQTA refs
                      </span>
                    {/if}
                  </div>
                  
                  <span>{result.note.metadata.word_count} words</span>
                </div>
              </div>
            {/each}
          </div>
        {:else if !searchQuery && recentSearches.length > 0}
          <!-- Recent searches when no query -->
          <div class="p-6">
            <h4 class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center">
              <Icon src={Clock} class="w-4 h-4 mr-2" />
              Recent searches
            </h4>
            <div class="space-y-2">
              {#each recentSearches as recent}
                <div class="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <button
                    class="flex-1 text-left text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    on:click={() => useRecentSearch(recent)}
                  >
                    {recent}
                  </button>
                  <button
                    class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    on:click={() => removeRecentSearch(recent)}
                    title="Remove from recent searches"
                  >
                    <Icon src={XMark} class="w-3 h-3" />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <!-- Empty state -->
          <div class="p-8 text-center">
            <Icon src={MagnifyingGlass} class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">Search your notes</h3>
            <p class="text-slate-500 dark:text-slate-400">
              Find notes by title, content, tags, or SEQTA references
            </p>
          </div>
        {/if}
      </div>

      <!-- Search Footer -->
      {#if searchResults.length > 0}
        <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div class="text-xs text-slate-500 dark:text-slate-400 text-center">
            Found {searchResults.length} note{searchResults.length === 1 ? '' : 's'}
            {#if Object.values(filters).some(v => v !== undefined && (Array.isArray(v) ? v.length > 0 : true))}
              with filters applied
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(.search-highlight) {
    background: rgb(254 240 138);
    color: rgb(133 77 14);
  }
  
  :global(.dark .search-highlight) {
    background: rgb(133 77 14);
    color: rgb(254 240 138);
  }
</style> 