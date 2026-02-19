<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import {
    accentColor,
    loadAccentColor,
    updateAccentColor,
    theme,
    updateTheme,
  } from '../../lib/stores/theme';
  import { Icon } from 'svelte-hero-icons';
  import {
    Plus,
    ArrowPath,
    Trash,
    Rss,
    Sun,
    Moon,
    ComputerDesktop,
    CloudArrowUp,
    Cog,
    Squares2x2,
    User,
    Bars3,
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
    GlobeAlt,
    PencilSquare,
    Flag,
    ChatBubbleBottomCenterText,
    FolderOpen,
    MagnifyingGlass,
    Minus,
  } from 'svelte-hero-icons';
  import { check } from '@tauri-apps/plugin-updater';
  import CloudSyncModal from '../../lib/components/CloudSyncModal.svelte';
  import TroubleshootingModal from '../../lib/components/TroubleshootingModal.svelte';
  import SidebarSettingsDialog from '../../lib/components/SidebarSettingsDialog.svelte';
  import LanguageSelector from '../../lib/components/LanguageSelector.svelte';
  import Card from '../../lib/components/ui/Card.svelte';
  import T from '../../lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';
  import { goto, beforeNavigate } from '$app/navigation';
  import { cloudAuthService } from '../../lib/services/cloudAuthService';
  import { toastStore } from '../../lib/stores/toast';
  import { cloudSettingsService } from '../../lib/services/cloudSettingsService';
  import { saveSettingsWithQueue, flushSettingsQueue } from '../../lib/services/settingsSync';
  import { setZoom } from '../../lib/utils/zoom';
  import { CacheManager } from '../../utils/cacheManager';
  import { performanceTester, type TestResults } from '../../lib/services/performanceTesting';
  import Modal from '../../lib/components/Modal.svelte';
  import ProfilePictureCropModal from '../../lib/components/ProfilePictureCropModal.svelte';

  interface Shortcut {
    name: string;
    icon: string;
    url: string;
  }

  interface Feed {
    url: string;
  }

  let shortcuts = $state<Shortcut[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let saveSuccess = $state(false);
  let saveError = $state('');
  let weatherEnabled = $state(false);
  let forceUseLocation = $state(false);
  let weatherCity = $state('');
  let feeds = $state<Feed[]>([]);
  let weatherCountry = $state('');
  let disableSchoolPicture = $state(false);
  let enhancedAnimations = $state(true);
  let geminiApiKey = $state('');
  let cerebrasApiKey = $state('');
  let aiProvider = $state<'gemini' | 'cerebras'>('gemini');

  let remindersEnabled = $state(true);
  let autoDismissMessageNotifications = $state(false);
  let showCloudSyncModal = $state(false);
  let showTroubleshootingModal = $state(false);
  let aiIntegrationsEnabled = $state(false);
  let clearingCache = $state(false);
  let lessonSummaryAnalyserEnabled = $state(true);
  let quizGeneratorEnabled = $state(true);
  let autoCollapseSidebar = $state(false);
  let autoExpandSidebarHover = $state(false);
  let globalSearchEnabled = $state(true);
  let devSensitiveInfoHider = $state(false);
  let devForceOfflineMode = $state(false);
  let showDevSettings = $state(false);
  let separateRssFeed = $state(false);
  let zoomLevel = $state(1);
  let keyBuffer = '';
  let acceptedCloudEula = $state(false);
  let showEulaModal = $state(false);
  let cloudBaseUrl: string = '';
  let cloudBaseUrlSaving = false;
  let cloudBaseUrlError: string | null = null;
  let cloudBaseUrlChanged = false;
  let performanceTestRunning = $state(false);
  let checkingUpdates = $state(false);
  let updateAvailable = $state(false);
  let updateVersion = $state('');
  let updateNotes = $state('');
  let isDesktop = $state(false);
  let showSidebarSettingsDialog = $state(false);
  let showUnsavedChangesModal = $state(false);
  let pendingNavigationUrl: string | null = null;
  let resettingOnboarding = $state(false);

  // Store initial settings state for comparison
  let initialSettings: {
    shortcuts: Shortcut[];
    feeds: Feed[];
    weatherEnabled: boolean;
    weatherCity: string;
    weatherCountry: string;
    remindersEnabled: boolean;
    autoDismissMessageNotifications: boolean;
    forceUseLocation: boolean;
    accentColor: string;
    theme: string;
    disableSchoolPicture: boolean;
    enhancedAnimations: boolean;
    geminiApiKey: string;
    cerebrasApiKey: string;
    aiProvider: 'gemini' | 'cerebras';
    aiIntegrationsEnabled: boolean;
    lessonSummaryAnalyserEnabled: boolean;
    quizGeneratorEnabled: boolean;
    autoCollapseSidebar: boolean;
    autoExpandSidebarHover: boolean;
    globalSearchEnabled: boolean;
    devSensitiveInfoHider: boolean;
    devForceOfflineMode: boolean;
    acceptedCloudEula: boolean;
    separateRssFeed: boolean;
    zoomLevel: number;
  } | null = null;

  // Menu configuration (same as in layout)
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
    { labelKey: 'navigation.reports', icon: ChartBar, path: '/reports' },
    { labelKey: 'navigation.analytics', icon: AcademicCap, path: '/analytics' },
    { labelKey: 'navigation.settings', icon: Cog6Tooth, path: '/settings' },
  ];

  // Inline EULA text (can be updated here)
  const CLOUD_EULA_TEXT = `
BetterSeqta Cloud End-User License Agreement (EULA)

This End-User License Agreement ("EULA") is a binding legal agreement between you, the user ("User"), and BetterSeqta ("Company") for the use of the BetterSeqta Cloud service ("Service"). By accessing or using the Service, you agree to be bound by the terms of this EULA.

1. License Grant

The Company grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal business purposes, subject to the terms and conditions of this EULA.

2. Data Privacy

The Company is committed to protecting your data. We will not intentionally sell, lease, or distribute any user data to third parties. We will also not intentionally access your data unless required to maintain the Service, troubleshoot a technical issue, or as required by law.

3. Beta Product Disclaimer

BetterSeqta Cloud is currently in a beta testing phase. As such, the Service may contain bugs, errors, and vulnerabilities. The Company makes no guarantee regarding the stability, reliability, or security of the Service. You acknowledge and agree that your use of the Service is at your own risk.

4. Security

Due to the beta nature of the Service, the Company cannot guarantee the security of any data stored on BetterSeqta Cloud. You are strongly advised not to store any sensitive, confidential, or critical data on the Service. The Company will not be liable for any loss or corruption of data, or for any unauthorized access to your data.

5. No Warranty

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.

6. Limitation of Liability

In no event shall the Company be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to, loss of profits, data, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use, or alteration of your transmissions or content.

7. Termination

The Company reserves the right to terminate your access to the Service at any time, with or without cause, with or without notice, effective immediately.`;

  // Cloud user state
  let cloudUser = $state<any>(null);
  let cloudUserLoading = $state(true);

  // Set the API URL for cloud sync
  const CLOUD_API_URL = 'https://accounts.betterseqta.org';

  // Profile picture state
  let customProfilePicture = $state<string | null>(null);
  let uploading = $state(false);
  let fileInput: HTMLInputElement;
  let showCropModal = $state(false);
  let cropImageSrc = $state<string | null>(null);

  async function loadCloudUser() {
    cloudUserLoading = true;
    try {
      // Initialize from current profile
      const user = await cloudAuthService.init();
      cloudUser = user;

      // If we have a user, verify session in background
      if (user) {
        cloudAuthService
          .getProfile()
          .then((u) => (cloudUser = u))
          .catch(async () => {
            // Token likely expired
            await cloudAuthService.logout();
            cloudUser = null;
          });
      }
    } catch (e) {
      cloudUser = null;
    }
    cloudUserLoading = false;
  }

  async function loadSettings() {
    loading = true;
    try {
      const settings = await invoke<any>('get_settings_subset', {
        keys: [
          'shortcuts',
          'feeds',
          'weather_enabled',
          'weather_city',
          'weather_country',
          'reminders_enabled',
          'auto_dismiss_message_notifications',
          'force_use_location',
          'accent_color',
          'theme',
          'disable_school_picture',
          'enhanced_animations',
          'gemini_api_key',
          'cerebras_api_key',
          'ai_provider',
          'ai_integrations_enabled',
          'lesson_summary_analyser_enabled',
          'quiz_generator_enabled',
          'auto_collapse_sidebar',
          'auto_expand_sidebar_hover',
          'global_search_enabled',
          'dev_sensitive_info_hider',
          'dev_force_offline_mode',
          'accepted_cloud_eula',
          'language',
          'separate_rss_feed',
          'zoom_level',
        ],
      });
      shortcuts = settings.shortcuts || [];
      feeds = settings.feeds || [];
      weatherEnabled = settings.weather_enabled ?? false;
      forceUseLocation = settings.force_use_location ?? false;
      weatherCity = settings.weather_city ?? '';
      weatherCountry = settings.weather_country ?? '';
      remindersEnabled = settings.reminders_enabled ?? true;
      autoDismissMessageNotifications = settings.auto_dismiss_message_notifications ?? false;
      disableSchoolPicture = settings.disable_school_picture ?? false;
      enhancedAnimations = settings.enhanced_animations ?? true;
      geminiApiKey = settings.gemini_api_key ?? '';
      cerebrasApiKey = settings.cerebras_api_key ?? '';
      aiProvider = (settings.ai_provider as 'gemini' | 'cerebras') || 'gemini';
      accentColor.set(settings.accent_color ?? '#3b82f6');
      theme.set(settings.theme === 'default' ? 'dark' : (settings.theme ?? 'dark'));
      aiIntegrationsEnabled = settings.ai_integrations_enabled ?? false;
      lessonSummaryAnalyserEnabled = settings.lesson_summary_analyser_enabled ?? true;
      quizGeneratorEnabled = settings.quiz_generator_enabled ?? true;
      autoCollapseSidebar = settings.auto_collapse_sidebar ?? false;
      autoExpandSidebarHover = settings.auto_expand_sidebar_hover ?? false;
      globalSearchEnabled = settings.global_search_enabled ?? true;
      devSensitiveInfoHider = settings.dev_sensitive_info_hider ?? false;
      devForceOfflineMode = settings.dev_force_offline_mode ?? false;
      acceptedCloudEula = settings.accepted_cloud_eula ?? false;
      separateRssFeed = settings.separate_rss_feed ?? false;
      zoomLevel = typeof settings.zoom_level === 'number' ? settings.zoom_level : 1;

      // Store initial state for comparison
      initialSettings = {
        shortcuts: JSON.parse(JSON.stringify(shortcuts)),
        feeds: JSON.parse(JSON.stringify(feeds)),
        weatherEnabled,
        weatherCity,
        weatherCountry,
        remindersEnabled,
        autoDismissMessageNotifications,
        forceUseLocation,
        accentColor: settings.accent_color ?? '#3b82f6',
        theme: settings.theme === 'default' ? 'dark' : (settings.theme ?? 'dark'),
        disableSchoolPicture,
        enhancedAnimations,
        geminiApiKey,
        cerebrasApiKey,
        aiProvider,
        aiIntegrationsEnabled,
        lessonSummaryAnalyserEnabled,
        quizGeneratorEnabled,
        autoCollapseSidebar,
        autoExpandSidebarHover,
        globalSearchEnabled,
        devSensitiveInfoHider,
        devForceOfflineMode,
        acceptedCloudEula,
        separateRssFeed,
        zoomLevel,
      };

      console.log('Loading settings', {
        shortcuts,
        weatherEnabled,
        weatherCity,
        weatherCountry,
        remindersEnabled,
        forceUseLocation,
        theme: settings.theme,
      });
    } catch (e) {
      shortcuts = [];
      feeds = [];
      weatherEnabled = false;
      forceUseLocation = false;
      weatherCity = '';
      weatherCountry = '';
      remindersEnabled = true;
      autoDismissMessageNotifications = false;
      disableSchoolPicture = false;
      enhancedAnimations = true;
      geminiApiKey = '';
      cerebrasApiKey = '';
      aiProvider = 'gemini';
      accentColor.set('#3b82f6');
      theme.set('dark');
      aiIntegrationsEnabled = false;
      lessonSummaryAnalyserEnabled = true;
      quizGeneratorEnabled = true;
      autoCollapseSidebar = false;
      autoExpandSidebarHover = false;
      globalSearchEnabled = true;
      devSensitiveInfoHider = false;
      devForceOfflineMode = false;
      acceptedCloudEula = false;
      separateRssFeed = false;
      zoomLevel = 1;
      showDevSettings = false;
    }
    loading = false;
  }

  // Helper function to get full profile picture URL
  function getFullPfpUrl(pfpUrl: string | null | undefined): string | null {
    if (!pfpUrl) return null;

    // If it's already a full URL, return as is
    if (pfpUrl.startsWith('http://') || pfpUrl.startsWith('https://')) {
      return pfpUrl;
    }

    // If it's a relative path, prepend the base domain
    if (pfpUrl.startsWith('/pfp/')) {
      return `https://accounts.betterseqta.org${pfpUrl}`;
    }

    // If it's a relative path, prepend the base domain
    if (pfpUrl.startsWith('/api/files/public/')) {
      return `https://accounts.betterseqta.org${pfpUrl}`;
    }

    // Fallback to DiceBear if it's not a recognized format
    return pfpUrl;
  }

  async function saveSettings(options: { skipReload?: boolean } = {}) {
    saving = true;
    saveSuccess = false;
    saveError = '';
    console.log('Saving settings', {
      shortcuts,
      feeds,
      weatherEnabled,
      weatherCity,
      weatherCountry,
      remindersEnabled,
      forceUseLocation,
      theme: $theme,
      enhancedAnimations,
    });
    try {
      // Filter out feeds with empty URLs before saving
      const validFeeds = feeds.filter((f) => f.url?.trim());
      const patch = {
        shortcuts,
        feeds: validFeeds,
        weather_enabled: weatherEnabled,
        weather_city: weatherCity,
        weather_country: weatherCountry,
        reminders_enabled: remindersEnabled,
        auto_dismiss_message_notifications: autoDismissMessageNotifications,
        force_use_location: forceUseLocation,
        accent_color: $accentColor,
        theme: $theme,
        disable_school_picture: disableSchoolPicture,
        enhanced_animations: enhancedAnimations,
        gemini_api_key: geminiApiKey,
        cerebras_api_key: cerebrasApiKey,
        ai_provider: aiProvider,
        ai_integrations_enabled: aiIntegrationsEnabled,
        lesson_summary_analyser_enabled: lessonSummaryAnalyserEnabled,
        quiz_generator_enabled: quizGeneratorEnabled,
        auto_collapse_sidebar: autoCollapseSidebar,
        auto_expand_sidebar_hover: autoExpandSidebarHover,
        global_search_enabled: globalSearchEnabled,
        dev_sensitive_info_hider: devSensitiveInfoHider,
        dev_force_offline_mode: devForceOfflineMode,
        accepted_cloud_eula: acceptedCloudEula,
        separate_rss_feed: separateRssFeed,
        zoom_level: zoomLevel,
      };
      await saveSettingsWithQueue(patch);
      await flushSettingsQueue();

      // Auto-sync to cloud is now handled automatically by saveSettingsWithQueue

      // Invalidate offline mode cache if setting changed
      if (patch.dev_force_offline_mode !== undefined) {
        const { invalidateOfflineModeCache } = await import('../../lib/utils/offlineMode');
        const { invalidateConnectivity } = await import('$lib/stores/connectivity');
        invalidateOfflineModeCache();
        invalidateConnectivity();
      }

      saveSuccess = true;

      // Show success toast
      toastStore.success('Settings saved successfully');

      // Sync feeds to valid only (empty URLs were filtered out)
      feeds = validFeeds;

      // Update initial settings after successful save
      if (initialSettings) {
        initialSettings.shortcuts = JSON.parse(JSON.stringify(shortcuts));
        initialSettings.feeds = JSON.parse(JSON.stringify(feeds));
        initialSettings.weatherEnabled = weatherEnabled;
        initialSettings.weatherCity = weatherCity;
        initialSettings.weatherCountry = weatherCountry;
        initialSettings.remindersEnabled = remindersEnabled;
        initialSettings.forceUseLocation = forceUseLocation;
        initialSettings.accentColor = $accentColor;
        initialSettings.theme = $theme;
        initialSettings.disableSchoolPicture = disableSchoolPicture;
        initialSettings.enhancedAnimations = enhancedAnimations;
        initialSettings.geminiApiKey = geminiApiKey;
        initialSettings.aiIntegrationsEnabled = aiIntegrationsEnabled;
        initialSettings.lessonSummaryAnalyserEnabled = lessonSummaryAnalyserEnabled;
        initialSettings.quizGeneratorEnabled = quizGeneratorEnabled;
        initialSettings.autoCollapseSidebar = autoCollapseSidebar;
        initialSettings.autoExpandSidebarHover = autoExpandSidebarHover;
        initialSettings.globalSearchEnabled = globalSearchEnabled;
        initialSettings.devSensitiveInfoHider = devSensitiveInfoHider;
        initialSettings.devForceOfflineMode = devForceOfflineMode;
        initialSettings.acceptedCloudEula = acceptedCloudEula;
        initialSettings.separateRssFeed = separateRssFeed;
        initialSettings.zoomLevel = zoomLevel;
      }

      if (!options.skipReload) {
        setTimeout(() => location.reload(), 1500);
      }
    } catch (e) {
      saveError = 'Failed to save settings.';
      console.log(e);
      // Show error toast
      toastStore.error('Failed to save settings');
    }
    saving = false;
  }

  function addShortcut() {
    shortcuts = [...shortcuts, { name: '', icon: '', url: '' }];
  }

  function addFeed() {
    feeds = [...feeds, { url: '' }];
  }

  function removeShortcut(idx: number) {
    shortcuts = shortcuts.filter((_, i) => i !== idx);
  }

  function removeFeed(idx: number) {
    feeds = feeds.filter((_, i) => i !== idx);
  }

  async function sendTestNotification() {
    if (!remindersEnabled) {
      toastStore.warning('Reminders are currently disabled. Enable them to receive notifications.');
      alert('Reminders are currently disabled. Enable them to receive notifications.');
      return;
    }
    toastStore.success('Test notification sent');
  }

  /** Safely get display name for a feed URL (hostname or 'New Feed'). Avoids Invalid URL errors. */
  function getFeedDisplayName(url: string): string {
    if (!url?.trim()) return 'New Feed';
    try {
      return new URL(url).hostname || 'New Feed';
    } catch {
      return 'New Feed';
    }
  }

  async function testFeed(url: string) {
    if (!url) {
      toastStore.error('Please enter a valid RSS feed URL');
      return;
    }

    try {
      const result = await invoke('get_rss_feed', { feed: url });
      toastStore.success('The RSS feed is valid and can be added');
    } catch (error) {
      toastStore.error('Could not fetch the RSS feed. Please check the URL and try again.');
    }
  }

  function openCloudSyncModal() {
    showCloudSyncModal = true;
  }

  function closeCloudSyncModal() {
    showCloudSyncModal = false;
  }

  function openTroubleshootingModal() {
    logger.info(
      'settings',
      'openTroubleshootingModal',
      'Opening troubleshooting modal from settings page',
    );
    showTroubleshootingModal = true;
  }

  function closeTroubleshootingModal() {
    logger.debug('settings', 'closeTroubleshootingModal', 'Closing troubleshooting modal');
    showTroubleshootingModal = false;
  }

  function handleSettingsUpload() {
    // No notification needed
  }

  async function handleSettingsDownload(cloudSettings: any) {
    // Reload settings from the newly downloaded data
    shortcuts = cloudSettings.shortcuts || [];
    feeds = cloudSettings.feeds || [];
    weatherEnabled = cloudSettings.weather_enabled ?? false;
    forceUseLocation = cloudSettings.force_use_location ?? false;
    weatherCity = cloudSettings.weather_city ?? '';
    weatherCountry = cloudSettings.weather_country ?? '';
    remindersEnabled = cloudSettings.reminders_enabled ?? true;
    disableSchoolPicture = cloudSettings.disable_school_picture ?? false;
    enhancedAnimations = cloudSettings.enhanced_animations ?? true;
    geminiApiKey = cloudSettings.gemini_api_key ?? '';
    cerebrasApiKey = cloudSettings.cerebras_api_key ?? '';
    aiProvider = (cloudSettings.ai_provider as 'gemini' | 'cerebras') || 'gemini';
    accentColor.set(cloudSettings.accent_color ?? '#3b82f6');
    theme.set(cloudSettings.theme ?? 'dark');
    aiIntegrationsEnabled = cloudSettings.ai_integrations_enabled ?? false;
    lessonSummaryAnalyserEnabled = cloudSettings.lesson_summary_analyser_enabled ?? true;
    quizGeneratorEnabled = cloudSettings.quiz_generator_enabled ?? true;
    autoCollapseSidebar = cloudSettings.auto_collapse_sidebar ?? false;
    autoExpandSidebarHover = cloudSettings.auto_expand_sidebar_hover ?? false;
    globalSearchEnabled = cloudSettings.global_search_enabled ?? true;
    devSensitiveInfoHider = cloudSettings.dev_sensitive_info_hider ?? false;
    acceptedCloudEula = cloudSettings.accepted_cloud_eula ?? false;
    separateRssFeed = cloudSettings.separate_rss_feed ?? false;
    zoomLevel = cloudSettings.zoom_level ?? 1;

    // Reload settings
    await loadSettings();

    // Reset initial settings after download to match current state
    if (initialSettings) {
      initialSettings.shortcuts = JSON.parse(JSON.stringify(shortcuts));
      initialSettings.feeds = JSON.parse(JSON.stringify(feeds));
      initialSettings.weatherEnabled = weatherEnabled;
      initialSettings.weatherCity = weatherCity;
      initialSettings.weatherCountry = weatherCountry;
      initialSettings.remindersEnabled = remindersEnabled;
      initialSettings.forceUseLocation = forceUseLocation;
      initialSettings.accentColor = $accentColor;
      initialSettings.theme = $theme;
      initialSettings.disableSchoolPicture = disableSchoolPicture;
      initialSettings.enhancedAnimations = enhancedAnimations;
      initialSettings.geminiApiKey = geminiApiKey;
      initialSettings.aiIntegrationsEnabled = aiIntegrationsEnabled;
      initialSettings.lessonSummaryAnalyserEnabled = lessonSummaryAnalyserEnabled;
      initialSettings.quizGeneratorEnabled = quizGeneratorEnabled;
      initialSettings.autoCollapseSidebar = autoCollapseSidebar;
      initialSettings.autoExpandSidebarHover = autoExpandSidebarHover;
      initialSettings.globalSearchEnabled = globalSearchEnabled;
      initialSettings.devSensitiveInfoHider = devSensitiveInfoHider;
      initialSettings.devForceOfflineMode = devForceOfflineMode;
      initialSettings.acceptedCloudEula = acceptedCloudEula;
      initialSettings.separateRssFeed = separateRssFeed;
      initialSettings.zoomLevel = zoomLevel;
    }

    // Apply zoom immediately after cloud download
    setZoom(zoomLevel);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!event.key || event.key.length !== 1) return;
    const char = event.key.toLowerCase();
    if (!/[a-z]/.test(char)) return;
    keyBuffer += char;
    if (keyBuffer.length > 3) keyBuffer = keyBuffer.slice(-3);
    if (keyBuffer === 'dev') {
      showDevSettings = true;
    }
  }

  // Check if there are unsaved changes
  function hasUnsavedChanges(): boolean {
    if (!initialSettings) return false;

    // Deep compare arrays
    const shortcutsChanged =
      JSON.stringify(shortcuts) !== JSON.stringify(initialSettings.shortcuts);
    const feedsChanged = JSON.stringify(feeds) !== JSON.stringify(initialSettings.feeds);

    return (
      shortcutsChanged ||
      feedsChanged ||
      weatherEnabled !== initialSettings.weatherEnabled ||
      weatherCity !== initialSettings.weatherCity ||
      weatherCountry !== initialSettings.weatherCountry ||
      remindersEnabled !== initialSettings.remindersEnabled ||
      forceUseLocation !== initialSettings.forceUseLocation ||
      $accentColor !== initialSettings.accentColor ||
      $theme !== initialSettings.theme ||
      disableSchoolPicture !== initialSettings.disableSchoolPicture ||
      enhancedAnimations !== initialSettings.enhancedAnimations ||
      geminiApiKey !== initialSettings.geminiApiKey ||
      cerebrasApiKey !== initialSettings.cerebrasApiKey ||
      aiProvider !== initialSettings.aiProvider ||
      aiIntegrationsEnabled !== initialSettings.aiIntegrationsEnabled ||
      lessonSummaryAnalyserEnabled !== initialSettings.lessonSummaryAnalyserEnabled ||
      quizGeneratorEnabled !== initialSettings.quizGeneratorEnabled ||
      autoCollapseSidebar !== initialSettings.autoCollapseSidebar ||
      autoExpandSidebarHover !== initialSettings.autoExpandSidebarHover ||
      globalSearchEnabled !== initialSettings.globalSearchEnabled ||
      devSensitiveInfoHider !== initialSettings.devSensitiveInfoHider ||
      devForceOfflineMode !== initialSettings.devForceOfflineMode ||
      acceptedCloudEula !== initialSettings.acceptedCloudEula ||
      separateRssFeed !== initialSettings.separateRssFeed ||
      zoomLevel !== initialSettings.zoomLevel
    );
  }

  // Handle navigation with unsaved changes check
  beforeNavigate(({ to, cancel }) => {
    // Don't block navigation if we're already on the settings page or if there are no unsaved changes
    if (!to || to.url.pathname === '/settings' || !hasUnsavedChanges()) {
      return;
    }

    // Cancel the navigation
    cancel();

    // Store the URL to navigate to later if user confirms
    pendingNavigationUrl = to.url.pathname + (to.url.search || '');

    // Show the confirmation modal
    showUnsavedChangesModal = true;
  });

  async function handleSaveAndLeave() {
    showUnsavedChangesModal = false;
    const urlToNavigate = pendingNavigationUrl;
    pendingNavigationUrl = null;

    // Save settings first (with reload enabled like normal save)
    await saveSettings();

    // Navigate to the new page (reload will happen after 1500ms on the new page)
    if (urlToNavigate) {
      goto(urlToNavigate);
    }
  }

  function handleCancelLeave() {
    showUnsavedChangesModal = false;
    pendingNavigationUrl = null;
  }

  onMount(async () => {
    // Check if running on desktop (updater only works on desktop)
    const tauriPlatform = import.meta.env.TAURI_ENV_PLATFORM;
    isDesktop = tauriPlatform !== 'ios' && tauriPlatform !== 'android';

    await Promise.all([loadSettings(), loadCloudUser(), loadProfilePicture()]);
    window.addEventListener('keydown', handleKeydown);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  // Clear browser cache to fix routing issues
  async function clearCache() {
    clearingCache = true;
    try {
      await CacheManager.clearCachesAndRefresh();
      toastStore.success('Cache cleared successfully. Page will refresh...');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toastStore.error('Failed to clear cache');
      clearingCache = false;
    }
  }

  // Check for updates
  async function checkForUpdates() {
    checkingUpdates = true;
    updateAvailable = false;
    updateVersion = '';
    updateNotes = '';

    try {
      const update = await check();

      if (update?.available) {
        updateAvailable = true;
        updateVersion = update.version;
        updateNotes = update.body || 'Bug fixes and improvements';

        toastStore.info(`Update available: Version ${update.version}`);
      } else {
        toastStore.success('You are running the latest version');
      }
    } catch (error) {
      logger.error('settings', 'checkForUpdates', 'Failed to check for updates', { error });
      toastStore.error('Failed to check for updates');
    } finally {
      checkingUpdates = false;
    }
  }

  // Install update
  async function installUpdate() {
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        toastStore.success('Update downloaded. Restart to install');
      }
    } catch (error) {
      logger.error('settings', 'installUpdate', 'Failed to install update', { error });
      toastStore.error('Failed to install update');
    }
  }

  // Load custom profile picture
  async function loadProfilePicture() {
    try {
      const dataUrl = await invoke<string | null>('get_profile_picture_data_url');
      customProfilePicture = dataUrl;
    } catch (error) {
      console.error('Failed to load profile picture:', error);
      customProfilePicture = null;
    }
  }

  // Handle profile picture upload - opens crop dialog
  function handleProfilePictureUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toastStore.error('Please select an image smaller than 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      cropImageSrc = reader.result as string;
      showCropModal = true;
    };
    reader.readAsDataURL(file);
    if (target) target.value = '';
  }

  // Save cropped profile picture (from crop modal)
  async function handleCropSave(croppedBase64: string) {
    uploading = true;
    try {
      await invoke('save_profile_picture', { base64Data: croppedBase64 });
      customProfilePicture = croppedBase64;
      toastStore.success('Profile picture updated successfully');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Failed to save profile picture:', error);
      toastStore.error('Failed to save profile picture. Please try again.');
    } finally {
      uploading = false;
    }
  }

  function closeCropModal() {
    showCropModal = false;
    cropImageSrc = null;
  }

  // Remove profile picture
  async function removeProfilePicture() {
    try {
      await invoke('delete_profile_picture');
      customProfilePicture = null;

      toastStore.success('Profile picture removed successfully');

      // Refresh the page to update the header
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Failed to remove profile picture:', error);
      toastStore.error('Failed to remove profile picture');
    }
  }

  async function runPerformanceTest() {
    if (performanceTestRunning) return;

    performanceTestRunning = true;
    toastStore.info('Performance test started...');

    try {
      const results = await performanceTester.startPerformanceTest();

      // Save results to backend and navigate to results page
      try {
        const savedPath = await invoke('save_performance_test_results', { results });
        console.log('Performance test results saved to:', savedPath);

        toastStore.success('Performance test completed successfully');

        // Store results in session storage for the results page
        sessionStorage.setItem('performance-test-results', JSON.stringify(results));

        // Navigate to results page
        goto('/performance-results');
      } catch (saveError) {
        console.error('Failed to save performance results:', saveError);
        toastStore.warning('Test completed but failed to save results');

        // Still show results even if save failed
        sessionStorage.setItem('performance-test-results', JSON.stringify(results));
        goto('/performance-results');
      }
    } catch (error) {
      console.error('Performance test failed:', error);
      toastStore.error('Performance test failed');

      // Still try to save error report to backend
      try {
        const errorResults = {
          startTime: Date.now(),
          endTime: Date.now(),
          totalDuration: 0,
          pages: [],
          overallErrors: [String(error)],
          systemMetricsHistory: [],
          summary: {
            averageLoadTime: 0,
            slowestPage: { name: 'N/A', time: 0 },
            fastestPage: { name: 'N/A', time: 0 },
            totalErrors: 1,
            totalWarnings: 0,
          },
          timestamp: new Date().toISOString(),
          version: '1.0.0-rc.8',
        };

        await invoke('save_performance_test_results', { results: errorResults });

        toastStore.error('Performance test failed but error report has been saved.');
      } catch (saveError) {
        console.error('Failed to save error report:', saveError);
        toastStore.error('Performance test failed and could not save error report.');
      }
    } finally {
      performanceTestRunning = false;
    }
  }

  async function openPerformanceTestsFolder() {
    try {
      const performanceDir = await invoke('get_performance_tests_directory');
      await invoke('open_url', { url: `file://${performanceDir}` });

      toastStore.success('Performance tests folder opened');
    } catch (error) {
      console.error('Failed to open performance tests folder:', error);
      toastStore.error('Failed to open performance tests folder');
    }
  }

  async function redoOnboarding() {
    resettingOnboarding = true;
    try {
      await saveSettingsWithQueue({ has_been_through_onboarding: false });
      await flushSettingsQueue();

      // Dispatch event to trigger onboarding in layout
      window.dispatchEvent(new CustomEvent('redo-onboarding'));

      toastStore.add({
        message:
          'Onboarding walkthrough will start when you navigate away and back, or refresh the page.',
        type: 'success',
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
      toastStore.add({
        message: 'Failed to reset onboarding walkthrough.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      resettingOnboarding = false;
    }
  }
</script>

<div class="p-4 mx-auto max-w-4xl sm:p-6 md:p-8">
  <div
    class="flex sticky top-0 z-20 flex-col gap-4 justify-between items-start px-6 py-4 mb-8 rounded-xl border-b backdrop-blur-md sm:flex-row sm:items-center animate-fade-in-up bg-white/80 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800">
    <h1 class="px-2 py-1 text-xl font-bold rounded-lg sm:text-2xl">
      <T key="navigation.settings" fallback="Settings" />
    </h1>
    <div class="flex flex-col gap-2 items-start w-full sm:flex-row sm:items-center sm:w-auto">
      {#if saveSuccess}
        <span class="text-sm text-green-400 animate-fade-in sm:text-base">
          <T key="settings.saved" fallback="Saved!" />
        </span>
      {/if}
      {#if saveError}
        <span class="text-sm text-red-400 animate-fade-in sm:text-base">{saveError}</span>
      {/if}
      <div class="flex flex-col gap-2 w-full sm:flex-row sm:w-auto">
        <button
          class="px-6 py-2 w-full text-white rounded-lg shadow-lg transition-all duration-200 bg-accent-500 sm:w-auto hover:from-green-700 hover:to-green-600 focus:ring-2 focus:ring-green-400 active:scale-95 hover:scale-105 playful"
          onclick={() => saveSettings()}
          disabled={saving}>
          {#if saving}
            <div class="flex gap-2 justify-center items-center">
              <div
                class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
              </div>
              <span><T key="settings.saving" fallback="Saving..." /></span>
            </div>
          {:else}
            <T key="settings.save_changes" fallback="Save Changes" />
          {/if}
        </button>
      </div>
    </div>
  </div>

  <ProfilePictureCropModal
    open={showCropModal}
    imageSrc={cropImageSrc}
    onsave={handleCropSave}
    oncancel={closeCropModal} />

  {#if loading}
    <div class="flex justify-center items-center py-12 animate-fade-in">
      <div class="flex flex-col gap-4 items-center">
        <div
          class="w-8 h-8 rounded-full border-4 animate-spin sm:w-10 sm:h-10 border-indigo-500/30 border-t-indigo-500">
        </div>
        <p class="text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          <T key="settings.loading_settings" fallback="Loading settings..." />
        </p>
      </div>
    </div>
  {:else}
    <div class="space-y-6 sm:space-y-8">
      <!-- Cloud Sync Section -->
      <section
        data-onboarding="cloud-sync"
        class="overflow-hidden relative rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/30 dark:border-zinc-800/30">
          <h2 class="text-base font-semibold sm:text-lg text-zinc-500 dark:text-zinc-400">
            <T key="settings.cloud_sync" fallback="Cloud Sync" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.cloud_sync_description"
              fallback="Sync your settings across devices with BetterSEQTA Plus account cloud syncing" />
          </p>
        </div>
        <div class="relative p-4 sm:p-6">
          {#if cloudUserLoading}
            <div class="p-4 rounded-lg bg-zinc-200/60 dark:bg-zinc-700/30 animate-fade-in">
              <div class="flex gap-3 items-center">
                <div
                  class="w-6 h-6 rounded-full border-2 animate-spin border-zinc-400/30 border-t-zinc-400">
                </div>
                <span class="text-sm text-zinc-500 dark:text-zinc-400"
                  ><T
                    key="settings.loading_account_status"
                    fallback="Loading account status..." /></span>
              </div>
            </div>
          {:else}
            {#if !acceptedCloudEula}
              <!-- EULA gate overlay -->
              <div
                class="flex absolute inset-0 z-10 flex-col justify-center items-center p-6 rounded-xl backdrop-blur-xs bg-black/40">
                <div
                  class="p-5 w-full max-w-xl rounded-xl border shadow-lg bg-white/95 dark:bg-zinc-900/95 border-zinc-300/50 dark:border-zinc-800/50 text-zinc-800 dark:text-white">
                  <h3 class="mb-2 text-base font-semibold sm:text-lg">
                    <T key="settings.accept_cloud_eula" fallback="Accept BetterSEQTA Cloud EULA" />
                  </h3>
                  <p class="mb-4 text-sm opacity-80">
                    <T
                      key="settings.cloud_eula_description"
                      fallback="You must read and accept the Cloud Sync EULA before using cloud features." />
                  </p>
                  <div class="flex gap-2">
                    <button
                      class="px-4 py-2 text-white rounded-lg transition-all duration-200 accent-bg hover:accent-bg-hover hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring"
                      onclick={() => (showEulaModal = true)}>
                      <T key="settings.read_accept" fallback="Read & Accept" />
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            {#if cloudUser}
              <!-- Logged in state -->
              <div
                class="p-4 rounded-lg border border-green-200 bg-green-100/60 dark:bg-green-900/30 animate-fade-in dark:border-green-800">
                <div class="flex gap-4 items-start">
                  {#if cloudUser.pfpUrl}
                    <img
                      src={getFullPfpUrl(cloudUser.pfpUrl) ||
                        `https://api.dicebear.com/7.x/thumbs/svg?seed=${cloudUser.id}`}
                      alt={cloudUser.displayName || cloudUser.username}
                      class="object-cover w-12 h-12 rounded-full border-2 border-green-300 dark:border-green-700" />
                  {:else}
                    <img
                      src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${cloudUser.id}`}
                      alt={cloudUser.displayName || cloudUser.username}
                      class="object-cover w-12 h-12 rounded-full border-2 border-green-300 dark:border-green-700" />
                  {/if}
                  <div class="flex-1">
                    <div class="flex gap-2 items-center mb-1">
                      <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span class="text-sm font-semibold text-green-800 dark:text-green-200"
                        >Logged in to BetterSEQTA Plus</span>
                    </div>
                    <div class="mb-1 text-sm text-green-700 dark:text-green-300">
                      <strong>{cloudUser.displayName || cloudUser.username}</strong>
                    </div>
                    <div class="mb-3 text-xs text-green-600 dark:text-green-400">
                      @{cloudUser.username}
                    </div>
                  </div>
                </div>
                <div class="pt-4 mt-4 border-t border-green-200 dark:border-green-800">
                  <h4 class="mb-2 text-sm font-semibold text-green-800 dark:text-green-200">
                    Settings Synchronization
                  </h4>
                  <p class="mb-4 text-xs text-green-700 dark:text-green-300">
                    Upload your current settings to the cloud or download settings from another
                    device. This includes all your shortcuts, feeds, theme preferences, and other
                    customizations.
                  </p>
                  <div class="flex flex-col gap-3 sm:flex-row">
                    <button
                      class="flex gap-2 items-center justify-center px-6 py-3 text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      onclick={openCloudSyncModal}
                      disabled={!acceptedCloudEula}>
                      <Icon src={CloudArrowUp} class="w-5 h-5" />
                      Sync Settings
                    </button>
                  </div>
                </div>
              </div>
            {:else}
              <!-- Not logged in state -->
              <div class="p-4 rounded-lg bg-zinc-200/60 dark:bg-zinc-700/30 animate-fade-in">
                <div
                  class="p-3 mb-3 rounded-sm border border-yellow-200 bg-yellow-100/60 dark:bg-yellow-900/30 dark:border-yellow-800">
                  <div class="flex gap-2 items-center">
                    <input
                      id="accept-eula-loggedout"
                      type="checkbox"
                      class="w-4 h-4 accent-blue-600"
                      bind:checked={acceptedCloudEula} />
                    <label for="accept-eula-loggedout" class="text-sm"
                      >I have read and accept the Cloud Sync Terms (EULA)</label>
                  </div>
                </div>
                <div class="flex flex-col gap-4">
                  <div class="flex gap-3 items-center">
                    <div class="w-2 h-2 rounded-full bg-zinc-400"></div>
                    <span class="text-sm font-semibold text-zinc-600 dark:text-zinc-300"
                      >Not logged in to BetterSEQTA Plus</span>
                  </div>
                  <div>
                    <h3
                      class="mb-2 text-sm font-semibold sm:text-base text-zinc-500 dark:text-zinc-400">
                      Settings Synchronization
                    </h3>
                    <p class="mb-4 text-xs text-zinc-500 sm:text-sm dark:text-zinc-500">
                      Upload your current settings to the cloud or download settings from another
                      device. This includes all your shortcuts, feeds, theme preferences, and other
                      customizations.
                    </p>
                    <p class="mb-4 text-xs text-zinc-500 sm:text-sm dark:text-zinc-500">
                      <a
                        href="https://accounts.betterseqta.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 dark:text-blue-500 hover:underline">
                        Create a free BetterSEQTA Plus account
                      </a> to get started with cloud syncing.
                    </p>
                  </div>
                  <div class="flex flex-col gap-3 sm:flex-row">
                    <button
                      class="flex gap-2 items-center justify-center px-6 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      onclick={openCloudSyncModal}
                      disabled={!acceptedCloudEula}>
                      <Icon src={CloudArrowUp} class="w-5 h-5" />
                      Login & Sync Settings
                    </button>
                    <div class="text-xs text-zinc-500 dark:text-zinc-500 sm:self-center">
                      Requires BetterSEQTA Plus account
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </section>

      <!-- Personal Settings -->
      <section
        class="overflow-hidden relative rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/30 dark:border-zinc-800/30">
          <h2 class="text-base font-semibold sm:text-lg text-zinc-500 dark:text-zinc-400">
            <T key="settings.personal_settings" fallback="Personal Settings" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.personal_settings_description"
              fallback="Customize your personal profile and preferences" />
          </p>
        </div>
        <div class="relative p-4 sm:p-6">
          <!-- Custom Profile Picture -->
          <div class="space-y-4">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="text-sm font-medium text-zinc-900 dark:text-white">
                  <T key="settings.custom_profile_picture" fallback="Custom Profile Picture" />
                </h3>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  <T
                    key="settings.profile_picture_description"
                    fallback="Upload a custom profile picture that will appear in the app header" />
                </p>
              </div>
              <div class="flex items-center gap-3 ml-4">
                {#if customProfilePicture}
                  <img
                    src={customProfilePicture}
                    alt="Custom profile"
                    class="w-10 h-10 rounded-full object-cover border-2 border-zinc-300 dark:border-zinc-600" />
                  <button
                    class="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-200 hover:bg-red-100 dark:hover:bg-red-900/30 hover:scale-105 active:scale-95"
                    onclick={removeProfilePicture}
                    disabled={uploading}>
                    <T key="common.remove" fallback="Remove" />
                  </button>
                {:else}
                  <div
                    class="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                    <Icon src={User} class="w-5 h-5 text-zinc-400" />
                  </div>
                {/if}
                <input
                  type="file"
                  accept="image/*"
                  onchange={handleProfilePictureUpload}
                  class="hidden"
                  bind:this={fileInput} />
                <button
                  class="px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:scale-105 active:scale-95"
                  onclick={() => fileInput?.click()}
                  disabled={uploading}>
                  {uploading
                    ? $_('settings.uploading') || 'Uploading...'
                    : $_('settings.upload') || 'Upload'}
                </button>
              </div>
            </div>

            <!-- Language Preference -->
            <div class="space-y-4 pt-6 border-t border-zinc-200/50 dark:border-zinc-700/50">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-sm font-medium text-zinc-900 dark:text-white">
                    <T key="settings.language" fallback="Language" />
                  </h3>
                  <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                    <T
                      key="settings.language_description"
                      fallback="Choose your preferred language for the DesQTA interface" />
                  </p>
                </div>
                <div class="ml-4">
                  <LanguageSelector compact={false} showFlags={true} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Homepage Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-100 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.homepage" fallback="Homepage" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T key="settings.homepage_description" fallback="Customize your homepage experience" />
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <!-- Widget Settings -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">
              <T key="settings.widget_settings" fallback="Widget Settings" />
            </h3>
            <p class="mb-4 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              <T
                key="settings.widget_settings_description"
                fallback="Configure which widgets appear on your DesQTA dashboard." />
            </p>
            <div
              class="p-4 space-y-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
              <!-- Always visible -->
              <div class="flex gap-4 items-center">
                <input
                  id="weather-enabled"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={weatherEnabled} />
                <label
                  for="weather-enabled"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                  ><T key="settings.show_weather_widget" fallback="Show Weather Widget" /></label>
              </div>

              <!-- Show this ONLY if weatherEnabled is true -->
              {#if weatherEnabled}
                <div class="flex gap-4 items-center">
                  <input
                    id="force-use-location"
                    type="checkbox"
                    class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                    bind:checked={forceUseLocation} />
                  <label
                    for="force-use-location"
                    class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                    ><T
                      key="settings.only_fallback_location"
                      fallback="Only use Fallback Location for Weather" /></label>
                </div>

                <!-- Show fallback inputs ONLY if forceUseLocation is true -->
                {#if forceUseLocation}
                  <div class="flex flex-col gap-2 items-start pl-1">
                    <label
                      for="weather-city"
                      class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400"
                      ><T key="settings.fallback_city" fallback="Fallback City:" /></label>
                    <input
                      id="weather-city"
                      class="px-3 py-2 w-full bg-white rounded-sm border transition text-zinc-900 sm:w-64 dark:bg-zinc-900/50 dark:text-white border-zinc-300/50 dark:border-zinc-700/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder={$_('settings.city_placeholder') || 'Perth'}
                      bind:value={weatherCity} />
                  </div>

                  <div class="flex flex-col gap-2 items-start pl-1">
                    <label
                      for="weather-country"
                      class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400"
                      ><T
                        key="settings.fallback_country_code"
                        fallback="Fallback Country Code" /></label>
                    <span class="text-xs">
                      Visit <a
                        href="https://countrycode.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-400 hover:underline">countrycode.org</a> to find your country
                      code.
                    </span>
                    <input
                      id="weather-country"
                      class="px-3 py-2 w-full bg-white rounded-sm border transition text-zinc-900 sm:w-64 dark:bg-zinc-900/50 dark:text-white border-zinc-300/50 dark:border-zinc-700/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder={$_('settings.country_placeholder') || 'AU'}
                      bind:value={weatherCountry} />
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </div>
      </section>

      <!-- Dashboard Shortcuts Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-150 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.dashboard_shortcuts" fallback="Dashboard Shortcuts" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.dashboard_shortcuts_description"
              fallback="Configure quick access shortcuts that appear on your dashboard" />
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">
              <T key="settings.dashboard_quick_actions" fallback="Dashboard Quick Actions" />
            </h3>
            <p class="mb-4 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              <T
                key="settings.quick_actions_description"
                fallback="Add shortcuts to frequently used features that will appear as quick action buttons on your dashboard." />
            </p>
            <div class="space-y-3 sm:space-y-4">
              {#key shortcuts.length + shortcuts.map((s) => s.name + s.url).join(',')}
                {#each shortcuts as shortcut, idx}
                  <div
                    class="flex flex-col gap-2 items-start p-3 rounded-lg transition-all duration-200 sm:flex-row sm:items-center bg-zinc-100/80 dark:bg-zinc-800/50 hover:shadow-lg hover:bg-zinc-200/80 dark:hover:bg-zinc-700/50 shortcut-item-animate"
                    style="animation-delay: {idx * 50}ms;">
                    <div class="flex flex-col gap-1 w-full sm:w-32">
                      <label
                        for="shortcut-name-{idx}"
                        class="text-xs text-zinc-600 dark:text-zinc-400">
                        <T key="common.name" fallback="Name" />
                      </label>
                      <input
                        id="shortcut-name-{idx}"
                        class="px-2 py-1.5 w-full text-sm bg-white rounded-sm transition dark:bg-zinc-900/50 focus:ring-2 focus:ring-blue-500"
                        placeholder={$_('settings.shortcut_name_placeholder') || 'Dashboard'}
                        bind:value={shortcut.name} />
                    </div>
                    <div class="flex flex-col gap-1 w-full sm:w-16">
                      <label
                        for="shortcut-icon-{idx}"
                        class="text-xs text-zinc-600 dark:text-zinc-400">
                        <T key="settings.icon" fallback="Icon" />
                      </label>
                      <input
                        id="shortcut-icon-{idx}"
                        class="px-2 py-1.5 w-full text-sm text-center bg-white rounded-sm transition dark:bg-zinc-900/50 focus:ring-2 focus:ring-blue-500"
                        placeholder="🏠"
                        bind:value={shortcut.icon} />
                    </div>
                    <div class="flex flex-col gap-1 w-full sm:flex-1">
                      <label
                        for="shortcut-url-{idx}"
                        class="text-xs text-zinc-600 dark:text-zinc-400">
                        <T key="settings.url" fallback="URL" />
                      </label>
                      <input
                        id="shortcut-url-{idx}"
                        class="px-2 py-1.5 w-full text-sm bg-white rounded-sm transition dark:bg-zinc-900/50 focus:ring-2 focus:ring-blue-500"
                        placeholder={$_('settings.shortcut_url_placeholder') || '/dashboard'}
                        bind:value={shortcut.url} />
                    </div>
                    <div class="flex items-end pt-4 h-full sm:pt-0">
                      <button
                        class="px-3 py-2 text-red-400 rounded-sm transition-all duration-200 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95"
                        onclick={() => removeShortcut(idx)}
                        title={$_('settings.remove_shortcut') || 'Remove shortcut'}>
                        <Icon src={Trash} class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                {/each}
              {/key}
              {#if shortcuts.length === 0}
                <div class="py-8 text-center text-zinc-600 dark:text-zinc-400 animate-fade-in">
                  <div class="mb-3 text-4xl opacity-50">⚡</div>
                  <p class="text-sm">
                    <T
                      key="settings.no_shortcuts_configured"
                      fallback="No dashboard shortcuts configured" />
                  </p>
                  <p class="mt-1 text-xs">
                    <T
                      key="settings.add_first_shortcut"
                      fallback="Add your first shortcut to get started" />
                  </p>
                </div>
              {/if}
              <button
                class="flex gap-2 justify-center items-center px-4 py-2 w-full text-white rounded-lg shadow-xs transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105"
                onclick={addShortcut}>
                <Icon src={Plus} class="w-4 h-4" />
                <T key="settings.add_dashboard_shortcut" fallback="Add Dashboard Shortcut" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Appearance Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-100 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.appearance" fallback="Appearance" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T key="settings.appearance_description" fallback="Customize how DesQTA looks" />
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <!-- Theme Settings -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">
              <T key="settings.theme" fallback="Theme" />
            </h3>
            <p class="mb-4 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              <T
                key="settings.theme_description"
                fallback="Choose your preferred color scheme and theme settings." />
            </p>
            <div
              class="p-4 space-y-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
              <div class="flex flex-col gap-2">
                <label for="accent-color" class="text-sm text-zinc-800 dark:text-zinc-200">
                  <T key="settings.accent_color" fallback="Accent Color" />
                </label>
                <div class="flex gap-2 items-center">
                  <input
                    type="color"
                    id="accent-color"
                    bind:value={$accentColor}
                    class="w-11 h-12 bg-transparent rounded-xl cursor-pointer focus:outline-hidden" />
                  <input
                    type="text"
                    bind:value={$accentColor}
                    class="flex-1 px-3 py-2 bg-white rounded-sm border transition text-zinc-900 dark:bg-zinc-900/50 dark:text-white border-zinc-300/50 dark:border-zinc-700/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="#3b82f6" />
                  <button
                    class="px-3 py-2 rounded-sm transition text-zinc-800 bg-zinc-200 dark:bg-zinc-700/50 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600/50 focus:ring-2 focus:ring-blue-500"
                    onclick={() => accentColor.set('#3b82f6')}>
                    <T key="common.reset" fallback="Reset" />
                  </button>
                </div>
                <p class="text-xs text-zinc-600 dark:text-zinc-400">
                  <T
                    key="settings.accent_color_description"
                    fallback="This color will be used throughout the app for buttons, links, and other interactive elements." />
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <p class="text-sm text-zinc-800 dark:text-zinc-200">
                  <T key="settings.theme" fallback="Theme" />
                </p>
                <div class="flex gap-2">
                  <button
                    class="flex-1 px-4 py-3 rounded-lg bg-zinc-200 dark:bg-zinc-700/50 text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600/50 focus:ring-2 focus:ring-blue-500 transition flex items-center justify-center gap-2 {$theme ===
                    'light'
                      ? 'accent-bg'
                      : ''}"
                    onclick={() => updateTheme('light')}>
                    <Icon src={Sun} class="w-5 h-5" />
                    <T key="settings.light" fallback="Light" />
                  </button>
                  <button
                    class="flex-1 px-4 py-3 rounded-lg bg-zinc-200 dark:bg-zinc-700/50 text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600/50 focus:ring-2 focus:ring-blue-500 transition flex items-center justify-center gap-2 {$theme ===
                    'dark'
                      ? 'accent-bg'
                      : ''}"
                    onclick={() => updateTheme('dark')}>
                    <Icon src={Moon} class="w-5 h-5" />
                    <T key="settings.dark" fallback="Dark" />
                  </button>
                  <button
                    class="flex-1 px-4 py-3 rounded-lg bg-zinc-200 dark:bg-zinc-700/50 text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-600/50 focus:ring-2 focus:ring-blue-500 transition flex items-center justify-center gap-2 {$theme ===
                    'system'
                      ? 'accent-bg'
                      : ''}"
                    onclick={() => updateTheme('system')}>
                    <Icon src={ComputerDesktop} class="w-5 h-5" />
                    <T key="settings.system" fallback="System" />
                  </button>
                </div>
                <p class="text-xs text-zinc-600 dark:text-zinc-400">
                  <T
                    key="settings.theme_mode_description"
                    fallback="Choose between light mode, dark mode, or follow your system preference." />
                </p>
                <div class="mt-4 flex flex-col items-center">
                  <button
                    type="button"
                    data-onboarding="theme-store"
                    onclick={() => {
                      console.log('Navigating to theme store...');
                      console.log('Current URL:', window.location.href);

                      // Try multiple navigation methods
                      try {
                        goto('/settings/theme-store');
                      } catch (e) {
                        console.warn('goto failed, trying window.location:', e);
                        window.location.href = '/settings/theme-store';
                      }

                      setTimeout(() => {
                        console.log('After navigation URL:', window.location.href);
                        console.log('Page pathname:', window.location.pathname);
                      }, 100);
                    }}
                    class="px-6 py-2 text-center text-white rounded-lg shadow-xs transition-all duration-200 accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105">
                    <T key="settings.open_theme_store" fallback="Open Theme Store" />
                  </button>
                  <p class="mt-2 text-xs text-center text-zinc-600 dark:text-zinc-400">
                    <T
                      key="settings.theme_store_description"
                      fallback="Browse and install custom themes for DesQTA" />
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Layout Settings -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">Layout</h3>
            <p class="mb-4 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              Adjust the layout and sizing of various elements.
            </p>
            <div class="p-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
              <div class="flex gap-4 items-center mb-4">
                <input
                  id="auto-collapse-sidebar"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={autoCollapseSidebar} />
                <label
                  for="auto-collapse-sidebar"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                  >Auto-collapse sidebar when navigating</label>
              </div>
              <p class="text-xs text-zinc-600 dark:text-zinc-400">
                When enabled, the sidebar will automatically collapse when you click on a page link,
                giving you more space for content.
              </p>
              <div class="flex gap-4 items-center mt-4 mb-4">
                <input
                  id="auto-expand-sidebar-hover"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={autoExpandSidebarHover} />
                <label
                  for="auto-expand-sidebar-hover"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                  >Auto-expand sidebar on hover</label>
              </div>
              <p class="text-xs text-zinc-600 dark:text-zinc-400">
                When enabled and the sidebar is collapsed, hovering near the left edge will
                temporarily expand the sidebar for easy navigation.
              </p>
              <div class="mt-4">
                <button
                  onclick={() => (showSidebarSettingsDialog = true)}
                  class="flex gap-2 items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 transform accent-bg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
                  <Icon src={Bars3} class="w-5 h-5" />
                  <T key="settings.customize_sidebar" fallback="Customize Sidebar" />
                </button>
                <p class="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                  Reorder pages, organize with folders, and manage favorites.
                </p>
              </div>
              <div class="flex gap-4 items-center mt-4 mb-4">
                <input
                  id="global-search-enabled"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={globalSearchEnabled} />
                <label
                  for="global-search-enabled"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                  >Enable global search</label>
              </div>
              <p class="text-xs text-zinc-600 dark:text-zinc-400">
                When enabled, you can use Ctrl+K to open a global search that searches across all
                your content, courses, and assessments.
              </p>
            </div>
          </div>
          <!-- Disable School Picture -->
          <div class="flex gap-4 items-center mt-4">
            <input
              id="disable-school-picture"
              type="checkbox"
              class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
              bind:checked={disableSchoolPicture} />
            <label
              for="disable-school-picture"
              class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
              >Disable school picture in user info</label>
          </div>
          <!-- Enhanced Animations Setting -->
          <div class="flex gap-4 items-center mt-4">
            <input
              id="enhanced-animations"
              type="checkbox"
              class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
              bind:checked={enhancedAnimations} />
            <label
              for="enhanced-animations"
              class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
              >Enhanced Animations</label>
          </div>
        </div>
      </section>

      <!-- Zoom Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-200 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.zoom" fallback="Interface Zoom" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.zoom_description"
              fallback="Adjust the size of interface elements (50%–200%)" />
          </p>
        </div>
        <div class="p-4 sm:p-6">
          <div
            class="flex flex-col gap-4 p-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
            <div class="flex gap-4 items-center">
              <button
                type="button"
                class="flex justify-center items-center w-10 h-10 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring disabled:opacity-50"
                onclick={() => {
                  zoomLevel = Math.max(0.5, zoomLevel - 0.1);
                  zoomLevel = Math.round(zoomLevel * 10) / 10;
                  setZoom(zoomLevel);
                }}
                aria-label="Zoom out">
                <Icon src={Minus} class="w-5 h-5" />
              </button>
              <span
                class="text-sm font-medium text-zinc-900 dark:text-white min-w-[4rem] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                class="flex justify-center items-center w-10 h-10 rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring disabled:opacity-50"
                onclick={() => {
                  zoomLevel = Math.min(2, zoomLevel + 0.1);
                  zoomLevel = Math.round(zoomLevel * 10) / 10;
                  setZoom(zoomLevel);
                }}
                aria-label="Zoom in">
                <Icon src={Plus} class="w-5 h-5" />
              </button>
              <button
                type="button"
                class="px-3 py-1 text-sm rounded-lg bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-all duration-200"
                onclick={() => {
                  zoomLevel = 1;
                  setZoom(1);
                }}>
                <T key="settings.zoom_reset" fallback="Reset" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Notification Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-200 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.notifications" fallback="Notifications" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.notifications_description"
              fallback="Manage your notification preferences" />
          </p>
        </div>
        <div class="p-4 sm:p-6">
          <div
            class="flex flex-col gap-4 p-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
            <div class="flex gap-3 items-center">
              <input
                id="reminders-enabled"
                type="checkbox"
                class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                bind:checked={remindersEnabled} />
              <label
                for="reminders-enabled"
                class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                ><T
                  key="settings.enable_reminder_notifications"
                  fallback="Enable assessment reminder notifications" /></label>
            </div>
            <div class="flex gap-3 items-center">
              <input
                id="auto-dismiss-message-notifications"
                type="checkbox"
                class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                bind:checked={autoDismissMessageNotifications} />
              <label
                for="auto-dismiss-message-notifications"
                class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200"
                >Auto-dismiss message notifications when clicked</label>
            </div>
            <button
              class="px-4 py-2 w-full text-white rounded-lg shadow-xs transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105"
              onclick={sendTestNotification}>
              <T key="settings.send_test_notification" fallback="Send Test Notification" />
            </button>
          </div>
        </div>
      </section>

      {#if showDevSettings}
        <section
          class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-400 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
          <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
            <h2 class="text-base font-semibold sm:text-lg">Developer Settings</h2>
            <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              Developer options for debugging and testing
            </p>
          </div>
          <div class="p-4 sm:p-6">
            <div class="space-y-6">
              <div class="flex gap-3 items-center">
                <input
                  id="dev-sensitive-info-hider"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={devSensitiveInfoHider} />
                <label
                  for="dev-sensitive-info-hider"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
                  Sensitive Info Hider (API responses replaced with random mock data)
                </label>
              </div>

              <div class="flex gap-3 items-center">
                <input
                  id="dev-force-offline-mode"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={devForceOfflineMode} />
                <label
                  for="dev-force-offline-mode"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
                  Force Offline Mode (Prevents all network requests, uses cached data only)
                </label>
              </div>

              <!-- Performance Testing Section -->
              <div class="pt-6 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
                  Performance Testing
                </h3>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                  Run automated performance testing across all pages. This will navigate through
                  each page, collect performance metrics including load times, errors, and resource
                  usage, then save the results as JSON files in your AppData directory.
                </p>

                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    class="flex gap-2 items-center justify-center px-4 py-2 text-white rounded-lg shadow-xs transition-all duration-200 accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={runPerformanceTest}
                    disabled={performanceTestRunning}>
                    {#if performanceTestRunning}
                      <div
                        class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
                      </div>
                      <span>Running Test...</span>
                    {:else}
                      <Icon src={Cog} class="w-4 h-4" />
                      <span>Run Performance Test</span>
                    {/if}
                  </button>

                  <button
                    class="flex gap-2 items-center justify-center px-4 py-2 rounded-lg border transition-all duration-200 border-zinc-300/70 dark:border-zinc-700/70 text-zinc-800 dark:text-white bg-zinc-100/60 dark:bg-zinc-800/40 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40 focus:outline-hidden focus:ring-2 focus:ring-offset-2 accent-ring active:scale-95 hover:scale-105"
                    onclick={openPerformanceTestsFolder}>
                    <Icon src={CloudArrowUp} class="w-4 h-4" />
                    <span>Open Saved Tests</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      {/if}

      <!-- RSS Feeds Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-200 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">RSS Feeds</h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            Manage your news and content feeds that appear in your DMs
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <!-- Separate RSS Feed Setting -->
          <div
            class="flex justify-between items-center p-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50">
            <div class="flex-1">
              <h3 class="text-sm font-semibold sm:text-base">Separate RSS Feed Page</h3>
              <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
                Show RSS feeds in a separate page instead of within messages
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" bind:checked={separateRssFeed} />
              <div
                class="w-11 h-6 bg-zinc-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600">
              </div>
            </label>
          </div>
          <div>
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="text-sm font-semibold sm:text-base">Feed Sources</h3>
                <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
                  Add RSS feeds to stay updated with your favorite content
                </p>
              </div>
              <button
                class="flex gap-2 items-center px-4 py-2 text-white rounded-lg shadow-xs transition-all duration-200 accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105"
                onclick={addFeed}>
                <Icon src={Plus} class="w-4 h-4" />
                Add Feed
              </button>
            </div>
            <div class="space-y-3">
              {#each feeds as feed, idx}
                <div
                  class="p-4 rounded-lg transition-all duration-200 group bg-zinc-100/80 dark:bg-zinc-800/50 hover:shadow-lg hover:bg-zinc-200/80 dark:hover:bg-zinc-700/50 animate-fade-in">
                  <div class="flex flex-col gap-3 items-start sm:flex-row sm:items-center">
                    <div class="flex-1 min-w-0">
                      <div class="flex gap-2 items-center mb-2">
                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span class="text-sm font-medium truncate text-zinc-800 dark:text-zinc-200">
                          {getFeedDisplayName(feed.url)}
                        </span>
                      </div>
                      <input
                        class="px-3 py-2 w-full bg-white rounded-sm border transition text-zinc-900 dark:bg-zinc-900/50 dark:text-white border-zinc-300/50 dark:border-zinc-700/50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/feed.xml"
                        bind:value={feed.url} />
                    </div>
                    <div class="flex gap-2 items-center">
                      <button
                        class="p-2 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:text-blue-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/50"
                        title="Test Feed"
                        onclick={() => testFeed(feed.url)}>
                        <Icon src={ArrowPath} class="w-5 h-5" />
                      </button>
                      <button
                        class="p-2 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:text-red-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/50"
                        title="Remove Feed"
                        onclick={() => removeFeed(idx)}>
                        <Icon src={Trash} class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
              {#if feeds.length === 0}
                <div class="py-8 text-center text-zinc-600 dark:text-zinc-400 animate-fade-in">
                  <Icon src={Rss} class="mx-auto mb-3 w-12 h-12 opacity-50" />
                  <p class="text-sm">No feeds added yet</p>
                  <p class="mt-1 text-xs">Add your first RSS feed to get started</p>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </section>

      <!-- AI Features -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-100 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.ai_features" fallback="AI Features" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.ai_features_description"
              fallback="Enable AI-powered features by providing your free Gemini API key." />
          </p>
        </div>
        <div class="p-4 space-y-4 sm:p-6">
          <div class="flex gap-3 items-center">
            <input
              id="ai-integrations-enabled"
              type="checkbox"
              class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
              bind:checked={aiIntegrationsEnabled} />
            <label
              for="ai-integrations-enabled"
              class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
              <T key="settings.enable_ai_features" fallback="Enable AI Features" />
            </label>
          </div>
          {#if aiIntegrationsEnabled}
            <div class="pl-6 mt-3 space-y-3 sm:space-y-4">
              <div class="flex gap-3 items-center">
                <input
                  id="lesson-summary-analyser-enabled"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={lessonSummaryAnalyserEnabled} />
                <label
                  for="lesson-summary-analyser-enabled"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
                  <T key="settings.lesson_summary_analyser" fallback="Lesson Summary Analyser" />
                </label>
              </div>
              <div class="flex gap-3 items-center">
                <input
                  id="quiz-generator-enabled"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={quizGeneratorEnabled} />
                <label
                  for="quiz-generator-enabled"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
                  <T key="settings.quiz_generator" fallback="Quiz Generator" />
                </label>
              </div>
              <div class="mt-6 space-y-4">
                <div>
                  <label
                    for="ai-provider"
                    class="block mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    <T key="settings.ai_provider" fallback="AI Provider" />
                  </label>
                  <select
                    id="ai-provider"
                    bind:value={aiProvider}
                    class="px-3 py-2 w-full bg-white rounded-sm border border-zinc-300/50 dark:border-zinc-700/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500">
                    <option value="gemini">Gemini</option>
                    <option value="cerebras">Cerebras</option>
                  </select>
                </div>
                {#if aiProvider === 'gemini'}
                  <div>
                    <label
                      for="gemini-api-key"
                      class="block mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      <T key="settings.gemini_api_key" fallback="Gemini API Key" />
                    </label>
                    <input
                      id="gemini-api-key"
                      type="text"
                      class="px-3 py-2 w-full bg-white rounded-sm border border-zinc-300/50 dark:border-zinc-700/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder={$_('settings.gemini_placeholder') ||
                        'Paste your Gemini API key here'}
                      bind:value={geminiApiKey}
                      autocomplete="off"
                      spellcheck="false" />
                    <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Get your API key from
                      <a
                        href="https://aistudio.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 dark:text-blue-400 hover:underline">
                        Google AI Studio
                      </a>
                    </p>
                  </div>
                {:else}
                  <div>
                    <label
                      for="cerebras-api-key"
                      class="block mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      <T key="settings.cerebras_api_key" fallback="Cerebras API Key" />
                    </label>
                    <input
                      id="cerebras-api-key"
                      type="text"
                      class="px-3 py-2 w-full bg-white rounded-sm border border-zinc-300/50 dark:border-zinc-700/50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder={$_('settings.cerebras_placeholder') ||
                        'Paste your Cerebras API key here'}
                      bind:value={cerebrasApiKey}
                      autocomplete="off"
                      spellcheck="false" />
                    <p class="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Get your API key from
                      <a
                        href="https://cloud.cerebras.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 dark:text-blue-400 hover:underline">
                        Cerebras Cloud
                      </a>
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </section>

      <!-- Plugins Section -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
          <h2 class="text-base font-semibold sm:text-lg">
            <T key="settings.plugins" fallback="Plugins" />
          </h2>
          <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
            <T
              key="settings.plugins_description"
              fallback="Enhance your DesQTA experience with plugins" />
          </p>
        </div>
        <div class="p-4 sm:p-6">
          <div class="p-4 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/50 animate-fade-in">
            <p class="mb-4 text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              <T
                key="settings.plugin_store_description"
                fallback="Install additional features and customizations from our plugin store." />
            </p>
            <a
              href="/settings/plugins"
              class="inline-block px-6 py-2 w-full text-center text-white rounded-lg shadow-xs transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105">
              <T key="settings.open_plugin_store" fallback="Open Plugin Store" />
            </a>
          </div>
        </div>
      </section>

      <!-- Check for Updates (Desktop only) -->
      {#if isDesktop}
        <section
          class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-green-700/50 animate-fade-in-up">
          <div class="p-4 sm:p-6">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h2 class="text-base font-semibold sm:text-lg">Updates</h2>
                <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
                  Check for the latest version of DesQTA.
                </p>
              </div>
              <button
                type="button"
                onclick={checkForUpdates}
                disabled={checkingUpdates}
                class="flex gap-2 justify-center items-center px-4 py-2 text-white bg-green-500 rounded-lg shadow-xs transition-all duration-200 hover:bg-green-600 focus:ring-2 focus:ring-green-400 active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                {#if checkingUpdates}
                  <div
                    class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
                  </div>
                  <span>Checking...</span>
                {:else}
                  <Icon src={ArrowPath} class="w-4 h-4" />
                  <span>Check for Updates</span>
                {/if}
              </button>
            </div>
            {#if updateAvailable}
              <div
                class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
                <div class="flex gap-3 items-start">
                  <div class="flex-1">
                    <h3 class="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
                      Update Available: v{updateVersion}
                    </h3>
                    <p class="text-xs text-green-700 dark:text-green-300 mb-3 whitespace-pre-line">
                      {updateNotes}
                    </p>
                    <button
                      type="button"
                      onclick={installUpdate}
                      class="flex gap-2 items-center px-4 py-2 text-white bg-green-600 rounded-lg shadow-xs transition-all duration-200 hover:bg-green-700 focus:ring-2 focus:ring-green-400 active:scale-95 hover:scale-105">
                      <Icon src={CloudArrowUp} class="w-4 h-4" />
                      <span>Install Update</span>
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </section>
      {/if}

      <!-- Redo Onboarding -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-purple-700/50 animate-fade-in-up">
        <div class="flex justify-between items-center p-4 sm:p-6">
          <div>
            <h2 class="text-base font-semibold sm:text-lg">
              <T key="settings.redo_onboarding" fallback="Redo Walkthrough" />
            </h2>
            <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              <T
                key="settings.redo_onboarding_description"
                fallback="Restart the onboarding walkthrough to learn about DesQTA features." />
            </p>
          </div>
          <button
            type="button"
            onclick={redoOnboarding}
            disabled={resettingOnboarding}
            class="flex gap-2 justify-center items-center px-4 py-2 text-white bg-purple-500 rounded-lg shadow-xs transition-all duration-200 hover:bg-purple-600 focus:ring-2 focus:ring-purple-400 active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
            {#if resettingOnboarding}
              <div
                class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
              </div>
              <span><T key="settings.resetting" fallback="Resetting..." /></span>
            {:else}
              <Icon src={ArrowPath} class="w-4 h-4" />
              <span><T key="settings.redo_onboarding" fallback="Redo Walkthrough" /></span>
            {/if}
          </button>
        </div>
      </section>

      <!-- Troubleshooting button -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="flex justify-between items-center p-4 sm:p-6">
          <div>
            <h2 class="text-base font-semibold sm:text-lg">Troubleshooting</h2>
            <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              Open the troubleshooting tools and diagnostics.
            </p>
          </div>
          <button
            class="flex gap-2 justify-center items-center px-4 py-2 text-white bg-blue-500 rounded-lg shadow-xs transition-all duration-200 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 active:scale-95 hover:scale-105"
            onclick={openTroubleshootingModal}>
            <Icon src={Cog} class="w-4 h-4" />
            Open
          </button>
        </div>
      </section>

      <!-- Cache Management -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-300 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-red-700/50 animate-fade-in-up">
        <div class="flex justify-between items-center p-4 sm:p-6">
          <div>
            <h2 class="text-base font-semibold sm:text-lg">Cache Management</h2>
            <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              Clear browser cache to fix navigation issues.
            </p>
          </div>
          <button
            type="button"
            onclick={clearCache}
            disabled={clearingCache}
            class="flex gap-2 justify-center items-center px-4 py-2 text-white bg-red-500 rounded-lg shadow-xs transition-all duration-200 hover:bg-red-600 focus:ring-2 focus:ring-red-400 active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
            <Icon src={Trash} class="w-4 h-4" />
            {clearingCache ? 'Clearing...' : 'Clear Cache'}
          </button>
        </div>
      </section>

      <!-- Dev Settings Section -->
      {#if showDevSettings}
        <section
          class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-xs transition-all duration-300 delay-400 bg-white/80 dark:bg-zinc-900/50 sm:rounded-2xl border-zinc-300/50 dark:border-zinc-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
          <div class="px-4 py-4 border-b sm:px-6 border-zinc-300/50 dark:border-zinc-800/50">
            <h2 class="text-base font-semibold sm:text-lg">Developer Settings</h2>
            <p class="text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
              Developer options for debugging and testing
            </p>
          </div>
          <div class="p-4 sm:p-6">
            <div class="space-y-6">
              <div class="flex gap-3 items-center">
                <input
                  id="dev-sensitive-info-hider"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={devSensitiveInfoHider} />
                <label
                  for="dev-sensitive-info-hider"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
                  Sensitive Info Hider (API responses replaced with random mock data)
                </label>
              </div>

              <div class="flex gap-3 items-center">
                <input
                  id="dev-force-offline-mode"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={devForceOfflineMode} />
                <label
                  for="dev-force-offline-mode"
                  class="text-sm font-medium cursor-pointer text-zinc-800 sm:text-base dark:text-zinc-200">
                  Force Offline Mode (Prevents all network requests, uses cached data only)
                </label>
              </div>

              <!-- Performance Testing Section -->
              <div class="pt-6 border-t border-zinc-200/50 dark:border-zinc-700/50">
                <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
                  Performance Testing
                </h3>
                <p class="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                  Run automated performance testing across all pages. This will navigate through
                  each page, collect performance metrics including load times, errors, and resource
                  usage, then save the results as JSON files in your AppData directory.
                </p>

                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    class="flex gap-2 items-center justify-center px-4 py-2 text-white rounded-lg shadow-xs transition-all duration-200 accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={runPerformanceTest}
                    disabled={performanceTestRunning}>
                    {#if performanceTestRunning}
                      <div
                        class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
                      </div>
                      <span>Running Test...</span>
                    {:else}
                      <Icon src={Cog} class="w-4 h-4" />
                      <span>Run Performance Test</span>
                    {/if}
                  </button>

                  <button
                    class="flex gap-2 items-center justify-center px-4 py-2 rounded-lg border transition-all duration-200 border-zinc-300/70 dark:border-zinc-700/70 text-zinc-800 dark:text-white bg-zinc-100/60 dark:bg-zinc-800/40 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40 focus:outline-hidden focus:ring-2 focus:ring-offset-2 accent-ring active:scale-95 hover:scale-105"
                    onclick={openPerformanceTestsFolder}>
                    <Icon src={CloudArrowUp} class="w-4 h-4" />
                    <span>Open Saved Tests</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>

<!-- Cloud Sync Modal -->
<CloudSyncModal
  bind:show={showCloudSyncModal}
  onSettingsUpload={handleSettingsUpload}
  onSettingsDownload={handleSettingsDownload}
  onSave={() => saveSettings({ skipReload: true })}
  on:close={closeCloudSyncModal} />

<!-- Troubleshooting Modal -->
<TroubleshootingModal open={showTroubleshootingModal} onclose={closeTroubleshootingModal} />

<!-- Sidebar Settings Dialog -->
<SidebarSettingsDialog
  open={showSidebarSettingsDialog}
  menu={DEFAULT_MENU}
  onClose={() => (showSidebarSettingsDialog = false)}
  onSave={() => {
    toastStore.success('Sidebar settings saved. Page will reload to apply changes.');
    setTimeout(() => location.reload(), 1500);
  }} />

{#if showEulaModal}
  <div class="flex fixed inset-0 z-50 justify-center items-center">
    <div
      class="absolute inset-0 backdrop-blur-xs bg-black/50"
      role="button"
      tabindex="0"
      onclick={() => (showEulaModal = false)}
      onkeydown={(e) => e.key === 'Escape' && (showEulaModal = false)}>
    </div>
    <div
      class="relative max-w-2xl w-[90vw] max-h-[80vh] rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 animate-fade-in">
      <h3 class="mb-3 text-lg font-semibold">BetterSEQTA Cloud EULA</h3>
      <div
        class="overflow-auto p-3 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200"
        style="max-height: 50vh;">
        <pre class="font-sans whitespace-pre-wrap">{CLOUD_EULA_TEXT}</pre>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button
          class="px-4 py-2 rounded-lg transition-all duration-200 bg-zinc-200 dark:bg-zinc-700/50 text-zinc-800 dark:text-white hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-400"
          onclick={() => (showEulaModal = false)}>Decline</button>
        <button
          class="px-4 py-2 text-white rounded-lg transition-all duration-200 accent-bg hover:accent-bg-hover hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring"
          onclick={async () => {
            try {
              await invoke('save_settings_merge', { patch: { accepted_cloud_eula: true } });
              acceptedCloudEula = true;
              showEulaModal = false;
            } catch (e) {
              console.error('Failed to save EULA acceptance', e);
            }
          }}>Accept</button>
      </div>
    </div>
  </div>
{/if}

<!-- Unsaved Changes Confirmation Modal -->
<Modal
  bind:open={showUnsavedChangesModal}
  title="Unsaved Changes"
  closeOnBackdrop={false}
  closeOnEscape={true}
  onclose={handleCancelLeave}>
  <div class="px-8 pb-8">
    <p class="mb-6 text-zinc-600 dark:text-zinc-400">
      <T
        key="settings.unsaved_changes_message"
        fallback="You have unsaved changes. Are you sure you want to leave? Your changes will be lost." />
    </p>
    <div class="flex gap-3 justify-end">
      <button
        class="px-4 py-2 rounded-lg transition-all duration-200 bg-zinc-200 dark:bg-zinc-700/50 text-zinc-800 dark:text-white hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2"
        onclick={handleCancelLeave}>
        <T key="common.cancel" fallback="Cancel" />
      </button>
      <button
        class="px-4 py-2 text-white rounded-lg transition-all duration-200 transform accent-bg hover:accent-bg-hover hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring focus:ring-offset-2"
        onclick={handleSaveAndLeave}
        disabled={saving}>
        {#if saving}
          <div class="flex gap-2 items-center">
            <div class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
            </div>
            <span><T key="settings.saving" fallback="Saving..." /></span>
          </div>
        {:else}
          <T key="settings.save_and_leave" fallback="Save Changes" />
        {/if}
      </button>
    </div>
  </div>
</Modal>

<style>
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(32px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .animate-fade-in {
    animation: fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .shortcut-item-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    opacity: 0;
  }
</style>
