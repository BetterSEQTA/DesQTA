<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import WeatherWidget from './WeatherWidget.svelte';
  import UserDropdown from './UserDropdown.svelte';
  import {
    Icon,
    Bars3,
    Bell,
    Minus,
    Square2Stack,
    XMark,
    Squares2x2
  } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { derived, writable } from 'svelte/store';
  import { fade, scale } from 'svelte/transition';
  import PagesMenu from './PagesMenu.svelte';
  import GlobalSearch from './GlobalSearch.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';

  interface Props {
    sidebarOpen: boolean;
    weatherEnabled: boolean;
    weatherData: any;
    userInfo?: UserInfo;
    showUserDropdown: boolean;
    onToggleSidebar: () => void;
    onToggleUserDropdown: () => void;
    onLogout: () => void;
    onShowAbout: () => void;
    onClickOutside: (event: MouseEvent) => void;
    disableSchoolPicture?: boolean;
  }

  interface UserInfo {
    clientIP: string;
    email: string;
    id: number;
    lastAccessedTime: number;
    meta: {
      code: string;
      governmentID: string;
    };
    personUUID: string;
    saml: [
      {
        autologin: boolean;
        label: string;
        method: string;
        request: string;
        sigalg: URL;
        signature: string;
        slo: boolean;
        url: URL;
      },
    ];
    status: string;
    type: string;
    userCode: string;
    userDesc: string;
    userName: string;
    displayName?: string;
    profilePicture?: string;
  }

  interface Notification {
    notificationID: number;
    type: string;
    timestamp: string;
    report?: {
      title: string;
    };
    coneqtAssessments?: {
      programmeID: number;
      metaclassID: number;
      subtitle: string;
      term: string;
      title: string;
      assessmentID: number;
      subjectCode: string;
    };
  }

  interface HeartbeatResponse {
    payload: {
      identifier: string;
      version: string;
      uuid: string;
      notifications: Notification[];
    };
    status: string;
  }

  let {
    sidebarOpen,
    weatherEnabled,
    weatherData,
    userInfo,
    showUserDropdown,
    onToggleSidebar,
    onToggleUserDropdown,
    onLogout,
    onShowAbout,
    onClickOutside,
    disableSchoolPicture = false
  }: Props = $props();

  const appWindow = Window.getCurrent();

  const pages = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Assessments', path: '/assessments' },
    { name: 'Courses', path: '/courses' },
    { name: 'Directory', path: '/directory' },
    { name: 'Direqt Messages', path: '/direqt-messages' },
    { name: 'News', path: '/news' },
    { name: 'Notices', path: '/notices' },
    { name: 'QR Sign In', path: '/qrsignin' },
    { name: 'Reports', path: '/reports' },
    { name: 'Settings', path: '/settings' },
    { name: 'Timetable', path: '/timetable' },
    { name: 'Welcome', path: '/welcome' },
  ];

  const searchStore = writable('');
  const showDropdownStore = writable(false);
  const filteredPages = derived(searchStore, ($search) =>
    $search ? pages.filter((p) => p.name.toLowerCase().includes($search.toLowerCase())) : pages
  );

  let searchInput: HTMLInputElement | null = null;
  let selectedIndex = $state(-1);
  let showPagesMenu = $state(false);
  let globalSearchEnabled = $state(true);
  let showNotifications = $state(false);
  let loadingNotifications = $state(false);
  let notifications = $state<Notification[]>([]);
  let unreadNotifications = $state(0);
  let isMobile = $state(false);
  let showNotificationsModal = $state(false);

  function handleSelect(page: { name: string; path: string }) {
    searchStore.set('');
    showDropdownStore.set(false);
    goto(page.path);
  }

  function handleFocus() {
    showDropdownStore.set(true);
  }

  function handleBlur() {
    setTimeout(() => showDropdownStore.set(false), 100);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!$showDropdownStore || $filteredPages.length === 0) return;
    if (e.key === 'ArrowDown') {
      selectedIndex = (selectedIndex + 1) % $filteredPages.length;
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      selectedIndex = (selectedIndex - 1 + $filteredPages.length) % $filteredPages.length;
      e.preventDefault();
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      handleSelect($filteredPages[selectedIndex]);
      e.preventDefault();
    }
  }

  function openPagesMenu() {
    showPagesMenu = true;
    setTimeout(() => {
      const input = document.getElementById('pages-search-input');
      if (input) input.focus();
    }, 10);
  }

  function closePagesMenu() {
    showPagesMenu = false;
  }

  async function loadGlobalSearchSetting() {
    logger.debug('AppHeader', 'loadGlobalSearchSetting', 'Loading global search setting');
    
    try {
      const settings = await invoke<{ global_search_enabled?: boolean }>('get_settings');
      globalSearchEnabled = settings.global_search_enabled ?? true;
      logger.info('AppHeader', 'loadGlobalSearchSetting', `Global search enabled: ${globalSearchEnabled}`);
    } catch (error) {
      logger.error('AppHeader', 'loadGlobalSearchSetting', `Failed to load global search setting: ${error}`, { error });
      globalSearchEnabled = true; // Default to enabled if loading fails
    }
  }

  async function fetchNotifications() {
    if (loadingNotifications) return;
    
    loadingNotifications = true;
    try {
      const response = await seqtaFetch('/seqta/student/heartbeat', {
        method: 'POST',
        body: {
          timestamp: '1970-01-01 00:00:00.0',
          hash: '#?page=/home'
        }
      });

      // Parse response if it's a string
      let parsedResponse = response;
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch (e) {
          console.error('Failed to parse response as JSON:', e);
          return;
        }
      }

      // Handle different possible response structures
      let notificationsData: Notification[] = [];
      
      if (parsedResponse.payload?.notifications) {
        notificationsData = parsedResponse.payload.notifications;
      } else if (parsedResponse.notifications) {
        notificationsData = parsedResponse.notifications;
      } else if (Array.isArray(parsedResponse)) {
        notificationsData = parsedResponse;
      }
      
      if (notificationsData.length > 0) {
        notifications = notificationsData;
        unreadNotifications = notificationsData.length;
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      loadingNotifications = false;
    }
  }

  function toggleNotifications() {
    logger.debug('AppHeader', 'toggleNotifications', 'Toggling notifications panel', { isMobile });
    
    if (isMobile) {
      showNotificationsModal = !showNotificationsModal;
      if (showNotificationsModal && notifications.length === 0) {
        logger.debug('AppHeader', 'toggleNotifications', 'Fetching notifications for mobile modal');
        fetchNotifications();
      }
    } else {
      showNotifications = !showNotifications;
      if (showNotifications && notifications.length === 0) {
        fetchNotifications();
      }
    }
  }

  function clearNotifications() {
    notifications = [];
    unreadNotifications = 0;
    showNotifications = false;
  }

  function formatNotificationTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  function getNotificationTitle(notification: Notification): string {
    if (notification.report) {
      return notification.report.title;
    } else if (notification.coneqtAssessments) {
      return notification.coneqtAssessments.title;
    }
    return 'Notification';
  }

  function getNotificationSubtitle(notification: Notification): string {
    if (notification.coneqtAssessments) {
      return `${notification.coneqtAssessments.subjectCode} - ${notification.coneqtAssessments.subtitle}`;
    }
    return '';
  }

  function handleNotificationClick(notification: Notification) {
    if (notification.type === 'coneqtassessments' && notification.coneqtAssessments) {
      const { assessmentID, metaclassID } = notification.coneqtAssessments;
      goto(`/assessments/${assessmentID}/${metaclassID}`);
    } else if (notification.type === 'report') {
      goto('/reports');
    }
  }

  onMount(() => {
    loadGlobalSearchSetting();
    fetchNotifications();
    
    // Check for mobile on mount and resize
    const checkMobile = async () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM
      if (tauri_platform == "ios" || tauri_platform == "android") {
        isMobile = true
      } else {
        isMobile = false
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Add click outside handler for notifications
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showNotifications && !target.closest('.notification-dropdown')) {
        showNotifications = false;
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('click', handleClickOutside);
    };
  });

  $effect(() => {
    if (!$showDropdownStore || $filteredPages.length === 0) selectedIndex = -1;
  });
  $effect(() => {
    if ($searchStore) selectedIndex = -1;
  });

  // Sort notifications by timestamp descending (latest first)
  let sortedNotifications = $derived([...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
</script>

<header class="flex justify-between items-center px-3 pr-2 w-full h-16 relative z-[999999]" data-tauri-drag-region style="background: var(--background-color);">
  <div class="flex items-center space-x-4">
    <button
      class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 bg-slate-100 hover:accent-bg dark:bg-slate-800 focus:outline-none focus:ring-2 accent-ring playful"
      onclick={onToggleSidebar}
      aria-label="Toggle sidebar">
      <Icon src={Bars3} class="w-5 h-5 text-slate-700 dark:text-slate-300 hover:text-white" />
    </button>
    <div class="flex items-center space-x-3">
      <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="w-8 h-8 invert dark:invert-0" />
      <h1
        class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
        DesQTA
      </h1>
    {#if weatherEnabled && weatherData}
      <WeatherWidget {weatherData} />
    {/if}
  </div>
  </div>
  <div class="flex-1 flex justify-center">
    {#if globalSearchEnabled}
    <GlobalSearch />
    {/if}
  </div>
  <div class="flex items-center space-x-2">
    <div class="relative notification-dropdown">
    <button
      class="flex relative justify-center items-center rounded-xl border transition-all duration-200 size-12 bg-white/60 border-slate-200/40 hover:accent-bg dark:bg-slate-800/60 dark:border-slate-700/40 focus:outline-none focus:ring-2 accent-ring playful"
        onclick={toggleNotifications}>
      <Icon src={Bell} class="w-5 h-5 text-slate-700 dark:text-slate-300 hover:text-white" />
      {#if unreadNotifications > 0}
        <span
          class="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {unreadNotifications}
        </span>
      {/if}
    </button>

      {#if showNotifications}
        <div
          class="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50"
          transition:scale={{ duration: 200 }}
          style="transform-origin: top right;">
          <div class="p-4 border-b border-slate-200 dark:border-slate-700">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Notifications</h3>
              <button
                class="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                onclick={clearNotifications}>
                Clear all
              </button>
            </div>
          </div>
          
          <div class="p-2">
            {#if loadingNotifications}
              <div class="flex justify-center items-center py-8">
                <div class="w-6 h-6 rounded-full border-2 animate-spin border-accent/30 border-t-accent"></div>
              </div>
            {:else if notifications.length === 0}
              <div class="text-center py-8 text-slate-500 dark:text-slate-400">
                <Icon src={Bell} class="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            {:else}
              {#each notifications as notification (notification.notificationID)}
                <button type="button"
                  class="p-3 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                  role="button"
                  aria-label={getNotificationTitle(notification)}
                  onclick={() => handleNotificationClick(notification)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleNotificationClick(notification); } }}>
                  <div class="flex gap-3">
                    <div class="flex-shrink-0 w-2 h-2 bg-accent rounded-full mt-2"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {getNotificationTitle(notification)}
                      </p>
                      {#if getNotificationSubtitle(notification)}
                        <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                          {getNotificationSubtitle(notification)}
                        </p>
                      {/if}
                      <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {formatNotificationTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </button>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    {#if userInfo}
      <UserDropdown
        {userInfo}
        {showUserDropdown}
        {onToggleUserDropdown}
        {onLogout}
        {onShowAbout}
        {onClickOutside}
        disableSchoolPicture={disableSchoolPicture}
      />
    {/if}

    <!-- Window Controls - Desktop Only -->
    {#if !isMobile}
      <div class="flex items-center ml-4 space-x-2">
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 accent-ring playful"
          onclick={() => appWindow.minimize()}
          aria-label="Minimize">
          <Icon src={Minus} class="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 accent-ring playful"
          onclick={() => appWindow.toggleMaximize()}
          aria-label="Maximize">
          <Icon src={Square2Stack} class="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 group hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 playful"
          onclick={() => appWindow.close()}
          aria-label="Close">
          <Icon src={XMark} class="w-4 h-4 transition duration-200 text-slate-600 dark:text-slate-400 group-hover:text-white" />
        </button>
      </div>
    {/if}
  </div>
  {#if showPagesMenu}
    <PagesMenu on:close={closePagesMenu} />
  {/if}
  {#if showNotificationsModal}
    <div
      class="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      tabindex="0"
      onclick={() => { showNotificationsModal = false; }}
      onkeydown={e => { if (e.key === 'Escape') showNotificationsModal = false; }}
    >
      <div class="relative w-full max-w-xl mx-auto rounded-2xl bg-white/70 dark:bg-gray-900/80 shadow-2xl border border-white/20 dark:border-gray-700/40 backdrop-blur-xl p-0 flex flex-col animate-in pointer-events-auto" role="document">
        <div class="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Notifications</h3>
          <button
            class="ml-2 px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-semibold text-base"
            onclick={() => { showNotificationsModal = false; }}>
            Close
          </button>
        </div>
        <div class="p-2 max-h-[70vh] overflow-y-auto">
          {#if loadingNotifications}
            <div class="flex justify-center items-center py-8">
              <div class="w-6 h-6 rounded-full border-2 animate-spin border-accent/30 border-t-accent"></div>
            </div>
          {:else if sortedNotifications.length === 0}
            <div class="text-center py-8 text-slate-500 dark:text-slate-400">
              <Icon src={Bell} class="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          {:else}
            {#each sortedNotifications as notification (notification.notificationID)}
              <button type="button"
                class="p-3 w-full text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                role="button"
                aria-label={getNotificationTitle(notification)}
                onclick={() => handleNotificationClick(notification)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleNotificationClick(notification); } }}>
                <div class="flex gap-3">
                  <div class="flex-shrink-0 w-2 h-2 bg-accent rounded-full mt-2"></div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {getNotificationTitle(notification)}
                    </p>
                    {#if getNotificationSubtitle(notification)}
                      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                        {getNotificationSubtitle(notification)}
                      </p>
                    {/if}
                    <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {formatNotificationTime(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</header>