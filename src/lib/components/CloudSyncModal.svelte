<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { Icon } from 'svelte-hero-icons';
  import {
    CloudArrowUp,
    CloudArrowDown,
    XMark,
    ExclamationTriangle,
    CheckCircle,
    InformationCircle,
    User,
    ArrowRightOnRectangle,
  } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { cloudAuthService, type CloudUser } from '../services/cloudAuthService';
  import { cloudSettingsService } from '../services/cloudSettingsService';
  import { toastStore } from '../stores/toast';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let onSettingsUpload: () => void = () => {};
  export let onSettingsDownload: (settings: any) => void = () => {};
  export let onSave: (() => Promise<void>) | null = null;

  let email = '';
  let password = '';
  let loading = false;
  let error = '';
  let success = '';
  let operation = '';
  let cloudUser: CloudUser | null = null;
  let isAuthenticated = false;

  let unlistenDiscordCallback: (() => void) | null = null;

  onMount(async () => {
    await checkAuthentication();
    // Listen for Discord OAuth callback
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen('discord-oauth-callback', async (event: any) => {
      const { token, user_id, refresh_token } = event.payload;
      if (token && user_id) {
        await handleDiscordCallback(token, user_id, refresh_token);
      }
    });
    unlistenDiscordCallback = unlisten;
  });

  onDestroy(() => {
    if (unlistenDiscordCallback) {
      unlistenDiscordCallback();
    }
  });

  async function checkAuthentication() {
    const user = await cloudAuthService.init();
    if (user) {
      cloudUser = user;
      isAuthenticated = true;
    } else {
      cloudUser = null;
      isAuthenticated = false;
    }
  }

  async function authenticate() {
    if (!email.trim() || !password.trim()) {
      error = 'Please enter your email and password';
      return;
    }

    loading = true;
    error = '';
    success = '';
    operation = 'authenticating';

    try {
      await cloudAuthService.login(email, password);
      cloudUser = await cloudAuthService.getUser();
      isAuthenticated = true;
      success = 'Successfully authenticated with BetterSEQTA Plus account';
      password = ''; // Clear password
      toastStore.success('Successfully authenticated with BetterSEQTA Plus');
      dispatch('cloudauthchange');
    } catch (err) {
      error = `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toastStore.error('Authentication failed');
    } finally {
      loading = false;
      operation = '';
    }
  }

  async function handleDiscordLogin() {
    loading = true;
    error = '';
    success = '';
    operation = 'authenticating';

    try {
      await cloudAuthService.loginWithDiscord();
      // The browser will open, user authenticates with Discord
      // The callback will be handled by the event listener in onMount
    } catch (err) {
      error = `Discord login failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toastStore.error('Discord login failed');
      loading = false;
      operation = '';
    }
  }

  async function handleDiscordCallback(token: string, userId: string, refreshToken?: string | null) {
    try {
      await cloudAuthService.handleDiscordCallback(token, userId, refreshToken);
      cloudUser = await cloudAuthService.getUser();
      isAuthenticated = true;
      success = 'Successfully authenticated with Discord';
      toastStore.success('Successfully authenticated with Discord');
      dispatch('cloudauthchange');
    } catch (err) {
      error = `Discord authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toastStore.error('Discord authentication failed');
    } finally {
      loading = false;
      operation = '';
    }
  }

  async function logout() {
    try {
      await cloudAuthService.logout();
      cloudUser = null;
      isAuthenticated = false;
      success = 'Successfully logged out';
      toastStore.success('Successfully logged out');
      dispatch('cloudauthchange');
    } catch (err) {
      error = `Logout failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toastStore.error('Logout failed');
    }
  }

  async function uploadSettings() {
    if (!isAuthenticated) {
      error = 'Please authenticate first';
      return;
    }

    loading = true;
    error = '';
    success = '';
    operation = 'uploading';

    try {
      if (onSave) {
        await onSave();

        // Settings are now saved locally AND synced to cloud by onSave (saveSettings in parent).
        // We can just finish up.
        success = 'Settings saved and uploaded.';
        toastStore.success('Settings saved and synced to cloud');
        onSettingsUpload();
        location.reload();
        return;
      }

      // Fallback if no onSave provided
      const settings = await invoke<any>('get_settings_subset', {
        keys: [
          'shortcuts',
          'feeds',
          'weather_enabled',
          'weather_city',
          'weather_country',
          'reminders_enabled',
          'force_use_location',
          'accent_color',
          'theme',
          'disable_school_picture',
          'enhanced_animations',
          'gemini_api_key',
          'ai_integrations_enabled',
          'grade_analyser_enabled',
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

      await cloudSettingsService.syncSettings(settings);

      success = 'Settings successfully uploaded to cloud';
      toastStore.success('Settings successfully uploaded to cloud');
      onSettingsUpload();
    } catch (err) {
      error = `Failed to upload settings: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toastStore.error('Failed to upload settings to cloud');
    } finally {
      loading = false;
      operation = '';
    }
  }

  async function downloadSettings() {
    if (!isAuthenticated) {
      error = 'Please authenticate first';
      return;
    }

    loading = true;
    error = '';
    success = '';
    operation = 'downloading';

    try {
      const cloudSettings = await cloudSettingsService.getSettings();

      if (!cloudSettings) {
        throw new Error('No settings found in cloud');
      }

      // Save the downloaded settings using the existing backend command
      // We might need to ensure the format matches what 'save_settings_merge' expects.
      // The guide says 'settings' object.

      // If the cloud settings are wrapped in a 'data' property or similar, we might need to unwrap.
      // Assuming cloudSettings IS the settings object.

      await invoke('save_settings_merge', {
        patch: cloudSettings,
      });

      success = 'Settings successfully downloaded from cloud';
      toastStore.success('Settings successfully downloaded from cloud');
      onSettingsDownload(cloudSettings);
      
      // Reload the page to apply the new settings
      setTimeout(() => {
        location.reload();
      }, 500);
    } catch (err) {
      error = `Failed to download settings: ${err instanceof Error ? err.message : 'Unknown error'}`;
      toastStore.error('Failed to download settings from cloud');
    } finally {
      loading = false;
      operation = '';
    }
  }

  function closeModal() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}>
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/50 backdrop-blur-xs"
      role="button"
      tabindex="0"
      on:click={closeModal}
      on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    </div>

    <!-- Modal -->
    <div
      class="relative w-full max-w-md bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700"
      transition:fly={{ y: 20, duration: 200 }}>
      <!-- Header -->
      <div
        class="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">Cloud Sync</h2>
        <button
          class="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-200"
          on:click={closeModal}>
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Authentication Status -->
        {#if isAuthenticated && cloudUser}
          <div
            class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Icon src={User} class="w-5 h-5 text-green-500 shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-medium text-green-700 dark:text-green-300">
                {cloudUser.displayName || cloudUser.username}
              </p>
              <p class="text-xs text-green-600 dark:text-green-400">
                @{cloudUser.username}
              </p>
            </div>
            <button
              class="p-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors duration-200"
              on:click={logout}
              title="Logout">
              <Icon src={ArrowRightOnRectangle} class="w-4 h-4" />
            </button>
          </div>
        {:else}
          <!-- Authentication -->
          <div class="space-y-3">
            <div>
              <label
                for="email"
                class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                bind:value={email}
                placeholder="email@example.com"
                class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors duration-200" />
            </div>
            <div>
              <label
                for="password"
                class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                bind:value={password}
                placeholder="••••••••"
                class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                on:keydown={(e) => e.key === 'Enter' && authenticate()} />
            </div>

            <p class="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              <a
                href="https://accounts.betterseqta.org"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline">
                Create a free account
              </a> if you don't have one yet.
            </p>
            
            <!-- Discord OAuth Button -->
            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-[#5865F2] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={handleDiscordLogin}
              disabled={loading}>
              {#if loading && operation === 'authenticating'}
                <div
                  class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin">
                </div>
                Connecting...
              {:else}
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Sign in with Discord
              {/if}
            </button>

            <!-- Divider -->
            <div class="flex items-center gap-3 my-3">
              <div class="flex-1 h-px bg-zinc-300 dark:bg-zinc-600"></div>
              <span class="text-xs text-zinc-500 dark:text-zinc-400">or</span>
              <div class="flex-1 h-px bg-zinc-300 dark:bg-zinc-600"></div>
            </div>

            <!-- Email/Password Login Button -->
            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={authenticate}
              disabled={loading}>
              {#if loading && operation === 'authenticating'}
                <div
                  class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin">
                </div>
                Authenticating...
              {:else}
                <Icon src={User} class="w-5 h-5" />
                Login with Email
              {/if}
            </button>
          </div>
        {/if}

        <!-- Error/Success Messages -->
        {#if error}
          <div
            class="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <Icon src={ExclamationTriangle} class="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        {/if}

        {#if success}
          <div
            class="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Icon src={CheckCircle} class="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            <p class="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        {/if}

        <!-- Info -->
        <div
          class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Icon src={InformationCircle} class="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div class="text-sm text-blue-700 dark:text-blue-300">
            <p class="font-medium mb-1">About Cloud Sync</p>
            <p>
              Sync your DesQTA settings across devices using BetterSEQTA Plus account cloud syncing.
              Your settings are encrypted and secure.
              <a
                href="https://accounts.betterseqta.org"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 dark:text-blue-400 hover:underline">
                Create a free account
              </a> to get started.
            </p>
          </div>
        </div>

        <!-- Actions -->
        {#if isAuthenticated}
          <div class="flex flex-col gap-3">
            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={uploadSettings}
              disabled={loading}>
              {#if loading && operation === 'uploading'}
                <div
                  class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin">
                </div>
                Uploading...
              {:else}
                <Icon src={CloudArrowUp} class="w-5 h-5" />
                Upload Settings to Cloud
              {/if}
            </button>

            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={downloadSettings}
              disabled={loading}>
              {#if loading && operation === 'downloading'}
                <div
                  class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin">
                </div>
                Downloading...
              {:else}
                <Icon src={CloudArrowDown} class="w-5 h-5" />
                Download Settings from Cloud
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
