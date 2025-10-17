<script lang="ts">
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import { Window } from "@tauri-apps/api/window";
  const appWindow = Window.getCurrent();
  import AppHeader from '../lib/components/AppHeader.svelte';
  import AppSidebar from '../lib/components/AppSidebar.svelte';
  import LoginScreen from '../lib/components/LoginScreen.svelte';
  import LoadingScreen from '../lib/components/LoadingScreen.svelte';
  import Skeleton from '../lib/components/Skeleton.svelte';
  import { authService, type UserInfo } from '../lib/services/authService';
  import { logger } from '../utils/logger';
  import { seqtaFetch } from '../utils/netUtil';
  import '../app.css';
  import { accentColor, loadAccentColor, theme, loadTheme, loadCurrentTheme } from '../lib/stores/theme';
  import { initI18n, locale, availableLocales, _ } from '../lib/i18n';
  import T from '../lib/components/T.svelte';
  import { themeBuilderSidebarOpen } from '../lib/stores/themeBuilderSidebar';
  import { Icon, Home, Newspaper, ClipboardDocumentList, BookOpen, ChatBubbleLeftRight, DocumentText, AcademicCap, ChartBar, Cog6Tooth, CalendarDays, User, GlobeAlt, XMark, PencilSquare } from 'svelte-hero-icons';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import type { WeatherData } from '../lib/services/weatherService';
  export const needsSetup = writable(false);

  type AboutModalComponent = typeof import('../lib/components/AboutModal.svelte').default;
  type ThemeBuilderComponent = typeof import('../lib/components/ThemeBuilder.svelte').default;
  type WeatherServiceModule = typeof import('../lib/services/weatherService');
  type WarmupServiceModule = typeof import('../lib/services/warmupService');

  let aboutModalComponent = $state<AboutModalComponent | null>(null);
  let aboutModalLoading = $state(false);
  let themeBuilderComponent = $state<ThemeBuilderComponent | null>(null);
  let themeBuilderLoading = $state(false);

  let weatherServiceModule: WeatherServiceModule | null = null;
  let warmupServiceModule: WarmupServiceModule | null = null;

  const ensureWeatherService = async () => {
    if (!weatherServiceModule) {
      weatherServiceModule = await import('../lib/services/weatherService');
    }
    return weatherServiceModule.weatherService;
  };

  const ensureWarmupService = async () => {
    if (!warmupServiceModule) {
      warmupServiceModule = await import('../lib/services/warmupService');
    }
    return warmupServiceModule;
  };

  let { children } = $props();

  // Core state
  let seqtaUrl = $state<string>('');
  let userInfo = $state<UserInfo | undefined>(undefined);
  let seqtaConfig: any = $state(null);
  let shellReady = $state(false);
  let contentLoading = $state(true);
  let isMobile = $state(false);
  
  // UI state  
  let sidebarOpen = $state(true);
  let showUserDropdown = $state(false);
  let showAboutModal = $state(false);
  
  // Weather state
  let weatherEnabled = $state(false);
  let forceUseLocation = $state(true);
  let weatherCity = $state('');
  let weatherCountry = $state('');
  let weatherData = $state<WeatherData | null>(null);
  let loadingWeather = $state(false);
  let weatherError = $state('');
  
  // Settings state
  let disableSchoolPicture = $state(false);
  let enhancedAnimations = $state(true);
  let autoCollapseSidebar = $state(false);
  let autoExpandSidebarHover = $state(false);
  // Menu configuration with translation keys
  const DEFAULT_MENU = [
    { labelKey: 'navigation.dashboard', icon: Home, path: '/' },
    { labelKey: 'navigation.courses', icon: BookOpen, path: '/courses' },
    { labelKey: 'navigation.assessments', icon: ClipboardDocumentList, path: '/assessments' },
    { labelKey: 'navigation.timetable', icon: CalendarDays, path: '/timetable' },
    { labelKey: 'navigation.study', icon: PencilSquare, path: '/study' },
    { labelKey: 'navigation.messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
    { labelKey: 'navigation.portals', icon: GlobeAlt, path: '/portals' },
    { labelKey: 'navigation.notices', icon: DocumentText, path: '/notices' },
    { labelKey: 'navigation.news', icon: Newspaper, path: '/news' },
    { labelKey: 'navigation.directory', icon: User, path: '/directory' },
    { labelKey: 'navigation.reports', icon: ChartBar, path: '/reports' },
    { labelKey: 'navigation.analytics', icon: AcademicCap, path: '/analytics' },
    { labelKey: 'navigation.settings', icon: Cog6Tooth, path: '/settings' },
  ];
  let menu = $state([...DEFAULT_MENU]);
  let menuLoading = $state(true);
  let devMockEnabled = false;

onMount(async () => {
  // Lazy-load heavy services (non-blocking)
  Promise.all([
    import('../lib/services/weatherService'),
    import('../lib/services/warmupService')
  ]).then(([ws, wus]) => {
    weatherServiceModule = ws;
    warmupServiceModule = wus;
  });

  // Platform detection - similar to LoginScreen
  const checkPlatform = () => {
    const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
    return {
      isWindows: tauri_platform === "windows",
      isMobile: tauri_platform === "ios" || tauri_platform === "android"
    };
  };

  const { isWindows, isMobile } = checkPlatform();

  // Only run window corner rounding on Windows desktop
  if (isWindows && !isMobile) {
    async function updateCorners() {
      const isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        document.body.classList.remove("rounded-xl");
      } else {
        document.body.classList.add("rounded-xl");
      }
    }
    updateCorners();
    appWindow.onResized(updateCorners);
    appWindow.onMoved(updateCorners);
  }
});

$effect(() => {
  if (showAboutModal && !aboutModalComponent && !aboutModalLoading) {
    aboutModalLoading = true;
    import('../lib/components/AboutModal.svelte')
      .then((module) => {
        aboutModalComponent = module.default;
      })
      .catch((error) => {
        logger.error('layout', 'loadAboutModal', 'Failed to load AboutModal', { error });
      })
      .finally(() => {
        aboutModalLoading = false;
      });
  }
});

$effect(() => {
  if ($themeBuilderSidebarOpen && !themeBuilderComponent && !themeBuilderLoading) {
    themeBuilderLoading = true;
    import('../lib/components/ThemeBuilder.svelte')
      .then((module) => {
        themeBuilderComponent = module.default;
      })
      .catch((error) => {
        logger.error('layout', 'loadThemeBuilder', 'Failed to load ThemeBuilder', { error });
      })
      .finally(() => {
        themeBuilderLoading = false;
      });
  }
});

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.user-dropdown-container')) {
      showUserDropdown = false;
    }
  };

  const checkSession = async () => {
    logger.logFunctionEntry('layout', 'checkSession');
    try {
      if (devMockEnabled) {
        needsSetup.set(false);
        logger.info('layout', 'checkSession', 'Dev mock enabled; bypassing login');
        await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
        logger.logFunctionExit('layout', 'checkSession', { sessionExists: true });
      } else {
        const sessionExists = await authService.checkSession();
        needsSetup.set(!sessionExists);
        logger.info('layout', 'checkSession', `Session exists: ${sessionExists}`, { sessionExists });
        if (sessionExists) {
          await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
        }
        logger.logFunctionExit('layout', 'checkSession', { sessionExists });
      }
    } catch (error) {
      logger.error('layout', 'checkSession', `Failed to check session: ${error}`, { error });
    }
  };

  // Remove duplicate onMount - consolidating below

  let unlisten: (() => void) | undefined;
  
  const setupServiceWorkerAndListeners = async () => {
    // Register service worker for offline static assets
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {}
    }
    logger.debug('layout', 'onMount', 'Setting up reload listener');
    unlisten = await listen<string>('reload', () => {
      logger.info('layout', 'reload_listener', 'Received reload event');
      location.reload();
    });

    // Listen for fullscreen changes from Tauri backend
    await listen<boolean>('fullscreen-changed', (event) => {
      const isFullscreen = event.payload;
      logger.debug('layout', 'fullscreen_listener', `Fullscreen changed: ${isFullscreen}`);
      
      if (isFullscreen) {
        // Remove rounded corners when entering fullscreen
        document.body.classList.remove('rounded-xl');
        const contentDiv = document.querySelector('.overflow-clip.rounded-xl');
        if (contentDiv) {
          contentDiv.classList.remove('rounded-xl');
        }
      } else {
        // Add rounded corners when exiting fullscreen
        document.body.classList.add('rounded-xl');
        const contentDiv = document.querySelector('.overflow-clip');
        if (contentDiv) {
          contentDiv.classList.add('rounded-xl');
        }
      }
    });
  };

  onDestroy(() => {
    logger.logComponentUnmount('layout');
    if (unlisten) {
      logger.debug('layout', 'onDestroy', 'Cleaning up reload listener');
      unlisten();
    }
  });

  // Consolidated settings loader
  const loadSettings = async (keys: string[]) => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys });
      return subset || {};
    } catch (e) {
      logger.error('layout', 'loadSettings', `Failed to load settings: ${e}`, { keys, error: e });
      return {};
    }
  };

  const reloadEnhancedAnimationsSetting = async () => {
    const settings = await loadSettings(['enhanced_animations']);
    enhancedAnimations = settings.enhanced_animations ?? true;
    logger.debug('layout', 'reloadEnhancedAnimationsSetting', `Enhanced animations: ${enhancedAnimations}`);
  };

  const reloadSidebarSettings = async () => {
    const settings = await loadSettings(['auto_collapse_sidebar', 'auto_expand_sidebar_hover']);
    autoCollapseSidebar = settings.auto_collapse_sidebar ?? false;
    autoExpandSidebarHover = settings.auto_expand_sidebar_hover ?? false;
  };

  const handlePageNavigation = () => {
    if (autoCollapseSidebar || isMobile) {
      sidebarOpen = false;
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (autoExpandSidebarHover && !isMobile) {
      const x = event.clientX;
      if (!sidebarOpen && x <= 20) {
        sidebarOpen = true;
      } else if (sidebarOpen && x > 280) {
        sidebarOpen = false;
      }
    }
  };

  const healthCheck = async () => {
    try {
      const response = await seqtaFetch('/seqta/student/heartbeat', {
        method: 'POST',
        body: {
          timestamp: '1970-01-01 00:00:00.0',
          hash: '#?page=/home'
        }
      });

      const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
      if (
        responseStr.includes('"status":"401"') ||
        responseStr.includes('"status":401') ||
        responseStr.toLowerCase().includes('unauthorized')
      ) {
        logger.warn('layout', 'healthCheck', 'Heartbeat returned 401, logging out');
        await handleLogout();
      }
    } catch (e) {
      // Network errors should not auto-logout; log and continue
      logger.debug('layout', 'healthCheck', 'Heartbeat check failed', { error: e });
    }
  };

  const startLogin = async () => {
    if (!seqtaUrl) {
      logger.error('layout', 'startLogin', 'No valid SEQTA URL found');
      return;
    }

    logger.info('layout', 'startLogin', 'Starting authentication', { url: seqtaUrl });
    await authService.startLogin(seqtaUrl);

    const timer = setInterval(async () => {
      const sessionExists = await authService.checkSession();
      if (sessionExists) {
        clearInterval(timer);
        needsSetup.set(false);
        await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      }
    }, 1000);

    setTimeout(() => clearInterval(timer), 5 * 60 * 1000);
  };

  const handleLogout = async () => {
    const success = await authService.logout();
    if (success) {
      userInfo = undefined;
      showUserDropdown = false;
      await checkSession();
    }
  };

  // Language change handler
  const changeLanguage = async (languageCode: string) => {
    try {
      locale.set(languageCode);
      await invoke('save_settings_merge', { patch: { language: languageCode } });
      logger.info('layout', 'changeLanguage', `Language changed to ${languageCode}`);
    } catch (e) {
      logger.error('layout', 'changeLanguage', `Failed to save language preference: ${e}`, { error: e });
    }
  };

  const loadUserInfo = async () => {
    const settings = await loadSettings(['disable_school_picture']);
    disableSchoolPicture = settings.disable_school_picture ?? false;
    userInfo = await authService.loadUserInfo({ disableSchoolPicture });
  };

  const loadWeatherSettings = async () => {
    const weatherService = await ensureWeatherService();
    const settings = await weatherService.loadWeatherSettings();
    weatherEnabled = settings.weather_enabled;
    weatherCity = settings.weather_city;
    weatherCountry = settings.weather_country ?? '';
    forceUseLocation = settings.force_use_location;
  };

  const fetchWeather = async (useIP = false) => {
    if (!weatherEnabled || (!useIP && !weatherCity)) {
      weatherData = null;
      return;
    }

    const weatherService = await ensureWeatherService();

    loadingWeather = true;
    weatherError = '';
    try {
      weatherData = useIP 
        ? await weatherService.fetchWeatherWithIP()
        : await weatherService.fetchWeather(weatherCity, weatherCountry);
    } catch (e) {
      weatherError = `Failed to load weather: ${e}`;
      weatherData = null;
    } finally {
      loadingWeather = false;
    }
  };

  $effect(() => {
    document.documentElement.setAttribute('data-accent-color', '');
    document.documentElement.style.setProperty('--accent-color-value', $accentColor);
    logger.debug('layout', '$effect', 'Applied accent color to root as CSS var', { accent: $accentColor });
  });

  const loadEnhancedAnimationsSetting = async () => {
    const settings = await loadSettings(['enhanced_animations']);
    enhancedAnimations = settings.enhanced_animations ?? true;
    logger.info('layout', 'loadEnhancedAnimationsSetting', 'Setting loaded', { enhancedAnimations });
  };

  $effect(() => {
    logger.debug('layout', '$effect', 'Enhanced animations effect triggered', { enhancedAnimations });
    if (enhancedAnimations) {
      document.body.classList.add('enhanced-animations');
    } else {
      document.body.classList.remove('enhanced-animations');
    }
  });

  onMount(async () => {
    logger.logComponentMount('layout');
    setupServiceWorkerAndListeners();
    
    // Initialize theme and i18n first
    await Promise.all([
      loadAccentColor(),
      loadTheme(),
      loadCurrentTheme(),
      initI18n(),
    ]);

    shellReady = true;

    try {
      // Load saved language preference
      try {
        const settings = await loadSettings(['language']);
        if (settings.language && availableLocales.some(l => l.code === settings.language)) {
          locale.set(settings.language);
        }
      } catch (e) {
        logger.debug('layout', 'onMount', 'Could not load language preference', { error: e });
      }

      // Load dev mock flag early to control session flow
      try {
        const settings = await loadSettings(['dev_sensitive_info_hider']);
        devMockEnabled = settings.dev_sensitive_info_hider ?? false;
      } catch {}

      // Load all settings and check session
      await Promise.all([
        checkSession(),
        loadWeatherSettings(),
        loadEnhancedAnimationsSetting(),
        reloadSidebarSettings()
      ]);
      
      // Background tasks (lazy-loaded)
      ensureWarmupService().then((warmupModule) => {
        warmupModule.warmUpCommonData().catch(() => {});
      });
      if (weatherEnabled) {
        fetchWeather(!forceUseLocation);
      }

      // Validate SEQTA session on app launch
      if (!devMockEnabled && !$needsSetup) {
        try {
          const response = await seqtaFetch('/seqta/student/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { mode: 'normal', query: null, redirect_url: seqtaUrl },
          });
          
          const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
          const isAuthenticated = responseStr.includes('site.name.abbrev');
          
          if (!isAuthenticated && (responseStr.includes('error') || responseStr.includes('unauthorized') || responseStr.includes('401'))) {
            logger.warn('layout', 'onMount', 'Session invalid, logging out');
            await handleLogout();
          }
        } catch (e) {
          logger.error('layout', 'onMount', 'SEQTA session check failed', { error: e });
        }
      }
      
      // Run a one-time heartbeat health check on app open
      await healthCheck();
      
      // Check and apply initial fullscreen styling
      try {
        await invoke('handle_fullscreen_change');
      } catch (e) {
        logger.debug('layout', 'onMount', 'Failed to check initial fullscreen state', { error: e });
      }
    } finally {
      contentLoading = false;
    }
  });

  // Consolidated effects
  $effect(() => {
    if (autoCollapseSidebar) handlePageNavigation();
    if ($needsSetup) sidebarOpen = false;
    if ($page.url.pathname === '/settings') reloadSidebarSettings();
  });

  // Mobile detection and event listeners
  onMount(() => {
    // Treat mobile either as a native mobile platform (Tauri)
    // or when viewport is below the `sm` breakpoint (~640px)
    const mql = window.matchMedia('(max-width: 640px)');

    const checkMobile = () => {
      const platform = import.meta.env.TAURI_ENV_PLATFORM;
      const isNativeMobile = platform === 'ios' || platform === 'android';
      const isSmallViewport = mql.matches;
      const nextIsMobile = isNativeMobile || isSmallViewport;

      // If switching from non-mobile to mobile, ensure sidebar is closed
      if (!isMobile && nextIsMobile) {
        sidebarOpen = false;
      }
      isMobile = nextIsMobile;
    };

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
      ['mousemove', handleMouseMove]
    ] as const;
    
    events.forEach(([event, handler]) => 
      document.addEventListener(event, handler as EventListener)
    );

    return () => {
      events.forEach(([event, handler]) => 
        document.removeEventListener(event, handler as EventListener)
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
    } catch (e) {
      logger.error('layout', 'loadSeqtaConfigAndMenu', 'Failed to load config/menu', { error: e });
    } finally {
      menuLoading = false;
    }
  };

  // Config/menu loading is handled in checkSession/startLogin
</script>

{#if !shellReady}
  <LoadingScreen />
{:else}
  <div class="flex flex-col h-screen">
    {#if !$needsSetup}
      <AppHeader
        {sidebarOpen}
        {weatherEnabled}
        {weatherData}
        {userInfo}
        {showUserDropdown}
        onToggleSidebar={() => (sidebarOpen = !sidebarOpen)}
        onToggleUserDropdown={() => (showUserDropdown = !showUserDropdown)}
        onLogout={handleLogout}
        onShowAbout={() => (showAboutModal = true)}
        onClickOutside={handleClickOutside}
        {disableSchoolPicture}
      />
    {/if}

    <div class="flex relative flex-1 min-h-0">
      {#if !$needsSetup && !menuLoading}
        <AppSidebar {sidebarOpen} {menu} onMenuItemClick={handlePageNavigation} />
      {/if}

      <!-- Mobile Sidebar Overlay -->
      {#if sidebarOpen && isMobile && !$needsSetup}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="fixed inset-0 z-20 bg-black/50 sm:hidden"
          onclick={() => (sidebarOpen = false)}
          role="button"
          tabindex="0"
          aria-label={$_('navigation.close_sidebar', { default: 'Close sidebar overlay' })}>
        </div>
      {/if}

      <!-- Main Content -->
      <main
        class="overflow-y-auto flex-1 border-t rounded-tl-xl {!$needsSetup ? 'border-l' : ''} border-zinc-200 dark:border-zinc-700/50 bg-white/50 dark:bg-zinc-900/50 transition-all duration-200"
        style="margin-right: {$themeBuilderSidebarOpen ? '384px' : '0'};"
      >
        {#if contentLoading}
          <div class="flex items-center justify-center w-full h-full py-12">
            <LoadingScreen inline />
          </div>
        {:else}
          {#if $needsSetup}
            <LoginScreen
              {seqtaUrl}
              onStartLogin={startLogin}
              onUrlChange={(url) => (seqtaUrl = url)}
            />
          {:else}
            {@render children()}
          {/if}
        {/if}
      </main>

      <!-- ThemeBuilder Sidebar -->
      {#if $themeBuilderSidebarOpen}
        <aside class="flex fixed top-0 right-0 z-50 flex-col w-96 h-full bg-white border-l shadow-xl transition-transform duration-200 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700">
          {#if themeBuilderComponent}
            <svelte:component this={themeBuilderComponent}>
              {#snippet close()}
                <button 
                  class="p-2 ml-auto rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200" 
                  onclick={() => themeBuilderSidebarOpen.set(false)} 
                  aria-label={$_('common.close_theme_builder', { default: 'Close Theme Builder' })}
                >
                  <Icon src={XMark} class="w-6 h-6" />
                </button>
              {/snippet}
            </svelte:component>
          {:else}
            <Skeleton variant="modal" />
          {/if}
        </aside>
      {/if}
    </div>
  </div>
{/if}

{#if aboutModalComponent}
  <svelte:component this={aboutModalComponent} bind:open={showAboutModal} onclose={() => (showAboutModal = false)} />
{:else if showAboutModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/70 backdrop-blur-sm"
    onclick={() => (showAboutModal = false)}
    role="dialog"
    aria-label={$_('about.loading_modal', { default: 'Loading about information' })}
  >
    <div class="w-[680px] max-w-[92vw]" onclick={(event) => event.stopPropagation()}>
      <Skeleton variant="modal" class="rounded-3xl" />
    </div>
  </div>
{/if}
