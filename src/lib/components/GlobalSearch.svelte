<script lang="ts">
import { createEventDispatcher, onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { writable, derived } from 'svelte/store';
import { 
  Icon, 
  Squares2x2, 
  BookOpen, 
  ClipboardDocumentList,
  MagnifyingGlass,
  Clock,
  Star,
  CommandLine,
  Cog6Tooth,
  ChartBar,
  DocumentText,
  Users,
  BellAlert,
  CalendarDays,
  Home,
  XMark,
  ArrowRight,
  ArrowPath,
  Sparkles,
  Fire,
  AcademicCap,
  ChatBubbleLeftRight,
  Newspaper,
  DocumentDuplicate,
  UserGroup,
  Cloud,
  MapPin
} from 'svelte-hero-icons';
import { scale, fly, fade } from 'svelte/transition';
import { invoke } from '@tauri-apps/api/core';

const dispatch = createEventDispatcher();

// Enhanced search categories with more metadata
interface SearchItem {
  id: string;
  name: string;
  path: string;
  category: 'page' | 'action' | 'setting' | 'recent' | 'favorite';
  icon: any;
  description?: string;
  keywords?: string[];
  shortcut?: string;
  badge?: string;
  priority?: number;
  lastUsed?: Date;
  useCount?: number;
}

interface SearchCategory {
  id: string;
  name: string;
  icon: any;
  color: string;
  items: SearchItem[];
}

// Comprehensive search data
const searchItems: SearchItem[] = [
  // Core Pages
  { id: 'home', name: 'Home', path: '/', category: 'page', icon: Home, description: 'Dashboard and widgets', keywords: ['dashboard', 'main', 'start'], priority: 10 },
  { id: 'analytics', name: 'Analytics', path: '/analytics', category: 'page', icon: ChartBar, description: 'Performance insights and charts', keywords: ['stats', 'data', 'metrics', 'graphs'], priority: 8 },
  { id: 'assessments', name: 'Assessments', path: '/assessments', category: 'page', icon: ClipboardDocumentList, description: 'Assignments and tests', keywords: ['homework', 'tests', 'assignments', 'exams'], priority: 9 },
  { id: 'courses', name: 'Courses', path: '/courses', category: 'page', icon: BookOpen, description: 'Course materials and content', keywords: ['subjects', 'classes', 'materials'], priority: 9 },
  { id: 'timetable', name: 'Timetable', path: '/timetable', category: 'page', icon: CalendarDays, description: 'Class schedule and calendar', keywords: ['schedule', 'calendar', 'classes', 'time'], priority: 9 },
  { id: 'directory', name: 'Directory', path: '/directory', category: 'page', icon: UserGroup, description: 'Student information', keywords: ['contacts', 'people', 'students'], priority: 6 },
  { id: 'messages', name: 'Direqt Messages', path: '/direqt-messages', category: 'page', icon: ChatBubbleLeftRight, description: 'Direqt messaging system', keywords: ['chat', 'messages', 'communication'], priority: 7 },
  { id: 'news', name: 'News', path: '/news', category: 'page', icon: Newspaper, description: 'Latest News and updates', keywords: ['News', 'updates', 'information'], priority: 5 },
  { id: 'notices', name: 'Notices', path: '/notices', category: 'page', icon: BellAlert, description: 'Important notices from staff', keywords: ['notifications', 'alerts', 'important'], priority: 6 },
  { id: 'portals', name: 'Portals', path: '/portals', category: 'page', icon: Squares2x2, description: 'External portals and links', keywords: ['portals', 'external', 'links', 'websites'], priority: 5 },
  { id: 'reports', name: 'Reports', path: '/reports', category: 'page', icon: DocumentDuplicate, description: 'Academic reports', keywords: ['grades', 'progress', 'academic'], priority: 7 },
  { id: 'settings', name: 'Settings', path: '/settings', category: 'page', icon: Cog6Tooth, description: 'App configuration and preferences', keywords: ['config', 'preferences', 'options'], priority: 4 },
  { id: 'welcome', name: 'Welcome', path: '/welcome', category: 'page', icon: Sparkles, description: 'SEQTA Welcome Page', keywords: ['welcome', 'seqta', 'help'], priority: 3 },

  // Quick Actions
  { id: 'action-theme', name: 'Toggle Theme', path: '/settings/theme-store', category: 'action', icon: Sparkles, description: 'Switch between light and dark mode', keywords: ['dark', 'light', 'appearance'], shortcut: 'Ctrl+Shift+T' },
  { id: 'action-focus', name: 'Start Focus Timer', path: '/?focus=true', category: 'action', icon: Fire, description: 'Begin a focused study session', keywords: ['timer', 'focus', 'study', 'pomodoro'], shortcut: 'Ctrl+F' },
  { id: 'action-refresh', name: 'Refresh Data', path: '/?refresh=true', category: 'action', icon: ArrowPath, description: 'Sync latest information', keywords: ['sync', 'update', 'reload'], shortcut: 'Ctrl+R' },
  { id: 'action-fullscreen', name: 'Toggle Fullscreen', path: '#', category: 'action', icon: Squares2x2, description: 'Enter or exit fullscreen mode', keywords: ['fullscreen', 'maximize', 'window'], shortcut: 'F11' },
  { id: 'action-minimize', name: 'Minimize Window', path: '#', category: 'action', icon: XMark, description: 'Minimize the application window', keywords: ['minimize', 'hide', 'window'] },
  { id: 'action-close', name: 'Close Application', path: '#', category: 'action', icon: XMark, description: 'Close the application', keywords: ['close', 'quit', 'exit'], shortcut: 'Ctrl+Q' },
  { id: 'action-sidebar-toggle', name: 'Toggle Sidebar', path: '#', category: 'action', icon: Squares2x2, description: 'Show or hide the sidebar', keywords: ['sidebar', 'navigation', 'menu'] },
  { id: 'action-dev-tools', name: 'Open Developer Tools', path: '#', category: 'action', icon: Cog6Tooth, description: 'Open browser developer tools', keywords: ['dev', 'debug', 'inspect'], shortcut: 'F12' },
  { id: 'action-clear-cache', name: 'Clear Cache', path: '#', category: 'action', icon: ArrowPath, description: 'Clear application cache and data', keywords: ['cache', 'clear', 'reset', 'clean'] },
  { id: 'action-export-data', name: 'Export Data', path: '#', category: 'action', icon: DocumentDuplicate, description: 'Export your data for backup', keywords: ['export', 'backup', 'save', 'download'] },
  { id: 'action-import-data', name: 'Import Data', path: '#', category: 'action', icon: DocumentDuplicate, description: 'Import data from backup', keywords: ['import', 'restore', 'upload', 'load'] },
  { id: 'action-print-page', name: 'Print Current Page', path: '#', category: 'action', icon: DocumentText, description: 'Print the current page', keywords: ['print', 'pdf', 'document'], shortcut: 'Ctrl+P' },
  { id: 'action-zoom-in', name: 'Zoom In', path: '#', category: 'action', icon: MagnifyingGlass, description: 'Increase page zoom level', keywords: ['zoom', 'magnify', 'larger'], shortcut: 'Ctrl+=' },
  { id: 'action-zoom-out', name: 'Zoom Out', path: '#', category: 'action', icon: MagnifyingGlass, description: 'Decrease page zoom level', keywords: ['zoom', 'shrink', 'smaller'], shortcut: 'Ctrl+-' },
  { id: 'action-zoom-reset', name: 'Reset Zoom', path: '#', category: 'action', icon: MagnifyingGlass, description: 'Reset zoom to default level', keywords: ['zoom', 'reset', 'default'], shortcut: 'Ctrl+0' },
  { id: 'action-open-data-folder', name: 'Open Data Folder', path: '#', category: 'action', icon: DocumentDuplicate, description: 'Open the app data directory', keywords: ['data', 'folder', 'directory', 'files'] },
  { id: 'action-copy-system-info', name: 'Copy System Info', path: '#', category: 'action', icon: DocumentText, description: 'Copy system information to clipboard', keywords: ['system', 'info', 'version', 'copy'] },
  { id: 'action-restart-app', name: 'Restart Application', path: '#', category: 'action', icon: ArrowPath, description: 'Restart the application', keywords: ['restart', 'reboot', 'reload'] },

  // Settings Subcategories
  { id: 'settings-plugins', name: 'Plugin Settings', path: '/settings/plugins', category: 'setting', icon: Cog6Tooth, description: 'Manage extensions and plugins', keywords: ['extensions', 'addons', 'plugins'] },
  { id: 'settings-theme', name: 'Theme Store', path: '/settings/theme-store', category: 'setting', icon: Sparkles, description: 'Customize app appearance', keywords: ['themes', 'colors', 'appearance', 'style'] },
  
  // Toggleable Settings
  { id: 'toggle-animations', name: 'Toggle Enhanced Animations', path: '#', category: 'setting', icon: Sparkles, description: 'Enable or disable enhanced animations', keywords: ['animations', 'effects', 'performance'] },
  { id: 'toggle-sidebar-collapse', name: 'Toggle Auto-Collapse Sidebar', path: '#', category: 'setting', icon: Squares2x2, description: 'Automatically collapse sidebar on small screens', keywords: ['sidebar', 'collapse', 'auto'] },
  { id: 'toggle-sidebar-hover', name: 'Toggle Sidebar Hover Expand', path: '#', category: 'setting', icon: Squares2x2, description: 'Expand sidebar on hover when collapsed', keywords: ['sidebar', 'hover', 'expand'] },
  { id: 'toggle-notifications', name: 'Toggle Notifications', path: '#', category: 'setting', icon: BellAlert, description: 'Enable or disable desktop notifications', keywords: ['notifications', 'alerts', 'desktop'] },
  { id: 'toggle-weather', name: 'Toggle Weather Widget', path: '#', category: 'setting', icon: Cloud, description: 'Show or hide weather information', keywords: ['weather', 'forecast', 'widget'] },
  { id: 'toggle-reminders', name: 'Toggle Reminders', path: '#', category: 'setting', icon: Clock, description: 'Enable or disable reminder notifications', keywords: ['reminders', 'alerts', 'notifications'] },
  { id: 'toggle-force-location', name: 'Toggle Force Location', path: '#', category: 'setting', icon: MapPin, description: 'Force use of specific location for weather', keywords: ['location', 'weather', 'gps'] },
  { id: 'toggle-school-picture', name: 'Toggle School Picture', path: '#', category: 'setting', icon: AcademicCap, description: 'Show or hide school picture on login', keywords: ['school', 'picture', 'login', 'image'] },
  { id: 'toggle-ai-integrations', name: 'Toggle AI Integrations', path: '#', category: 'setting', icon: Sparkles, description: 'Enable or disable AI-powered features', keywords: ['ai', 'artificial', 'intelligence', 'gemini'] },
  { id: 'toggle-grade-analyser', name: 'Toggle Grade Analyser', path: '#', category: 'setting', icon: ChartBar, description: 'Enable or disable grade analysis features', keywords: ['grades', 'analysis', 'ai', 'analytics'] },
  { id: 'toggle-lesson-summary', name: 'Toggle Lesson Summary Analyser', path: '#', category: 'setting', icon: DocumentText, description: 'Enable or disable lesson summary analysis', keywords: ['lessons', 'summary', 'analysis', 'ai'] },
  { id: 'toggle-global-search', name: 'Toggle Global Search', path: '#', category: 'setting', icon: MagnifyingGlass, description: 'Enable or disable global search functionality', keywords: ['search', 'global', 'find'] },
  { id: 'toggle-dev-info-hider', name: 'Toggle Dev Info Hider', path: '#', category: 'setting', icon: Cog6Tooth, description: 'Hide sensitive development information', keywords: ['dev', 'development', 'sensitive', 'info'] },
];

// Search state management
const searchStore = writable('');
const showModal = writable(false);
const selectedIndex = writable(0);
const searchHistory = writable<string[]>([]);
const favoriteItems = writable<string[]>([]);
const recentItems = writable<SearchItem[]>([]);
const searchMode = writable<'normal' | 'command' | 'fuzzy'>('normal');

// Advanced search settings
let isMobile = $state(false);
let isAdvancedMode = $state(false);
let searchDebounceTimer: number | null = null;
let modalInput = $state<HTMLInputElement | null>(null);
let searchStats = $state({ totalSearches: 0, averageTime: 0 });
let currentCategory = $state<string | null>(null);
let showPreview = $state(false);
let previewItem = $state<SearchItem | null>(null);

// Fuzzy search implementation
function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (textLower.includes(queryLower)) {
    return 1 - (textLower.indexOf(queryLower) / text.length);
  }
  
  let score = 0;
  let queryIndex = 0;
  
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length ? score / query.length : 0;
}

// Enhanced filtering with multiple algorithms
const filteredItems = derived(
  [searchStore, searchMode, favoriteItems, recentItems],
  ([$search, $mode, $favorites, $recents]) => {
    if (!$search.trim()) {
      // Show recent and favorites when no search
      const recentWithCategory = $recents.map(item => ({ ...item, badge: 'Recent' }));
      const favoriteWithCategory = searchItems
        .filter(item => $favorites.includes(item.id))
        .map(item => ({ ...item, badge: 'Favorite' }));
      
      return [...favoriteWithCategory, ...recentWithCategory].slice(0, 8);
    }

    let results = searchItems;
    
    // Apply different search algorithms based on mode
    if ($mode === 'fuzzy') {
      results = searchItems
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
      // Standard search
      const query = $search.toLowerCase();
      results = searchItems.filter(item => {
        return (
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.keywords?.some(k => k.toLowerCase().includes(query)) ||
          item.path.toLowerCase().includes(query)
        );
      });
    }

    // Sort by priority and usage
    return results
      .sort((a, b) => {
        const aPriority = (a.priority || 0) + (a.useCount || 0) * 0.1;
        const bPriority = (b.priority || 0) + (b.useCount || 0) * 0.1;
        return bPriority - aPriority;
      })
      .slice(0, 12);
  }
);

// Categories for browsing
const categories: SearchCategory[] = [
  {
    id: 'pages',
    name: 'Pages',
    icon: Squares2x2,
    color: 'blue',
    items: searchItems.filter(item => item.category === 'page')
  },
  {
    id: 'actions',
    name: 'Quick Actions',
    icon: CommandLine,
    color: 'purple',
    items: searchItems.filter(item => item.category === 'action')
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Cog6Tooth,
    color: 'green',
    items: searchItems.filter(item => item.category === 'setting')
  }
];

const visibleCategories = derived(
  [searchStore, searchMode],
  ([$search, $mode]) => {
    if ($search.trim() || $mode === 'command') return [];
    return categories;
  }
);

// Enhanced keyboard shortcuts
const shortcuts = [
  { key: 'Ctrl+K', description: 'Open search', action: () => openModal() },
  { key: 'Ctrl+Shift+K', description: 'Command mode', action: () => openCommandMode() },
  { key: 'Ctrl+/', description: 'Fuzzy search', action: () => toggleFuzzyMode() },
  { key: 'Ctrl+H', description: 'Search history', action: () => showSearchHistory() },
];

// Modal and interaction functions
function openModal() {
  showModal.set(true);
  searchMode.set('normal');
  currentCategory = null;
  selectedIndex.set(0);
  setTimeout(() => {
    if (modalInput) {
      modalInput.focus();
      modalInput.select();
    }
  }, 100);
}

function openCommandMode() {
  showModal.set(true);
  searchMode.set('command');
  searchStore.set('>');
  selectedIndex.set(0);
  setTimeout(() => {
    if (modalInput) {
      modalInput.focus();
      modalInput.setSelectionRange(1, 1);
    }
  }, 100);
}

function toggleFuzzyMode() {
  if ($searchMode === 'fuzzy') {
    searchMode.set('normal');
  } else {
    searchMode.set('fuzzy');
  }
}

function showSearchHistory() {
  // Implementation for search history
  console.log('Search history:', $searchHistory);
}

function closeModal() {
  showModal.set(false);
  searchStore.set('');
  searchMode.set('normal');
  currentCategory = null;
  selectedIndex.set(0);
  showPreview = false;
  previewItem = null;
}

function openCategory(categoryId: string) {
  currentCategory = categoryId;
  selectedIndex.set(0);
  setTimeout(() => {
    if (modalInput) modalInput.focus();
  }, 10);
}

function goBack() {
  if (currentCategory) {
    currentCategory = null;
    selectedIndex.set(0);
  } else if ($searchMode === 'command') {
    searchMode.set('normal');
    searchStore.set('');
  }
  setTimeout(() => {
    if (modalInput) modalInput.focus();
  }, 10);
}

async function handleSelect(item: SearchItem) {
  // Track usage with Rust backend
  try {
    await invoke('increment_search_usage', { 
      itemId: item.id, 
      category: item.category 
    });
  } catch (e) {
    console.warn('Failed to track usage:', e);
  }
  
  // Update local item data
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
  
  // Save to storage
  try {
    await saveSearchData();
  } catch (e) {
    console.warn('Failed to save search data:', e);
  }
  
  closeModal();
  
  // Handle different action types
  if (item.category === 'action') {
    await handleAction(item);
  } else {
    goto(item.path);
  }
}

async function toggleSetting(settingKey: string, inverted: boolean = false) {
  try {
    // Get current settings
    const settings = await invoke<any>('get_settings');
    
    // Toggle the setting
    const currentValue = settings[settingKey];
    const newValue = inverted ? !currentValue : !currentValue;
    settings[settingKey] = newValue;
    
    // Save updated settings
    await invoke('save_settings', { newSettings: settings });
    
    console.log(`${settingKey} toggled to:`, newValue);
  } catch (e) {
    console.warn(`Failed to toggle ${settingKey}:`, e);
  }
}

async function handleAction(item: SearchItem) {
  switch (item.id) {
    case 'action-theme':
      // Toggle theme logic
      document.documentElement.classList.toggle('dark');
      break;
    case 'action-focus':
      // Start focus timer
      goto('/?widget=focus_timer');
      break;
    case 'action-refresh':
      // Refresh data
      window.location.reload();
      break;
    case 'action-fullscreen':
      try {
        await invoke('toggle_fullscreen');
      } catch (e) {
        console.warn('Failed to toggle fullscreen:', e);
      }
      break;
    case 'action-minimize':
      try {
        await invoke('minimize_window');
      } catch (e) {
        console.warn('Failed to minimize window:', e);
      }
      break;
    case 'action-close':
      try {
        await invoke('quit');
      } catch (e) {
        console.warn('Failed to close application:', e);
      }
      break;
    case 'action-sidebar-toggle':
      // Dispatch event to toggle sidebar
      dispatch('toggle-sidebar');
      break;
    case 'action-dev-tools':
      try {
        await invoke('open_devtools');
      } catch (e) {
        console.warn('Failed to open dev tools:', e);
      }
      break;
    case 'action-clear-cache':
      try {
        await invoke('clear_cache');
        // Show success message
        console.log('Cache cleared successfully');
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }
      break;
    case 'action-export-data':
      try {
        const data = await invoke<string>('export_search_data');
        // Create download link
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'desqta-search-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Failed to export data:', e);
      }
      break;
    case 'action-import-data':
      // Create file input for import
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            const text = await file.text();
            await invoke('import_search_data', { jsonData: text });
            await loadSearchData(); // Reload data
            console.log('Data imported successfully');
          } catch (e) {
            console.warn('Failed to import data:', e);
          }
        }
      };
      input.click();
      break;
    case 'action-print-page':
      window.print();
      break;
    case 'action-zoom-in':
      // Handle zoom on frontend
      const currentZoom = parseFloat(document.body.style.zoom || '1');
      document.body.style.zoom = Math.min(currentZoom * 1.1, 3.0).toString();
      break;
    case 'action-zoom-out':
      // Handle zoom on frontend
      const currentZoomOut = parseFloat(document.body.style.zoom || '1');
      document.body.style.zoom = Math.max(currentZoomOut / 1.1, 0.5).toString();
      break;
    case 'action-zoom-reset':
      // Handle zoom on frontend
      document.body.style.zoom = '1';
      break;
    case 'action-open-data-folder':
      try {
        const dataDir = await invoke<string>('get_app_data_dir');
        await invoke('open_file_explorer', { path: dataDir });
      } catch (e) {
        console.warn('Failed to open data folder:', e);
      }
      break;
    case 'action-copy-system-info':
      try {
        const systemInfo = await invoke<any>('get_system_info');
        const infoText = `DesQTA v${systemInfo.version}\nPlatform: ${systemInfo.platform}\nArchitecture: ${systemInfo.arch}\nTauri: ${systemInfo.tauri_version}`;
        await navigator.clipboard.writeText(infoText);
        console.log('System info copied to clipboard');
      } catch (e) {
        console.warn('Failed to copy system info:', e);
      }
      break;
    case 'action-restart-app':
      try {
        await invoke('restart_app');
      } catch (e) {
        console.warn('Failed to restart app:', e);
      }
      break;
    // Toggle settings
    case 'toggle-animations':
      await toggleSetting('enhanced_animations');
      break;
    case 'toggle-sidebar-collapse':
      await toggleSetting('auto_collapse_sidebar');
      break;
    case 'toggle-sidebar-hover':
      await toggleSetting('auto_expand_sidebar_hover');
      break;
    case 'toggle-notifications':
      await toggleSetting('reminders_enabled');
      break;
    case 'toggle-weather':
      await toggleSetting('weather_enabled');
      break;
    case 'toggle-reminders':
      await toggleSetting('reminders_enabled');
      break;
    case 'toggle-force-location':
      await toggleSetting('force_use_location');
      break;
    case 'toggle-school-picture':
      await toggleSetting('disable_school_picture', true); // Inverted logic
      break;
    case 'toggle-ai-integrations':
      await toggleSetting('ai_integrations_enabled');
      break;
    case 'toggle-grade-analyser':
      await toggleSetting('grade_analyser_enabled');
      break;
    case 'toggle-lesson-summary':
      await toggleSetting('lesson_summary_analyser_enabled');
      break;
    case 'toggle-global-search':
      await toggleSetting('global_search_enabled');
      break;
    case 'toggle-dev-info-hider':
      await toggleSetting('dev_sensitive_info_hider');
      break;
    default:
      goto(item.path);
  }
}

function toggleFavorite(itemId: string) {
  favoriteItems.update(favorites => {
    if (favorites.includes(itemId)) {
      return favorites.filter(id => id !== itemId);
    } else {
      return [...favorites, itemId];
    }
  });
  saveSearchData();
}

async function saveSearchData() {
  try {
    const data = {
      search_history: $searchHistory,
      favorite_items: $favoriteItems,
      recent_items: $recentItems,
      search_stats: searchStats
    };
    await invoke('save_global_search_data', { data });
  } catch (e) {
    console.warn('Failed to save search data:', e);
  }
}

async function loadSearchData() {
  try {
    const data = await invoke<any>('get_global_search_data');
    if (data) {
      searchHistory.set(data.search_history || []);
      favoriteItems.set(data.favorite_items || []);
      recentItems.set(data.recent_items || []);
      searchStats = data.search_stats || { totalSearches: 0, averageTime: 0 };
    }
  } catch (e) {
    console.warn('Failed to load search data:', e);
  }
}

// Scroll selected item into view
function scrollSelectedIntoView() {
  setTimeout(() => {
    const selectedElement = document.querySelector('.search-result-selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, 10);
}

// Advanced keyboard handling
function handleKeydown(e: KeyboardEvent) {
  if (!$showModal) return;
  
  const items = currentCategory 
    ? categories.find(c => c.id === currentCategory)?.items || []
    : $filteredItems;
  
  const maxIndex = Math.max(0, items.length - 1);
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedIndex.update(i => {
        const newIndex = Math.min(i + 1, maxIndex);
        scrollSelectedIntoView();
        return newIndex;
      });
      break;
      
    case 'ArrowUp':
      e.preventDefault();
      selectedIndex.update(i => {
        const newIndex = Math.max(i - 1, 0);
        scrollSelectedIntoView();
        return newIndex;
      });
      break;
      
    case 'Enter':
      e.preventDefault();
      if (currentCategory) {
        const category = categories.find(c => c.id === currentCategory);
        if (category && category.items[$selectedIndex]) {
          handleSelect(category.items[$selectedIndex]);
    }
      } else if ($visibleCategories.length > 0 && $selectedIndex < $visibleCategories.length) {
        openCategory($visibleCategories[$selectedIndex].id);
      } else if (items[$selectedIndex]) {
        handleSelect(items[$selectedIndex]);
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
      
    case 'Tab':
      e.preventDefault();
      if (items[$selectedIndex]) {
        showPreview = true;
        previewItem = items[$selectedIndex];
      }
      break;
      
    case 'F1':
      e.preventDefault();
      isAdvancedMode = !isAdvancedMode;
      break;
    }
  }

// Mobile detection
function checkMobile() {
  isMobile = window.innerWidth < 768;
}

// Component lifecycle
onMount(() => {
  loadSearchData();
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Global keyboard shortcuts
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey)) {
      switch (e.key.toLowerCase()) {
        case 'k':
          if (e.shiftKey) {
            e.preventDefault();
            openCommandMode();
          } else {
            e.preventDefault();
            openModal();
          }
          break;
        case '/':
          e.preventDefault();
          toggleFuzzyMode();
          break;
        case 'h':
          if ($showModal) {
            e.preventDefault();
            showSearchHistory();
          }
          break;
      }
    }
  };
  
  window.addEventListener('keydown', handleGlobalKeydown);
  
  // Click outside to close
  const handleClick = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.global-search-modal')) {
      closeModal();
    }
  };
  window.addEventListener('mousedown', handleClick);

  return () => {
    window.removeEventListener('resize', checkMobile);
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('mousedown', handleClick);
  };
});

onDestroy(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
});
</script>

<!-- Header search trigger -->
<div class="flex-1 flex justify-center" data-tauri-drag-region>
  <button
    type="button"
    class="group relative max-w-72 w-full px-5 py-2 rounded-xl bg-white/20 dark:bg-gray-800/40 border border-accent text-accent font-semibold shadow-md backdrop-blur-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 flex items-center justify-between
    
    /* Responsive sizing */
    sm:max-w-72 sm:px-5 sm:w-full
    md:max-w-60 md:px-4
    lg:max-w-72 lg:px-5
    
    /* Small screens - reduce padding and width */
    max-[640px]:max-w-48 max-[640px]:px-3
    max-[500px]:max-w-36 max-[500px]:px-2
    max-[400px]:max-w-12 max-[400px]:px-0 max-[400px]:justify-center"
    onclick={openModal}
    aria-label="Open global search (Ctrl+K)"
  >
    <div class="flex items-center gap-3 min-w-0
    /* Hide text content on very small screens */
    max-[400px]:gap-0">
      <Icon src={MagnifyingGlass} class="w-4 h-4 opacity-70 flex-shrink-0" />
      <span class="opacity-70 truncate
      /* Progressively hide text on smaller screens */
      max-[500px]:text-sm
      max-[400px]:hidden">
        Quick search...
      </span>
    </div>
    <div class="flex items-center gap-1 opacity-50 text-xs flex-shrink-0
    /* Hide keyboard shortcuts on small screens */
    max-[500px]:hidden">
      <kbd class="px-1.5 py-0.5 rounded bg-white/20 dark:bg-gray-700/50">⌘</kbd>
      <kbd class="px-1.5 py-0.5 rounded bg-white/20 dark:bg-gray-700/50">K</kbd>
    </div>
  </button>
</div>

{#if $showModal}
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
        {#if currentCategory || $searchMode === 'command'}
          <button 
            class="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/50 transition-colors" 
            onclick={goBack}
            aria-label="Go back"
          >
            <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        {/if}
        
        <div class="flex items-center gap-2">
          {#if $searchMode === 'command'}
            <Icon src={CommandLine} class="w-5 h-5 text-purple-500" />
          {:else if $searchMode === 'fuzzy'}
            <Icon src={Sparkles} class="w-5 h-5 text-orange-500" />
          {:else}
            <Icon src={MagnifyingGlass} class="w-5 h-5 text-accent" />
          {/if}
        </div>
        
        <input
          bind:this={modalInput}
          type="text"
          class="flex-1 px-4 py-3 rounded-xl bg-white/40 dark:bg-gray-800/60 text-slate-900 dark:text-white border border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 placeholder:text-slate-500 dark:placeholder:text-gray-400 text-lg"
          placeholder={
            $searchMode === 'command' ? 'Type a command...' :
            $searchMode === 'fuzzy' ? 'Fuzzy search...' :
            currentCategory ? `Search ${currentCategory}...` : 
            'Search anything...'
          }
          bind:value={$searchStore}
          onkeydown={handleKeydown}
          autocomplete="off"
        />
        
        <div class="flex items-center gap-2">
          {#if $searchMode === 'fuzzy'}
            <span class="px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-medium">
              Fuzzy
            </span>
          {:else if $searchMode === 'command'}
            <span class="px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium">
              Command
            </span>
          {/if}
          
          <button
            onclick={closeModal}
            class="p-1 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/50 transition-colors"
            aria-label="Close search"
          >
            <Icon src={XMark} class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
      
      <!-- Search Results -->
      <div class="flex-1 overflow-hidden">
        {#if currentCategory}
          {@const category = categories.find(c => c.id === currentCategory)}
          {#if category}
            <div class="p-4 max-h-96 overflow-y-auto">
              <div class="grid gap-2">
                {#each category.items as item, i}
                                     <button
                     type="button"
                     class="flex items-center gap-4 w-full p-4 rounded-xl transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50 text-left group {$selectedIndex === i ? 'bg-accent text-white shadow-lg scale-[1.02] search-result-selected' : 'text-slate-900 dark:text-white'}"
                     onclick={() => handleSelect(item)}
                     onmouseenter={() => selectedIndex.set(i)}
                  >
                    <div class="p-2 rounded-lg bg-white/20 dark:bg-gray-700/30 group-hover:scale-110 transition-transform">
                      <Icon src={item.icon} class="w-5 h-5" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold truncate">{item.name}</div>
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
                     <div
                       onclick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                       class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                       role="button"
                       tabindex="0"
                     >
                       <Icon src={Star} class="w-4 h-4 {$favoriteItems.includes(item.id) ? 'text-yellow-400 fill-current' : ''}" />
                     </div>
                   </button>
                 {/each}
               </div>
             </div>
           {/if}
        {:else if $visibleCategories.length > 0}
          <!-- Category Browser -->
          <div class="p-4">
            <div class="grid gap-3">
              {#each $visibleCategories as category, i}
              <button
                type="button"
                   class="flex items-center gap-4 w-full p-4 rounded-xl transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50 text-left group {$selectedIndex === i ? 'bg-accent text-white shadow-lg scale-[1.02] search-result-selected' : 'text-slate-900 dark:text-white'}"
                   onclick={() => openCategory(category.id)}
                   onmouseenter={() => selectedIndex.set(i)}
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
        {:else if $filteredItems.length > 0}
          <!-- Search Results -->
          <div class="p-4 max-h-96 overflow-y-auto">
            <div class="grid gap-2">
              {#each $filteredItems as item, i}
            <button
              type="button"
                   class="flex items-center gap-4 w-full p-3 rounded-xl transition-all duration-200 hover:bg-white/50 dark:hover:bg-gray-800/50 text-left group {$selectedIndex === i ? 'bg-accent text-white shadow-lg scale-[1.02] search-result-selected' : 'text-slate-900 dark:text-white'}"
                   onclick={() => handleSelect(item)}
                   onmouseenter={() => selectedIndex.set(i)}
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
                                     <div
                     onclick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                     class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                     role="button"
                     tabindex="0"
                   >
                     <Icon src={Star} class="w-4 h-4 {$favoriteItems.includes(item.id) ? 'text-yellow-400 fill-current' : ''}" />
                   </div>
            </button>
          {/each}
            </div>
          </div>
        {:else if $searchStore.trim()}
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
            
            <div class="grid grid-cols-2 gap-3 mb-6">
              <button
                onclick={openCommandMode}
                class="flex items-center gap-3 p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <Icon src={CommandLine} class="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span class="font-medium text-purple-700 dark:text-purple-300">Commands</span>
              </button>
              <button
                onclick={toggleFuzzyMode}
                class="flex items-center gap-3 p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
              >
                <Icon src={Sparkles} class="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span class="font-medium text-orange-700 dark:text-orange-300">Fuzzy Search</span>
              </button>
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
            <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-gray-700">Tab</kbd> Preview
          </span>
          <span class="flex items-center gap-1">
            <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-gray-700">Esc</kbd> Close
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="opacity-60">
            {$searchMode === 'fuzzy' ? 'Fuzzy' : $searchMode === 'command' ? 'Command' : 'Normal'} mode
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