<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { notify } from '../../utils/notify';
  import {
    accentColor,
    loadAccentColor,
    updateAccentColor,
    theme,
    loadTheme,
    updateTheme,
  } from '../../lib/stores/theme';
  import { Icon } from 'svelte-hero-icons';
  import { Plus, ArrowPath, Trash, Rss, Sun, Moon, ComputerDesktop, CloudArrowUp } from 'svelte-hero-icons';
  import CloudSyncModal from '../../lib/components/CloudSyncModal.svelte';
  import { errorService } from '../../lib/services/errorService';

  interface Shortcut {
    name: string;
    icon: string;
    url: string;
  }

  interface Feed {
    url: string;
  }

  let shortcuts: Shortcut[] = [];
  let loading = true;
  let saving = false;
  let saveSuccess = false;
  let saveError = '';
  let weatherEnabled = false;
  let forceUseLocation = false;
  let weatherCity = '';
  let feeds: Feed[] = [];
  let weatherCountry = '';
  let disableSchoolPicture = false;
  let enhancedAnimations = true;
  let geminiApiKey = '';

  let remindersEnabled = true;
  let showCloudSyncModal = false;
  let aiIntegrationsEnabled = false;
  let gradeAnalyserEnabled = true;
  let lessonSummaryAnalyserEnabled = true;
  let autoCollapseSidebar = false;
  let autoExpandSidebarHover = false;
  let globalSearchEnabled = true;
  let devSensitiveInfoHider = false;
  let showDevSettings = false;
  let keyBuffer = '';

  async function loadSettings() {
    loading = true;
    try {
      const settings = await invoke<{
        shortcuts: Shortcut[];
        feeds: any[];
        weather_enabled: boolean;
        weather_city: string;
        weather_country: string;
        reminders_enabled: boolean;
        force_use_location: boolean;
        accent_color: string;
        theme: 'light' | 'dark';
        disable_school_picture?: boolean;
        enhanced_animations?: boolean;
        gemini_api_key?: string;
        ai_integrations_enabled?: boolean;
        grade_analyser_enabled?: boolean;
        lesson_summary_analyser_enabled?: boolean;
        auto_collapse_sidebar?: boolean;
        auto_expand_sidebar_hover?: boolean;
        global_search_enabled?: boolean;
        dev_sensitive_info_hider?: boolean;
      }>('get_settings');
      shortcuts = settings.shortcuts || [];
      feeds = settings.feeds || [];
      weatherEnabled = settings.weather_enabled ?? false;
      forceUseLocation = settings.force_use_location ?? false;
      weatherCity = settings.weather_city ?? '';
      weatherCountry = settings.weather_country ?? '';
      remindersEnabled = settings.reminders_enabled ?? true;
      disableSchoolPicture = settings.disable_school_picture ?? false;
      enhancedAnimations = settings.enhanced_animations ?? true;
      geminiApiKey = settings.gemini_api_key ?? '';
      accentColor.set(settings.accent_color ?? '#3b82f6');
      theme.set(settings.theme ?? 'dark');
      aiIntegrationsEnabled = settings.ai_integrations_enabled ?? false;
      gradeAnalyserEnabled = settings.grade_analyser_enabled ?? true;
      lessonSummaryAnalyserEnabled = settings.lesson_summary_analyser_enabled ?? true;
      autoCollapseSidebar = settings.auto_collapse_sidebar ?? false;
      autoExpandSidebarHover = settings.auto_expand_sidebar_hover ?? false;
      globalSearchEnabled = settings.global_search_enabled ?? true;
      devSensitiveInfoHider = settings.dev_sensitive_info_hider ?? false;

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
      disableSchoolPicture = false;
      enhancedAnimations = true;
      geminiApiKey = '';
      accentColor.set('#3b82f6');
      theme.set('dark');
      aiIntegrationsEnabled = false;
      gradeAnalyserEnabled = true;
      lessonSummaryAnalyserEnabled = true;
      autoCollapseSidebar = false;
      autoExpandSidebarHover = false;
      globalSearchEnabled = true;
      devSensitiveInfoHider = false;
    }
    loading = false;
  }

  async function saveSettings() {
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
      // Load current settings to preserve fields like widget_layout
      const currentSettings = await invoke<any>('get_settings');
      const newSettings = {
        ...currentSettings,
        shortcuts,
        feeds,
        weather_enabled: weatherEnabled,
        weather_city: weatherCity,
        weather_country: weatherCountry,
        reminders_enabled: remindersEnabled,
        force_use_location: forceUseLocation,
        accent_color: $accentColor,
        theme: $theme,
        disable_school_picture: disableSchoolPicture,
        enhanced_animations: enhancedAnimations,
        gemini_api_key: geminiApiKey,
        ai_integrations_enabled: aiIntegrationsEnabled,
        grade_analyser_enabled: gradeAnalyserEnabled,
        lesson_summary_analyser_enabled: lessonSummaryAnalyserEnabled,
        auto_collapse_sidebar: autoCollapseSidebar,
        auto_expand_sidebar_hover: autoExpandSidebarHover,
        global_search_enabled: globalSearchEnabled,
        dev_sensitive_info_hider: devSensitiveInfoHider,
      };
      await invoke('save_settings', { newSettings });
      saveSuccess = true;
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      saveError = 'Failed to save settings.';
      console.log(e);
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
      alert('Reminders are currently disabled. Enable them to receive notifications.');
      return;
    }
    await notify({
      title: 'Test Notification',
      body: 'This is a test notification from DesQTA settings.',
    });
  }

  async function testFeed(url: string) {
    if (!url) {
      notify({
        title: 'Invalid Feed URL',
        body: 'Please enter a valid RSS feed URL',
      });
      return;
    }

    try {
      const result = await invoke('get_rss_feed', { feed: url });
      notify({
        title: 'Feed Test Successful',
        body: 'The RSS feed is valid and can be added',
      });
    } catch (error) {
      notify({
        title: 'Feed Test Failed',
        body: 'Could not fetch the RSS feed. Please check the URL and try again.',
      });
    }
  }

  function openCloudSyncModal() {
    showCloudSyncModal = true;
  }

  function closeCloudSyncModal() {
    showCloudSyncModal = false;
  }

  function handleSettingsUpload() {
    notify({
      title: 'Settings Uploaded',
      body: 'Your settings have been successfully uploaded to the cloud.',
    });
  }

  function handleSettingsDownload(cloudSettings: any) {
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
    accentColor.set(cloudSettings.accent_color ?? '#3b82f6');
    theme.set(cloudSettings.theme ?? 'dark');
    aiIntegrationsEnabled = cloudSettings.ai_integrations_enabled ?? false;
    gradeAnalyserEnabled = cloudSettings.grade_analyser_enabled ?? true;
    lessonSummaryAnalyserEnabled = cloudSettings.lesson_summary_analyser_enabled ?? true;
    autoCollapseSidebar = cloudSettings.auto_collapse_sidebar ?? false;
    autoExpandSidebarHover = cloudSettings.auto_expand_sidebar_hover ?? false;
        globalSearchEnabled = cloudSettings.global_search_enabled ?? true;
    devSensitiveInfoHider = cloudSettings.dev_sensitive_info_hider ?? false;

    notify({
      title: 'Settings Downloaded',
      body: 'Your settings have been successfully downloaded from the cloud.',
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    keyBuffer += event.key.toLowerCase();
    if (keyBuffer.length > 3) keyBuffer = keyBuffer.slice(-3);
    if (keyBuffer === 'dev') {
      showDevSettings = true;
    }
  }

  function simulateError() {
    errorService.handleManualError('Simulated error for testing purposes', 500);
  }

  onMount(async () => {
    await Promise.all([loadSettings(), loadTheme()]);
    window.addEventListener('keydown', handleKeydown);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="p-4 mx-auto max-w-4xl sm:p-6 md:p-8">
  <div
    class="sticky top-0 z-50 flex flex-col gap-4 justify-between items-start mb-8 sm:flex-row sm:items-center animate-fade-in-up backdrop-blur-md bg-white/80 dark:bg-slate-900/80 py-4 px-6 border-b border-slate-200 dark:border-slate-800 rounded-xl">
    <h1 class="text-xl font-bold sm:text-2xl px-2 py-1 rounded-lg">Settings</h1>
    <div class="flex flex-col gap-2 items-start w-full sm:flex-row sm:items-center sm:w-auto">
      <button
        class="px-6 py-2 w-full text-white bg-gradient-to-r from-green-600 to-green-500 rounded-lg shadow-lg transition-all duration-200 sm:w-auto hover:from-green-700 hover:to-green-600 focus:ring-2 focus:ring-green-400 active:scale-95 hover:scale-105 playful"
        onclick={saveSettings}
        disabled={saving}>
        {#if saving}
          <div class="flex gap-2 justify-center items-center">
            <div class="w-4 h-4 rounded-full border-2 animate-spin border-white/30 border-t-white">
            </div>
            <span>Saving...</span>
          </div>
        {:else}
          Save Changes
        {/if}
      </button>
      {#if saveSuccess}
        <span class="text-sm text-green-400 animate-fade-in sm:text-base"
          >Saved!</span>
      {/if}
      {#if saveError}
        <span class="text-sm text-red-400 animate-fade-in sm:text-base">{saveError}</span>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-12 animate-fade-in">
      <div class="flex flex-col gap-4 items-center">
        <div
          class="w-8 h-8 rounded-full border-4 animate-spin sm:w-10 sm:h-10 border-indigo-500/30 border-t-indigo-500">
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400 sm:text-base">Loading settings...</p>
      </div>
    </div>
  {:else}
    <div class="space-y-6 sm:space-y-8">
      <!-- Cloud Sync Section -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 bg-slate-100/60 dark:bg-slate-800/30 sm:rounded-2xl border-slate-300/30 dark:border-slate-800/30 animate-fade-in-up relative opacity-60">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/30 dark:border-slate-800/30">
          <h2 class="text-base font-semibold sm:text-lg text-slate-500 dark:text-slate-400">Cloud Sync</h2>
          <p class="text-xs text-slate-500 sm:text-sm dark:text-slate-500">
            Sync your settings across devices with BetterSEQTA Plus account cloud syncing
          </p>
        </div>
        <div class="p-4 sm:p-6 relative">
          <!-- Coming Soon Overlay -->
          <div class="absolute inset-0 flex items-center justify-center bg-slate-200/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg z-10">
            <div class="text-center">
              <div class="text-2xl font-bold text-slate-600 dark:text-slate-400 mb-2">Coming Soon</div>
              <div class="text-sm text-slate-500 dark:text-slate-500">Cloud sync functionality will be available in a future update</div>
            </div>
          </div>
          
          <div class="p-4 rounded-lg bg-slate-200/60 dark:bg-slate-700/30 animate-fade-in opacity-50">
            <div class="flex flex-col gap-4">
              <div>
                <h3 class="text-sm font-semibold sm:text-base mb-2 text-slate-500 dark:text-slate-400">Settings Synchronization</h3>
                <p class="text-xs text-slate-500 sm:text-sm dark:text-slate-500 mb-4">
                  Upload your current settings to the cloud or download settings from another device. 
                  This includes all your shortcuts, feeds, theme preferences, and other customizations.
                </p>
                <p class="text-xs text-slate-500 sm:text-sm dark:text-slate-500 mb-4">
                  <a href="https://accounts.betterseqta.org" target="_blank" rel="noopener noreferrer" 
                     class="text-slate-400 dark:text-slate-500 hover:underline">
                    Create a free BetterSEQTA Plus account
                  </a> to get started with cloud syncing.
                </p>
              </div>
              <div class="flex flex-col gap-3 sm:flex-row">
                <button
                  class="flex gap-2 items-center justify-center px-6 py-3 text-slate-400 bg-slate-300 dark:bg-slate-600 rounded-lg shadow transition-all duration-200 cursor-not-allowed"
                  disabled>
                  <Icon src={CloudArrowUp} class="w-5 h-5" />
                  Sync Settings
                </button>
                <div class="text-xs text-slate-500 dark:text-slate-500 sm:self-center">
                  Requires BetterSEQTA Plus account
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Homepage Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-100 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-base font-semibold sm:text-lg">Homepage</h2>
          <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Customize your homepage experience
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <!-- Shortcuts -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">Quick Access Shortcuts</h3>
            <p class="mb-4 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Add shortcuts to frequently used websites that will appear at the top of your
              homepage.
            </p>
            <div class="space-y-3 sm:space-y-4">
              {#each shortcuts as shortcut, idx}
                <div
                  class="flex flex-col gap-2 items-start p-3 rounded-lg transition-all duration-200 sm:flex-row sm:items-center bg-slate-100/80 dark:bg-slate-800/50 hover:shadow-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/50 animate-fade-in">
                  <input
                    class="px-2 py-1.5 w-full bg-white rounded transition sm:w-32 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500"
                    placeholder="Name"
                    bind:value={shortcut.name} />
                  <input
                    class="px-2 py-1.5 w-full bg-white rounded transition sm:w-10 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500"
                    placeholder="Icon emoji"
                    bind:value={shortcut.icon} />
                  <input
                    class="px-2 py-1.5 w-full bg-white rounded transition sm:flex-10 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500"
                    placeholder="URL"
                    bind:value={shortcut.url} />
                  <button
                    class="px-2 text-red-400 transition-transform duration-200 hover:text-red-600 active:scale-110"
                    onclick={() => removeShortcut(idx)}
                    title="Remove">❌</button>
                </div>
              {/each}
              <button
                class="px-4 py-2 w-full text-white rounded-lg shadow transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105"
                onclick={addShortcut}>Add Shortcut</button>
            </div>
          </div>
          <!-- Widget Settings -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">Widget Settings</h3>
            <p class="mb-4 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Configure which widgets appear on your DesQTA dashboard.
            </p>
            <div
              class="p-4 space-y-4 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 animate-fade-in">
              <!-- Always visible -->
<div class="flex gap-4 items-center">
  <input
    id="weather-enabled"
    type="checkbox"
    class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
    bind:checked={weatherEnabled} />
  <label
    for="weather-enabled"
    class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
    >Show Weather Widget</label>
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
      class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
      >Only use Fallback Location for Weather</label>
  </div>

  <!-- Show fallback inputs ONLY if forceUseLocation is true -->
  {#if forceUseLocation}
    <div class="flex flex-col gap-2 items-start pl-1">
      <label
        for="weather-city"
        class="text-xs text-slate-600 sm:text-sm dark:text-slate-400"
        >Fallback City:</label>
      <input
        id="weather-city"
        class="px-3 py-2 w-full bg-white rounded border transition text-slate-900 sm:w-64 dark:bg-slate-900/50 dark:text-white border-slate-300/50 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Perth"
        bind:value={weatherCity} />
    </div>

    <div class="flex flex-col gap-2 items-start pl-1">
      <label
        for="weather-country"
        class="text-xs text-slate-600 sm:text-sm dark:text-slate-400"
        >Fallback Country Code</label>
      <span class="text-xs">
        Visit <a
          href="https://countrycode.org"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-400 hover:underline">countrycode.org</a> to find your country code.
      </span>
      <input
        id="weather-country"
        class="px-3 py-2 w-full bg-white rounded border transition text-slate-900 sm:w-64 dark:bg-slate-900/50 dark:text-white border-slate-300/50 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="AU"
        bind:value={weatherCountry} />
    </div>
  {/if}
{/if}

            </div>
          </div>
        </div>
      </section>

      <!-- Appearance Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-100 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-base font-semibold sm:text-lg">Appearance</h2>
          <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Customize how DesQTA looks
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <!-- Theme Settings -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">Theme</h3>
            <p class="mb-4 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Choose your preferred color scheme and theme settings.
            </p>
            <div
              class="p-4 space-y-4 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 animate-fade-in">
              <div class="flex flex-col gap-2">
                <label for="accent-color" class="text-sm text-slate-800 dark:text-slate-200"
                  >Accent Color</label>
                <div class="flex gap-2 items-center">
                   <input
                      type="color"
                      id="accent-color"
                      bind:value={$accentColor}
                      class="w-11 h-12 bg-transparent rounded-xl cursor-pointer focus:outline-none" />
                  <input
                    type="text"
                    bind:value={$accentColor}
                    class="flex-1 px-3 py-2 bg-white rounded border transition text-slate-900 dark:bg-slate-900/50 dark:text-white border-slate-300/50 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#3b82f6" />
                  <button
                    class="px-3 py-2 rounded transition text-slate-800 bg-slate-200 dark:bg-slate-700/50 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500"
                    onclick={() => accentColor.set('#3b82f6')}>
                    Reset
                  </button>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  This color will be used throughout the app for buttons, links, and other
                  interactive elements.
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <p class="text-sm text-slate-800 dark:text-slate-200">Theme</p>
                <div class="flex gap-2">
                  <button
                    class="flex-1 px-4 py-3 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 transition flex items-center justify-center gap-2 {$theme ===
                    'light'
                      ? 'accent-bg'
                      : ''}"
                    onclick={() => updateTheme('light')}>
                    <Icon src={Sun} class="w-5 h-5" />
                    Light
                  </button>
                  <button
                    class="flex-1 px-4 py-3 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 transition flex items-center justify-center gap-2 {$theme ===
                    'dark'
                      ? 'accent-bg'
                      : ''}"
                    onclick={() => updateTheme('dark')}>
                    <Icon src={Moon} class="w-5 h-5" />
                    Dark
                  </button>
                  <button
                    class="flex-1 px-4 py-3 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 transition flex items-center justify-center gap-2 {$theme ===
                    'system'
                      ? 'accent-bg'
                      : ''}"
                    onclick={() => updateTheme('system')}>
                    <Icon src={ComputerDesktop} class="w-5 h-5" />
                    System
                  </button>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  Choose between light mode, dark mode, or follow your system preference.
                </p>
              </div>
            </div>
          </div>
          <!-- Layout Settings -->
          <div>
            <h3 class="mb-3 text-sm font-semibold sm:text-base sm:mb-4">Layout</h3>
            <p class="mb-4 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Adjust the layout and sizing of various elements.
            </p>
            <div class="p-4 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 animate-fade-in">
              <div class="flex gap-4 items-center mb-4">
                <input
                  id="auto-collapse-sidebar"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={autoCollapseSidebar} />
                <label
                  for="auto-collapse-sidebar"
                  class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
                  >Auto-collapse sidebar when navigating</label>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                When enabled, the sidebar will automatically collapse when you click on a page link, giving you more space for content.
              </p>
              <div class="flex gap-4 items-center mb-4 mt-4">
                <input
                  id="auto-expand-sidebar-hover"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={autoExpandSidebarHover} />
                <label
                  for="auto-expand-sidebar-hover"
                  class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
                  >Auto-expand sidebar on hover</label>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                When enabled and the sidebar is collapsed, hovering near the left edge will temporarily expand the sidebar for easy navigation.
              </p>
              <div class="flex gap-4 items-center mb-4 mt-4">
                <input
                  id="global-search-enabled"
                  type="checkbox"
                  class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                  bind:checked={globalSearchEnabled} />
                <label
                  for="global-search-enabled"
                  class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
                  >Enable global search</label>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">
                When enabled, you can use Ctrl+K to open a global search that searches across all your content, courses, and assessments.
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
              class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
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
              class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
              >Enhanced Animations</label>
          </div>
        </div>
      </section>

      <!-- Notification Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-200 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-base font-semibold sm:text-lg">Notifications</h2>
          <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Manage your notification preferences
          </p>
        </div>
        <div class="p-4 sm:p-6">
          <div
            class="flex flex-col gap-4 p-4 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 animate-fade-in">
            <div class="flex gap-3 items-center">
              <input
                id="reminders-enabled"
                type="checkbox"
                class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                bind:checked={remindersEnabled} />
              <label
                for="reminders-enabled"
                class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
                >Enable assessment reminder notifications</label>
            </div>
            <button
              class="px-4 py-2 w-full text-white rounded-lg shadow transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105"
              onclick={sendTestNotification}>
              Send Test Notification
            </button>
          </div>
        </div>
      </section>

      <!-- RSS Feeds Settings -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-200 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-base font-semibold sm:text-lg">RSS Feeds</h2>
          <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Manage your news and content feeds that appear in your DMs
          </p>
        </div>
        <div class="p-4 space-y-6 sm:p-6">
          <div>
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="text-sm font-semibold sm:text-base">Feed Sources</h3>
                <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
                  Add RSS feeds to stay updated with your favorite content
                </p>
              </div>
              <button
                class="flex gap-2 items-center px-4 py-2 text-white rounded-lg shadow transition-all duration-200 accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105"
                onclick={addFeed}>
                <Icon src={Plus} class="w-4 h-4" />
                Add Feed
              </button>
            </div>
            <div class="space-y-3">
              {#each feeds as feed, idx}
                <div
                  class="p-4 rounded-lg transition-all duration-200 group bg-slate-100/80 dark:bg-slate-800/50 hover:shadow-lg hover:bg-slate-200/80 dark:hover:bg-slate-700/50 animate-fade-in">
                  <div class="flex flex-col gap-3 items-start sm:flex-row sm:items-center">
                    <div class="flex-1 min-w-0">
                      <div class="flex gap-2 items-center mb-2">
                        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span
                          class="text-sm font-medium truncate text-slate-800 dark:text-slate-200">
                          {feed.url ? new URL(feed.url).hostname : 'New Feed'}
                        </span>
                      </div>
                      <input
                        class="px-3 py-2 w-full bg-white rounded border transition text-slate-900 dark:bg-slate-900/50 dark:text-white border-slate-300/50 dark:border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="https://example.com/feed.xml"
                        bind:value={feed.url} />
                    </div>
                    <div class="flex gap-2 items-center">
                      <button
                        class="p-2 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                        title="Test Feed"
                        onclick={() => testFeed(feed.url)}>
                        <Icon src={ArrowPath} class="w-5 h-5" />
                      </button>
                      <button
                        class="p-2 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                        title="Remove Feed"
                        onclick={() => removeFeed(idx)}>
                        <Icon src={Trash} class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
              {#if feeds.length === 0}
                <div class="py-8 text-center text-slate-600 dark:text-slate-400 animate-fade-in">
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
  class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-100 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up"
>
  <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
    <h2 class="text-base font-semibold sm:text-lg">AI Features</h2>
    <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
      Enable AI-powered features by providing your free Gemini API key.
    </p>
  </div>
  <div class="p-4 space-y-4 sm:p-6">
    <div class="flex gap-3 items-center">
      <input
        id="ai-integrations-enabled"
        type="checkbox"
        class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
        bind:checked={aiIntegrationsEnabled}
      />
      <label
        for="ai-integrations-enabled"
        class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
      >
        Enable AI Features
      </label>
    </div>
    {#if aiIntegrationsEnabled}
      <div class="pl-6 mt-3 space-y-3 sm:space-y-4">
        <div class="flex gap-3 items-center">
          <input
            id="grade-analyser-enabled"
            type="checkbox"
            class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
            bind:checked={gradeAnalyserEnabled}
          />
          <label
            for="grade-analyser-enabled"
            class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
          >
            Grade Analyser
          </label>
        </div>
        <div class="flex gap-3 items-center">
          <input
            id="lesson-summary-analyser-enabled"
            type="checkbox"
            class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
            bind:checked={lessonSummaryAnalyserEnabled}
          />
          <label
            for="lesson-summary-analyser-enabled"
            class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
          >
            Lesson Summary Analyser
          </label>
        </div>
        <div class="mt-6">
          <label
            for="gemini-api-key"
            class="text-sm font-medium text-slate-800 dark:text-slate-200 block mb-1"
          >
            Gemini API Key
          </label>
          <input
            id="gemini-api-key"
            type="text"
            class="w-full px-3 py-2 rounded border border-slate-300/50 dark:border-slate-700/50 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste your Gemini API key here"
            bind:value={geminiApiKey}
            autocomplete="off"
            spellcheck="false"
          />
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Get your API key from
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        </div>
      </div>
    {/if}
  </div>
</section>

      <!-- Plugins Section -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-300 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-base font-semibold sm:text-lg">Plugins</h2>
          <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Enhance your DesQTA experience with plugins
          </p>
        </div>
        <div class="p-4 sm:p-6">
          <div class="p-4 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 animate-fade-in">
            <p class="mb-4 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Install additional features and customizations from our plugin store.
            </p>
            <a
              href="/settings/plugins"
              class="inline-block px-6 py-2 w-full text-center text-white rounded-lg shadow transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105">
              Open Plugin Store
            </a>
          </div>
        </div>
      </section>

      <!-- Theme Store Link -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-300 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-base font-semibold sm:text-lg">Theme Store</h2>
          <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
            Browse and install custom themes for DesQTA
          </p>
        </div>
        <div class="p-4 sm:p-6">
          <div class="p-4 rounded-lg bg-slate-100/80 dark:bg-slate-800/50 animate-fade-in">
            <p class="mb-4 text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Explore a collection of beautiful themes to customize your DesQTA experience.
            </p>
            <a
              href="/settings/theme-store"
              class="inline-block px-6 py-2 w-full text-center text-white rounded-lg shadow transition-all duration-200 sm:w-auto accent-bg hover:accent-bg-hover focus:ring-2 accent-ring active:scale-95 hover:scale-105">
              Open Theme Store
            </a>
          </div>
        </div>
      </section>

      <!-- Dev Settings Section -->
      {#if showDevSettings}
        <section class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 delay-400 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 hover:shadow-2xl hover:border-blue-700/50 animate-fade-in-up">
          <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-800/50">
            <h2 class="text-base font-semibold sm:text-lg">Dev Settings</h2>
            <p class="text-xs text-slate-600 sm:text-sm dark:text-slate-400">
              Developer options for debugging and testing
            </p>
          </div>
          <div class="p-4 sm:p-6 space-y-4">
            <div class="flex gap-3 items-center">
              <input
                id="dev-sensitive-info-hider"
                type="checkbox"
                class="w-4 h-4 accent-blue-600 sm:w-5 sm:h-5"
                bind:checked={devSensitiveInfoHider}
              />
              <label
                for="dev-sensitive-info-hider"
                class="text-sm font-medium cursor-pointer text-slate-800 sm:text-base dark:text-slate-200"
              >
                Sensitive Info Hider (API responses replaced with random mock data)
              </label>
            </div>
            
            <div class="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Testing Tools</h3>
              <button
                onclick={simulateError}
                class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                🚨 Simulate Error
              </button>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Triggers a test error to verify error handling and display
              </p>
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
  on:close={closeCloudSyncModal}
/>

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
</style>
