<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { Icon, UserCircle, Check, Plus, Trash } from 'svelte-hero-icons';
  import { fly, fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { _ } from '../i18n';

  interface Profile {
    id: string;
    base_url: string;
    user_id: number;
    display_name: string | null;
    created_at: number;
  }

  interface Props {
    onProfileSwitch?: () => void;
  }

  let { onProfileSwitch }: Props = $props();

  let profiles = $state<Profile[]>([]);
  let currentProfile = $state<Profile | null>(null);
  let loading = $state(true);
  let showSwitcher = $state(false);
  let switching = $state(false);
  let switcherContainer: HTMLDivElement;
  let showAddAccountModal = $state(false);
  let seqtaUrl = $state('');
  let addingAccount = $state(false);
  let deletingProfileId = $state<string | null>(null);

  function closeSwitcher() {
    showSwitcher = false;
  }

  async function loadProfiles() {
    try {
      loading = true;
      const [profilesList, current] = await Promise.all([
        invoke<Profile[]>('list_profiles'),
        invoke<Profile | null>('get_current_profile'),
      ]);
      profiles = profilesList;
      currentProfile = current;
    } catch (e) {
      console.error('Failed to load profiles:', e);
      profiles = [];
      currentProfile = null;
    } finally {
      loading = false;
    }
  }

  async function switchProfile(profileId: string) {
    if (switching || profileId === currentProfile?.id) return;

    try {
      switching = true;
      // Note: app handle is passed automatically by Tauri
      await invoke('switch_profile', { profileId });

      // Clear userInfo cache so it reloads for the new profile
      const { cache } = await import('../../utils/cache');
      cache.delete('userInfo');

      // Also clear IndexedDB cache
      const { idbCacheDelete } = await import('../services/idb');
      await idbCacheDelete('userInfo').catch(() => {});

      // Reload profiles to get updated current
      await loadProfiles();

      // Reload the app to switch to new profile's data
      if (onProfileSwitch) {
        onProfileSwitch();
      } else {
        // Default: reload the page
        window.location.reload();
      }
    } catch (e) {
      console.error('Failed to switch profile:', e);
      alert(`Failed to switch profile: ${e}`);
    } finally {
      switching = false;
      showSwitcher = false;
    }
  }

  function formatProfileName(profile: Profile): string {
    if (profile.display_name) {
      return profile.display_name;
    }
    // Extract domain from base_url
    try {
      const url = new URL(profile.base_url);
      return url.hostname.replace('www.', '');
    } catch {
      return profile.base_url;
    }
  }

  async function addAccount() {
    if (!seqtaUrl.trim()) {
      alert('Please enter a SEQTA URL');
      return;
    }

    try {
      addingAccount = true;
      // Clean up any existing login windows
      await invoke('cleanup_login_windows');
      // Open login window - this will create a new profile when login succeeds
      await invoke('create_login_window', { url: seqtaUrl.trim() });
      // Close modal
      showAddAccountModal = false;
      seqtaUrl = '';
      // The app will reload after successful login, so we don't need to reload profiles here
    } catch (e) {
      console.error('Failed to add account:', e);
      alert(`Failed to add account: ${e}`);
    } finally {
      addingAccount = false;
    }
  }

  function openAddAccountModal() {
    showSwitcher = false;
    showAddAccountModal = true;
    seqtaUrl = '';
    // Focus input after modal opens
    setTimeout(() => {
      const input = document.getElementById('seqta-url-input') as HTMLInputElement;
      input?.focus();
    }, 100);
  }

  function closeAddAccountModal() {
    showAddAccountModal = false;
    seqtaUrl = '';
  }

  async function deleteProfile(profileId: string, profileName: string) {
    const confirmMsg = `${$_('profile.delete_confirm', { default: 'Delete this profile?' })} ${profileName}\n\n${$_('profile.delete_warning', { default: 'All data for this account will be removed. This cannot be undone.' })}`;
    if (!confirm(confirmMsg)) return;

    try {
      deletingProfileId = profileId;
      await invoke('delete_profile', { profileId });

      const wasCurrentProfile = profileId === currentProfile?.id;
      await loadProfiles();

      if (wasCurrentProfile || profiles.length === 0) {
        if (onProfileSwitch) {
          onProfileSwitch();
        } else {
          window.location.reload();
        }
      }
    } catch (e) {
      console.error('Failed to delete profile:', e);
      alert($_('profile.delete_failed', { default: 'Failed to delete profile' }) + `: ${e}`);
    } finally {
      deletingProfileId = null;
    }
  }

  onMount(() => {
    loadProfiles();
  });
</script>

<div class="relative" bind:this={switcherContainer} use:clickOutside={closeSwitcher}>
  <button
    class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 hover:bg-zinc-800/50 hover:text-white dark:text-zinc-200 group"
    onclick={() => (showSwitcher = !showSwitcher)}
    disabled={loading}>
    <div
      class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-zinc-100 group-hover:bg-white/20 dark:bg-zinc-700/50">
      <Icon
        src={UserCircle}
        class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
    </div>
    <div class="flex-1">
      <div class="font-medium">Switch Profile</div>
      <div class="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-white/80">
        {#if loading}
          Loading...
        {:else if profiles.length <= 1}
          {profiles.length} profile
        {:else if currentProfile}
          Current: {formatProfileName(currentProfile)}
        {:else}
          Select a profile
        {/if}
      </div>
    </div>
  </button>

  {#if showSwitcher}
    <div
      role="menu"
      tabindex="-1"
      class="absolute left-0 z-50 mt-2 w-full rounded-2xl border shadow-2xl backdrop-blur-md bg-white/95 border-zinc-200/60 dark:bg-zinc-900/90 dark:border-zinc-700/40 max-h-64 overflow-y-auto"
      transition:fly={{ y: -8, duration: 200, opacity: 0 }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          showSwitcher = false;
        }
      }}>
      <div class="p-2">
        {#if profiles.length > 0}
          {#each profiles as profile (profile.id)}
            <div
              class="flex gap-3 items-center px-4 py-3 w-full rounded-xl transition-all duration-200 text-zinc-700 hover:bg-accent-500/10 hover:text-accent-600 dark:text-zinc-200 dark:hover:text-accent-400 group">
              <button
                class="flex gap-3 items-center flex-1 min-w-0 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={() => switchProfile(profile.id)}
                disabled={switching || profile.id === currentProfile?.id}>
                <div
                  class="flex justify-center items-center w-8 h-8 shrink-0 rounded-lg transition-colors bg-accent-100 group-hover:bg-accent-500/20 dark:bg-accent-900/30">
                  {#if profile.id === currentProfile?.id}
                    <Icon src={Check} class="w-4 h-4 text-accent-600 dark:text-accent-400" />
                  {:else}
                    <div class="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{formatProfileName(profile)}</div>
                  <div
                    class="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-accent-600/80 dark:group-hover:text-accent-400/80 truncate">
                    {profile.base_url}
                  </div>
                </div>
                {#if switching && profile.id !== currentProfile?.id}
                  <div
                    class="w-4 h-4 shrink-0 border-2 border-accent-600 border-t-transparent rounded-full animate-spin">
                  </div>
                {/if}
              </button>
              <button
                type="button"
                class="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-500/10 dark:hover:text-red-400 dark:hover:bg-red-500/20 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                onclick={(e) => {
                  e.stopPropagation();
                  deleteProfile(profile.id, formatProfileName(profile));
                }}
                disabled={deletingProfileId !== null}
                aria-label={$_('profile.delete_profile', { default: 'Delete profile' })}>
                {#if deletingProfileId === profile.id}
                  <div
                    class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin">
                  </div>
                {:else}
                  <Icon src={Trash} class="w-4 h-4" />
                {/if}
              </button>
            </div>
          {/each}
        {/if}

        <div class="my-2 border-t border-zinc-200 dark:border-zinc-700/40"></div>

        <button
          class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 text-zinc-700 hover:bg-accent-500/10 hover:text-accent-600 dark:text-zinc-200 dark:hover:text-accent-400 group"
          onclick={openAddAccountModal}
          disabled={addingAccount}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-accent-100 group-hover:bg-accent-500/20 dark:bg-accent-900/30">
            <Icon src={Plus} class="w-4 h-4 text-accent-600 dark:text-accent-400" />
          </div>
          <div class="flex-1">
            <div class="font-medium">Add Account</div>
            <div
              class="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-accent-600/80 dark:group-hover:text-accent-400/80">
              Sign in with another account
            </div>
          </div>
        </button>
      </div>
    </div>
  {/if}

  {#if showAddAccountModal}
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-account-title"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      transition:fade={{ duration: 200 }}
      onclick={(e) => {
        if (e.target === e.currentTarget) closeAddAccountModal();
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') closeAddAccountModal();
      }}>
      <div
        role="presentation"
        class="w-full max-w-sm rounded-xl border shadow-2xl backdrop-blur-md bg-white/95 border-zinc-200/60 dark:bg-zinc-900/90 dark:border-zinc-700/40"
        transition:fly={{ y: -8, duration: 200, opacity: 0 }}
        onclick={(e) => e.stopPropagation()}>
        <div class="p-4">
          <h2
            id="add-account-title"
            class="text-lg font-semibold text-zinc-900 dark:text-white mb-1.5">
            Add Account
          </h2>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
            Enter your SEQTA URL to sign in with another account. Your current session will remain
            active.
          </p>

          <div class="mb-3">
            <label
              for="seqta-url-input"
              class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              SEQTA URL
            </label>
            <input
              id="seqta-url-input"
              type="text"
              bind:value={seqtaUrl}
              placeholder="e.g., https://yourschool.seqta.com.au"
              class="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-200"
              onkeydown={(e) => {
                if (e.key === 'Enter' && !addingAccount) {
                  addAccount();
                }
              }}
              disabled={addingAccount} />
          </div>

          <div class="flex gap-2 justify-end">
            <button
              class="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
              onclick={closeAddAccountModal}
              disabled={addingAccount}>
              Cancel
            </button>
            <button
              class="px-3 py-1.5 text-sm rounded-lg accent-bg text-white hover:opacity-90 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onclick={addAccount}
              disabled={addingAccount || !seqtaUrl.trim()}>
              {#if addingAccount}
                <span class="flex items-center gap-1.5">
                  <span
                    class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></span>
                  Adding...
                </span>
              {:else}
                Add Account
              {/if}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
