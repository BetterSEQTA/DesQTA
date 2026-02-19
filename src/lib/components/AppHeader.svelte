<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import WeatherWidget from './WeatherWidget.svelte';
  import UserDropdown from './UserDropdown.svelte';
  import QuestionnaireWidget from './QuestionnaireWidget.svelte';
  import QuestionnaireModal from './QuestionnaireModal.svelte';
  import {
    Icon,
    Bars3,
    Bell,
    Minus,
    Square2Stack,
    XMark,
    ChatBubbleLeftRight,
    ClipboardDocumentList,
    DocumentText,
    CloudArrowUp,
    NoSymbol,
  } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { derived, writable } from 'svelte/store';
  import { fly } from 'svelte/transition';
  import PagesMenu from './PagesMenu.svelte';
  import GlobalSearch from './search/GlobalSearchOptimized.svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';
  import { flushAll } from '../services/syncService';
  import {
    questionnaireService,
    type QuestionnaireQuestion,
  } from '../services/questionnaireService';
  import { cloudUserStore } from '../services/cloudAuthService';
  import { _ } from '../i18n';
  import T from './T.svelte';

  interface Props {
    sidebarOpen: boolean;
    weatherEnabled: boolean;
    weatherData: any;
    userInfo?: UserInfo;
    showUserDropdown: boolean;
    isFullscreen?: boolean;
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
    message?: {
      messageID: number;
      title: string;
      subtitle: string;
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
    isFullscreen = false,
    onToggleSidebar,
    onToggleUserDropdown,
    onLogout,
    onShowAbout,
    onClickOutside,
    disableSchoolPicture = false,
  }: Props = $props();

  const appWindow = Window.getCurrent();

  const pages = [
    { nameKey: 'navigation.dashboard', path: '/dashboard' },
    { nameKey: 'navigation.analytics', path: '/analytics' },
    { nameKey: 'navigation.assessments', path: '/assessments' },
    { nameKey: 'navigation.courses', path: '/courses' },
    { nameKey: 'navigation.directory', path: '/directory' },
    { nameKey: 'navigation.goals', path: '/goals' },
    { nameKey: 'navigation.forums', path: '/forums' },
    { nameKey: 'navigation.folios', path: '/folios' },
    { nameKey: 'navigation.messages', path: '/direqt-messages' },
    { nameKey: 'navigation.news', path: '/news' },
    { nameKey: 'navigation.notices', path: '/notices' },
    { nameKey: 'navigation.qr_signin', path: '/qrsignin' },
    { nameKey: 'navigation.reports', path: '/reports' },
    { nameKey: 'navigation.settings', path: '/settings' },
    { nameKey: 'navigation.timetable', path: '/timetable' },
    { nameKey: 'navigation.welcome', path: '/welcome' },
  ];

  const searchStore = writable('');
  const showDropdownStore = writable(false);
  const filteredPages = derived(searchStore, ($search) =>
    $search
      ? pages.filter((p) => {
          const translatedName = $_(`${p.nameKey}`, { default: p.nameKey });
          return translatedName.toLowerCase().includes($search.toLowerCase());
        })
      : pages,
  );

  let selectedIndex = $state(-1);
  let showPagesMenu = $state(false);
  let globalSearchEnabled = $state(false);
  let autoDismissMessageNotifications = $state(false);
  let showNotifications = $state(false);
  let loadingNotifications = $state(false);
  let notifications = $state<Notification[]>([]);
  let unreadNotifications = $state(0);
  let isMobile = $state(false);
  let showNotificationsModal = $state(false);
  let showQuestionnaireModal = $state(false);
  let currentQuestion = $state<QuestionnaireQuestion | null>(null);
  let showCloudSignOutInfo = $state(false);

  function handleSelect(page: { nameKey: string; path: string }) {
    searchStore.set('');
    showDropdownStore.set(false);
    goto(page.path);
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

  function closePagesMenu() {
    showPagesMenu = false;
  }

  async function loadGlobalSearchSetting() {
    logger.debug('AppHeader', 'loadGlobalSearchSetting', 'Loading global search setting');

    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['global_search_enabled'] });
      globalSearchEnabled = subset?.global_search_enabled ?? true; // Default to enabled
      logger.info(
        'AppHeader',
        'loadGlobalSearchSetting',
        `Global search enabled: ${globalSearchEnabled}`,
      );
    } catch (error) {
      logger.error(
        'AppHeader',
        'loadGlobalSearchSetting',
        `Failed to load global search setting: ${error}`,
        { error },
      );
      globalSearchEnabled = true; // Default to enabled on error
    }
  }

  async function loadAutoDismissMessageNotificationsSetting() {
    logger.debug(
      'AppHeader',
      'loadAutoDismissMessageNotificationsSetting',
      'Loading auto dismiss message notifications setting',
    );

    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['auto_dismiss_message_notifications'],
      });
      autoDismissMessageNotifications = subset?.auto_dismiss_message_notifications ?? false; // Default to disabled
      logger.info(
        'AppHeader',
        'loadAutoDismissMessageNotificationsSetting',
        `Auto dismiss message notifications enabled: ${autoDismissMessageNotifications}`,
      );
    } catch (error) {
      logger.error(
        'AppHeader',
        'loadAutoDismissMessageNotificationsSetting',
        `Failed to load auto dismiss message notifications setting: ${error}`,
        { error },
      );
      autoDismissMessageNotifications = false; // Default to disabled on error
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
          hash: '#?page=/home',
        },
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

      // Always update notifications, even if empty (to reflect dismissed notifications)
      notifications = notificationsData;
      unreadNotifications = notificationsData.length;
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
    } else if (notification.message) {
      return notification.message.title;
    }
    return 'Notification';
  }

  function getNotificationSubtitle(notification: Notification): string {
    if (notification.coneqtAssessments) {
      return `${notification.coneqtAssessments.subjectCode} - ${notification.coneqtAssessments.subtitle}`;
    } else if (notification.message) {
      return notification.message.subtitle;
    }
    return '';
  }

  function getNotificationIcon(notification: Notification) {
    if (notification.type === 'message' || notification.message) return ChatBubbleLeftRight;
    if (notification.type === 'coneqtassessments' || notification.coneqtAssessments)
      return ClipboardDocumentList;
    if (notification.type === 'report' || notification.report) return DocumentText;
    return Bell;
  }

  async function handleNotificationClick(notification: Notification) {
    if (notification.type === 'coneqtassessments' && notification.coneqtAssessments) {
      const { assessmentID, metaclassID } = notification.coneqtAssessments;
      // Extract year from notification timestamp (fallback to current year if unavailable)
      const notificationYear = new Date(notification.timestamp).getFullYear();
      showNotifications = false;
      showNotificationsModal = false;
      goto(`/assessments/${assessmentID}/${metaclassID}?year=${notificationYear}`);
    } else if (notification.type === 'report') {
      showNotifications = false;
      showNotificationsModal = false;
      // Report notifications don't have UUID in the interface, so just go to reports page
      goto('/reports');
    } else if (notification.type === 'message' && notification.message) {
      const id = notification.message.messageID;

      // If auto-dismiss is enabled, dismiss the notification before navigating
      if (autoDismissMessageNotifications) {
        try {
          // Optimistically remove the notification from the list immediately
          notifications = notifications.filter(
            (n) => n.notificationID !== notification.notificationID,
          );
          unreadNotifications = Math.max(0, unreadNotifications - 1);

          // Dismiss on server
          await seqtaFetch('/seqta/student/notification/dismiss', {
            method: 'POST',
            body: {
              ids: [notification.notificationID],
            },
          });
          logger.info(
            'AppHeader',
            'handleNotificationClick',
            `Dismissed message notification ${notification.notificationID}`,
          );

          // Refresh notifications list in background to ensure sync
          fetchNotifications().catch((error) => {
            logger.error(
              'AppHeader',
              'handleNotificationClick',
              `Failed to refresh notifications after dismiss: ${error}`,
              { error },
            );
          });
        } catch (error) {
          logger.error(
            'AppHeader',
            'handleNotificationClick',
            `Failed to dismiss notification: ${error}`,
            { error },
          );
          // Re-fetch to restore the notification if dismiss failed
          await fetchNotifications();
        }
      }

      showNotifications = false;
      showNotificationsModal = false;
      goto(`/direqt-messages?messageID=${id}`);
    }
  }

  onMount(() => {
    loadGlobalSearchSetting();
    loadAutoDismissMessageNotificationsSetting();
    fetchNotifications();
    // Attempt to flush any queued offline changes on header mount
    flushAll().catch(() => {});

    // Check for mobile on mount and resize
    const checkMobile = async () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
      if (tauri_platform == 'ios' || tauri_platform == 'android') {
        isMobile = true;
      } else {
        isMobile = false;
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Add click outside handler for notifications and cloud sign-out info
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showNotifications && !target.closest('.notification-dropdown')) {
        showNotifications = false;
      }
      if (showCloudSignOutInfo && !target.closest('.cloud-status-dropdown')) {
        showCloudSignOutInfo = false;
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
  let sortedNotifications = $state<Notification[]>([]);

  $effect(() => {
    sortedNotifications = [...notifications].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  });
</script>

<header
  class="flex justify-between items-center px-3 pr-2 w-full h-16 relative z-999999 theme-bg {isFullscreen
    ? ''
    : sidebarOpen
      ? 'rounded-tr-2xl'
      : 'rounded-t-2xl'}"
  data-tauri-drag-region>
  <div class="flex items-center space-x-4">
    <button
      class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 ease-in-out transform bg-white hover:accent-bg dark:bg-zinc-800 focus:outline-hidden focus:ring-2 accent-ring hover:scale-105 active:scale-95 playful"
      onclick={onToggleSidebar}
      aria-label={$_('header.toggle_sidebar', { default: 'Toggle sidebar' })}>
      <Icon src={Bars3} class="w-5 h-5 text-zinc-700 dark:text-zinc-300 dark:hover:text-white" />
    </button>
    <div class="flex items-center space-x-3">
      <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="w-8 h-8 invert dark:invert-0" />
      <h1
        class="text-xl font-bold text-transparent bg-clip-text bg-linear-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-300">
        DesQTA
      </h1>
      {#if weatherEnabled && weatherData}
        <WeatherWidget {weatherData} />
      {/if}
      <QuestionnaireWidget
        onOpenModal={(question) => {
          currentQuestion = question;
          showQuestionnaireModal = true;
        }} />
    </div>
  </div>
  <div class="flex flex-1 justify-center">
    {#if globalSearchEnabled}
      <GlobalSearch />
    {/if}
  </div>

  <div class="flex items-center space-x-2">
    {#if userInfo}
      <UserDropdown
        {userInfo}
        {showUserDropdown}
        {onToggleUserDropdown}
        {onLogout}
        {onShowAbout}
        {onClickOutside}
        {disableSchoolPicture} />
    {/if}

    <!-- Cloud sync status indicator -->
    <div class="relative cloud-status-dropdown">
      {#if $cloudUserStore}
        <a
          href="/settings"
          class="flex relative justify-center items-center rounded-xl border transition-all duration-200 ease-in-out transform size-12 bg-white/60 border-zinc-200/40 hover:accent-bg dark:bg-zinc-800/60 dark:border-zinc-700/40 focus:outline-hidden focus:ring-2 accent-ring hover:scale-105 active:scale-95 playful"
          aria-label={$_('header.cloud_signed_in', { default: 'Signed in to BetterSEQTA Plus' })}>
          <Icon src={CloudArrowUp} class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </a>
      {:else}
        <button
          type="button"
          class="flex relative justify-center items-center rounded-xl border transition-all duration-200 ease-in-out transform size-12 bg-white/60 border-zinc-200/40 hover:accent-bg dark:bg-zinc-800/60 dark:border-zinc-700/40 focus:outline-hidden focus:ring-2 accent-ring hover:scale-105 active:scale-95 playful"
          aria-label={$_('header.cloud_not_signed_in', { default: 'Not signed in to BetterSEQTA Plus' })}
          onclick={() => (showCloudSignOutInfo = !showCloudSignOutInfo)}>
          <span class="relative inline-flex justify-center items-center">
            <Icon src={CloudArrowUp} class="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
            <Icon
              src={NoSymbol}
              class="absolute w-4 h-4 text-red-500 dark:text-red-400 pointer-events-none"
              aria-hidden="true" />
          </span>
        </button>
        {#if showCloudSignOutInfo}
          <div
            class="absolute right-0 z-50 mt-2 w-72 rounded-xl border shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-zinc-900/95 border-zinc-200/60 dark:border-zinc-700/60 p-4"
            transition:fly={{ y: -8, duration: 200, opacity: 0, easing: (t) => t * (2 - t) }}
            style="transform-origin: top right;">
            <p class="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
              <T key="header.cloud_signed_out_message" fallback="You're signed out of BetterSEQTA Plus. Sign in via Settings to sync your data across devices." />
            </p>
            <a
              href="/settings"
              class="flex justify-center items-center gap-2 w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 accent-bg hover:scale-[1.02] active:scale-95"
              onclick={() => (showCloudSignOutInfo = false)}>
              <T key="header.cloud_go_to_settings" fallback="Go to Settings" />
            </a>
          </div>
        {/if}
      {/if}
    </div>

    <div class="relative notification-dropdown">
      <button
        class="flex relative justify-center items-center rounded-xl border transition-all duration-200 ease-in-out transform size-12 bg-white/60 border-zinc-200/40 hover:accent-bg dark:bg-zinc-800/60 dark:border-zinc-700/40 focus:outline-hidden focus:ring-2 accent-ring hover:scale-105 active:scale-95 playful"
        onclick={toggleNotifications}>
        <Icon src={Bell} class="w-5 h-5 text-zinc-700 dark:text-zinc-300 hover:text-white" />
        {#if unreadNotifications > 0}
          <span
            class="flex absolute -top-1 -right-1 justify-center items-center px-1 translate-x-[calc(50%-3px)] h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadNotifications}
          </span>
        {/if}
      </button>

      {#if showNotifications}
        <div
          class="overflow-y-auto absolute right-0 z-50 mt-2 w-96 max-h-96 rounded-xl border shadow-2xl backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border-white/20 dark:border-zinc-700/40"
          transition:fly={{ y: -8, duration: 200, opacity: 0, easing: (t) => t * (2 - t) }}
          style="transform-origin: top right;">
          <div class="p-4 border-b border-zinc-200 dark:border-zinc-700">
            <div class="flex justify-between items-center">
              <h3
                class="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Icon src={Bell} class="w-5 h-5 opacity-80" />
                Notifications
              </h3>
              <button
                class="transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1"
                onclick={clearNotifications}>
                <Icon src={XMark} class="w-4 h-4" />
                Clear all
              </button>
            </div>
          </div>

          <div class="p-2">
            {#if loadingNotifications}
              <div class="flex justify-center items-center py-8">
                <div
                  class="w-6 h-6 rounded-full border-2 animate-spin border-accent/30 border-t-accent">
                </div>
              </div>
            {:else if notifications.length === 0}
              <div class="py-8 text-center text-zinc-500 dark:text-zinc-400">
                <Icon src={Bell} class="mx-auto mb-2 w-12 h-12 opacity-50" />
                <p>No notifications</p>
              </div>
            {:else}
              {#each notifications as notification (notification.notificationID)}
                <button
                  type="button"
                  class="p-3 w-full text-left rounded-lg transition-all duration-200 ease-in-out transform cursor-pointer hover:bg-white/40 dark:hover:bg-zinc-700/40 hover:scale-[1.01] active:scale-[0.99]"
                  aria-label={getNotificationTitle(notification)}
                  onclick={() => handleNotificationClick(notification)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleNotificationClick(notification);
                    }
                  }}>
                  <div class="flex gap-3">
                    <div class="shrink-0 mt-1.5">
                      <Icon src={getNotificationIcon(notification)} class="w-4 h-4 text-accent" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate text-zinc-900 dark:text-white">
                        {getNotificationTitle(notification)}
                      </p>
                      {#if getNotificationSubtitle(notification)}
                        <p class="mt-1 text-xs truncate text-zinc-600 dark:text-zinc-400">
                          {getNotificationSubtitle(notification)}
                        </p>
                      {/if}
                      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
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

    <!-- Window Controls - Desktop Only -->
    {#if !isMobile}
      <div class="flex items-center ml-4 space-x-2">
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 ease-in-out transform hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 playful"
          onclick={() => appWindow.minimize()}
          aria-label={$_('header.minimize', { default: 'Minimize' })}>
          <Icon src={Minus} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 ease-in-out transform hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 playful"
          onclick={() => appWindow.toggleMaximize()}
          aria-label={$_('header.maximize', { default: 'Maximize' })}>
          <Icon src={Square2Stack} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          class="flex justify-center items-center w-8 h-8 rounded-lg transition-all duration-200 ease-in-out transform group hover:bg-red-500 hover:scale-105 active:scale-95 playful"
          onclick={() => appWindow.close()}
          aria-label={$_('header.close', { default: 'Close' })}>
          <Icon
            src={XMark}
            class="w-4 h-4 transition duration-200 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
        </button>
      </div>
    {/if}
  </div>
  {#if showPagesMenu}
    <PagesMenu on:close={closePagesMenu} />
  {/if}
  {#if showNotificationsModal}
    <div
      class="fixed inset-0 z-9999999 flex items-center justify-center bg-black/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={$_('header.notifications') || 'Notifications'}
      tabindex="0"
      onclick={() => {
        showNotificationsModal = false;
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') showNotificationsModal = false;
      }}>
      <div
        class="flex relative flex-col p-0 mx-auto w-full max-w-xl rounded-2xl border shadow-2xl backdrop-blur-xl pointer-events-auto bg-white/70 dark:bg-zinc-900/80 border-white/20 dark:border-zinc-700/40 animate-in"
        role="document">
        <div
          class="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">Notifications</h3>
          <button
            class="px-3 py-1 ml-2 text-base font-semibold rounded-lg transition-all duration-200 ease-in-out transform bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:scale-105 active:scale-95"
            onclick={() => {
              showNotificationsModal = false;
            }}>
            Close
          </button>
        </div>
        <div class="p-2 max-h-[70vh] overflow-y-auto">
          {#if loadingNotifications}
            <div class="flex justify-center items-center py-8">
              <div
                class="w-6 h-6 rounded-full border-2 animate-spin border-accent/30 border-t-accent">
              </div>
            </div>
          {:else if sortedNotifications.length === 0}
            <div class="py-8 text-center text-zinc-500 dark:text-zinc-400">
              <Icon src={Bell} class="mx-auto mb-2 w-12 h-12 opacity-50" />
              <p>No notifications</p>
            </div>
          {:else}
            {#each sortedNotifications as notification (notification.notificationID)}
              <button
                type="button"
                class="p-3 w-full text-left rounded-lg transition-all duration-200 ease-in-out transform cursor-pointer hover:bg-white/40 dark:hover:bg-zinc-700/40 hover:scale-[1.01] active:scale-[0.99]"
                aria-label={getNotificationTitle(notification)}
                onclick={() => handleNotificationClick(notification)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleNotificationClick(notification);
                  }
                }}>
                <div class="flex gap-3">
                  <div class="shrink-0 mt-1.5">
                    <Icon src={getNotificationIcon(notification)} class="w-4 h-4 text-accent" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate text-zinc-900 dark:text-white">
                      {getNotificationTitle(notification)}
                    </p>
                    {#if getNotificationSubtitle(notification)}
                      <p class="mt-1 text-xs truncate text-zinc-600 dark:text-zinc-400">
                        {getNotificationSubtitle(notification)}
                      </p>
                    {/if}
                    <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
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
  <QuestionnaireModal
    bind:open={showQuestionnaireModal}
    question={currentQuestion}
    onclose={() => {
      showQuestionnaireModal = false;
    }} />
</header>
