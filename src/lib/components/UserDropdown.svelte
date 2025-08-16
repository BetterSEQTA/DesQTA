<script lang="ts">
  import { Icon, ArrowRightOnRectangle } from 'svelte-hero-icons';
  import { fly } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { getRandomDicebearAvatar } from '../../utils/netUtil';
  import { onMount } from 'svelte';

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

  interface Props {
    userInfo: UserInfo;
    showUserDropdown: boolean;
    onToggleUserDropdown: () => void;
    onLogout: () => void;
    onShowAbout: () => void;
    onClickOutside: (event: MouseEvent) => void;
    disableSchoolPicture?: boolean;
  }

  let {
    userInfo,
    showUserDropdown,
    onToggleUserDropdown,
    onLogout,
    onShowAbout,
    onClickOutside,
    disableSchoolPicture = false
  }: Props = $props();

  let devSensitiveInfoHider = $state(false);
  let randomAvatarUrl = $state('');

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['dev_sensitive_info_hider'] });
      devSensitiveInfoHider = subset?.dev_sensitive_info_hider ?? false;
      if (devSensitiveInfoHider) {
        randomAvatarUrl = getRandomDicebearAvatar();
      }
    } catch (e) {
      devSensitiveInfoHider = false;
    }
  });

  // Refresh avatar if the setting flips while open
  async function refreshSensitiveAvatar() {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['dev_sensitive_info_hider'] });
      const newVal = subset?.dev_sensitive_info_hider ?? false;
      if (newVal && !devSensitiveInfoHider) {
        randomAvatarUrl = getRandomDicebearAvatar();
      }
      devSensitiveInfoHider = newVal;
    } catch {}
  }

  // Close dropdown when userInfo becomes undefined (logout)
  $effect(() => {
    if (!userInfo) {
      showUserDropdown = false;
    }
  });
</script>

<div class="relative user-dropdown-container">
  <button
    class="flex gap-3 items-center px-4 py-2 rounded-xl border transition-all duration-200 bg-white/60 border-slate-200/40 hover:accent-bg dark:bg-slate-800/60 dark:border-slate-700/40 dark:hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
    onclick={onToggleUserDropdown}
    aria-label="User menu"
    tabindex="0">
    {#if devSensitiveInfoHider && randomAvatarUrl}
      <img
        src={randomAvatarUrl}
        alt="Random avatar"
        class="object-cover w-8 h-8 rounded-full border-2 shadow-sm border-white/60 dark:border-slate-600/60" />
    {:else if !disableSchoolPicture && userInfo.profilePicture}
      <img
        src={userInfo.profilePicture}
        alt=""
        class="object-cover w-8 h-8 rounded-full border-2 shadow-sm border-white/60 dark:border-slate-600/60" />
    {:else}
      <div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-white font-bold text-base border-2 shadow-sm border-white/60 dark:border-slate-600/60">
        {userInfo.displayName ? userInfo.displayName[0] : userInfo.userName[0]}
      </div>
    {/if}
    <span class="hidden font-semibold text-slate-900 md:inline dark:text-white">
      {userInfo.userDesc || userInfo.userName}
    </span>
  </button>
  {#if showUserDropdown}
    <div
      class="absolute right-0 z-50 mt-3 w-56 rounded-2xl border shadow-2xl backdrop-blur-md bg-white/95 border-slate-200/60 dark:bg-slate-900/50 dark:border-slate-700/40"
      transition:fly={{ y: -8, duration: 200, opacity: 0 }}>
      <div class="p-2">
        <button
          class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 text-slate-700 hover:accent-bg hover:text-white dark:text-slate-200 group"
          onclick={() => {
            onToggleUserDropdown();
            onShowAbout();
          }}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-slate-100 group-hover:bg-white/20 dark:bg-slate-700/50">
            <svg
              class="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="flex-1">
            <div class="font-medium">About</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/80">App information</div>
          </div>
        </button>

        <div class="my-2 border-t border-slate-200 dark:border-slate-700/40"></div>

        <button
          class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 text-slate-700 hover:accent-bg hover:text-white dark:text-slate-200 group"
          onclick={() => {
            onToggleUserDropdown();
            onLogout();
          }}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-slate-100 group-hover:bg-white/20 dark:bg-slate-700/50">
            <Icon
              src={ArrowRightOnRectangle}
              class="w-4 h-4 text-slate-600 dark:text-slate-400 group-hover:text-white" />
          </div>
          <div class="flex-1">
            <div class="font-medium">Sign out</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 group-hover:text-white/80">End your session</div>
          </div>
        </button>

        <div class="my-2 border-t border-slate-200 dark:border-slate-700/40"></div>

        <button
          class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 text-red-600 hover:bg-red-500 hover:text-white dark:text-red-400 group"
          onclick={() => {
            onToggleUserDropdown();
            // Call the quit command
            invoke('quit');
          }}>
          <div
            class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-red-100 group-hover:bg-red-500/20 dark:bg-red-900/30">
            <svg
              class="w-4 h-4 text-red-600 dark:text-red-400 group-hover:text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
          </div>
          <div class="flex-1">
            <div class="font-medium">Quit DesQTA</div>
            <div class="text-xs text-red-500 dark:text-red-400 group-hover:text-white/80">Close the application</div>
          </div>
        </button>
      </div>
    </div>
  {/if}
</div>