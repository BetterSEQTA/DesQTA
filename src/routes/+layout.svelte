<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { Window } from '@tauri-apps/api/window';
  const appWindow = Window.getCurrent();
  import AboutModal from '../lib/components/AboutModal.svelte';
  import WhatsNewModal from '../lib/components/WhatsNewModal.svelte';
  import AppHeader from '../lib/components/AppHeader.svelte';
  import AppSidebar from '../lib/components/AppSidebar.svelte';
  import MobileBottomNav from '../lib/components/MobileBottomNav.svelte';
  import LoginScreen from '../lib/components/LoginScreen.svelte';
  import SetupAssistant from '../lib/components/SetupAssistant.svelte';
  import PostLoginPrompts from '../lib/components/PostLoginPrompts.svelte';
  import BiometricGate from '../lib/components/BiometricGate.svelte';
  import LoadingScreen from '../lib/components/LoadingScreen.svelte';
  import ThemeBuilder from '../lib/components/ThemeBuilder.svelte';
  import { Toaster } from 'svelte-sonner';
  import Onboarding from '../lib/components/Onboarding.svelte';
  import UploadProgressBar from '../lib/components/UploadProgressBar.svelte';
  import OfflineBanner from '../lib/components/OfflineBanner.svelte';
  import {
    checkSession as checkSessionAuth,
    loadUserInfo as loadUserInfoAuth,
    handleLogout as handleLogoutAuth,
    invalidateSession as invalidateSessionAuth,
    startLogin as startLoginAuth,
  } from '../lib/services/layoutAuthService';
  import { runCloudSettingsStartupSync } from '../lib/services/layoutCloudService';
  import { saveSettingsWithQueue, flushSettingsQueue } from '../lib/services/settingsSync';
  import { authService, type UserInfo } from '../lib/services/authService';
  import { warmUpCommonData } from '../lib/services/warmupService';
  import { logger } from '../utils/logger';
  import { seqtaFetch } from '../utils/netUtil';
  import { useWeather } from '$lib/composables/useWeather.svelte';
  import { useSidebar } from '../lib/composables/useSidebar';
  import { usePlatform } from '../lib/composables/usePlatform';
  import { useLayoutListeners } from '../lib/composables/useLayoutListeners';
  import { platformStore } from '$lib/stores/platform';
  import {
    loadSettings,
    loadEnhancedAnimationsSetting as loadEnhancedAnimationsSettingFn,
  } from '../lib/composables/useLayoutSettings';
  import { checkStatus } from '@choochmeque/tauri-plugin-biometry-api';
  import '../app.css';
  import {
    accentColor,
    loadAccentColor,
    theme,
    loadTheme,
    loadCurrentTheme,
  } from '../lib/stores/theme';
  import {
    customBackground,
    loadCustomBackground,
    getBackgroundSizeCss,
  } from '../lib/stores/customBackground';
  import { themeService } from '../lib/services/themeService';
  import { initI18n, locale, availableLocales, _ } from '../lib/i18n';
  import T from '../lib/components/T.svelte';
  import { themeBuilderSidebarOpen } from '../lib/stores/themeBuilderSidebar';
  import {
    Icon,
    Home,
    Newspaper,
    ClipboardDocumentList,
    BookOpen,
    ChatBubbleLeftRight,
    DocumentText,
    DocumentDuplicate,
    AcademicCap,
    ChartBar,
    Cog6Tooth,
    CalendarDays,
    User,
    GlobeAlt,
    XMark,
    PencilSquare,
    Rss,
    Flag,
    ChatBubbleBottomCenterText,
    FolderOpen,
  } from 'svelte-hero-icons';
  import { writable, get } from 'svelte/store';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { isDevTauriPerformance } from '$lib/performance/devTauriContext';
  import {
    installDevTauriPerformanceRuntime,
    teardownDevTauriPerformanceRuntime,
  } from '$lib/performance/devTauriRuntime';
  import DevPerfHud from '$lib/components/dev/DevPerfHud.svelte';
  import PerformanceTestMegaSuiteOverlay from '$lib/components/dev/PerformanceTestMegaSuiteOverlay.svelte';
  export const needsSetup = writable(false);

  let { children } = $props();

  // Must run synchronously during layout init: Kit's beforeNavigate/afterNavigate use onMount internally.
  if (browser && isDevTauriPerformance()) {
    installDevTauriPerformanceRuntime();
  }

  // Core state
  let seqtaUrl = $state<string>('');
  let userInfo = $state<UserInfo | undefined>(undefined);
  let seqtaConfig: any = $state(null);
  let shellReady = $state(false);
  let contentLoading = $state(true);

  // UI state
  let sidebarOpen = $state(true);
  let showUserDropdown = $state(false);
  let showAboutModal = $state(false);
  let showWhatsNewModal = $state(false);
  let changelogMarkdown = $state('');
  let versionUpdateCurrent = $state('');
  let versionUpdatePrevious = $state('');
  let showOnboarding = $state(false);
  let tourPendingAfterReleaseNotes = $state(false);
  let hasCompletedSetupAssistant = $state(false);
  let profilesExist = $state(false);
  let hasCompletedPostLoginPrompts = $state(false);
  let biometricEnabled = $state(false);
  let biometricUnlocked = $state(false);
  let isFullscreen = $state(false);

  const BIOMETRIC_SESSION_UNLOCK_KEY = 'biometric_session_unlocked';

  const setBiometricSessionUnlocked = (unlocked: boolean) => {
    biometricUnlocked = unlocked;
    if (typeof sessionStorage === 'undefined') return;
    if (unlocked) {
      sessionStorage.setItem(BIOMETRIC_SESSION_UNLOCK_KEY, '1');
    } else {
      sessionStorage.removeItem(BIOMETRIC_SESSION_UNLOCK_KEY);
    }
  };

  // Composables
  const weather = useWeather();
  const sidebar = useSidebar();
  const platform = usePlatform();

  // Sync composable state with component state
  let weatherEnabled = $derived(weather.enabled);
  let weatherData = $derived(weather.data);
  let loadingWeather = $derived(weather.loading);
  let weatherError = $derived(weather.error);
  let forceUseLocation = $derived(weather.forceUseLocation);
  let autoCollapseSidebar = $state(false);
  let autoExpandSidebarHover = $state(false);
  let isMobile = $derived($platformStore.isMobile);
  let isIOS = $derived($platformStore.isIOS);
  let supportsBiometric = $derived($platformStore.supportsBiometric);
  let showBiometricGate = $derived(
    !$needsSetup && biometricEnabled && supportsBiometric && !biometricUnlocked,
  );

  // Settings state
  let disableSchoolPicture = $state(false);
  let enhancedAnimations = $state(true);
  // Menu configuration with translation keys
  const DEFAULT_MENU = [
    { labelKey: 'navigation.dashboard', icon: Home, path: '/' },
    { labelKey: 'navigation.courses', icon: BookOpen, path: '/courses' },
    { labelKey: 'navigation.assessments', icon: ClipboardDocumentList, path: '/assessments' },
    { labelKey: 'navigation.timetable', icon: CalendarDays, path: '/timetable' },
    { labelKey: 'navigation.study', icon: PencilSquare, path: '/study' },
    { labelKey: 'navigation.goals', icon: Flag, path: '/goals' },
    { labelKey: 'navigation.forums', icon: ChatBubbleBottomCenterText, path: '/forums' },
    { labelKey: 'navigation.folios', icon: FolderOpen, path: '/folios' },
    { labelKey: 'navigation.messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
    { labelKey: 'navigation.rss_feeds', icon: Rss, path: '/rss-feeds' },
    { labelKey: 'navigation.portals', icon: GlobeAlt, path: '/portals' },
    { labelKey: 'navigation.notices', icon: DocumentText, path: '/notices' },
    { labelKey: 'navigation.news', icon: Newspaper, path: '/news' },
    { labelKey: 'navigation.directory', icon: User, path: '/directory' },
    { labelKey: 'navigation.documents', icon: DocumentDuplicate, path: '/documents' },
    { labelKey: 'navigation.reports', icon: ChartBar, path: '/reports' },
    { labelKey: 'navigation.analytics', icon: AcademicCap, path: '/analytics' },
    { labelKey: 'navigation.settings', icon: Cog6Tooth, path: '/settings' },
  ];
  let menu = $state([...DEFAULT_MENU]);
  let menuLoading = $state(true);
  let devMockEnabled = false;

  onMount(() => {
    platform.checkPlatform();
    platform.setupWindowCorners();
  });

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.user-dropdown-container')) {
      showUserDropdown = false;
    }
  };

  let unlistenLayout: (() => void) | undefined;
  let unlistenShowWhatsNew: ((e: Event) => void) | undefined;

  const checkSession = async () => {
    await checkSessionAuth({
      devMockEnabled,
      needsSetupSet: (v) => needsSetup.set(v),
      loadUserInfo: () => loadUserInfo(),
      loadSeqtaConfigAndMenu,
    });
  };

  onDestroy(() => {
    logger.logComponentUnmount('layout');
    unlistenLayout?.();
    window.removeEventListener('redo-onboarding', handleRedoOnboarding);
    window.removeEventListener('weather-settings-changed', handleWeatherSettingsChanged);
    if (unlistenShowWhatsNew) {
      window.removeEventListener('show-whats-new', unlistenShowWhatsNew);
    }
    if (browser && isDevTauriPerformance()) {
      teardownDevTauriPerformanceRuntime();
    }
  });

  const reloadSidebarSettings = async () => {
    const settings = await sidebar.loadSettings();
    autoCollapseSidebar = settings.autoCollapse;
    autoExpandSidebarHover = settings.autoExpandOnHover;

    if (!isMobile && !get(needsSetup) && autoExpandSidebarHover) {
      sidebarOpen = false;
    }
  };

  const loadUserInfo = async () => {
    await loadUserInfoAuth({
      loadSettings,
      onDisableSchoolPicture: (v) => (disableSchoolPicture = v),
      onUserInfo: (info) => (userInfo = info),
      devMockEnabled,
      onSessionInvalid: () => needsSetup.set(true),
    });
  };

  const invalidateSession = async () => {
    setBiometricSessionUnlocked(false);
    await invalidateSessionAuth({
      onSessionInvalid: () => needsSetup.set(true),
      onClearUser: () => (userInfo = undefined),
      onCloseDropdown: () => (showUserDropdown = false),
    });
  };

  const loadEnhancedAnimationsSetting = async () => {
    await loadEnhancedAnimationsSettingFn({
      onEnhancedAnimations: (v) => (enhancedAnimations = v),
    });
  };

  const closeSidebarForNavigation = () => {
    if (autoCollapseSidebar || isMobile) {
      sidebarOpen = false;
    }
    sidebar.handlePageNavigation();
  };

  // Hover expand: open when mouse at left edge; close when mouse enters main content
  const EDGE_ZONE_PX = 20;
  const handleEdgeHover = (e: MouseEvent) => {
    if (!autoExpandSidebarHover || isMobile || $needsSetup) return;
    if (!sidebarOpen && e.clientX <= EDGE_ZONE_PX) {
      sidebarOpen = true;
    }
  };
  const handleMainContentEnter = () => {
    if (autoExpandSidebarHover && sidebarOpen && !isMobile && !$needsSetup) {
      sidebarOpen = false;
    }
  };

  const healthCheck = async () => {
    try {
      const response = await seqtaFetch('/seqta/student/heartbeat', {
        method: 'POST',
        body: {
          timestamp: '1970-01-01 00:00:00.0',
          hash: '#?page=/home',
        },
      });

      const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
      if (
        responseStr.includes('"status":"401"') ||
        responseStr.includes('"status":401') ||
        responseStr.toLowerCase().includes('unauthorized')
      ) {
        logger.warn('layout', 'healthCheck', 'Heartbeat returned 401, redirecting to login');
        await invalidateSession();
      }
    } catch (e) {
      // Network errors should not auto-logout; log and continue
      logger.debug('layout', 'healthCheck', 'Heartbeat check failed', { error: e });
    }
  };

  const startLogin = async () => {
    await startLoginAuth({
      seqtaUrl,
      needsSetupSet: (v) => needsSetup.set(v),
      loadUserInfo,
      loadSeqtaConfigAndMenu,
    });
  };

  const handleLogout = async () => {
    setBiometricSessionUnlocked(false);
    await handleLogoutAuth({
      onClearUser: () => (userInfo = undefined),
      onCloseDropdown: () => (showUserDropdown = false),
      checkSession,
    });
  };

  const loadWeatherSettings = async () => {
    await weather.refreshFromSettings();
  };

  const cloudSyncOptions = {
    loadWeatherSettings,
    loadEnhancedAnimationsSetting,
    reloadSidebarSettings,
  };

  const runCloudSettingsStartup = () => runCloudSettingsStartupSync(cloudSyncOptions);

  // Language change handler
  const changeLanguage = async (languageCode: string) => {
    try {
      locale.set(languageCode);
      const { saveSettingsWithQueue } = await import('$lib/services/settingsSync');
      await saveSettingsWithQueue({ language: languageCode });
      logger.info('layout', 'changeLanguage', `Language changed to ${languageCode}`);
    } catch (e) {
      logger.error('layout', 'changeLanguage', `Failed to save language preference: ${e}`, {
        error: e,
      });
    }
  };

  const fetchWeather = async (useIP = false) => {
    await weather.fetchWeather(useIP);
  };

  const sendAnalytics = async () => {
    try {
      await invoke('proxy_request', {
        url: 'https://betterseqta.org/api/analytics/desqta',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });
    } catch (e) {
      logger.debug('layout', 'sendAnalytics', 'Failed to send analytics', { error: e });
    }
  };

  $effect(() => {
    document.documentElement.setAttribute('data-accent-color', '');
    document.documentElement.style.setProperty('--accent-color-value', $accentColor);
    logger.debug('layout', '$effect', 'Applied accent color to root as CSS var', {
      accent: $accentColor,
    });
  });

  // iOS: add platform-ios class for safe area padding (notch, home indicator)
  $effect(() => {
    if (isIOS) {
      document.documentElement.classList.add('platform-ios');
    } else {
      document.documentElement.classList.remove('platform-ios');
    }
  });

  $effect(() => {
    logger.debug('layout', '$effect', 'Enhanced animations effect triggered', {
      enhancedAnimations,
    });
    if (enhancedAnimations) {
      document.body.classList.add('enhanced-animations');
    } else {
      document.body.classList.remove('enhanced-animations');
    }
  });

  // Listen for redo onboarding event
  const handleRedoOnboarding = async () => {
    try {
      const settings = await loadSettings(['has_been_through_onboarding']);
      if (!settings.has_been_through_onboarding) {
        showOnboarding = true;
        if (isMobile) sidebarOpen = false;
      }
    } catch (e) {
      logger.debug('layout', 'handleRedoOnboarding', 'Could not check onboarding status', {
        error: e,
      });
    }
  };

  const handleWeatherSettingsChanged = () => {
    loadWeatherSettings().catch((e) => {
      logger.debug('layout', 'weatherSettingsChanged', 'Failed to refresh weather', { error: e });
    });
  };

  onMount(async () => {
    logger.logComponentMount('layout');

    if (typeof sessionStorage !== 'undefined') {
      biometricUnlocked = sessionStorage.getItem(BIOMETRIC_SESSION_UNLOCK_KEY) === '1';
    }

    unlistenLayout = await useLayoutListeners({
      appWindow,
      onFullscreenChange: (v) => (isFullscreen = v),
    });

    // Restore saved zoom level (from settings backend first, else localStorage)
    const { restoreZoom, restoreZoomFromLevel } = await import('$lib/utils/zoom');
    try {
      const settings = await loadSettings(['zoom_level']);
      const zoomLevel = settings.zoom_level;
      if (typeof zoomLevel === 'number' && zoomLevel >= 0.5 && zoomLevel <= 2) {
        restoreZoomFromLevel(zoomLevel);
      } else {
        restoreZoom();
      }
    } catch {
      restoreZoom();
    }

    // Set up redo onboarding listener
    window.addEventListener('redo-onboarding', handleRedoOnboarding);
    window.addEventListener('weather-settings-changed', handleWeatherSettingsChanged);

    // Initialize theme and i18n first
    await Promise.all([
      loadAccentColor(),
      loadTheme(),
      loadCurrentTheme(),
      loadCustomBackground(),
      initI18n(),
    ]);

    // Initialize theme sync in background (don't block startup)
    themeService.initializeThemeSync().catch((e) => {
      logger.error('layout', 'onMount', 'Failed to initialize theme sync', { error: e });
    });

    shellReady = true;

    try {
      // Load saved language preference
      try {
        const settings = await loadSettings(['language']);
        const lang = settings.language;
        if (typeof lang === 'string' && availableLocales.some((l) => l.code === lang)) {
          locale.set(lang);
        }
      } catch (e) {
        logger.debug('layout', 'onMount', 'Could not load language preference', { error: e });
      }

      // Load dev mock flag early to control session flow
      try {
        const settings = await loadSettings(['dev_sensitive_info_hider']);
        devMockEnabled = settings.dev_sensitive_info_hider === true;
      } catch {}

      // Load all settings and check session
      await Promise.all([
        checkSession(),
        loadWeatherSettings(),
        loadEnhancedAnimationsSetting(),
        reloadSidebarSettings(),
        runCloudSettingsStartup(),
      ]);

      // Usage analytics: increment session count and start hourly check (service checks opt-in internally)
      if (!get(needsSetup)) {
        import('$lib/services/usageAnalyticsService').then(({ usageAnalyticsService }) => {
          usageAnalyticsService.onAppStart().catch(() => {});
          usageAnalyticsService.start();
        });
      }

      // Load setup assistant completion status, post-login prompts, biometric preference, and profile count
      try {
        const [setupSettings, profilesList] = await Promise.all([
          loadSettings([
            'has_completed_setup_assistant',
            'has_completed_post_login_prompts',
            'biometric_enabled',
          ]),
          invoke<unknown[]>('list_profiles').catch(() => []),
        ]);
        hasCompletedSetupAssistant = setupSettings.has_completed_setup_assistant === true;
        profilesExist = Array.isArray(profilesList) && profilesList.length > 0;
        hasCompletedPostLoginPrompts = setupSettings.has_completed_post_login_prompts === true;
        biometricEnabled = setupSettings.biometric_enabled === true;

        // Auto-disable biometric if not available (e.g. no face/fingerprint/iris enrolled)
        if (biometricEnabled && get(platformStore).supportsBiometric) {
          try {
            const status = await checkStatus();
            if (!status.isAvailable) {
              logger.debug('layout', 'onMount', 'Biometric not available, auto-disabling', {
                error: status.error,
                errorCode: status.errorCode,
              });
              biometricEnabled = false;
              const { saveSettingsWithQueue, flushSettingsQueue } =
                await import('$lib/services/settingsSync');
              await saveSettingsWithQueue({ biometric_enabled: false });
              await flushSettingsQueue();
            }
          } catch (e) {
            logger.debug('layout', 'onMount', 'Could not check biometric status', { error: e });
          }
        }
      } catch (e) {
        logger.debug('layout', 'onMount', 'Could not load setup assistant status', { error: e });
      }

      // Check if user needs onboarding - show tour for first-time users (only after post-login screens)
      try {
        const settings = await loadSettings(['has_been_through_onboarding']);
        if (
          !settings.has_been_through_onboarding &&
          !get(needsSetup) &&
          hasCompletedPostLoginPrompts
        ) {
          // Wait a bit for UI to settle; defer if release notes (What's New) will be open
          setTimeout(() => {
            if (showWhatsNewModal) {
              tourPendingAfterReleaseNotes = true;
            } else {
              showOnboarding = true;
              if (isMobile) sidebarOpen = false;
            }
          }, 1000);
        }
      } catch (e) {
        logger.debug('layout', 'onMount', 'Could not check onboarding status', { error: e });
      }

      // Check if app was just updated - show What's New modal (disabled for rc/beta)
      try {
        const versionInfo = await invoke<{ current: string; previousVersion?: string }>(
          'get_version_update_info',
        );
        const isStableRelease =
          !versionInfo?.current?.includes('rc') && !versionInfo?.current?.includes('beta');
        if (versionInfo?.previousVersion && !get(needsSetup) && isStableRelease) {
          versionUpdateCurrent = versionInfo.current;
          versionUpdatePrevious = versionInfo.previousVersion;
          try {
            const res = await fetch('/CHANGELOG.md');
            changelogMarkdown = (await res.text()) || '';
          } catch {
            changelogMarkdown = '';
          }
          setTimeout(() => (showWhatsNewModal = true), 800);
        }
      } catch (e) {
        logger.debug('layout', 'onMount', 'Could not check version update info', { error: e });
      }

      // Listen for manual "What's New" request (e.g. from Settings)
      const handleShowWhatsNew = async () => {
        try {
          versionUpdateCurrent = await invoke<string>('get_app_version');
          versionUpdatePrevious = '';
          try {
            const res = await fetch('/CHANGELOG.md');
            changelogMarkdown = (await res.text()) || '';
          } catch {
            changelogMarkdown = '';
          }
          showWhatsNewModal = true;
        } catch (e) {
          logger.debug('layout', 'handleShowWhatsNew', "Failed to show What's New", { error: e });
        }
      };
      window.addEventListener('show-whats-new', handleShowWhatsNew);
      unlistenShowWhatsNew = handleShowWhatsNew;

      // Validate SEQTA session BEFORE starting background sync
      // This prevents sync_analytics_data (and other warmup) from running in parallel with
      // session invalidation - which could clear the session mid-sync and cause 401 errors
      if (!devMockEnabled && !$needsSetup) {
        try {
          const response = await seqtaFetch('/seqta/student/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { mode: 'normal', query: null, redirect_url: seqtaUrl },
          });

          const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
          const isAuthenticated = responseStr.includes('site.name.abbrev');

          // Only logout on explicit auth failures (401, unauthorized), NOT on 404 or generic errors
          // 404 and other non-auth errors can include "error" in the response and would incorrectly invalidate the session
          const isAuthFailure =
            !isAuthenticated &&
            (responseStr.includes('"status":"401"') ||
              responseStr.includes('"status": "401"') ||
              responseStr.includes('unauthorized') ||
              responseStr.toLowerCase().includes('authentication failed'));

          if (isAuthFailure) {
            logger.warn('layout', 'onMount', 'Session invalid, redirecting to login');
            await invalidateSession();
          }
        } catch (e) {
          logger.error('layout', 'onMount', 'SEQTA session check failed', { error: e });
        }
      }

      // Load cached data from SQLite immediately for instant UI
      // Pass needsSetup so we skip background sync when user is on login screen (or after session invalidation)
      const { initializeApp } = await import('$lib/services/startupService');
      await initializeApp(get(needsSetup), devMockEnabled);
      contentLoading = false;

      // Run a one-time heartbeat health check on app open without blocking initial content render
      healthCheck().catch((e) => {
        logger.debug('layout', 'onMount', 'Health check failed', { error: e });
      });

      // Send startup analytics
      sendAnalytics();

      // Check and apply initial fullscreen state (also check maximized)
      // On macOS: skip isMaximized() - it can cause issues with undecorated windows (plugins-workspace#1918)
      try {
        const currentFullscreen = await appWindow.isFullscreen();
        const currentMaximized =
          import.meta.env.TAURI_ENV_PLATFORM === 'darwin' ||
          import.meta.env.TAURI_ENV_PLATFORM === 'macos'
            ? false
            : await appWindow.isMaximized().catch(() => false);
        isFullscreen = currentFullscreen || currentMaximized;
        logger.debug(
          'layout',
          'onMount',
          `Initial fullscreen/maximized state: ${isFullscreen} (fullscreen: ${currentFullscreen}, maximized: ${currentMaximized})`,
        );
      } catch (e) {
        logger.debug('layout', 'onMount', 'Failed to check initial fullscreen state', { error: e });
      }
    } finally {
      if (contentLoading) {
        contentLoading = false;
      }
      if (import.meta.env.DEV && import.meta.env.TAURI_ENV_PLATFORM) {
        const { recordStartupPhase } = await import('$lib/performance/hooks');
        recordStartupPhase('shell_ready');
      }
    }
  });

  // Initialize connectivity and queue service when user is logged in
  $effect(() => {
    if (shellReady && !$needsSetup) {
      import('$lib/stores/connectivity').then(({ initConnectivity }) =>
        import('$lib/services/queueService').then(({ initQueueService, getQueueSummary }) => {
          initConnectivity(() => getQueueSummary().then((s) => s.total));
          initQueueService();
        }),
      );
    }
  });

  // Sidebar: close on route change (auto-collapse) and reload settings when entering /settings
  let prevPath = $state('');
  $effect(() => {
    if ($needsSetup) sidebarOpen = false;
    const path = $page.url.pathname;
    if (path !== prevPath) {
      if (autoCollapseSidebar || isMobile) sidebarOpen = false;
      if (path === '/settings') reloadSidebarSettings();
      prevPath = path;
    }
  });

  // Mobile: sidebar closed by default
  let hasInitializedMobileSidebar = $state(false);
  $effect(() => {
    if (isMobile && !$needsSetup && !showOnboarding && !hasInitializedMobileSidebar) {
      hasInitializedMobileSidebar = true;
      sidebarOpen = false;
    }
  });

  // Hover expand: start collapsed once when enabled
  let hasInitializedHoverSidebar = $state(false);
  $effect(() => {
    if (!autoExpandSidebarHover || isMobile || $needsSetup) {
      hasInitializedHoverSidebar = false;
      return;
    }
    if (!hasInitializedHoverSidebar) {
      hasInitializedHoverSidebar = true;
      sidebarOpen = false;
    }
  });

  // Close mobile sidebar when onboarding tour starts
  $effect(() => {
    if (showOnboarding && isMobile) {
      sidebarOpen = false;
    }
  });

  // Mobile detection and event listeners (uses unified usePlatform)
  onMount(() => {
    const mql = window.matchMedia('(max-width: 640px)');

    const checkMobile = () => {
      const prevMobile = get(platformStore).isMobile;
      const { isMobile: newMobile } = platform.checkPlatform();
      if (!prevMobile && newMobile) {
        sidebarOpen = false;
      }
    };

    // Load safe area plugin only in Tauri (avoids infinite loop outside Tauri)
    const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
    if (tauriPlatform === 'ios' || tauriPlatform === 'android') {
      import('@saurl/tauri-plugin-safe-area-insets-css-api');
    }

    checkMobile();
    const onMqlChange = () => checkMobile();
    try {
      // Modern browsers
      mql.addEventListener('change', onMqlChange);
    } catch {
      // Safari fallback
      // @ts-ignore
      mql.addListener(onMqlChange);
    }

    const events = [
      ['resize', checkMobile],
      ['click', handleClickOutside],
      ['mousemove', handleEdgeHover],
    ] as const;

    events.forEach(([event, handler]) =>
      document.addEventListener(event, handler as EventListener),
    );

    return () => {
      events.forEach(([event, handler]) =>
        document.removeEventListener(event, handler as EventListener),
      );
      try {
        mql.removeEventListener('change', onMqlChange);
      } catch {
        // @ts-ignore
        mql.removeListener(onMqlChange);
      }
    };
  });

  const loadSeqtaConfigAndMenu = async () => {
    try {
      if (!devMockEnabled) {
        const sessionExists = await authService.checkSession();
        if (!sessionExists) {
          logger.debug('layout', 'loadSeqtaConfigAndMenu', 'Skipping: not authenticated');
          return;
        }
      }

      let config = await invoke('load_seqta_config');
      let latestConfig = null;

      if (!config) {
        // Fetch latest config
        const res = await seqtaFetch('/seqta/student/load/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {},
        });
        latestConfig = typeof res === 'string' ? JSON.parse(res) : res;
        seqtaConfig = latestConfig;
        await invoke('save_seqta_config', { config: latestConfig });
      } else {
        // Check if existing config is outdated
        const res = await seqtaFetch('/seqta/student/load/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {},
        });
        latestConfig = typeof res === 'string' ? JSON.parse(res) : res;
        const isDifferent = await invoke('is_seqta_config_different', { newConfig: latestConfig });

        if (isDifferent) {
          seqtaConfig = latestConfig;
          await invoke('save_seqta_config', { config: latestConfig });
        } else {
          seqtaConfig = config;
        }
      }

      menu = [...DEFAULT_MENU]; // Use default menu configuration

      // Filter menu items based on SEQTA config (skip when mock enabled - show all pages)
      if (!devMockEnabled && latestConfig?.payload) {
        const goalsEnabled = latestConfig.payload['coneqt-s.page.goals']?.value === 'enabled';
        if (!goalsEnabled) {
          menu = menu.filter((item) => item.path !== '/goals');
        }
        const forumsPageEnabled = latestConfig.payload['coneqt-s.page.forums']?.value === 'enabled';
        const forumsGreetingExists = latestConfig.payload['coneqt-s.forum.greeting'] !== undefined;
        const forumsEnabled = forumsPageEnabled || forumsGreetingExists;
        if (!forumsEnabled) {
          menu = menu.filter((item) => item.path !== '/forums');
        }
        const foliosEnabled = latestConfig.payload['coneqt-s.page.folios']?.value === 'enabled';
        if (!foliosEnabled) {
          menu = menu.filter((item) => item.path !== '/folios');
        }
      }

      // Apply menu order from settings
      await applyMenuOrder();

      // Filter RSS feeds menu item based on setting (after menu order is applied)
      const settings = await loadSettings(['separate_rss_feed']);
      const separateRssFeed = settings.separate_rss_feed ?? false;
      if (!separateRssFeed) {
        menu = menu.filter((item) => item.path !== '/rss-feeds');
      }
    } catch (e) {
      logger.error('layout', 'loadSeqtaConfigAndMenu', 'Failed to load config/menu', { error: e });
    } finally {
      menuLoading = false;
    }
  };

  const applyMenuOrder = async () => {
    try {
      const settings = await loadSettings(['menu_order', 'disabled_sidebar_pages']);
      const menuOrder = settings.menu_order as string[] | undefined;
      const disabledPages = (settings.disabled_sidebar_pages as string[] | undefined) || [];

      // Use current menu state instead of DEFAULT_MENU to preserve filters
      const currentMenu = [...menu];
      const currentMenuMap = new Map(currentMenu.map((item) => [item.path, item]));

      let orderedMenu: typeof DEFAULT_MENU;

      if (menuOrder && Array.isArray(menuOrder) && menuOrder.length > 0) {
        // Reorder menu based on saved order, keeping any new items at the end
        orderedMenu = [];
        const addedPaths = new Set<string>();

        // Add items in saved order (only if they exist in current menu)
        for (const path of menuOrder) {
          const item = currentMenuMap.get(path);
          if (item) {
            orderedMenu.push(item);
            addedPaths.add(path);
          }
        }

        // Add any items not in saved order (new items that exist in current menu)
        for (const item of currentMenu) {
          if (!addedPaths.has(item.path)) {
            orderedMenu.push(item);
          }
        }
      } else {
        orderedMenu = [...currentMenu];
      }

      // Filter out disabled pages (Settings cannot be disabled)
      const disabledSet = new Set(disabledPages);
      menu = orderedMenu.filter((item) => !disabledSet.has(item.path) || item.path === '/settings');
    } catch (e) {
      logger.error('layout', 'applyMenuOrder', 'Failed to apply menu order', { error: e });
      // Don't reset to DEFAULT_MENU on error, keep current filtered menu
    }
  };

  // Track recent activity when route changes

  // Config/menu loading is handled in checkSession/startLogin
</script>

{#if !shellReady}
  <LoadingScreen />
{:else}
  <div
    class="relative flex flex-col h-screen w-screen {isMobile || isFullscreen
      ? ''
      : 'rounded-2xl'} overflow-hidden {$customBackground.enabled && $customBackground.imageUrl
      ? ''
      : 'theme-bg'}"
    style="outline: none; border: none; margin: 0; padding: 0; padding-top: var(--safe-area-top); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
    {#if $customBackground.enabled && $customBackground.imageUrl}
      <div
        class="pointer-events-none absolute inset-0 z-0 bg-zinc-950"
        aria-hidden="true"
        style="background-image: url('{$customBackground.imageUrl}'); background-position: center; background-repeat: no-repeat; background-size: {getBackgroundSizeCss(
          $customBackground.fit,
        )}; opacity: {$customBackground.opacity};">
      </div>
      {#if $customBackground.dim > 0}
        <div
          class="pointer-events-none absolute inset-0 z-0 bg-black"
          aria-hidden="true"
          style="opacity: {$customBackground.dim};">
        </div>
      {/if}
    {/if}
    <div class="relative z-10 flex flex-col flex-1 min-h-0 h-full w-full">
    {#if !$needsSetup}
      <AppHeader
        {sidebarOpen}
        {userInfo}
        {showUserDropdown}
        {isFullscreen}
        {isMobile}
        {weatherEnabled}
        {weatherData}
        {loadingWeather}
        onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
        onToggleUserDropdown={() => (showUserDropdown = !showUserDropdown)}
        onLogout={handleLogout}
        onShowAbout={() => (showAboutModal = true)}
        onClickOutside={handleClickOutside}
        {disableSchoolPicture} />
    {/if}

    <div class="flex relative flex-1 min-h-0">
      {#if !$needsSetup && !menuLoading}
        <AppSidebar {sidebarOpen} {menu} {isFullscreen} onMenuItemClick={closeSidebarForNavigation} />
      {/if}

      {#if sidebarOpen && isMobile && !$needsSetup}
        <div
          class="fixed inset-0 z-20 bg-black/50 sm:hidden"
          onclick={() => (sidebarOpen = false)}
          role="button"
          tabindex="0"
          aria-label={$_('navigation.close_sidebar', { default: 'Close sidebar overlay' })}>
        </div>
      {/if}

      <main
        onmouseenter={handleMainContentEnter}
        class="flex-1 min-h-0 flex flex-col border-t
          {sidebarOpen && !isMobile && !$needsSetup
          ? 'border-l border-zinc-200 dark:border-zinc-700/50'
          : ''}
          {isMobile
          ? 'rounded-t-2xl overflow-hidden'
          : sidebarOpen
            ? 'rounded-tl-2xl overflow-hidden'
            : 'rounded-none'}
          isolate transition-[border-radius,border-color] duration-300 bg-transparent"
        style="margin-left: 0; margin-right: {$themeBuilderSidebarOpen ? '384px' : '0'};">
        <div
          class="flex-1 min-h-0 overflow-y-auto
            {!$needsSetup ? '[scrollbar-gutter:stable]' : ''}
            {isMobile && !$needsSetup ? 'pb-[56px] mobile-main mobile-soft' : ''}">
          {#if !$needsSetup}
            <OfflineBanner />
          {/if}
          {#if contentLoading}
            <div class="flex items-center justify-center w-full h-full py-12">
              <LoadingScreen inline />
            </div>
          {:else if !$needsSetup && !hasCompletedPostLoginPrompts}
            <PostLoginPrompts
              onComplete={() => {
                hasCompletedPostLoginPrompts = true;
                loadSettings(['has_been_through_onboarding'])
                  .then((settings) => {
                    if (!settings.has_been_through_onboarding && !get(needsSetup)) {
                      setTimeout(() => {
                        if (showWhatsNewModal) {
                          tourPendingAfterReleaseNotes = true;
                        } else {
                          showOnboarding = true;
                          if (isMobile) sidebarOpen = false;
                        }
                      }, 1000);
                    }
                  })
                  .catch((e) => {
                    logger.debug('layout', 'PostLoginComplete', 'Could not check onboarding', {
                      error: e,
                    });
                  });
              }} />
          {:else if showBiometricGate}
            <BiometricGate
              onUnlock={() => setBiometricSessionUnlocked(true)}
              onBiometryUnavailable={() => {
                biometricEnabled = false;
                setBiometricSessionUnlocked(true);
                import('$lib/services/settingsSync').then(
                  ({ saveSettingsWithQueue, flushSettingsQueue }) => {
                    saveSettingsWithQueue({ biometric_enabled: false })
                      .then(() => flushSettingsQueue())
                      .catch((e) => {
                        logger.debug('layout', 'BiometricGate', 'Failed to disable biometric', {
                          error: e,
                        });
                      });
                  },
                );
              }} />
          {:else if $needsSetup}
            {#if !hasCompletedSetupAssistant && !profilesExist}
              <SetupAssistant onComplete={() => (hasCompletedSetupAssistant = true)} />
            {:else}
              <LoginScreen
                {seqtaUrl}
                onStartLogin={startLogin}
                onUrlChange={(url) => (seqtaUrl = url)} />
            {/if}
          {:else}
            {@render children()}
          {/if}
        </div>
      </main>

      <!-- ThemeBuilder Sidebar -->
      <!-- Mobile Bottom Navigation -->
      {#if isMobile && !$needsSetup}
        <MobileBottomNav
          onOpenSidebar={() => {
            sidebarOpen = true;
          }}
          onCloseSidebar={() => {
            sidebarOpen = false;
          }} />
      {/if}

      {#if $themeBuilderSidebarOpen}
        <aside
          class="flex fixed top-0 right-0 z-50 flex-col w-96 h-full theme-bg border-l shadow-xl transition-transform duration-200 border-zinc-200 dark:border-zinc-700">
          <ThemeBuilder>
            {#snippet close()}
              <button
                class="p-2 ml-auto rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                onclick={() => themeBuilderSidebarOpen.set(false)}
                aria-label={$_('common.close_theme_builder', { default: 'Close Theme Builder' })}>
                <Icon src={XMark} class="w-6 h-6" />
              </button>
            {/snippet}
          </ThemeBuilder>
        </aside>
      {/if}
    </div>
    </div>
  </div>
{/if}
<UploadProgressBar />
<Toaster
  position={isMobile ? 'top-center' : 'bottom-right'}
  theme={$theme === 'dark' ? 'dark' : 'light'}
  richColors
  expand={true}
  closeButton
  offset={isMobile ? 'calc(var(--safe-area-top, 0px) + 1rem)' : '20px'}
  visibleToasts={5}
  toastOptions={{
    unstyled: true,
    classes: {
      toast:
        'bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md text-zinc-900 dark:text-zinc-100 shadow-2xl border rounded-xl px-4 py-3 min-w-[300px] max-w-[500px] flex items-center gap-3 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border-white/20 dark:border-zinc-700/40',
      title: 'text-sm font-semibold flex-1',
      description: 'text-sm text-zinc-600 dark:text-zinc-400 mt-1',
      success:
        'border-green-200/60 dark:border-green-800/60 bg-green-50/95 dark:bg-green-900/40 backdrop-blur-md text-green-700 dark:text-green-300',
      error:
        'border-red-200/60 dark:border-red-800/60 bg-red-50/95 dark:bg-red-900/40 backdrop-blur-md text-red-700 dark:text-red-300',
      info: 'border-blue-200/60 dark:border-blue-800/60 bg-blue-50/95 dark:bg-blue-900/40 backdrop-blur-md text-blue-700 dark:text-blue-300',
      warning:
        'border-yellow-200/60 dark:border-yellow-800/60 bg-yellow-50/95 dark:bg-yellow-900/40 backdrop-blur-md text-yellow-700 dark:text-yellow-300',
      closeButton:
        'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all duration-200 ease-in-out rounded-md p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex-shrink-0 transform hover:scale-110 active:scale-95',
      actionButton:
        'bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95',
      cancelButton:
        'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95',
    },
  }} />
<AboutModal open={showAboutModal} onclose={() => (showAboutModal = false)} />
<WhatsNewModal
  open={showWhatsNewModal}
  currentVersion={versionUpdateCurrent}
  previousVersion={versionUpdatePrevious}
  {changelogMarkdown}
  onclose={() => {
    showWhatsNewModal = false;
    if (tourPendingAfterReleaseNotes) {
      tourPendingAfterReleaseNotes = false;
      setTimeout(() => {
        showOnboarding = true;
        if (isMobile) sidebarOpen = false;
      }, 300);
    }
  }} />
<Onboarding open={showOnboarding} onComplete={() => (showOnboarding = false)} />
<DevPerfHud />
<PerformanceTestMegaSuiteOverlay />
