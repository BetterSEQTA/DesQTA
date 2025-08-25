import {
  Icon,
  Home,
  Newspaper,
  ClipboardDocumentList,
  BookOpen,
  ChatBubbleLeftRight,
  DocumentText,
  AcademicCap,
  ChartBar,
  Cog6Tooth,
  CalendarDays,
  User,
  GlobeAlt,
  Squares2x2,
  XMark,
  ArrowPath,
  Sparkles,
  Fire,
  CommandLine,
  BellAlert,
  MagnifyingGlass,
  DocumentDuplicate,
  UserGroup,
  Cloud,
  MapPin,
  PencilSquare
} from 'svelte-hero-icons';

export interface SearchItem {
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

export interface SearchCategory {
  id: string;
  name: string;
  icon: any;
  color: string;
  items: SearchItem[];
}

// Core pages
const PAGES: SearchItem[] = [
  { id: 'home', name: 'Home', path: '/', category: 'page', icon: Home, description: 'Dashboard and widgets', keywords: ['dashboard', 'main', 'start'], priority: 10 },
  { id: 'analytics', name: 'Analytics', path: '/analytics', category: 'page', icon: ChartBar, description: 'Performance insights and charts', keywords: ['stats', 'data', 'metrics', 'graphs'], priority: 8 },
  { id: 'assessments', name: 'Assessments', path: '/assessments', category: 'page', icon: ClipboardDocumentList, description: 'Assignments and tests', keywords: ['homework', 'tests', 'assignments', 'exams'], priority: 9 },
  { id: 'courses', name: 'Courses', path: '/courses', category: 'page', icon: BookOpen, description: 'Course materials and content', keywords: ['subjects', 'classes', 'materials'], priority: 9 },
  { id: 'timetable', name: 'Timetable', path: '/timetable', category: 'page', icon: CalendarDays, description: 'Class schedule and calendar', keywords: ['schedule', 'calendar', 'classes', 'time'], priority: 9 },
  { id: 'study', name: 'Study', path: '/study', category: 'page', icon: PencilSquare, description: 'Study tools and notes', keywords: ['notes', 'study', 'tools'], priority: 8 },
  { id: 'directory', name: 'Directory', path: '/directory', category: 'page', icon: UserGroup, description: 'Student information', keywords: ['contacts', 'people', 'students'], priority: 6 },
  { id: 'messages', name: 'Direqt Messages', path: '/direqt-messages', category: 'page', icon: ChatBubbleLeftRight, description: 'Direqt messaging system', keywords: ['chat', 'messages', 'communication'], priority: 7 },
  { id: 'news', name: 'News', path: '/news', category: 'page', icon: Newspaper, description: 'Latest News and updates', keywords: ['News', 'updates', 'information'], priority: 5 },
  { id: 'notices', name: 'Notices', path: '/notices', category: 'page', icon: BellAlert, description: 'Important notices from staff', keywords: ['notifications', 'alerts', 'important'], priority: 6 },
  { id: 'portals', name: 'Portals', path: '/portals', category: 'page', icon: Squares2x2, description: 'External portals and links', keywords: ['portals', 'external', 'links', 'websites'], priority: 5 },
  { id: 'reports', name: 'Reports', path: '/reports', category: 'page', icon: DocumentDuplicate, description: 'Academic reports', keywords: ['grades', 'progress', 'academic'], priority: 7 },
  { id: 'settings', name: 'Settings', path: '/settings', category: 'page', icon: Cog6Tooth, description: 'App configuration and preferences', keywords: ['config', 'preferences', 'options'], priority: 4 },
  { id: 'welcome', name: 'Welcome', path: '/welcome', category: 'page', icon: Sparkles, description: 'SEQTA Welcome Page', keywords: ['welcome', 'seqta', 'help'], priority: 3 },
];

// Quick actions
const ACTIONS: SearchItem[] = [
  { id: 'action-theme', name: 'Toggle Theme', path: '/settings/theme-store', category: 'action', icon: Sparkles, description: 'Switch between light and dark mode', keywords: ['dark', 'light', 'appearance'], shortcut: 'Ctrl+Shift+T' },
  { id: 'action-focus', name: 'Start Focus Timer', path: '/?focus=true', category: 'action', icon: Fire, description: 'Begin a focused study session', keywords: ['timer', 'focus', 'study', 'pomodoro'], shortcut: 'Ctrl+F' },
  { id: 'action-refresh', name: 'Refresh Data', path: '/?refresh=true', category: 'action', icon: ArrowPath, description: 'Sync latest information', keywords: ['sync', 'update', 'reload'], shortcut: 'Ctrl+R' },
  { id: 'action-fullscreen', name: 'Toggle Fullscreen', path: '#', category: 'action', icon: Squares2x2, description: 'Enter or exit fullscreen mode', keywords: ['fullscreen', 'maximize', 'window'], shortcut: 'F11' },
  { id: 'action-minimize', name: 'Minimize Window', path: '#', category: 'action', icon: XMark, description: 'Minimize the application window', keywords: ['minimize', 'hide', 'window'] },
  { id: 'action-close', name: 'Close Application', path: '#', category: 'action', icon: XMark, description: 'Close the application', keywords: ['close', 'quit', 'exit'], shortcut: 'Ctrl+Q' },
  { id: 'action-sidebar-toggle', name: 'Toggle Sidebar', path: '#', category: 'action', icon: Squares2x2, description: 'Show or hide the sidebar', keywords: ['sidebar', 'navigation', 'menu'] },
];

// Settings
const SETTINGS: SearchItem[] = [
  { id: 'settings-plugins', name: 'Plugin Settings', path: '/settings/plugins', category: 'setting', icon: Cog6Tooth, description: 'Manage extensions and plugins', keywords: ['extensions', 'addons', 'plugins'] },
  { id: 'settings-theme', name: 'Theme Store', path: '/settings/theme-store', category: 'setting', icon: Sparkles, description: 'Customize app appearance', keywords: ['themes', 'colors', 'appearance', 'style'] },
  { id: 'toggle-animations', name: 'Toggle Enhanced Animations', path: '#', category: 'setting', icon: Sparkles, description: 'Enable or disable enhanced animations', keywords: ['animations', 'effects', 'performance'] },
  { id: 'toggle-sidebar-collapse', name: 'Toggle Auto-Collapse Sidebar', path: '#', category: 'setting', icon: Squares2x2, description: 'Automatically collapse sidebar on small screens', keywords: ['sidebar', 'collapse', 'auto'] },
  { id: 'toggle-weather', name: 'Toggle Weather Widget', path: '#', category: 'setting', icon: Cloud, description: 'Show or hide weather information', keywords: ['weather', 'forecast', 'widget'] },
  { id: 'toggle-notifications', name: 'Toggle Notifications', path: '#', category: 'setting', icon: BellAlert, description: 'Enable or disable desktop notifications', keywords: ['notifications', 'alerts', 'desktop'] },
];

export const searchItems: SearchItem[] = [...PAGES, ...ACTIONS, ...SETTINGS];

export const categories: SearchCategory[] = [
  {
    id: 'pages',
    name: 'Pages',
    icon: Squares2x2,
    color: 'blue',
    items: PAGES
  },
  {
    id: 'actions',
    name: 'Quick Actions',
    icon: CommandLine,
    color: 'purple',
    items: ACTIONS
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: Cog6Tooth,
    color: 'green',
    items: SETTINGS
  }
];

export const shortcuts = [
  { key: 'Ctrl+K', description: 'Open search' },
  { key: 'Ctrl+Shift+K', description: 'Command mode' },
  { key: 'Ctrl+/', description: 'Fuzzy search' },
  { key: 'Ctrl+H', description: 'Search history' },
];
