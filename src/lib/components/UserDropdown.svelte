<script lang="ts">
  import { Icon, ArrowRightOnRectangle, BookOpen } from 'svelte-hero-icons';
  import { fly } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { goto } from '$app/navigation';
  import { getRandomDicebearAvatar } from '../../utils/netUtil';
  import { onMount } from 'svelte';
  import ProfileSwitcher from './ProfileSwitcher.svelte';
  import { _ } from '../i18n';
  import T from './T.svelte';

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
    disableSchoolPicture = false,
  }: Props = $props();

  let devSensitiveInfoHider = $state(false);
  let randomAvatarUrl = $state('');
  let customProfilePicture = $state<string | null>(null);
  let customProfilePictureError = $state(false);
  let randomAvatarError = $state(false);
  let schoolPictureError = $state(false);

  // Load custom profile picture
  async function loadCustomProfilePicture() {
    try {
      const dataUrl = await invoke<string | null>('get_profile_picture_data_url');
      customProfilePicture = dataUrl;
    } catch (e) {
      customProfilePicture = null;
    }
  }

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['dev_sensitive_info_hider'],
      });
      devSensitiveInfoHider = subset?.dev_sensitive_info_hider ?? false;
      if (devSensitiveInfoHider) {
        randomAvatarUrl = getRandomDicebearAvatar();
      }
    } catch (e) {
      devSensitiveInfoHider = false;
    }

    // Load custom profile picture
    await loadCustomProfilePicture();
  });

  // Close dropdown when userInfo becomes undefined (logout)
  $effect(() => {
    if (!userInfo) {
      showUserDropdown = false;
    }
  });
</script>

<div class="relative user-dropdown-container">
  <button
    data-onboarding="user-dropdown"
    class="flex gap-3 items-center px-4 py-2 rounded-xl border transition-all duration-200 bg-white/60 border-zinc-200/40 hover:accent-bg dark:bg-zinc-800/60 dark:border-zinc-700/40 dark:hover:bg-zinc-800/80 focus:outline-hidden focus:ring-2 focus:ring-zinc-500/50"
    onclick={onToggleUserDropdown}
    aria-label={$_('user.user_menu') || 'User menu'}
    tabindex="0">
    {#if customProfilePicture && !customProfilePictureError}
      <img
        src={customProfilePicture}
        alt=""
        onerror={() => (customProfilePictureError = true)}
        class="object-cover w-8 h-8 rounded-full border-2 shadow-xs border-white/60 dark:border-zinc-600/60" />
    {:else if devSensitiveInfoHider && randomAvatarUrl && !randomAvatarError}
      <img
        src={randomAvatarUrl}
        alt=""
        onerror={() => (randomAvatarError = true)}
        class="object-cover w-8 h-8 rounded-full border-2 shadow-xs border-white/60 dark:border-zinc-600/60" />
    {:else if !disableSchoolPicture && userInfo.profilePicture && !schoolPictureError}
      <img
        src={userInfo.profilePicture}
        alt=""
        onerror={() => (schoolPictureError = true)}
        class="object-cover w-8 h-8 rounded-full border-2 shadow-xs border-white/60 dark:border-zinc-600/60" />
    {:else}
      <div
        class="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-white font-bold text-base border-2 shadow-xs border-white/60 dark:border-zinc-600/60">
        {(userInfo.displayName || userInfo.userName || '?')[0]}
      </div>
    {/if}
    <span class="hidden font-semibold text-zinc-900 md:inline dark:text-white">
      {userInfo.userDesc || userInfo.userName}
    </span>
  </button>
  {#if showUserDropdown}
    <div
      class="absolute right-0 z-50 mt-3 w-56 rounded-2xl border shadow-2xl backdrop-blur-md bg-white/95 border-zinc-200/60 dark:bg-zinc-900/90 dark:border-zinc-700/40"
      transition:fly={{ y: -8, duration: 200, opacity: 0, easing: (t) => t * (2 - t) }}>
      <div class="p-2">
        <button
  class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 ease-in-out transform
         hover:scale-[1.02] active:scale-[0.98]
         text-zinc-700 dark:text-zinc-200
         hover:bg-zinc-800/50 dark:hover:bg-zinc-700/50
         hover:text-white dark:hover:text-white
         group"
  onclick={() => {
    onToggleUserDropdown();
    onShowAbout();
  }}>
  <div class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-zinc-100 dark:bg-zinc-700/50 group-hover:bg-white/20 dark:group-hover:bg-zinc-600/50">
    <svg class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
  </div>
  <div class="flex-1">
    <div class="font-medium"><T key="user.about" fallback="About" /></div>
    <div class="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-white/80">
      <T key="user.app_information" fallback="App information" />
    </div>
  </div>
</button>

<button
  class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 ease-in-out transform
         hover:scale-[1.02] active:scale-[0.98]
         text-zinc-700 dark:text-zinc-200
         hover:bg-zinc-800/50 dark:hover:bg-zinc-700/50
         hover:text-white dark:hover:text-white
         group"
  onclick={() => {
    onToggleUserDropdown();
    goto('/user-documentation');
  }}>
  <div class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-zinc-100 dark:bg-zinc-700/50 group-hover:bg-white/20 dark:group-hover:bg-zinc-600/50">
    <Icon src={BookOpen} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
  </div>
  <div class="flex-1">
    <div class="font-medium"><T key="user.get_help" fallback="Get Help" /></div>
    <div class="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-white/80">
      <T key="user.user_guide_faq" fallback="User guide & FAQ" />
    </div>
  </div>
</button>

<ProfileSwitcher
  onProfileSwitch={() => {
    onToggleUserDropdown();
    window.location.reload();
  }}
  class="px-2 py-1 hover:scale-[1.02] transition-all"
/>

<button
  class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 ease-in-out transform
         hover:scale-[1.02] active:scale-[0.98]
         text-zinc-700 dark:text-zinc-200
         hover:bg-zinc-800/50 dark:hover:bg-zinc-700/50
         hover:text-white dark:hover:text-white
         group"
  onclick={() => {
    onToggleUserDropdown();
    onLogout();
  }}>
  <div class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-zinc-100 dark:bg-zinc-700/50 group-hover:bg-white/20 dark:group-hover:bg-zinc-600/50">
    <Icon src={ArrowRightOnRectangle} class="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
  </div>
  <div class="flex-1">
    <div class="font-medium"><T key="user.sign_out" fallback="Sign out" /></div>
    <div class="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-white/80">
      <T key="user.end_session" fallback="End your session" />
    </div>
  </div>
</button>

<button
  class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 ease-in-out transform
         hover:scale-[1.02] active:scale-[0.98]
         text-red-600 dark:text-red-400
         hover:bg-red-900/20 dark:hover:bg-red-900/30
         hover:text-white dark:hover:text-white
         group"
  onclick={() => {
    onToggleUserDropdown();
    invoke('quit');
  }}>
  <div class="flex justify-center items-center w-8 h-8 rounded-lg transition-colors bg-red-100 dark:bg-red-900/30 group-hover:bg-red-500/20">
    <svg class="w-4 h-4 text-red-600 dark:text-red-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
    </svg>
  </div>
  <div class="flex-1">
    <div class="font-medium"><T key="user.quit_app" fallback="Quit DesQTA" /></div>
    <div class="text-xs text-red-500 dark:text-red-400 group-hover:text-white/80">
      <T key="user.close_application" fallback="Close the application" />
    </div>
    </div>
      </button>
      </div>
    </div>
  {/if}
</div>
