<script lang="ts">
  import { Icon, Funnel } from 'svelte-hero-icons';
  import { fade } from 'svelte/transition';

  interface Props {
    categories: Array<{ id: string; name: string }>;
    selectedCategory: string;
    searchQuery: string;
    sortBy: 'popular' | 'newest' | 'rating' | 'downloads' | 'name';
    onCategoryChange: (category: string) => void;
    onSearchChange: (query: string) => void;
    onSortChange: (sort: 'popular' | 'newest' | 'rating' | 'downloads' | 'name') => void;
  }

  let {
    categories,
    selectedCategory,
    searchQuery,
    sortBy,
    onCategoryChange,
    onSearchChange,
    onSortChange,
  }: Props = $props();

  let searchInput = $state(searchQuery);
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleSearchInput(value: string) {
    searchInput = value;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  }
</script>

<div
  class="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-700 shadow-sm">
  <div class="px-6 py-4 w-full mx-auto">
    <div class="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
      <!-- Search Bar -->
      <div class="relative flex-1 max-w-md">
        <input
          type="text"
          placeholder="Search themes..."
          bind:value={searchInput}
          oninput={(e) => handleSearchInput(e.currentTarget.value)}
          class="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 accent-ring focus:border-transparent transition-all duration-200" />
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
      </div>

      <!-- Category Filters -->
      <div class="flex items-center gap-2 overflow-x-auto overflow-y-hidden scrollbar-hide">
        {#each categories as category}
          <button
            type="button"
            class="flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 {selectedCategory ===
            category.id
              ? 'accent-bg text-white shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
            onclick={() => onCategoryChange(category.id)}
            transition:fade={{ duration: 200 }}>
            <Icon src={Funnel} class="w-4 h-4" />
            {category.name}
          </button>
        {/each}
      </div>

      <!-- Sort Dropdown -->
      <div class="relative">
        <select
          bind:value={sortBy}
          onchange={(e) =>
            onSortChange(
              e.currentTarget.value as 'popular' | 'newest' | 'rating' | 'downloads' | 'name',
            )}
          class="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 accent-ring transition-all duration-200 appearance-none cursor-pointer pr-10">
          <option value="popular">Most Popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Highest Rated</option>
          <option value="downloads">Most Downloaded</option>
          <option value="name">Name (A-Z)</option>
        </select>
        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg class="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </div>
      </div>
    </div>
  </div>
</div>
