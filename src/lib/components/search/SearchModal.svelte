<script lang="ts">
  import { Icon, XMark, MagnifyingGlass, CommandLine, Sparkles, ArrowRight, Star } from 'svelte-hero-icons';
  import { scale, fade } from 'svelte/transition';
  import type { SearchItem, SearchCategory } from './SearchData';
  import type { Snippet } from 'svelte';

  interface Props {
    showModal: boolean;
    searchQuery: string;
    searchMode: 'normal' | 'command' | 'fuzzy';
    currentCategory: string | null;
    selectedIndex: number;
    filteredItems: SearchItem[];
    visibleCategories: SearchCategory[];
    favoriteItems: string[];
    isAdvancedMode: boolean;
    onClose: () => void;
    onGoBack: () => void;
    onSelect: (item: SearchItem) => void;
    onSelectCategory: (categoryId: string) => void;
    onToggleFavorite: (itemId: string) => void;
    onKeydown: (e: KeyboardEvent) => void;
    onMouseEnter: (index: number) => void;
    children?: Snippet;
  }

  let {
    showModal,
    searchQuery = $bindable(),
    searchMode,
    currentCategory,
    selectedIndex,
    filteredItems,
    visibleCategories,
    favoriteItems,
    isAdvancedMode,
    onClose,
    onGoBack,
    onSelect,
    onSelectCategory,
    onToggleFavorite,
    onKeydown,
    onMouseEnter,
    children
  }: Props = $props();

  let modalInput = $state<HTMLInputElement>();

  const placeholderText = $derived(
    searchMode === 'command' ? 'Type a command...' :
    searchMode === 'fuzzy' ? 'Fuzzy search...' :
    currentCategory ? `Search ${currentCategory}...` :
    'Search anything...'
  );

  $effect(() => {
    if (showModal && modalInput) {
      setTimeout(() => modalInput?.focus(), 100);
    }
  });

  function handleItemClick(item: SearchItem, e: MouseEvent) {
    e.stopPropagation();
    onSelect(item);
  }

  function handleFavoriteClick(itemId: string, e: MouseEvent) {
    e.stopPropagation();
    onToggleFavorite(itemId);
  }
</script>

{#if showModal}
  <div 
    class="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="global-search-modal relative w-full max-w-2xl mx-4 rounded-2xl bg-white/90 dark:bg-gray-900/90 shadow-2xl border border-white/20 dark:border-gray-700/40 backdrop-blur-xl flex flex-col overflow-hidden"
      style="backdrop-filter: blur(24px); max-height: 80vh;"
      transition:scale={{ duration: 200, start: 0.95 }}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <!-- Search Header -->
      <div class="flex items-center gap-3 px-6 py-4 border-b border-white/10 dark:border-gray-700/20">
        {#if currentCategory || searchMode === 'command'}
          <button 
            class="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/50 transition-colors" 
            onclick={onGoBack}
            aria-label="Go back"
          >
            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        {/if}
        
        <div class="flex items-center gap-2">
          {#if searchMode === 'command'}
            <Icon src={CommandLine} class="w-5 h-5 text-purple-500" />
          {:else if searchMode === 'fuzzy'}
            <Icon src={Sparkles} class="w-5 h-5 text-orange-500" />
          {:else}
            <Icon src={MagnifyingGlass} class="w-5 h-5 text-accent" />
          {/if}
        </div>
        
        <input
          bind:this={modalInput}
          type="text"
          class="flex-1 px-4 py-3 rounded-xl bg-white/40 dark:bg-gray-800/60 text-slate-900 dark:text-white border border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 placeholder:text-slate-500 dark:placeholder:text-gray-400 text-lg"
          placeholder={placeholderText}
          bind:value={searchQuery}
          onkeydown={onKeydown}
          autocomplete="off"
        />
        
        <div class="flex items-center gap-2">
          {#if searchMode === 'fuzzy'}
            <span class="px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium">
              Fuzzy
            </span>
          {:else if searchMode === 'command'}
            <span class="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium">
              Command
            </span>
          {/if}
          
          <button
            onclick={onClose}
            class="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/50 transition-colors"
            aria-label="Close search"
          >
            <Icon src={XMark} class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
      
      <!-- Search Results -->
      <div class="flex-1 overflow-hidden">
        {#if children}
          {@render children()}
        {:else if currentCategory}
          <!-- Category Items - when in a specific category -->
          <div class="p-4 max-h-96 overflow-y-auto">
            <div class="grid gap-2">
              {#each filteredItems as item, i}
                <button
                  type="button"
                  class="flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50 text-left group {selectedIndex === i ? 'bg-accent text-white shadow-lg scale-[1.02] search-result-selected' : 'text-slate-900 dark:text-white'}"
                  onclick={(e) => handleItemClick(item, e)}
                  onmouseenter={() => onMouseEnter(i)}
                >
                  <div class="p-2 rounded-lg bg-white/20 dark:bg-gray-700/30 group-hover:scale-110 transition-transform">
                    <Icon src={item.icon} class="w-4 h-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate flex items-center gap-2">
                      {item.name}
                      {#if item.badge}
                        <span class="px-2 py-0.5 rounded-full bg-white/20 dark:bg-gray-700/50 text-xs font-normal opacity-75">
                          {item.badge}
                        </span>
                      {/if}
                    </div>
                    {#if item.description}
                      <div class="text-sm opacity-75 truncate">{item.description}</div>
                    {/if}
                  </div>
                  {#if item.shortcut}
                    <div class="flex items-center gap-1 opacity-60 text-xs">
                      {#each item.shortcut.split('+') as key}
                        <kbd class="px-1.5 py-0.5 rounded bg-white/20 dark:bg-gray-700/50">{key}</kbd>
                      {/each}
                    </div>
                  {/if}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    onclick={(e) => handleFavoriteClick(item.id, e)}
                    class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    role="button"
                    tabindex="0"
                    aria-label="Toggle favorite"
                  >
                    <Icon src={Star} class="w-4 h-4 {favoriteItems.includes(item.id) ? 'text-yellow-400 fill-current' : ''}" />
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {:else if !currentCategory && visibleCategories.length > 0}
          <!-- Category Browser -->
          <div class="p-4">
            <div class="grid gap-3">
              {#each visibleCategories as category, i}
                <button
                  type="button"
                  class="flex items-center gap-4 w-full p-4 rounded-xl transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50 text-left group {selectedIndex === i ? 'bg-accent text-white shadow-lg scale-[1.02] search-result-selected' : 'text-slate-900 dark:text-white'}"
                  onclick={() => onSelectCategory(category.id)}
                  onmouseenter={() => onMouseEnter(i)}
                >
                  <div class="p-3 rounded-xl bg-{category.color}-100 dark:bg-{category.color}-900/30 group-hover:scale-110 transition-transform">
                    <Icon src={category.icon} class="w-6 h-6 text-{category.color}-600 dark:text-{category.color}-400" />
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold text-lg">{category.name}</div>
                    <div class="text-sm opacity-75">{category.items.length} items</div>
                  </div>
                  <Icon src={ArrowRight} class="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                </button>
              {/each}
            </div>
          </div>
        {:else if filteredItems.length > 0}
          <!-- Search Results -->
          <div class="p-4 max-h-96 overflow-y-auto">
            <div class="grid gap-2">
              {#each filteredItems as item, i}
                <button
                  type="button"
                  class="flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50 text-left group {selectedIndex === i ? 'bg-accent text-white shadow-lg scale-[1.02] search-result-selected' : 'text-slate-900 dark:text-white'}"
                  onclick={(e) => handleItemClick(item, e)}
                  onmouseenter={() => onMouseEnter(i)}
                >
                  <div class="p-2 rounded-lg bg-white/20 dark:bg-gray-700/30 group-hover:scale-110 transition-transform">
                    <Icon src={item.icon} class="w-4 h-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate flex items-center gap-2">
                      {item.name}
                      {#if item.badge}
                        <span class="px-2 py-0.5 rounded-full bg-white/20 dark:bg-gray-700/50 text-xs font-normal opacity-75">
                          {item.badge}
                        </span>
                      {/if}
                    </div>
                    {#if item.description}
                      <div class="text-sm opacity-75 truncate">{item.description}</div>
                    {/if}
                  </div>
                  {#if item.shortcut}
                    <div class="flex items-center gap-1 opacity-60 text-xs">
                      {#each item.shortcut.split('+') as key}
                        <kbd class="px-1.5 py-0.5 rounded bg-white/20 dark:bg-gray-700/50">{key}</kbd>
                      {/each}
                    </div>
                  {/if}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    onclick={(e) => handleFavoriteClick(item.id, e)}
                    class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    role="button"
                    tabindex="0"
                    aria-label="Toggle favorite"
                  >
                    <Icon src={Star} class="w-4 h-4 {favoriteItems.includes(item.id) ? 'text-yellow-400 fill-current' : ''}" />
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {:else if searchQuery.trim()}
          <!-- No Results -->
          <div class="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-gray-400">
            <Icon src={MagnifyingGlass} class="w-12 h-12 mb-4 opacity-50" />
            <p class="text-lg font-medium mb-2">No results found</p>
            <p class="text-sm">Try adjusting your search or browse categories</p>
          </div>
        {:else}
          <!-- Welcome State -->
          <div class="p-6">
            <div class="text-center mb-6">
              <Icon src={Sparkles} class="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 class="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Enhanced Global Search
              </h3>
              <p class="text-slate-600 dark:text-gray-400">
                Search pages, run commands, or browse categories
              </p>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Footer -->
      <div class="flex items-center justify-between px-6 py-3 border-t border-white/10 dark:border-gray-700/20 text-xs text-slate-500 dark:text-gray-400">
        <div class="flex items-center gap-4">
          <span class="flex items-center gap-1">
            <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-gray-700">↑↓</kbd> Navigate
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-gray-700">↵</kbd> Select
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-gray-700">Esc</kbd> Close
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="opacity-60">
            {searchMode === 'fuzzy' ? 'Fuzzy' : searchMode === 'command' ? 'Command' : 'Normal'} mode
          </span>
          {#if isAdvancedMode}
            <span class="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
              Advanced
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
