<script lang="ts">
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import AboutModal from '../lib/components/AboutModal.svelte';
  import AppHeader from '../lib/components/AppHeader.svelte';
  import AppSidebar from '../lib/components/AppSidebar.svelte';
  import LoginScreen from '../lib/components/LoginScreen.svelte';
  import LoadingScreen from '../lib/components/LoadingScreen.svelte';
  import ThemeBuilder from '../lib/components/ThemeBuilder.svelte';
  import { authService, type UserInfo } from '../lib/services/authService';
  import { weatherService, type WeatherData } from '../lib/services/weatherService';
  import { warmUpCommonData } from '../lib/services/warmupService';
  import { logger } from '../utils/logger';
  import { seqtaFetch } from '../utils/netUtil';
  import '../app.css';
  import { accentColor, loadAccentColor, theme, loadTheme, loadCurrentTheme } from '../lib/stores/theme';
  import { themeBuilderSidebarOpen } from '../lib/stores/themeBuilderSidebar';
  import { Icon, Home, Newspaper, ClipboardDocumentList, BookOpen, ChatBubbleLeftRight, DocumentText, AcademicCap, ChartBar, Cog6Tooth, CalendarDays, User, GlobeAlt, XMark, PencilSquare } from 'svelte-hero-icons';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  export const needsSetup = writable(false);

  let { children } = $props();

  // Core state
  let seqtaUrl = $state<string>('');
  let userInfo = $state<UserInfo | undefined>(undefined);
  let seqtaConfig: any = $state(null);
  let isLoading = $state(true);
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
  // Menu configuration
  const DEFAULT_MENU = [
    { label: 'Dashboard', icon: Home, path: '/' },
    { label: 'Courses', icon: BookOpen, path: '/courses' },
    { label: 'Assessments', icon: ClipboardDocumentList, path: '/assessments' },
    { label: 'Timetable', icon: CalendarDays, path: '/timetable' },
    { label: 'Study', icon: PencilSquare, path: '/study' },
    { label: 'Messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
    { label: 'Portals', icon: GlobeAlt, path: '/portals' },
    { label: 'Notices', icon: DocumentText, path: '/notices' },
    { label: 'News', icon: Newspaper, path: '/news' },
    { label: 'Directory', icon: User, path: '/directory' },
    { label: 'Reports', icon: ChartBar, path: '/reports' },
    { label: 'Analytics', icon: AcademicCap, path: '/analytics' },
    { label: 'Settings', icon: Cog6Tooth, path: '/settings' },
  ];
  let menu = $state([...DEFAULT_MENU]);
  let menuLoading = $state(true);



  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target.closest('.user-dropdown-container')) {
      showUserDropdown = false;
    }
  };

  const checkSession = async () => {
    logger.logFunctionEntry('layout', 'checkSession');
    try {
      const sessionExists = await authService.checkSession();
      needsSetup.set(!sessionExists);
      logger.info('layout', 'checkSession', `Session exists: ${sessionExists}`, { sessionExists });
      
      if (sessionExists) {
        await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      }
      logger.logFunctionExit('layout', 'checkSession', { sessionExists });
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

  const loadUserInfo = async () => {
    const settings = await loadSettings(['disable_school_picture']);
    disableSchoolPicture = settings.disable_school_picture ?? false;
    userInfo = await authService.loadUserInfo({ disableSchoolPicture });
  };

  const loadWeatherSettings = async () => {
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
    
    // Initialize theme first
    await Promise.all([
      loadAccentColor(),
      loadTheme(),
      loadCurrentTheme(),
    ]);

    // Load all settings and check session
    await Promise.all([
      checkSession(),
      loadWeatherSettings(),
      loadEnhancedAnimationsSetting(),
      reloadSidebarSettings()
    ]);
    
    // Background tasks
    warmUpCommonData().catch(() => {});
    if (weatherEnabled) {
      fetchWeather(!forceUseLocation);
    }

    // Validate SEQTA session on app launch
    if (!$needsSetup) {
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
    isLoading = false;
  });

  // Consolidated effects
  $effect(() => {
    if (autoCollapseSidebar) handlePageNavigation();
    if ($needsSetup) sidebarOpen = false;
    if ($page.url.pathname === '/settings') reloadSidebarSettings();
  });

  // Mobile detection and event listeners
  onMount(() => {
    const checkMobile = () => {
      const platform = import.meta.env.TAURI_ENV_PLATFORM;
      isMobile = platform === 'ios' || platform === 'android';
      if (isMobile) sidebarOpen = false;
    };

    checkMobile();
    const events = [
      ['resize', checkMobile],
      ['click', handleClickOutside],
      ['mousemove', handleMouseMove]
    ] as const;
    
    events.forEach(([event, handler]) => 
      document.addEventListener(event, handler as EventListener)
    );

    return () => events.forEach(([event, handler]) => 
      document.removeEventListener(event, handler as EventListener)
    );
  });

  const loadSeqtaConfigAndMenu = async () => {
    try {
      const sessionExists = await authService.checkSession();
      if (!sessionExists) {
        logger.debug('layout', 'loadSeqtaConfigAndMenu', 'Skipping: not authenticated');
        return;
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

{#if isLoading}
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

    <div class="flex flex-1 min-h-0 relative">
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
          aria-label="Close sidebar overlay">
        </div>
      {/if}

      <!-- Main Content -->
      <main
        class="overflow-y-auto flex-1 border-t {!$needsSetup ? 'border-l' : ''} border-slate-200 dark:border-slate-700/50 transition-all duration-200"
        style="background: var(--background-color); margin-right: {$themeBuilderSidebarOpen ? '384px' : '0'};"
      >
        {#if $needsSetup}
          <LoginScreen
            {seqtaUrl}
            onStartLogin={startLogin}
            onUrlChange={(url) => (seqtaUrl = url)}
          />
        {:else}
          {@render children()}
        {/if}
      </main>

      <!-- ThemeBuilder Sidebar -->
      {#if $themeBuilderSidebarOpen}
        <aside class="fixed top-0 right-0 h-full w-96 z-50 bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-200">
          <ThemeBuilder>
            {#snippet close()}
              <button 
                class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors ml-auto" 
                onclick={() => themeBuilderSidebarOpen.set(false)} 
                aria-label="Close Theme Builder"
              >
                <Icon src={XMark} class="w-6 h-6" />
              </button>
            {/snippet}
          </ThemeBuilder>
        </aside>
      {/if}
    </div>
  </div>
{/if}
<AboutModal bind:open={showAboutModal} onclose={() => (showAboutModal = false)} />