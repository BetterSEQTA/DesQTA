<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { Button } from '$lib/components/ui';
  import { Icon, MagnifyingGlass, CommandLine, Sparkles } from 'svelte-hero-icons';
  import SearchModal from './SearchModal.svelte';
  import { searchItems, categories, type SearchItem } from './SearchData';
  import { handleAction, fuzzyScore } from './SearchActions';

  const dispatch = createEventDispatcher();

  // Core stores
  const searchStore = writable('');
  const showModal = writable(false);
  const selectedIndex = writable(0);
  const searchHistory = writable<string[]>([]);
  const favoriteItems = writable<string[]>([]);
  const recentItems = writable<SearchItem[]>([]);
  const searchMode = writable<'normal' | 'command' | 'fuzzy'>('normal');

  // State
  let currentCategory = $state<string | null>(null);
  let isAdvancedMode = $state(false);
  let modalInput = $state<HTMLInputElement | null>(null);

  // Enhanced filtering - handles both global search and category-specific search
  const filteredItems = derived(
    [searchStore, searchMode, favoriteItems, recentItems],
    ([$search, $mode, $favorites, $recents]) => {
      // Determine source items based on current context
      const sourceItems = currentCategory 
        ? categories.find(c => c.id === currentCategory)?.items || []
        : searchItems;

      if (!$search.trim()) {
        if (currentCategory) {
          // When in a category, show all category items if no search
          return sourceItems;
        }
        
        // Global search with no query - show favorites and recents
        const recentWithBadge = $recents.map(item => ({ ...item, badge: 'Recent' }));
        const favoriteWithBadge = searchItems
          .filter(item => $favorites.includes(item.id))
          .map(item => ({ ...item, badge: 'Favorite' }));
        return [...favoriteWithBadge, ...recentWithBadge].slice(0, 8);
      }

      let results = sourceItems;
      
      if ($mode === 'fuzzy') {
        results = sourceItems
          .map(item => ({
            ...item,
            score: Math.max(
              fuzzyScore(item.name, $search),
              fuzzyScore(item.description || '', $search),
              ...(item.keywords || []).map(k => fuzzyScore(k, $search))
            )
          }))
          .filter(item => item.score > 0.3)
          .sort((a, b) => (b.score || 0) - (a.score || 0));
      } else {
        const query = $search.toLowerCase();
        results = sourceItems.filter(item => {
          return (
            item.name.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.keywords?.some(k => k.toLowerCase().includes(query)) ||
            item.path.toLowerCase().includes(query)
          );
        });
      }

      return results
        .sort((a, b) => {
          const aPriority = (a.priority || 0) + (a.useCount || 0) * 0.1;
          const bPriority = (b.priority || 0) + (b.useCount || 0) * 0.1;
          return bPriority - aPriority;
        })
        .slice(0, 12);
    }
  );

  const visibleCategories = derived(
    [searchStore, searchMode],
    ([$search, $mode]) => {
      if ($search.trim() || $mode === 'command') return [];
      return categories;
    }
  );

  // Modal functions
  const openModal = () => {
    showModal.set(true);
    searchMode.set('normal');
    currentCategory = null;
    selectedIndex.set(0);
  };

  const openCommandMode = () => {
    showModal.set(true);
    searchMode.set('command');
    searchStore.set('>');
    selectedIndex.set(0);
  };

  const toggleFuzzyMode = () => {
    searchMode.update(mode => mode === 'fuzzy' ? 'normal' : 'fuzzy');
  };

  const closeModal = () => {
    showModal.set(false);
    searchStore.set('');
    searchMode.set('normal');
    currentCategory = null;
    selectedIndex.set(0);
  };

  const openCategory = (categoryId: string) => {
    currentCategory = categoryId;
    searchStore.set(''); // Clear search when entering category
    selectedIndex.set(0);
  };

  const goBack = () => {
    if (currentCategory) {
      currentCategory = null;
    } else if ($searchMode === 'command') {
      searchMode.set('normal');
      searchStore.set('');
    }
    selectedIndex.set(0);
  };

  // Selection handling
  const handleSelect = async (item: SearchItem) => {
    // Track usage
    try {
      await invoke('increment_search_usage', { itemId: item.id, category: item.category });
    } catch (e) {
      console.warn('Failed to track usage:', e);
    }
    
    // Update local data
    item.useCount = (item.useCount || 0) + 1;
    item.lastUsed = new Date();
    
    // Add to recent items
    recentItems.update(items => {
      const filtered = items.filter(i => i.id !== item.id);
      return [item, ...filtered].slice(0, 5);
    });
    
    // Add to search history
    const query = $searchStore.trim();
    if (query) {
      searchHistory.update(history => {
        const filtered = history.filter(h => h !== query);
        return [query, ...filtered].slice(0, 10);
      });
    }
    
    closeModal();
    
    if (item.category === 'action') {
      if (item.id === 'action-sidebar-toggle') {
        dispatch('toggle-sidebar');
      } else {
        await handleAction(item);
      }
    } else {
      goto(item.path);
    }
  };

  const toggleFavorite = (itemId: string) => {
    favoriteItems.update(favorites => {
      if (favorites.includes(itemId)) {
        return favorites.filter(id => id !== itemId);
      } else {
        return [...favorites, itemId];
      }
    });
    saveSearchData();
  };

  // Data persistence
  const saveSearchData = async () => {
    try {
      const data = {
        search_history: $searchHistory,
        favorite_items: $favoriteItems,
        recent_items: $recentItems,
      };
      await invoke('save_global_search_data', { data });
    } catch (e) {
      console.warn('Failed to save search data:', e);
    }
  };

  const loadSearchData = async () => {
    try {
      const data = await invoke<any>('get_global_search_data');
      if (data) {
        searchHistory.set(data.search_history || []);
        favoriteItems.set(data.favorite_items || []);
        recentItems.set(data.recent_items || []);
      }
    } catch (e) {
      console.warn('Failed to load search data:', e);
    }
  };

  // Keyboard handling
  const handleKeydown = (e: KeyboardEvent) => {
    if (!$showModal) return;
    
    // Determine what items are currently being displayed
    let items: any[] = [];
    if (currentCategory) {
      // In a category - show filtered category items
      items = $filteredItems;
    } else if ($visibleCategories.length > 0) {
      // Showing categories
      items = $visibleCategories;
    } else {
      // Showing search results
      items = $filteredItems;
    }
    
    const maxIndex = Math.max(0, items.length - 1);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex.update(i => Math.min(i + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (currentCategory && $filteredItems[$selectedIndex]) {
          // In a category - select the filtered item
          handleSelect($filteredItems[$selectedIndex]);
        } else if ($visibleCategories.length > 0 && $selectedIndex < $visibleCategories.length) {
          // Showing categories - open selected category
          openCategory($visibleCategories[$selectedIndex].id);
        } else if ($filteredItems[$selectedIndex]) {
          // Showing search results - select item
          handleSelect($filteredItems[$selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (currentCategory || $searchMode === 'command') {
          goBack();
        } else {
          closeModal();
        }
        break;
    }
  };

  // Global shortcuts
  onMount(() => {
    loadSearchData();
    
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault();
            if (e.shiftKey) {
              openCommandMode();
            } else {
              openModal();
            }
            break;
          case '/':
            e.preventDefault();
            toggleFuzzyMode();
            break;
        }
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.global-search-modal')) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('mousedown', handleClick);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      document.removeEventListener('mousedown', handleClick);
    };
  });
</script>

<!-- Header search trigger -->
<div class="flex-1 flex justify-center" data-tauri-drag-region>
  <Button
    variant="ghost"
    onclick={openModal}
    ariaLabel="Open global search (Ctrl+K)"
    class="group relative max-w-72 w-full px-5 py-2 rounded-xl bg-white/20 dark:bg-gray-800/40 border border-accent text-accent font-semibold shadow-md backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 flex items-center justify-between
    sm:max-w-72 sm:px-5 sm:w-full md:max-w-60 md:px-4 lg:max-w-72 lg:px-5
    max-[640px]:max-w-48 max-[640px]:px-3 max-[500px]:max-w-36 max-[500px]:px-2 max-[400px]:max-w-12 max-[400px]:px-0 max-[400px]:justify-center"
  >
    <div class="flex items-center gap-3 min-w-0 max-[400px]:gap-0">
      <Icon src={MagnifyingGlass} class="w-4 h-4 opacity-70 flex-shrink-0" />
      <span class="opacity-70 truncate max-[500px]:text-sm max-[400px]:hidden">
        Quick search...
      </span>
    </div>
    <div class="flex items-center gap-1 opacity-50 text-xs flex-shrink-0 max-[500px]:hidden">
      <kbd class="px-1.5 py-0.5 rounded bg-white/20 dark:bg-gray-700/50">⌘</kbd>
      <kbd class="px-1.5 py-0.5 rounded bg-white/20 dark:bg-gray-700/50">K</kbd>
    </div>
  </Button>
</div>

<SearchModal
  showModal={$showModal}
  bind:searchQuery={$searchStore}
  searchMode={$searchMode}
  {currentCategory}
  selectedIndex={$selectedIndex}
  filteredItems={$filteredItems}
  visibleCategories={$visibleCategories}
  favoriteItems={$favoriteItems}
  {isAdvancedMode}
  onClose={closeModal}
  onGoBack={goBack}
  onSelect={handleSelect}
  onSelectCategory={openCategory}
  onToggleFavorite={toggleFavorite}
  onKeydown={handleKeydown}
  onMouseEnter={(index) => selectedIndex.set(index)}
/>
