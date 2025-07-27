<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
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
    ArrowRightOnRectangle
  } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';

  const dispatch = createEventDispatcher();

  export let show = false;
  export let onSettingsUpload: () => void = () => {};
  export let onSettingsDownload: (settings: any) => void = () => {};

  let token = '';
  let loading = false;
  let error = '';
  let success = '';
  let operation = '';
  let cloudUser: any = null;
  let isAuthenticated = false;

  onMount(async () => {
    await checkAuthentication();
  });

  async function checkAuthentication() {
    try {
      const result = await invoke<{ user: any; token: string | null }>('get_cloud_user');
      if (result && result.user && result.token) {
        cloudUser = result.user;
        isAuthenticated = true;
      }
    } catch (err) {
      // User not authenticated, that's fine
      cloudUser = null;
      isAuthenticated = false;
    }
  }

  async function authenticate() {
    if (!token.trim()) {
      error = 'Please enter your authentication token';
      return;
    }

    loading = true;
    error = '';
    success = '';
    operation = 'authenticating';

    try {
      const result = await invoke<{ user: any; token: string }>('save_cloud_token', { token: token.trim() });
      cloudUser = result.user;
      isAuthenticated = true;
      success = 'Successfully authenticated with BetterSEQTA Plus account';
      token = ''; // Clear the token input for security
    } catch (err) {
      error = `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      loading = false;
      operation = '';
    }
  }

  async function logout() {
    try {
      await invoke('clear_cloud_token');
      cloudUser = null;
      isAuthenticated = false;
      success = 'Successfully logged out';
    } catch (err) {
      error = `Logout failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
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
      await invoke('upload_settings_to_cloud');
      
      success = 'Settings successfully uploaded to cloud';
      onSettingsUpload();
    } catch (err) {
      error = `Failed to upload settings: ${err instanceof Error ? err.message : 'Unknown error'}`;
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
      const cloudSettings = await invoke('download_settings_from_cloud');
      
      // Save the downloaded settings
      await invoke('save_settings_from_json', {
        json: JSON.stringify(cloudSettings)
      });

      success = 'Settings successfully downloaded from cloud';
      onSettingsDownload(cloudSettings);
    } catch (err) {
      error = `Failed to download settings: ${err instanceof Error ? err.message : 'Unknown error'}`;
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
    transition:fade={{ duration: 200 }}
  >
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      on:click={closeModal}
    ></div>

    <!-- Modal -->
    <div 
      class="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700"
      transition:fly={{ y: 20, duration: 200 }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          Cloud Sync
        </h2>
        <button
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
          on:click={closeModal}
        >
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Authentication Status -->
        {#if isAuthenticated && cloudUser}
          <div class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Icon src={User} class="w-5 h-5 text-green-500 flex-shrink-0" />
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
              title="Logout"
            >
              <Icon src={ArrowRightOnRectangle} class="w-4 h-4" />
            </button>
          </div>
        {:else}
          <!-- Authentication -->
          <div>
            <label for="token" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Authentication Token
            </label>
            <input
              id="token"
              type="password"
              bind:value={token}
              placeholder="Enter your BetterSEQTA Plus account token"
              class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            />
            <p class="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Get your token from your BetterSEQTA Plus account settings. 
              <a href="https://accounts.betterseqta.org" target="_blank" rel="noopener noreferrer" 
                 class="text-blue-600 dark:text-blue-400 hover:underline">
                Create a free account
              </a> if you don't have one yet.
            </p>
            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 mt-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={authenticate}
              disabled={loading}
            >
              {#if loading && operation === 'authenticating'}
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Authenticating...
              {:else}
                <Icon src={User} class="w-5 h-5" />
                Authenticate
              {/if}
            </button>
          </div>
        {/if}

        <!-- Error/Success Messages -->
        {#if error}
          <div class="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <Icon src={ExclamationTriangle} class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p class="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        {/if}

        {#if success}
          <div class="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Icon src={CheckCircle} class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <p class="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        {/if}

        <!-- Info -->
        <div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Icon src={InformationCircle} class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div class="text-sm text-blue-700 dark:text-blue-300">
            <p class="font-medium mb-1">About Cloud Sync</p>
            <p>Sync your DesQTA settings across devices using BetterSEQTA Plus account cloud syncing. Your settings are encrypted and secure. 
            <a href="https://accounts.betterseqta.org" target="_blank" rel="noopener noreferrer" 
               class="text-blue-600 dark:text-blue-400 hover:underline">
              Create a free account
            </a> to get started.</p>
          </div>
        </div>

        <!-- Actions -->
        {#if isAuthenticated}
          <div class="flex flex-col gap-3">
            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={uploadSettings}
              disabled={loading}
            >
              {#if loading && operation === 'uploading'}
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Uploading...
              {:else}
                <Icon src={CloudArrowUp} class="w-5 h-5" />
                Upload Settings to Cloud
              {/if}
            </button>

            <button
              class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={downloadSettings}
              disabled={loading}
            >
              {#if loading && operation === 'downloading'}
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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