<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import { Icon } from 'svelte-hero-icons';
  import {
    Minus,
    Square2Stack,
    XMark,
    QrCode,
    Camera,
    ArrowUpTray,
    QuestionMarkCircle,
    UserCircle,
    ArrowRight,
  } from 'svelte-hero-icons';
  import { authService } from '$lib/services/authService';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { tick } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { Input, Button } from '$lib/components/ui';
  import Modal from '$lib/components/Modal.svelte';

  // Remove jsQR import and add html5-qrcode import
  import { Html5Qrcode } from 'html5-qrcode';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { invalidateDevSensitiveInfoHiderCache } from '../../utils/netUtil';
  import { get } from 'svelte/store';
  import T from './T.svelte';
  import LanguageSelector from './LanguageSelector.svelte';
  import { _ } from '../i18n';

  interface Props {
    seqtaUrl: string;
    onStartLogin: () => void;
    onUrlChange: (url: string) => void;
  }

  let { seqtaUrl, onStartLogin, onUrlChange }: Props = $props();

  const appWindow = Window.getCurrent();

  let qrProcessing = $state(false);
  let qrError = $state('');
  let qrSuccess = $state('');
  let jwtExpiredError = $state(false);
  let showLiveScan = $state(false);
  let liveScanError = $state('');
  let html5QrLive: Html5Qrcode | null = null;
  let isMobile = $state(false);
  let loginMethod = $state<'url' | 'qr' | 'direct'>('url'); // Default to manual URL for desktop
  let directUsername = $state('');
  let directPassword = $state('');
  let directSeqtaUrl = $state('');
  let directLoginError = $state('');
  let directLoginLoading = $state(false);
  let mobileSsoUrl = $state(''); // For manual SSO URL entry on mobile
  let showMobileSsoInput = $state(false); // Toggle for mobile SSO URL input
  let showPreviewModal = $state(false);
  let selectedPreview = $state<string | null>(null);
  let showQrInstructionsModal = $state(false);
  let showDevToggle = $state(false);
  let devSensitiveInfoHider = $state(false);
  let devKeyBuffer = '';
  let showManualAuthInstructions = $state(false);
  let profiles = $state<
    Array<{
      id: string;
      base_url: string;
      user_id: number;
      display_name: string | null;
      created_at: number;
    }>
  >([]);
  let loadingProfiles = $state(false);
  let profilesKey = $derived(profiles.length + profiles.map((p) => p.id).join(','));
  let profilesReadyToAnimate = $state(false);

  async function loadProfiles() {
    try {
      loadingProfiles = true;
      const profilesList = await invoke<
        Array<{
          id: string;
          base_url: string;
          user_id: number;
          display_name: string | null;
          created_at: number;
        }>
      >('list_profiles');
      profiles = profilesList;
      // Delay animation trigger to ensure component is visible after loading screen
      setTimeout(() => {
        profilesReadyToAnimate = true;
      }, 300);
    } catch (e) {
      console.error('Failed to load profiles:', e);
      profiles = [];
      setTimeout(() => {
        profilesReadyToAnimate = true;
      }, 300);
    } finally {
      loadingProfiles = false;
    }
  }

  // Reset animation state when profiles change
  $effect(() => {
    if (profiles.length > 0 && !loadingProfiles) {
      profilesReadyToAnimate = false;
      setTimeout(() => {
        profilesReadyToAnimate = true;
      }, 300);
    }
  });

  async function selectProfile(profile: {
    id: string;
    base_url: string;
    user_id: number;
    display_name: string | null;
    created_at: number;
  }) {
    try {
      // Note: app handle is passed automatically by Tauri
      await invoke('switch_profile', { profileId: profile.id });
      // Set the URL to the profile's base_url
      onUrlChange(profile.base_url);

      // Show instructions overlay for manual auth when profile is selected
      showManualAuthInstructions = true;

      // Check for session completion or window closure to hide overlay
      const checkSessionInterval = setInterval(async () => {
        try {
          const sessionExists = await authService.checkSession();
          if (sessionExists) {
            showManualAuthInstructions = false;
            clearInterval(checkSessionInterval);
            return;
          }

          // Check if login window still exists
          const hasWindows = await invoke<boolean>('has_login_windows');
          if (!hasWindows) {
            // Window was closed, hide overlay
            showManualAuthInstructions = false;
            clearInterval(checkSessionInterval);
          }
        } catch {
          // Ignore errors
        }
      }, 1000);

      // Clean up after 5 minutes
      setTimeout(
        () => {
          clearInterval(checkSessionInterval);
          if (showManualAuthInstructions) {
            showManualAuthInstructions = false;
          }
        },
        5 * 60 * 1000,
      );

      // Start login with this profile's URL
      onStartLogin();
    } catch (e) {
      console.error('Failed to switch profile:', e);
      alert(`Failed to switch profile: ${e}`);
    }
  }

  function formatProfileName(profile: { base_url: string; display_name: string | null }): string {
    if (profile.display_name) {
      return profile.display_name;
    }
    try {
      const url = new URL(profile.base_url);
      return url.hostname.replace('www.', '');
    } catch {
      return profile.base_url;
    }
  }

  onMount(() => {
    (async () => {
      try {
        const subset = await invoke<any>('get_settings_subset', {
          keys: ['dev_sensitive_info_hider'],
        });
        devSensitiveInfoHider = subset?.dev_sensitive_info_hider ?? false;
      } catch {}
    })();
    loadProfiles();
    const checkMobile = () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
      if (tauri_platform == 'ios' || tauri_platform == 'android') {
        isMobile = true;
        loginMethod = 'qr'; // Default to QR on mobile
      } else {
        isMobile = false;
        loginMethod = 'url'; // Default to manual URL on desktop
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    const handleKeydown = (e: KeyboardEvent) => {
      const char = e.key?.toLowerCase();
      if (!char || char.length !== 1 || !/[a-z]/.test(char)) return;
      devKeyBuffer = (devKeyBuffer + char).slice(-3);
      if (devKeyBuffer === 'dev') {
        showDevToggle = true;
      }
    };
    window.addEventListener('keydown', handleKeydown);

    // Auto-maximize window on login screen load (desktop only)
    if (!isMobile) {
      // Add a small delay to ensure window is ready, then force maximize
      setTimeout(async () => {
        try {
          console.log('Attempting to maximize window...');
          await appWindow.maximize();
          console.log('Window maximize command sent');

          // Double-check after a brief moment
          setTimeout(async () => {
            try {
              const isMaximized = await appWindow.isMaximized();
              console.log('Window maximized state after attempt:', isMaximized);
            } catch (e) {
              console.log('Could not check maximized state:', e);
            }
          }, 200);
        } catch (err) {
          console.error('Failed to maximize window:', err);
        }
      }, 300);
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  // Global error handler to catch JWT expiration errors
  function handleGlobalError(event: ErrorEvent) {
    if (
      event.error &&
      typeof event.error === 'string' &&
      event.error.includes('JWT token has expired')
    ) {
      jwtExpiredError = true;
      qrError = '';
      qrSuccess = '';
      qrProcessing = false;
    }
  }

  // Add global error listener
  if (typeof window !== 'undefined') {
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', (event) => {
      if (
        event.reason &&
        typeof event.reason === 'string' &&
        event.reason.includes('JWT token has expired')
      ) {
        jwtExpiredError = true;
        qrError = '';
        qrSuccess = '';
        qrProcessing = false;
      }
    });
  }

  // Remove old QR file input logic and add new handler using html5-qrcode
  async function handleQrFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    // Always clear error/success/expired state on new file selection
    qrError = '';
    qrSuccess = '';
    jwtExpiredError = false;
    const file = input.files[0];
    console.debug('[QR] File selected:', file.name, 'type:', file.type, 'size:', file.size);
    qrProcessing = true;
    try {
      console.debug('[QR] Starting scan...');
      const html5Qr = new Html5Qrcode('qr-reader-temp');
      const qrCodeData = await html5Qr.scanFile(file, true);
      await html5Qr.clear();
      if (qrCodeData) {
        console.debug('[QR] Scan success:', qrCodeData);
        qrSuccess = get(_)('login.qr_success');
        onUrlChange(qrCodeData);
        onStartLogin();
      } else {
        console.warn('[QR] No QR code found in the image.');
        qrError = get(_)('login.qr_no_code');
      }
    } catch (err) {
      console.error('[QR] Failed to scan QR code:', err);
      let errorMsg = get(_)('login.qr_error_generic');
      if (err && typeof err === 'object' && 'message' in err) {
        errorMsg += ' ' + (err as any).message;
      } else if (typeof err === 'string') {
        errorMsg += ' ' + err;
      }
      qrError = errorMsg;
    } finally {
      // Reset file input value so user can re-select the same file
      if (input) input.value = '';
      console.debug('[QR] Scan finished.');
      qrProcessing = false;
    }
  }

  async function startLiveScan() {
    liveScanError = '';
    jwtExpiredError = false;
    // Check for available cameras before opening modal
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        liveScanError = get(_)('login.camera_error');
        showLiveScan = true;
        return;
      }
    } catch (err) {
      liveScanError = get(_)('login.camera_permission');
      showLiveScan = true;
      return;
    }
    showLiveScan = true;
    await tick(); // Wait for modal DOM
    try {
      html5QrLive = new Html5Qrcode('qr-reader-live');
      await html5QrLive.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 300, height: 300 } },
        (decodedText) => {
          qrSuccess = get(_)('login.qr_success');
          onUrlChange(decodedText);
          onStartLogin();
          stopLiveScan();
        },
        (err) => {
          // Optionally log scan errors
        },
      );
    } catch (err) {
      liveScanError =
        get(_)('login.live_scan_error') +
        (err && typeof err === 'object' && 'message' in err ? (err as any).message : err);
      console.error('[QR] Live scan error:', err);
    }
  }

  async function stopLiveScan() {
    if (html5QrLive) {
      await html5QrLive.stop();
      await html5QrLive.clear();
      html5QrLive = null;
    }
    showLiveScan = false;
  }

  function openPreviewModal(previewType: string) {
    selectedPreview = previewType;
    showPreviewModal = true;
  }

  function closePreviewModal() {
    showPreviewModal = false;
    selectedPreview = null;
  }

  function openQrInstructionsModal() {
    showQrInstructionsModal = true;
  }

  function closeQrInstructionsModal() {
    showQrInstructionsModal = false;
  }

  function normalizeSeqtaUrlInput(inputValue: string): string {
    let value = (inputValue ?? '').trim();

    // If multiple protocols were prepended (e.g., "https://https://..." or "https://http://..."),
    // collapse to the last protocol the user entered
    const multiProto = value.match(/^(?:https?:\/\/)*(https?:\/\/)(.*)$/i);
    if (multiProto) {
      return multiProto[1] + multiProto[2];
    }

    // If user is in the middle of typing a protocol, avoid auto-prepending
    if (
      /^https?:?$/i.test(value) ||
      /^https?:\/?$/i.test(value) ||
      /^https?:\/\/?>?$/i.test(value) ||
      /^http/i.test(value)
    ) {
      return value;
    }

    // If no protocol provided, default to https://
    if (value && !/^https?:\/\//i.test(value)) {
      value = 'https://' + value;
    }

    return value;
  }

  async function handleDirectLogin() {
    if (!directSeqtaUrl.trim() || !directUsername.trim() || !directPassword.trim()) {
      directLoginError = get(_)('login.fill_all_fields');
      return;
    }

    directLoginError = '';
    directLoginLoading = true;

    try {
      await invoke('direct_login', {
        baseUrl: directSeqtaUrl.trim(),
        username: directUsername.trim(),
        password: directPassword.trim(),
      });
      // Success - app will reload automatically
    } catch (error) {
      console.error('[DIRECT_LOGIN] Failed:', error);
      directLoginError = typeof error === 'string' ? error : get(_)('login.failed_credentials');
      directLoginLoading = false;
    }
  }
</script>

<div
  class="flex flex-col h-full relative {isMobile
    ? 'overflow-y-auto'
    : 'overflow-hidden'} bg-gradient-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-800">
  <!-- Window Controls Bar -->
  <div
    class="relative flex justify-between items-center px-6 py-3 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-b border-white/20 dark:border-zinc-700/30 z-10 {isMobile
      ? 'shrink-0'
      : ''}"
    data-tauri-drag-region>
    <!-- Draggable area with branding -->
    <div class="flex items-center space-x-3" data-tauri-drag-region>
      <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="w-8 h-8 invert dark:invert-0" />
      <h1 class="text-xl font-bold text-zinc-800 dark:text-white">
        <T key="login.app_name" fallback="DesQTA" />
      </h1>
    </div>

    <!-- Language selector for login screen -->
    <div class="flex items-center space-x-3">
      <LanguageSelector compact={true} />
    </div>

    <!-- Window Controls -->
    {#if !isMobile}
      <div class="flex items-center space-x-1" data-tauri-drag-region>
        <button
          class="flex justify-center items-center w-10 h-10 rounded-full transition-all duration-200 ease-in-out transform hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={() => appWindow.minimize()}
          aria-label="Minimize">
          <Icon src={Minus} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          class="flex justify-center items-center w-10 h-10 rounded-full transition-all duration-200 ease-in-out transform hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={() => appWindow.toggleMaximize()}
          aria-label="Maximize">
          <Icon src={Square2Stack} class="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
        </button>
        <button
          class="flex justify-center items-center w-10 h-10 rounded-full transition-all duration-200 ease-in-out transform group hover:bg-red-500/90 hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onclick={() => appWindow.close()}
          aria-label="Close">
          <Icon
            src={XMark}
            class="w-4 h-4 transition duration-200 text-zinc-600 dark:text-zinc-400 group-hover:text-white" />
        </button>
      </div>
    {/if}
  </div>

  <!-- Login Content -->
  <div
    class="relative flex justify-center items-center {isMobile
      ? 'p-4 min-h-0 flex-1'
      : 'p-8 flex-1'} z-10 {isMobile ? 'overflow-y-auto' : ''}">
    <!-- Static geometric background pattern -->
    {#if !isMobile}
      <div class="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
        <div
          class="absolute top-0 left-0 w-full h-full"
          style="background-image: radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0); background-size: 40px 40px;">
        </div>
      </div>
    {/if}

    <div class="w-full {isMobile ? 'max-w-md' : 'max-w-5xl'}">
      <!-- Main Login Card -->
      <div
        class="relative overflow-hidden {isMobile
          ? 'rounded-2xl'
          : 'rounded-3xl'} bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/40 dark:border-zinc-700/40 shadow-2xl login-card-animate"
        transition:scale={{ duration: 400, start: 0.95, easing: cubicInOut }}>
        <!-- Static Background -->
        <div
          class="absolute inset-0 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-800 {isMobile
            ? 'rounded-2xl'
            : 'rounded-3xl'}">
        </div>

        <!-- Subtle accent overlay -->
        <div
          class="absolute inset-0 opacity-5 dark:opacity-10 {isMobile
            ? 'rounded-2xl'
            : 'rounded-3xl'}">
          <div
            class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 {isMobile
              ? 'rounded-2xl'
              : 'rounded-3xl'}">
          </div>
        </div>

        <!-- Subtle border highlight -->
        <div
          class="absolute inset-0 border-2 border-indigo-200/30 dark:border-indigo-800/30 {isMobile
            ? 'rounded-2xl'
            : 'rounded-3xl'} pointer-events-none">
        </div>

        <div class="relative flex flex-col {isMobile ? '' : 'lg:flex-row'}">
          <!-- Left side - Hero Section -->
          {#if !isMobile}
            <div
              class="lg:w-1/3 pt-12 pb-12 pl-12 pr-4 flex flex-col justify-center relative overflow-hidden">
              <div class="space-y-6">
                <div class="space-y-3">
                  <h1
                    class="text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white leading-tight">
                    <T key="login.welcome_to" fallback="Welcome to" /><br /><span
                      class="text-indigo-600 dark:text-indigo-400"
                      ><T key="login.app_name" fallback="DesQTA" /></span>
                  </h1>
                  <p class="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    <T
                      key="login.subtitle"
                      fallback="Experience SEQTA Learn like never before with our powerful, modern desktop application" />
                  </p>
                </div>

                <!-- Static feature highlight -->
                <div class="flex items-center space-x-3 pt-2">
                  <div class="flex items-center space-x-2 text-zinc-600 dark:text-zinc-300">
                    <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span class="text-base font-medium">
                      <T key="login.secure_login" fallback="Secure • Fast • Modern" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Right side - Login Form and Profiles -->
          <div
            class="{isMobile ? 'w-full p-6' : 'lg:w-2/3 p-10'} flex {isMobile
              ? 'flex-col'
              : 'flex-row'} gap-6">
            <!-- Login Options (Left side) -->
            <div class="flex-1 flex flex-col justify-center {isMobile ? '' : 'px-6'}">
              {#if isMobile}
                <!-- Mobile Title -->
                <div class="text-center space-y-4 mb-8">
                  <h1 class="text-3xl font-bold text-zinc-900 dark:text-white">
                    <T key="login.welcome_to" fallback="Welcome to" />
                    <span class="text-indigo-600 dark:text-indigo-400"
                      ><T key="login.app_name" fallback="DesQTA" /></span>
                  </h1>
                  <p class="text-zinc-600 dark:text-zinc-300">
                    <T
                      key="login.subtitle_mobile"
                      fallback="Experience SEQTA Learn like never before" />
                  </p>
                </div>
              {/if}

              <!-- Mobile: Show profiles above login options -->
              {#if isMobile && profiles.length > 0}
                <div class="space-y-4 mb-6">
                  <div class="text-center space-y-1">
                    <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                      <T key="login.available_profiles" fallback="Available Profiles" />
                    </h3>
                    <p class="text-sm text-zinc-600 dark:text-zinc-400">
                      <T
                        key="login.select_profile_to_login"
                        fallback="Select a profile to continue" />
                    </p>
                  </div>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    {#key profilesKey}
                      {#each profiles as profile, i (profile.id)}
                        <button
                          type="button"
                          class="flex gap-3 items-center px-4 py-3 w-full text-left rounded-xl transition-all duration-200 ease-in-out transform bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 hover:bg-white/20 dark:hover:bg-zinc-800/20 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 hover:scale-[1.01] active:scale-[0.99] group"
                          class:profile-card-animate={profilesReadyToAnimate}
                          style="animation-delay: {profilesReadyToAnimate ? i * 50 : 0}ms;"
                          onclick={() => selectProfile(profile)}>
                          <div
                            class="flex justify-center items-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                            <Icon
                              src={UserCircle}
                              class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="font-medium text-zinc-900 dark:text-white truncate">
                              {formatProfileName(profile)}
                            </div>
                            <div class="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                              {profile.base_url}
                            </div>
                          </div>
                          <Icon
                            src={ArrowRight}
                            class="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                        </button>
                      {/each}
                    {/key}
                  </div>
                  <div class="flex items-center">
                    <div
                      class="flex-1 h-px bg-linear-to-r from-transparent via-zinc-300 dark:via-zinc-600 to-transparent">
                    </div>
                    <span class="px-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium"
                      ><T key="login.or" fallback="or" /></span>
                    <div
                      class="flex-1 h-px bg-linear-to-r from-transparent via-zinc-300 dark:via-zinc-600 to-transparent">
                    </div>
                  </div>
                </div>
              {/if}

              <div class="space-y-8">
                <!-- Login method toggle -->
                {#if !isMobile}
                  <div class="flex items-center justify-center">
                    <div
                      class="flex p-1 bg-white/15 dark:bg-zinc-800/20 backdrop-blur-xl rounded-2xl relative overflow-hidden border border-white/20 dark:border-zinc-700/20">
                      <!-- Animated background slider -->
                      <div
                        class="absolute top-1 bottom-1 bg-white/30 dark:bg-zinc-700/40 backdrop-blur-xl rounded-xl shadow-xs transition-all duration-300 ease-in-out border border-white/40 dark:border-zinc-600/40"
                        style="left: {loginMethod === 'qr'
                          ? '4px'
                          : loginMethod === 'url'
                            ? 'calc(33.333% - 4px)'
                            : 'calc(66.666% - 4px)'}; width: calc(33.333% - 4px); transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
                      </div>
                      <button
                        class="px-4 py-3 rounded-xl font-medium transition-all duration-200 ease-in-out relative z-10 transform hover:scale-105 active:scale-95 {loginMethod ===
                        'qr'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'}"
                        onclick={() => (loginMethod = 'qr')}>
                        <Icon
                          src={QrCode}
                          class="w-5 h-5 inline mr-2 transition-transform duration-200 ease-in-out {loginMethod ===
                          'qr'
                            ? 'scale-110'
                            : ''}" />
                        <T key="login.qr_code" fallback="QR Code" />
                      </button>
                      <button
                        class="px-4 py-3 rounded-xl font-medium transition-all duration-200 ease-in-out relative z-10 transform hover:scale-105 active:scale-95 {loginMethod ===
                        'url'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'}"
                        onclick={() => (loginMethod = 'url')}>
                        <T key="login.manual_url" fallback="Manual URL" />
                      </button>
                      <button
                        class="px-4 py-3 rounded-xl font-medium transition-all duration-200 ease-in-out relative z-10 transform hover:scale-105 active:scale-95 {loginMethod ===
                        'direct'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'}"
                        onclick={() => (loginMethod = 'direct')}>
                        <T key="login.direct_login" fallback="Direct Login" />
                      </button>
                    </div>
                  </div>
                {:else}
                  <!-- Mobile: Toggle link to switch to manual SSO URL -->
                  {#if loginMethod === 'qr' && !showMobileSsoInput}
                    <div class="text-center">
                      <button
                        type="button"
                        onclick={() => (showMobileSsoInput = true)}
                        class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 rounded-sm transition-all duration-200">
                        <T key="login.enter_sso_url_manually" fallback="Enter SSO URL manually" />
                      </button>
                    </div>
                  {/if}
                {/if}

                <!-- Content Container with Height Animation -->
                <div
                  class="transition-all duration-500 ease-in-out overflow-hidden"
                  style="height: {isMobile && showMobileSsoInput
                    ? '200px'
                    : loginMethod === 'qr'
                      ? '350px'
                      : loginMethod === 'direct'
                        ? '380px'
                        : '200px'}; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
                  <!-- Mobile SSO URL Input -->
                  {#if isMobile && showMobileSsoInput}
                    <div class="space-y-6">
                      <div class="text-center space-y-2">
                        <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">
                          <T key="login.manual_sso_login" fallback="Manual SSO Login" />
                        </h2>
                        <p class="text-zinc-600 dark:text-zinc-400">
                          <T
                            key="login.enter_sso_deeplink"
                            fallback="Enter your SSO deeplink URL" />
                        </p>
                      </div>

                      <div class="space-y-4">
                        <div class="relative px-4">
                          <Input
                            type="text"
                            bind:value={mobileSsoUrl}
                            onkeydown={(e: KeyboardEvent) => {
                              if (
                                e.key === 'Enter' &&
                                mobileSsoUrl.trim().startsWith('seqtalearn://')
                              ) {
                                jwtExpiredError = false;
                                onUrlChange(mobileSsoUrl.trim());
                                onStartLogin();
                              }
                            }}
                            placeholder={$_('login.sso_url_placeholder', {
                              default: 'seqtalearn://sso/...',
                            })}
                            inputClass="w-full py-4 px-6 text-base bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 rounded-2xl text-zinc-900 dark:text-white placeholder:text-base placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 focus:bg-white/20 dark:focus:bg-zinc-800/20" />
                        </div>
                        <div class="text-center">
                          <button
                            type="button"
                            onclick={() => {
                              showMobileSsoInput = false;
                              mobileSsoUrl = '';
                            }}
                            class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 rounded-sm transition-all duration-200">
                            <T key="login.use_qr_code" fallback="Use QR code instead" />
                          </button>
                        </div>
                      </div>
                    </div>
                  {:else if loginMethod === 'qr'}
                    <div class="space-y-2 px-2">
                      <div class="text-center space-y-1 -mt-2">
                        <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">
                          <T key="login.quick_login" fallback="Quick Login" />
                        </h2>
                        <p class="text-zinc-600 dark:text-zinc-400">
                          <T
                            key="login.qr_description"
                            fallback="Scan your SEQTA QR code to sign in instantly" />
                        </p>
                      </div>

                      <!-- QR Code upload area -->
                      <div class="relative">
                        <input
                          id="qr-upload"
                          type="file"
                          accept="image/*"
                          class="hidden"
                          onchange={handleQrFileInput} />
                        <label
                          for="qr-upload"
                          class="flex flex-col items-center justify-center w-full h-[10.6rem] border-2 border-dashed border-indigo-300/60 dark:border-indigo-600/60 rounded-2xl cursor-pointer bg-white/5 dark:bg-zinc-800/5 backdrop-blur-xl hover:bg-white/15 dark:hover:bg-zinc-800/15 transition-all duration-200 ease-in-out transform group hover:border-indigo-400/80 dark:hover:border-indigo-500/80 hover:scale-[1.02] active:scale-[0.98]">
                          <div class="flex flex-col items-center space-y-4">
                            <div
                              class="p-4 bg-white/15 dark:bg-zinc-800/20 backdrop-blur-xl rounded-full group-hover:scale-110 transition-transform duration-200 ease-in-out border border-white/20 dark:border-zinc-700/20">
                              <Icon
                                src={ArrowUpTray}
                                class="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div class="text-center">
                              <p class="text-lg font-medium text-indigo-700 dark:text-indigo-300">
                                <T key="login.upload_qr" fallback="Upload QR Code" />
                              </p>
                              <p class="text-sm text-indigo-600 dark:text-indigo-400">
                                <T
                                  key="login.click_browse"
                                  fallback="Click to browse or drag & drop" />
                              </p>
                            </div>
                          </div>
                        </label>
                      </div>

                      <!-- Divider -->
                      <div class="flex items-center">
                        <div
                          class="flex-1 h-px bg-linear-to-r from-transparent via-zinc-300 dark:via-zinc-600 to-transparent">
                        </div>
                        <span class="px-2 text-sm text-zinc-500 dark:text-zinc-400 font-medium"
                          ><T key="login.or" fallback="or" /></span>
                        <div
                          class="flex-1 h-px bg-linear-to-r from-transparent via-zinc-300 dark:via-zinc-600 to-transparent">
                        </div>
                      </div>

                      <!-- Live scan button -->
                      <Button
                        variant="secondary"
                        size="lg"
                        fullWidth={true}
                        icon={Camera}
                        onclick={startLiveScan}
                        class="py-3 px-6 bg-linear-to-r from-orange-200 to-pink-200 hover:from-orange-300 hover:to-pink-300 text-zinc-700 dark:text-zinc-800 font-semibold rounded-2xl shadow-lg hover:shadow-xl">
                        <T key="login.scan_camera" fallback="Scan with Camera" />
                      </Button>

                      <!-- Inline help link under scan button -->
                      <div class="text-center">
                        <button
                          type="button"
                          onclick={openQrInstructionsModal}
                          class="mt-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 rounded-sm">
                          <T key="login.how_get_qr" fallback="How do I get a QR code?" />
                        </button>
                      </div>
                    </div>
                  {/if}

                  <!-- Manual URL Method -->
                  {#if loginMethod === 'url'}
                    <div class="space-y-6">
                      <div class="text-center space-y-2">
                        <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">
                          <T key="login.manual_login" fallback="Manual Login" />
                        </h2>
                        <p class="text-zinc-600 dark:text-zinc-400">
                          <T key="login.enter_url" fallback="Enter your school's SEQTA URL" />
                        </p>
                      </div>

                      <div class="space-y-4">
                        <div class="relative px-4">
                          <Input
                            type="text"
                            bind:value={seqtaUrl}
                            oninput={(e) => {
                              const el = e.target as HTMLInputElement;
                              const normalized = normalizeSeqtaUrlInput(el.value);
                              if (el.value !== normalized) {
                                el.value = normalized;
                              }
                              onUrlChange(normalized);
                            }}
                            onkeydown={(e: KeyboardEvent) => {
                              if (e.key === 'Enter' && seqtaUrl.trim()) {
                                jwtExpiredError = false;
                                onStartLogin();
                              }
                            }}
                            placeholder={$_('login.url_placeholder', {
                              default: 'school.seqta.com.au',
                            })}
                            inputClass="w-full py-4 px-6 text-base bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 rounded-2xl text-zinc-900 dark:text-white placeholder:text-base placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 focus:bg-white/20 dark:focus:bg-zinc-800/20" />
                        </div>
                        {#if isMobile}
                          <div class="text-center">
                            <button
                              type="button"
                              onclick={() => (loginMethod = 'qr')}
                              class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 rounded-sm transition-all duration-200">
                              <T key="login.use_qr_code" fallback="Use QR code instead" />
                            </button>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- Direct Login Method -->
                  {#if loginMethod === 'direct'}
                    <div class="space-y-3 px-2">
                      <div class="text-center space-y-1">
                        <h2 class="text-xl font-bold text-zinc-900 dark:text-white">
                          <T key="login.direct_login_title" fallback="Direct Login" />
                        </h2>
                        <p class="text-xs text-zinc-600 dark:text-zinc-400">
                          <T
                            key="login.direct_login_description"
                            fallback="Enter your credentials directly (last resort method)" />
                        </p>
                      </div>

                      <div
                        class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                        <div class="flex items-start space-x-2">
                          <Icon
                            src={QuestionMarkCircle}
                            class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                            <T
                              key="login.direct_login_warning"
                              fallback="Your credentials will be stored securely and encrypted. Use this method only if QR code or browser login fails." />
                          </p>
                        </div>
                      </div>

                      <div class="space-y-2.5">
                        <div class="relative">
                          <Input
                            type="text"
                            bind:value={directSeqtaUrl}
                            oninput={(e) => {
                              const el = e.target as HTMLInputElement;
                              const normalized = normalizeSeqtaUrlInput(el.value);
                              if (el.value !== normalized) {
                                el.value = normalized;
                              }
                              directSeqtaUrl = normalized;
                            }}
                            placeholder={$_('login.url_placeholder', {
                              default: 'school.seqta.com.au',
                            })}
                            inputClass="w-full py-2.5 px-4 text-sm bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 rounded-lg text-zinc-900 dark:text-white placeholder:text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 focus:bg-white/20 dark:focus:bg-zinc-800/20" />
                        </div>
                        <div class="relative">
                          <Input
                            type="text"
                            bind:value={directUsername}
                            placeholder={$_('login.username_placeholder', {
                              default: 'Username',
                            })}
                            inputClass="w-full py-2.5 px-4 text-sm bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 rounded-lg text-zinc-900 dark:text-white placeholder:text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 focus:bg-white/20 dark:focus:bg-zinc-800/20" />
                        </div>
                        <div class="relative">
                          <Input
                            type="password"
                            bind:value={directPassword}
                            onkeydown={(e: KeyboardEvent) => {
                              if (
                                e.key === 'Enter' &&
                                directSeqtaUrl.trim() &&
                                directUsername.trim() &&
                                directPassword.trim()
                              ) {
                                handleDirectLogin();
                              }
                            }}
                            placeholder={$_('login.password_placeholder', {
                              default: 'Password',
                            })}
                            inputClass="w-full py-2.5 px-4 text-sm bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 rounded-lg text-zinc-900 dark:text-white placeholder:text-sm placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 focus:bg-white/20 dark:focus:bg-zinc-800/20" />
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Status Messages -->
                {#if qrProcessing}
                  <div
                    class="flex items-center justify-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 status-message-animate"
                    transition:scale={{ duration: 200, start: 0.95, easing: cubicInOut }}>
                    <div
                      class="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
                      style="animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
                    </div>
                    <span class="text-blue-700 dark:text-blue-300 font-medium"
                      ><T key="login.processing_qr" fallback="Processing QR code..." /></span>
                  </div>
                {/if}

                {#if qrSuccess}
                  <div
                    class="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 status-message-animate"
                    transition:scale={{ duration: 200, start: 0.95, easing: cubicInOut }}>
                    <div class="flex items-center space-x-3">
                      <div
                        class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd" />
                        </svg>
                      </div>
                      <span class="text-green-700 dark:text-green-300 font-medium"
                        ><T
                          key="login.qr_success"
                          fallback="QR code scanned successfully!" /></span>
                    </div>
                  </div>
                {/if}

                {#if qrError}
                  <div
                    class="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 status-message-animate"
                    transition:scale={{ duration: 200, start: 0.95, easing: cubicInOut }}>
                    <div class="flex items-center space-x-3">
                      <div class="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                      </div>
                      <span class="text-red-700 dark:text-red-300 font-medium">{qrError}</span>
                    </div>
                  </div>
                {/if}

                {#if showDevToggle}
                  <div
                    class="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                    <div class="flex items-center justify-between">
                      <div class="text-sm text-purple-800 dark:text-purple-200 font-medium">
                        Mock API backend
                      </div>
                      <label class="inline-flex items-center cursor-pointer relative">
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          bind:checked={devSensitiveInfoHider}
                          onchange={async () => {
                            try {
                              await invoke('save_settings_merge', {
                                patch: { dev_sensitive_info_hider: devSensitiveInfoHider },
                              });
                              invalidateDevSensitiveInfoHiderCache();
                              setTimeout(() => location.reload(), 150);
                            } catch (e) {
                              console.warn('Failed to toggle mock API backend', e);
                            }
                          }} />
                        <div
                          class="w-11 h-6 bg-purple-200 peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer dark:bg-purple-800 peer-checked:after:translate-x-full peer-checked:rtl:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500">
                        </div>
                      </label>
                    </div>
                    <p class="mt-2 text-xs text-purple-700 dark:text-purple-300">
                      Replaces live SEQTA API calls with safe mock data.
                    </p>
                  </div>
                {/if}

                {#if jwtExpiredError}
                  <div
                    class="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                    <div class="flex items-start space-x-4">
                      <div
                        class="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd" />
                        </svg>
                      </div>
                      <div class="space-y-2">
                        <h3 class="font-semibold text-amber-800 dark:text-amber-200">
                          QR Code Expired
                        </h3>
                        <p class="text-amber-700 dark:text-amber-300">
                          The QR code from your mobile login email has expired. Please request a new
                          QR code and try again.
                        </p>
                      </div>
                    </div>
                  </div>
                {/if}

                {#if directLoginError}
                  <div
                    class="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 status-message-animate"
                    transition:scale={{ duration: 200, start: 0.95, easing: cubicInOut }}>
                    <div class="flex items-center space-x-3">
                      <div class="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clip-rule="evenodd" />
                        </svg>
                      </div>
                      <span class="text-red-700 dark:text-red-300 font-medium"
                        >{directLoginError}</span>
                    </div>
                  </div>
                {/if}

                {#if directLoginLoading}
                  <div
                    class="flex items-center justify-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 status-message-animate"
                    transition:scale={{ duration: 200, start: 0.95, easing: cubicInOut }}>
                    <div
                      class="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"
                      style="animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);">
                    </div>
                    <span class="text-blue-700 dark:text-blue-300 font-medium"
                      ><T key="login.processing_login" fallback="Logging in..." /></span>
                  </div>
                {/if}

                <!-- Sign In Button -->
                {#if loginMethod === 'direct'}
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth={true}
                    onclick={handleDirectLogin}
                    disabled={directLoginLoading ||
                      !directSeqtaUrl.trim() ||
                      !directUsername.trim() ||
                      !directPassword.trim()}
                    class="py-3 px-6 bg-linear-to-r from-orange-200 to-pink-200 hover:from-orange-300 hover:to-pink-300 disabled:from-zinc-300 disabled:to-zinc-400 text-zinc-700 dark:text-zinc-800 disabled:text-zinc-500 font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-200 transform hover:scale-105 active:scale-95">
                    <T key="login.sign_in" fallback="Sign In to DesQTA" />
                  </Button>
                {:else}
                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth={true}
                    onclick={() => {
                      jwtExpiredError = false;
                      if (isMobile && showMobileSsoInput && mobileSsoUrl.trim()) {
                        // Use the manually entered SSO URL
                        onUrlChange(mobileSsoUrl.trim());
                      }
                      // Show instructions overlay for manual auth
                      if (loginMethod === 'url') {
                        showManualAuthInstructions = true;

                        // Check for session completion or window closure to hide overlay
                        const checkSessionInterval = setInterval(async () => {
                          try {
                            const sessionExists = await authService.checkSession();
                            if (sessionExists) {
                              showManualAuthInstructions = false;
                              clearInterval(checkSessionInterval);
                              return;
                            }

                            // Check if login window still exists
                            const hasWindows = await invoke<boolean>('has_login_windows');
                            if (!hasWindows) {
                              // Window was closed, hide overlay
                              showManualAuthInstructions = false;
                              clearInterval(checkSessionInterval);
                            }
                          } catch {
                            // Ignore errors
                          }
                        }, 1000);

                        // Clean up after 5 minutes
                        setTimeout(
                          () => {
                            clearInterval(checkSessionInterval);
                            if (showManualAuthInstructions) {
                              showManualAuthInstructions = false;
                            }
                          },
                          5 * 60 * 1000,
                        );
                      }
                      onStartLogin();
                    }}
                    disabled={jwtExpiredError ||
                      (loginMethod === 'url' && !seqtaUrl.trim()) ||
                      (loginMethod === 'qr' &&
                        !qrSuccess &&
                        !(
                          isMobile &&
                          showMobileSsoInput &&
                          mobileSsoUrl.trim().startsWith('seqtalearn://')
                        ))}
                    class="py-4 px-6 bg-linear-to-r from-orange-200 to-pink-200 hover:from-orange-300 hover:to-pink-300 disabled:from-zinc-300 disabled:to-zinc-400 text-zinc-700 dark:text-zinc-800 disabled:text-zinc-500 font-semibold rounded-2xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-200 transform hover:scale-105 active:scale-95">
                    <T key="login.sign_in" fallback="Sign In to DesQTA" />
                  </Button>
                {/if}

                <!-- Help Link -->
                <div class="text-center">
                  <p class="text-sm text-zinc-600 dark:text-zinc-400">
                    <T key="login.need_help" fallback="Need help?" />
                    <a
                      href="https://github.com/betterseqta/desqta"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-all duration-300 hover:underline decoration-2 underline-offset-2">
                      <T key="login.visit_github" fallback="Visit our GitHub" />
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <!-- Profiles Sidebar (Right side) -->
            {#if !isMobile && profiles.length > 0}
              <div class="w-64 flex flex-col border-l border-white/20 dark:border-zinc-700/20 pl-6">
                <div class="space-y-3 mb-4">
                  <h3 class="text-lg font-semibold text-zinc-900 dark:text-white">
                    <T key="login.available_profiles" fallback="Available Profiles" />
                  </h3>
                  <p class="text-sm text-zinc-600 dark:text-zinc-400">
                    <T
                      key="login.select_profile_to_login"
                      fallback="Select a profile to continue" />
                  </p>
                </div>
                <div class="flex flex-col gap-2 overflow-y-auto overflow-x-hidden flex-1 pr-1">
                  {#key profilesKey}
                    {#each profiles as profile, i (profile.id)}
                      <button
                        type="button"
                        class="flex gap-3 items-center px-4 py-3 text-left rounded-xl transition-all duration-200 ease-in-out transform bg-white/10 dark:bg-zinc-800/10 backdrop-blur-xl border border-white/20 dark:border-zinc-700/20 hover:bg-white/20 dark:hover:bg-zinc-800/20 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 hover:scale-[1.01] active:scale-[0.99] group"
                        class:profile-card-animate={profilesReadyToAnimate}
                        style="animation-delay: {profilesReadyToAnimate ? i * 50 : 0}ms;"
                        onclick={() => selectProfile(profile)}>
                        <div
                          class="flex justify-center items-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors shrink-0">
                          <Icon
                            src={UserCircle}
                            class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-medium text-zinc-900 dark:text-white truncate text-sm">
                            {formatProfileName(profile)}
                          </div>
                          <div class="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                            {profile.base_url}
                          </div>
                        </div>
                        <Icon
                          src={ArrowRight}
                          class="w-5 h-5 text-zinc-400 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0" />
                      </button>
                    {/each}
                  {/key}
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Live Scan Modal -->
  {#if showLiveScan}
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-black/60">
      <div
        class="bg-white/10 dark:bg-zinc-900/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 border border-white/30 dark:border-zinc-700/20">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">
            <T key="login.live_scanner" fallback="Live QR Scanner" />
          </h2>
          <button
            class="p-2 rounded-full bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xs hover:bg-white/30 dark:hover:bg-zinc-800/40 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 border border-white/30 dark:border-zinc-700/30"
            onclick={stopLiveScan}
            aria-label="Close live scan modal">
            <Icon src={XMark} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
        </div>

        <div class="relative">
          <div
            id="qr-reader-live"
            class="w-full h-80 rounded-2xl overflow-hidden bg-black border-4 border-indigo-200 dark:border-indigo-800">
          </div>
          <div
            class="absolute inset-0 border-2 border-indigo-500 rounded-2xl pointer-events-none animate-pulse">
          </div>
        </div>

        {#if liveScanError}
          <div
            class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
            <p class="text-red-700 dark:text-red-300 font-medium">{liveScanError}</p>
          </div>
        {/if}

        <p class="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <T key="login.position_qr" fallback="Position the QR code within the frame to scan" />
        </p>
      </div>
    </div>
  {/if}

  <!-- Preview Modal -->
  {#if showPreviewModal && selectedPreview}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-black/70"
      transition:fade={{ duration: 300, easing: cubicInOut }}>
      <div
        class="relative w-full max-w-4xl mx-8"
        transition:fly={{ y: 50, duration: 500, easing: cubicInOut }}
        style="transform-origin: center;">
        <!-- Close Button -->
        <button
          class="absolute -top-12 right-0 p-3 rounded-full bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl hover:bg-white/30 dark:hover:bg-zinc-800/40 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-white/50 focus:ring-offset-2 border border-white/30 dark:border-zinc-700/30 z-10"
          onclick={closePreviewModal}
          aria-label="Close preview modal">
          <Icon src={XMark} class="w-6 h-6 text-white" />
        </button>

        <!-- Modal Content -->
        <div
          class="bg-white/10 dark:bg-zinc-900/20 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-zinc-700/20 shadow-2xl p-8">
          {#if selectedPreview === 'header'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                Application Header
              </h2>
              <div
                class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
                <div class="flex items-center justify-between h-16 px-6">
                  <div class="flex items-center space-x-4">
                    <div class="relative">
                      <div class="w-8 h-8 bg-indigo-400 rounded-full"></div>
                      <div
                        class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white">
                      </div>
                    </div>
                    <div class="w-32 h-6 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm"></div>
                  </div>
                  <div class="flex space-x-3">
                    <div class="w-12 h-6 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm"></div>
                    <div class="w-12 h-6 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm"></div>
                  </div>
                </div>
              </div>
              <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                The application header contains navigation controls, branding, and user account
                access. It stays fixed at the top of the interface for easy access to core
                functionality.
              </p>
            </div>
          {:else if selectedPreview === 'sidebar'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                Navigation Sidebar
              </h2>
              <div
                class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
                <div class="space-y-4">
                  {#each [{ icon: 'indigo-400', label: $_('navigation.dashboard'), desc: $_( 'login.feature_dashboard_desc', { default: 'Main overview' }, ) }, { icon: 'purple-400', label: $_('navigation.assessments'), desc: $_( 'login.feature_assessments_desc', { default: 'View assignments' }, ) }, { icon: 'pink-400', label: $_('navigation.timetable'), desc: $_( 'login.feature_timetable_desc', { default: 'Class schedule' }, ) }, { icon: 'blue-400', label: $_('navigation.analytics'), desc: $_( 'login.feature_analytics_desc', { default: 'Performance data' }, ) }, { icon: 'green-400', label: $_('navigation.settings'), desc: $_( 'login.feature_settings_desc', { default: 'App preferences' }, ) }] as item}
                    <div class="flex items-center space-x-4">
                      <div class="w-8 h-8 bg-{item.icon} rounded-sm"></div>
                      <div class="flex-1">
                        <div class="w-24 h-4 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm mb-1">
                        </div>
                        <div class="w-16 h-3 bg-zinc-300/30 dark:bg-zinc-600/30 rounded-sm"></div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
              <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                The sidebar provides quick navigation between different sections of DesQTA. Each
                item shows an icon, label, and takes you to the corresponding feature area.
              </p>
            </div>
          {:else if selectedPreview === 'assessment'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">Assessment Card</h2>
              <div
                class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30 border-l-8 border-l-green-400">
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div class="w-32 h-4 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm"></div>
                    <div class="w-20 h-6 bg-green-400/80 rounded-sm"></div>
                  </div>
                  <div class="w-48 h-6 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm"></div>
                  <div class="w-32 h-4 bg-zinc-300/30 dark:bg-zinc-600/30 rounded-sm"></div>
                  <div class="w-40 h-3 bg-zinc-300/20 dark:bg-zinc-600/20 rounded-sm"></div>
                </div>
              </div>
              <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Assessment cards display key information about assignments including due dates,
                status, and subject details. The colored left border indicates the subject category.
              </p>
            </div>
          {:else if selectedPreview === 'timetable'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                Weekly Timetable
              </h2>
              <div
                class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
                <div class="space-y-4">
                  <div class="grid grid-cols-6 gap-2 mb-4">
                    <div class="text-center text-xs text-zinc-600 dark:text-zinc-400">Time</div>
                    <div class="text-center text-xs text-zinc-600 dark:text-zinc-400">Mon</div>
                    <div class="text-center text-xs text-zinc-600 dark:text-zinc-400">Tue</div>
                    <div
                      class="text-center text-xs text-zinc-600 dark:text-zinc-400 bg-indigo-400/20 rounded-sm px-2 py-1">
                      Wed (Today)
                    </div>
                    <div class="text-center text-xs text-zinc-600 dark:text-zinc-400">Thu</div>
                    <div class="text-center text-xs text-zinc-600 dark:text-zinc-400">Fri</div>
                  </div>
                  <div class="grid grid-cols-6 gap-2 h-32">
                    <div
                      class="flex flex-col justify-between text-xs text-zinc-500 dark:text-zinc-400">
                      <span>9:00</span>
                      <span>10:00</span>
                      <span>11:00</span>
                      <span>12:00</span>
                    </div>
                    {#each Array(5) as _, dayIdx}
                      <div class="relative">
                        {#if dayIdx === 0}
                          <div
                            class="absolute top-2 left-0 right-0 h-8 bg-purple-400/60 rounded-sm border-l-2 border-purple-500 p-1">
                            <div class="text-xs text-white font-medium">Math</div>
                          </div>
                        {:else if dayIdx === 1}
                          <div
                            class="absolute top-4 left-0 right-0 h-12 bg-blue-400/60 rounded-sm border-l-2 border-blue-500 p-1">
                            <div class="text-xs text-white font-medium">Science</div>
                          </div>
                        {:else if dayIdx === 2}
                          <div
                            class="absolute top-0 left-0 right-0 h-6 bg-indigo-500/80 rounded-sm border-l-2 border-indigo-600 p-1 shadow-md">
                            <div class="text-xs text-white font-medium">English</div>
                          </div>
                          <div
                            class="absolute top-8 left-0 right-0 h-8 bg-pink-400/60 rounded-sm border-l-2 border-pink-500 p-1">
                            <div class="text-xs text-white font-medium">History</div>
                          </div>
                        {:else if dayIdx === 3}
                          <div
                            class="absolute top-6 left-0 right-0 h-10 bg-orange-400/60 rounded-sm border-l-2 border-orange-500 p-1">
                            <div class="text-xs text-white font-medium">Art</div>
                          </div>
                        {:else if dayIdx === 4}
                          <div
                            class="absolute top-2 left-0 right-0 h-12 bg-red-400/60 rounded-sm border-l-2 border-red-500 p-1">
                            <div class="text-xs text-white font-medium">PE</div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
              <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                The timetable shows your weekly class schedule with color-coded subjects. Today's
                column is highlighted, and each lesson block shows the subject name, time, and
                teacher information.
              </p>
            </div>
          {:else if selectedPreview === 'dashboard'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                Dashboard Widget
              </h2>
              <div
                class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
                <div class="space-y-4">
                  <div class="flex items-center space-x-4 mb-6">
                    <div
                      class="w-10 h-10 bg-linear-to-r from-indigo-400 to-purple-400 rounded-full">
                    </div>
                    <div class="w-32 h-6 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm"></div>
                  </div>
                  <div class="space-y-3">
                    <div class="w-full h-4 bg-zinc-300/40 dark:bg-zinc-600/40 rounded-sm"></div>
                    <div class="w-4/5 h-4 bg-zinc-300/40 dark:bg-zinc-600/40 rounded-sm"></div>
                    <div class="w-3/5 h-4 bg-zinc-300/40 dark:bg-zinc-600/40 rounded-sm"></div>
                    <div class="w-2/3 h-3 bg-zinc-300/30 dark:bg-zinc-600/30 rounded-sm"></div>
                  </div>
                </div>
              </div>
              <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Dashboard widgets provide quick access to important information like upcoming
                assignments, recent grades, or daily schedules. Each widget has a distinct icon and
                organized content layout.
              </p>
            </div>
          {:else if selectedPreview === 'analytics'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
                Analytics Dashboard
              </h2>
              <div
                class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
                <div class="space-y-4">
                  <div class="w-32 h-6 bg-zinc-300/50 dark:bg-zinc-600/50 rounded-sm mb-6"></div>
                  <div class="flex items-end justify-between h-32 space-x-2">
                    {#each [{ height: 'h-16', color: 'indigo-400' }, { height: 'h-24', color: 'purple-400' }, { height: 'h-12', color: 'pink-400' }, { height: 'h-20', color: 'blue-400' }, { height: 'h-28', color: 'green-400' }, { height: 'h-10', color: 'orange-400' }, { height: 'h-18', color: 'red-400' }, { height: 'h-22', color: 'teal-400' }] as bar}
                      <div class="w-6 {bar.height} bg-{bar.color}/60 rounded-sm"></div>
                    {/each}
                  </div>
                </div>
              </div>
              <p class="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                The analytics section provides visual insights into your academic performance with
                interactive charts and graphs. Track progress across subjects and identify areas for
                improvement.
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Manual Auth Instructions Overlay -->
  {#if showManualAuthInstructions}
    <div
      class="fixed inset-0 z-9999 flex items-center justify-end backdrop-blur-sm bg-black/80 pr-8"
      transition:fade={{ duration: 200, easing: cubicInOut }}
      role="button"
      tabindex="0"
      onclick={(e) => {
        // Close overlay when clicking backdrop
        if (e.target === e.currentTarget) {
          showManualAuthInstructions = false;
        }
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && e.target === e.currentTarget)) {
          showManualAuthInstructions = false;
        }
      }}>
      <div
        class="relative bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 dark:border-zinc-700/40 p-8 max-w-2xl"
        transition:scale={{ duration: 200, easing: cubicInOut }}>
        <!-- Close Button -->
        <button
          class="absolute top-6 right-6 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-in-out transform hover:scale-110 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
          onclick={() => (showManualAuthInstructions = false)}
          aria-label="Close instructions">
          <Icon src={XMark} class="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <div class="space-y-6">
          <div class="text-center space-y-2 pr-10">
            <h2 class="text-2xl font-bold text-zinc-900 dark:text-white">
              <T key="login.manual_auth_title" fallback="Manual Authentication" />
            </h2>
            <p class="text-zinc-600 dark:text-zinc-400">
              <T
                key="login.manual_auth_description"
                fallback="A login window has been opened. Please follow the instructions below." />
            </p>
          </div>

          <div
            class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-6">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  <T key="login.login_as_normal" fallback="Login as per normal" />
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300">
                  <T
                    key="login.login_as_normal_desc"
                    fallback="Use your usual SEQTA credentials to log in through the opened window." />
                </p>
              </div>
            </div>
          </div>

          <div
            class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  <T
                    key="login.wait_for_close"
                    fallback="Wait for the window to close automatically" />
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300">
                  <T
                    key="login.wait_for_close_desc"
                    fallback="Once you've successfully logged in, the window will close automatically and you'll be signed in to DesQTA." />
                </p>
              </div>
            </div>
          </div>

          <div
            class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <div class="flex items-start space-x-3">
              <Icon
                src={QuestionMarkCircle}
                class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p class="text-sm text-amber-700 dark:text-amber-300">
                <T
                  key="login.manual_auth_note"
                  fallback="Note: Do not close the login window manually. It will close automatically once authentication is complete." />
              </p>
            </div>
          </div>

          <div
            class="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl p-5">
            <div class="flex items-start space-x-3">
              <Icon
                src={QuestionMarkCircle}
                class="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div class="flex-1">
                <h3 class="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-2">
                  <T key="login.not_working" fallback="Not Working?" />
                </h3>
                <p class="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                  <T
                    key="login.try_direct_login"
                    fallback="If the browser login window isn't working, try the Direct Login method instead. It allows you to enter your credentials directly." />
                </p>
                <button
                  type="button"
                  onclick={() => {
                    showManualAuthInstructions = false;
                    loginMethod = 'direct';
                  }}
                  class="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                  <T key="login.switch_to_direct" fallback="Switch to Direct Login" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- QR Instructions Modal (standardized) -->
  <Modal
    bind:open={showQrInstructionsModal}
    ariaLabel="How to Get Your QR Code"
    onclose={closeQrInstructionsModal}>
    <div class="p-8 max-h-[80vh] overflow-y-auto">
      <div class="space-y-6">
        <div class="text-center space-y-2">
          <h2 class="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
            How to Get Your QR Code
          </h2>
          <p class="text-zinc-600 dark:text-zinc-300">
            Follow these steps to get your SEQTA mobile app QR code
          </p>
        </div>

        <div class="space-y-6">
          <div
            class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Open SEQTA in Your Browser
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300">
                  Go to your school's SEQTA URL (e.g., <code
                    class="bg-zinc-200/50 dark:bg-zinc-700/50 px-2 py-1 rounded-sm text-sm"
                    >yourschool.seqta.com.au</code
                  >) and log in with your usual credentials.
                </p>
              </div>
            </div>
          </div>

          <div
            class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Navigate to Settings
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300">
                  Once logged in, look for the <strong>Settings</strong> section. This is usually found
                  on the left sidebar.
                </p>
              </div>
            </div>
          </div>

          <div
            class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Click "Connect Mobile App"
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300">
                  Find and click the <strong>"Connect Mobile App"</strong> or
                  <strong>"Mobile Device"</strong> option. This will initiate the mobile app connection
                  process.
                </p>
              </div>
            </div>
          </div>

          <div
            class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Check Your Email
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300 mb-3">
                  SEQTA will send an email to your registered school email address. This email
                  contains the QR code you need for DesQTA.
                </p>
                <div
                  class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p class="text-sm text-amber-700 dark:text-amber-300">
                    <strong>Note:</strong> The email might take a few minutes to arrive. Check your spam/junk
                    folder if you don't see it.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                5
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Screenshot or Save the QR Code
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300 mb-3">
                  Open the email and take a screenshot of the QR code, or save the QR code image to
                  your device.
                </p>
                <div class="space-y-2">
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">
                    <strong>Desktop:</strong> Right-click the QR code → "Save image as..."
                  </p>
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">
                    <strong>Mobile:</strong> Long press the QR code → "Save to Photos" or take a screenshot
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            class="bg-white/20 dark:bg-zinc-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-zinc-700/30">
            <div class="flex items-start space-x-4">
              <div
                class="shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                6
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  Upload to DesQTA
                </h3>
                <p class="text-zinc-600 dark:text-zinc-300">
                  Return to DesQTA and use the "Upload QR Code" button to select and upload your
                  saved QR code image. DesQTA will automatically log you in!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <h3 class="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Need More Help?
          </h3>
          <p class="text-blue-700 dark:text-blue-300 text-sm mb-3">
            If you can't find the "Connect Mobile App" option, it might be called something
            different at your school, such as:
          </p>
          <ul class="text-sm text-blue-600 dark:text-blue-300 space-y-1 ml-4">
            <li>• "Mobile Device Registration"</li>
            <li>• "App Setup"</li>
            <li>• "QR Code Setup"</li>
            <li>• "Connect Device"</li>
          </ul>
          <p class="text-sm text-blue-700 dark:text-blue-300 mt-3">
            Contact your school's IT support if you still can't locate this option.
          </p>
        </div>

        <div class="text-center">
          <Button
            variant="primary"
            size="lg"
            onclick={closeQrInstructionsModal}
            class="py-3 px-8 bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200">
            Got it, thanks!
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</div>

<div id="qr-reader-temp" style="display:none;"></div>

<style>
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

  .login-card-animate {
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .profile-card-animate {
    opacity: 0;
    animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .status-message-animate {
    animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>
