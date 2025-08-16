<script lang="ts">
  import { listen } from '@tauri-apps/api/event';
  import { invoke } from '@tauri-apps/api/core';
  import AboutModal from '../lib/components/AboutModal.svelte';
  import AppHeader from '../lib/components/AppHeader.svelte';
  import AppSidebar from '../lib/components/AppSidebar.svelte';
  import LoginScreen from '../lib/components/LoginScreen.svelte';
  import { authService, type UserInfo } from '../lib/services/authService';
  import { weatherService, type WeatherData } from '../lib/services/weatherService';
  import { errorService } from '../lib/services/errorService';
  import { logger } from '../utils/logger';

  import jsQR from 'jsqr';

  import '../app.css';
  import { accentColor, loadAccentColor, theme, loadTheme, loadCurrentTheme } from '../lib/stores/theme';
  import { warmUpCommonData } from '../lib/services/warmupService';
  import { Icon, Home, Newspaper, ClipboardDocumentList, BookOpen, ChatBubbleLeftRight, DocumentText, AcademicCap, ChartBar, Cog6Tooth, CalendarDays, User, GlobeAlt, Swatch, XMark, PencilSquare } from 'svelte-hero-icons';

  import { writable } from 'svelte/store';
  import { seqtaFetch } from '../utils/netUtil';
  import LoadingScreen from '../lib/components/LoadingScreen.svelte';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  export const needsSetup = writable(false);

  let seqtaUrl = $state<string>('');
  let userInfo = $state<UserInfo | undefined>(undefined);
  let { children } = $props();

  let weatherEnabled = $state(false);
  let forceUseLocation = $state(true);
  let weatherCity = $state('');
  let weatherCountry = $state('');
  let weatherData = $state<WeatherData | null>(null);
  let loadingWeather = $state(false);
  let weatherError = $state('');

  let isMobile = $state(false);

  let sidebarOpen = $state(true);
  let isDarkMode = $derived($theme === 'dark');
  let notifications = $state([]);
  let unreadNotifications = $state(0);

  let showUserDropdown = $state(false);
  let showAboutModal = $state(false);
  let isLoading = $state(true);

  let disableSchoolPicture = $state(false);

  let enhancedAnimations = $state(true);
  let autoCollapseSidebar = $state(false);
  let autoExpandSidebarHover = $state(false);

  let seqtaConfig: any = $state(null);
  let menu = $state([
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
  ]);
  let menuLoading = $state(true);

  import ThemeBuilder from '../lib/components/ThemeBuilder.svelte';
  import { themeBuilderSidebarOpen } from '../lib/stores/themeBuilderSidebar';
  import { get } from 'svelte/store';

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.user-dropdown-container')) {
      showUserDropdown = false;
    }
  }

  async function checkSession() {
    logger.logFunctionEntry('layout', 'checkSession');
    logger.info('layout', 'checkSession', 'Checking user session');
    
    try {
      const sessionExists = await authService.checkSession();
      needsSetup.set(!sessionExists);
      
      logger.info('layout', 'checkSession', `Session exists: ${sessionExists}`, { sessionExists });
      
      if (sessionExists) {
        logger.debug('layout', 'checkSession', 'Loading user info');
        await loadUserInfo();
        await loadSeqtaConfigAndMenu();
      }
      
      logger.logFunctionExit('layout', 'checkSession', { sessionExists });
    } catch (error) {
      logger.error('layout', 'checkSession', `Failed to check session: ${error}`, { error });
    }
  }

  onMount(() => {
    logger.logComponentMount('layout');
    logger.info('layout', 'onMount', 'Application layout mounted');
    checkSession();
  });

  let unlisten: (() => void) | undefined;
  onMount(async () => {
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
  });

  onDestroy(() => {
    logger.logComponentUnmount('layout');
    if (unlisten) {
      logger.debug('layout', 'onDestroy', 'Cleaning up reload listener');
      unlisten();
    }
  });

  // Function to reload enhanced animations setting
  async function reloadEnhancedAnimationsSetting() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['enhanced_animations'] });
      enhancedAnimations = subset?.enhanced_animations ?? true;
      logger.debug('layout', 'reloadEnhancedAnimationsSetting', `Enhanced animations setting reloaded: ${enhancedAnimations}`, { enhancedAnimations });
    } catch (e) {
      logger.error('layout', 'reloadEnhancedAnimationsSetting', `Failed to reload enhanced animations setting: ${e}`, { error: e });
    }
  }

  // Function to reload auto collapse sidebar setting
  async function reloadAutoCollapseSidebarSetting() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['auto_collapse_sidebar'] });
      autoCollapseSidebar = subset?.auto_collapse_sidebar ?? false;
      console.log('Auto collapse sidebar setting reloaded:', autoCollapseSidebar);
    } catch (e) {
      console.error('Failed to reload auto collapse sidebar setting:', e);
    }
  }

  // Function to reload auto expand sidebar hover setting
  async function reloadAutoExpandSidebarHoverSetting() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['auto_expand_sidebar_hover'] });
      autoExpandSidebarHover = subset?.auto_expand_sidebar_hover ?? false;
      console.log('Auto expand sidebar hover setting reloaded:', autoExpandSidebarHover);
    } catch (e) {
      console.error('Failed to reload auto expand sidebar hover setting:', e);
    }
  }

  // Function to handle page navigation with auto-collapse
  function handlePageNavigation() {
    if (autoCollapseSidebar) {
      sidebarOpen = false;
    }
    // Auto-close sidebar on mobile when menu item is clicked
    if (isMobile) {
      sidebarOpen = false;
    }
  }

  // Function to handle mouse hover for auto-expand
  function handleMouseMove(event: MouseEvent) {
    if (autoExpandSidebarHover && !isMobile) {
      const x = event.clientX;
      
      if (!sidebarOpen && x <= 20) {
        // Expand sidebar when hovering near left edge
        sidebarOpen = true;
      } else if (sidebarOpen && x > 280) {
        // Collapse sidebar when mouse moves away from sidebar area (sidebar width is ~256px + some buffer)
        sidebarOpen = false;
      }
    }
  }

  async function startLogin() {
    console.log('[LOGIN_FRONTEND] startLogin called');
    
    if (!seqtaUrl) {
      console.error('[LOGIN_FRONTEND] No valid SEQTA URL found');
      return;
    }

    console.log('[LOGIN_FRONTEND] Starting authentication with URL:', seqtaUrl);
    await authService.startLogin(seqtaUrl);
    console.log('[LOGIN_FRONTEND] Authentication request sent to backend');

    const timer = setInterval(async () => {
      const sessionExists = await authService.checkSession();
      console.log('[LOGIN_FRONTEND] Session check result:', sessionExists);
      
      if (sessionExists) {
        console.log('[LOGIN_FRONTEND] Session found, completing login');
        clearInterval(timer);
        needsSetup.set(false);
        await loadUserInfo();
        await loadSeqtaConfigAndMenu();
      }
    }, 1000);

    setTimeout(() => {
      console.log('[LOGIN_FRONTEND] Login timeout reached');
      clearInterval(timer);
    }, 5 * 60 * 1000);
  }

  async function handleLogout() {
    const success = await authService.logout();
    if (success) {
      // Immediately clear user info and close dropdown
      userInfo = undefined;
      showUserDropdown = false;
      await checkSession();
    }
  }

  async function loadSettingsForUserPicture() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['disable_school_picture'] });
      console.log('Loaded settings for user picture:', subset);
      disableSchoolPicture = subset?.disable_school_picture ?? false;
      console.log('disableSchoolPicture set to:', disableSchoolPicture);
    } catch (e) {
      console.error('Failed to load settings for user picture:', e);
      disableSchoolPicture = false;
    }
  }

  async function loadUserInfo() {
    await loadSettingsForUserPicture();
    userInfo = await authService.loadUserInfo({ disableSchoolPicture });
  }

  async function loadWeatherSettings() {
    const settings = await weatherService.loadWeatherSettings();
    weatherEnabled = settings.weather_enabled;
    weatherCity = settings.weather_city;
    weatherCountry = settings.weather_country ?? '';
    forceUseLocation = settings.force_use_location;
  }

  async function fetchWeatherWithIP() {
    if (!weatherEnabled) {
      weatherData = null;
      return;
    }

    loadingWeather = true;
    weatherError = '';

    try {
      weatherData = await weatherService.fetchWeatherWithIP();
    } catch (e) {
      weatherError = `Failed to load weather: ${e}`;
      weatherData = null;
    } finally {
      loadingWeather = false;
    }
  }

  async function fetchWeather() {
    if (!weatherEnabled || !weatherCity) {
      weatherData = null;
      return;
    }

    loadingWeather = true;
    weatherError = '';
    try {
      weatherData = await weatherService.fetchWeather(weatherCity, weatherCountry);
    } catch (e) {
      weatherError = `Failed to load weather: ${e}`;
      weatherData = null;
    } finally {
      loadingWeather = false;
    }
  }

  $effect(() => {
    document.documentElement.setAttribute('data-accent-color', '');
    document.documentElement.style.setProperty('--accent-color-value', $accentColor);
    logger.debug('layout', '$effect', 'Applied accent color to root as CSS var', { accent: $accentColor });
  });

  async function loadEnhancedAnimationsSetting() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['enhanced_animations'] });
      enhancedAnimations = subset?.enhanced_animations ?? true;
      logger.info('layout', 'loadEnhancedAnimationsSetting', 'Enhanced animations setting loaded', { enhancedAnimations });
    } catch (e) {
      logger.error('layout', 'loadEnhancedAnimationsSetting', 'Failed to load enhanced animations setting', { error: e });
      enhancedAnimations = true;
    }
  }

  $effect(() => {
    logger.debug('layout', '$effect', 'Enhanced animations effect triggered', { enhancedAnimations });
    if (enhancedAnimations) {
      document.body.classList.add('enhanced-animations');
    } else {
      document.body.classList.remove('enhanced-animations');
    }
  });

  onMount(async () => {
    // Normalize theme initialization order: load accent/theme first
    await Promise.all([
      loadAccentColor(),
      loadTheme(),
      loadCurrentTheme(),
    ]);

    await Promise.all([
      checkSession(),
      loadWeatherSettings(),
      loadEnhancedAnimationsSetting(),
      reloadAutoCollapseSidebarSetting(),
      reloadAutoExpandSidebarHoverSetting()
    ]);
    // Background warm-up irrespective of navigation intent
    // Fires after we've attempted session load; it will no-op if unauthenticated endpoints fail
    warmUpCommonData().catch(() => {});
    if (weatherEnabled) {
      if (forceUseLocation) fetchWeather();
      else fetchWeatherWithIP();
    }

    // Check SEQTA cookie/session on app launch
    if (!($needsSetup)) {
      try {
        const appUrl = seqtaUrl;
        const response = await seqtaFetch('/seqta/student/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            mode: 'normal',
            query: null,
            redirect_url: appUrl,
          },
        });
        // Debug: log the raw response
        logger.debug('layout', 'onMount', 'SEQTA session check response', { response });
        const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
        const foundAbbrev = responseStr.includes('site.name.abbrev');
        logger.debug('layout', 'onMount', 'Contains site.name.abbrev', { foundAbbrev });
        if (foundAbbrev) {
          logger.info('layout', 'onMount', 'User is authenticated - site info found in response');
          // User is authenticated, no need to logout
        } else {
          logger.debug('layout', 'onMount', 'No site info found - user may be logged out');
          // Check if this is actually an error response that indicates logout
          if (responseStr.includes('error') || responseStr.includes('unauthorized') || responseStr.includes('401')) {
            logger.warn('layout', 'onMount', 'Detected logout/error response, triggering logout');
          await handleLogout();
          }
        }
      } catch (e) {
        logger.error('layout', 'onMount', 'SEQTA session check failed', { error: e });
      }
    }
    isLoading = false;
  });

  // Effect to handle page navigation and auto-collapse sidebar
  $effect(() => {
    if (autoCollapseSidebar) {
      handlePageNavigation();
    }
  });

  // Reload auto collapse sidebar setting when navigating to settings
  $effect(() => {
    if ($page.url.pathname === '/settings') {
      reloadAutoCollapseSidebarSetting();
      reloadAutoExpandSidebarHoverSetting();
    }
  });

  // Force sidebar closed when on login screen
  $effect(() => {
    if ($needsSetup) {
      sidebarOpen = false;
    }
  });

  onMount(() => {
    const checkMobile = () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM
      if (tauri_platform == "ios" || tauri_platform == "android") {
        isMobile = true
      } else {
        isMobile = false
      }
      if (isMobile) {
        sidebarOpen = false;
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    document.addEventListener('click', handleClickOutside);
    
    // Add mouse event listeners for auto-expand hover
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  });

  async function loadSeqtaConfigAndMenu() {
    try {
      const sessionExists = await authService.checkSession();
      if (!sessionExists) {
        logger.debug('layout', 'loadSeqtaConfigAndMenu', 'Skipping SEQTA config fetch: not authenticated');
        return;
      }

      let config = await invoke('load_seqta_config');
      let needsFetch = false;
      let latestConfig = null;
      if (!config) {
        needsFetch = true;
      } else {
        // Fetch latest config from SEQTA
        const res = await seqtaFetch('/seqta/student/load/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {},
        });
        latestConfig = typeof res === 'string' ? JSON.parse(res) : res;
        // Check if config is outdated
        const isDifferent = await invoke('is_seqta_config_different', { newConfig: latestConfig });
        if (isDifferent) {
          needsFetch = true;
        } else {
          seqtaConfig = config;
        }
      }
      if (needsFetch) {
        // Save the latest config
        if (!latestConfig) {
          const res = await seqtaFetch('/seqta/student/load/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {},
          });
          latestConfig = typeof res === 'string' ? JSON.parse(res) : res;
        }
        seqtaConfig = latestConfig;
        await invoke('save_seqta_config', { config: latestConfig });
      }
      // Now, build the menu based on config
      let newMenu = [
        { label: 'Dashboard', icon: Home, path: '/' },
        { label: 'Courses', icon: BookOpen, path: '/courses' },
        { label: 'Assessments', icon: ClipboardDocumentList, path: '/assessments' },
        { label: 'Timetable', icon: CalendarDays, path: '/timetable' },
        { label: 'Study', icon: PencilSquare, path: '/study' },
        // Always show DM (Messages) page
        { label: 'Messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
        { label: 'Portals', icon: GlobeAlt, path: '/portals' },
        { label: 'Notices', icon: DocumentText, path: '/notices' },
        { label: 'News', icon: Newspaper, path: '/news' },
        { label: 'Directory', icon: User, path: '/directory' },
        { label: 'Reports', icon: ChartBar, path: '/reports' },
        { label: 'Analytics', icon: AcademicCap, path: '/analytics' },
        { label: 'Settings', icon: Cog6Tooth, path: '/settings' },
      ];
      menu = newMenu;
    } catch (e) {
      console.error('Failed to load SEQTA config or menu:', e);
    } finally {
      menuLoading = false;
    }
  }

  onMount(() => {
    // Defer SEQTA config/menu loading until after authentication.
    // It will be triggered from checkSession/startLogin when a session exists.
  });
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
        disableSchoolPicture={disableSchoolPicture}
      />
    {/if}

    <div class="flex flex-1 min-h-0 relative">
      {#if !$needsSetup}
        {#if !menuLoading}
          <AppSidebar {sidebarOpen} {menu} onMenuItemClick={handlePageNavigation} />
        {/if}
      {/if}

      <!-- Mobile Sidebar Overlay -->
      {#if sidebarOpen && isMobile && !$needsSetup}
        <div
          class="fixed inset-0 z-20 bg-black/50 sm:hidden"
          onclick={() => (sidebarOpen = false)}
          onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)}
          role="button"
          tabindex="0"
          aria-label="Close sidebar overlay">
        </div>
      {/if}

      <!-- Main Content with ThemeBuilder Sidebar -->
      <main
        class="overflow-y-auto flex-1 border-t {!$needsSetup ? 'border-l' : ''} border-slate-200 dark:border-slate-700/50 transition-all duration-200"
        style="background: var(--background-color); margin-right: { $themeBuilderSidebarOpen ? '384px' : '0'};"
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
        <aside class="fixed top-0 right-0 h-full w-96 z-50 bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-200" style="transform: translateX(0);">
          <ThemeBuilder>
            <button slot="close" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors ml-auto" onclick={() => themeBuilderSidebarOpen.set(false)} aria-label="Close Theme Builder">
              <Icon src={XMark} class="w-6 h-6" />
            </button>
          </ThemeBuilder>
        </aside>
      {/if}
    </div>
  </div>
{/if}



<!-- About Modal -->
<AboutModal bind:open={showAboutModal} onclose={() => (showAboutModal = false)} />
