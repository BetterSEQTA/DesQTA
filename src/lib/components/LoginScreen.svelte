<script lang="ts">
  import { Window } from '@tauri-apps/api/window';
  import { Icon } from 'svelte-hero-icons';
  import { Minus, Square2Stack, XMark, QrCode, Camera, ArrowUpTray } from 'svelte-hero-icons';
  import { authService } from '$lib/services/authService';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { theme } from '$lib/stores/theme';
  import { tick } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';

  // Remove jsQR import and add html5-qrcode import
  import { Html5Qrcode } from 'html5-qrcode';
  import { onMount } from 'svelte';

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
  let loginMethod = $state<'url' | 'qr'>('qr'); // Default to QR for modern experience
  let showPreviewModal = $state(false);
  let selectedPreview = $state<string | null>(null);
  
  // Typewriter animation state
  let currentFeatureIndex = $state(0);
  let currentText = $state('');
  let isTyping = $state(true);
  
  const features = [
    'Lightning-fast performance',
    'Seamless QR code login', 
    'Beautiful, intuitive interface',
    'Advanced analytics dashboard',
    'Real-time notifications',
    'Offline capability support',
    'Cross-platform compatibility',
    'Enhanced security features',
    'Customizable themes',
    'Smart grade predictions'
  ];

  onMount(() => {
    const checkMobile = () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM;
      if (tauri_platform == "ios" || tauri_platform == "android") {
        isMobile = true;
      } else {
        isMobile = false;
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
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
    
    // Typewriter animation (only on desktop)
    if (!isMobile) {
      let typewriterInterval: number;
      let pauseTimeout: number;
      
      const startTypewriter = () => {
        const currentFeature = features[currentFeatureIndex];
        let charIndex = 0;
        
        // Typing phase
        if (isTyping) {
          typewriterInterval = setInterval(() => {
            if (charIndex <= currentFeature.length) {
              currentText = currentFeature.slice(0, charIndex);
              charIndex++;
            } else {
              clearInterval(typewriterInterval);
              // Pause before erasing
              pauseTimeout = setTimeout(() => {
                isTyping = false;
                startTypewriter();
              }, 2000);
            }
          }, 80);
        } else {
          // Erasing phase
          charIndex = currentText.length;
          typewriterInterval = setInterval(() => {
            if (charIndex >= 0) {
              currentText = currentFeature.slice(0, charIndex);
              charIndex--;
            } else {
              clearInterval(typewriterInterval);
              // Move to next feature
              currentFeatureIndex = (currentFeatureIndex + 1) % features.length;
              isTyping = true;
              // Pause before typing next
              pauseTimeout = setTimeout(() => {
                startTypewriter();
              }, 500);
            }
          }, 50);
        }
      };
      
      // Start the animation
      startTypewriter();
      
      return () => {
        window.removeEventListener('resize', checkMobile);
        if (typewriterInterval) clearInterval(typewriterInterval);
        if (pauseTimeout) clearTimeout(pauseTimeout);
      };
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  // Global error handler to catch JWT expiration errors
  function handleGlobalError(event: ErrorEvent) {
    if (event.error && typeof event.error === 'string' && event.error.includes('JWT token has expired')) {
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
      if (event.reason && typeof event.reason === 'string' && event.reason.includes('JWT token has expired')) {
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
        qrSuccess = 'QR code scanned successfully!';
        onUrlChange(qrCodeData);
        onStartLogin();
      } else {
        console.warn('[QR] No QR code found in the image.');
        qrError = 'No QR code found in the image.';
      }
    } catch (err) {
      console.error('[QR] Failed to scan QR code:', err);
      let errorMsg = 'Failed to scan QR code. Please try a clearer image.';
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
        liveScanError = 'No camera found on this device.';
        showLiveScan = true;
        return;
      }
    } catch (err) {
      liveScanError = 'Unable to access camera. Please check browser permissions.';
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
          qrSuccess = 'QR code scanned successfully!';
          onUrlChange(decodedText);
          onStartLogin();
          stopLiveScan();
        },
        (err) => {
          // Optionally log scan errors
        }
      );
    } catch (err) {
      liveScanError = 'Failed to start live scan. ' + (err && typeof err === 'object' && 'message' in err ? (err as any).message : err);
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
</script>

<div class="flex flex-col h-full relative {isMobile ? 'overflow-y-auto' : 'overflow-hidden'} bg-slate-100 dark:bg-slate-950">
  <!-- Window Controls Bar -->
  <div 
    class="relative flex justify-between items-center px-6 py-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/20 dark:border-slate-700/30 z-10 {isMobile ? 'flex-shrink-0' : ''}"
    data-tauri-drag-region>
    <!-- Draggable area with branding -->
    <div class="flex items-center space-x-3" data-tauri-drag-region>
      <img src="/betterseqta-dark-icon.png" alt="DesQTA" class="w-8 h-8 invert dark:invert-0" />
      <h1 class="text-xl font-bold text-slate-800 dark:text-white">
        DesQTA
      </h1>
    </div>

    <!-- Window Controls -->
    {#if !isMobile}
      <div class="flex items-center space-x-1" data-tauri-drag-region>
        <button
          class="flex justify-center items-center w-10 h-10 rounded-full transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={() => appWindow.minimize()}
          aria-label="Minimize">
          <Icon src={Minus} class="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          class="flex justify-center items-center w-10 h-10 rounded-full transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onclick={() => appWindow.toggleMaximize()}
          aria-label="Maximize">
          <Icon src={Square2Stack} class="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          class="flex justify-center items-center w-10 h-10 rounded-full transition-all duration-200 group hover:bg-red-500/90 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          onclick={() => appWindow.close()}
          aria-label="Close">
          <Icon src={XMark} class="w-4 h-4 transition duration-200 text-slate-600 dark:text-slate-400 group-hover:text-white" />
        </button>
      </div>
    {/if}
  </div>

  <!-- Login Content -->
  <div class="relative flex justify-center items-center {isMobile ? 'p-4 min-h-0 flex-1' : 'p-8 flex-1'} z-10 {isMobile ? 'overflow-y-auto' : ''}">
    {#if !isMobile}
    <!-- Preview Components Around Login -->
    <!-- Top Left - Mini Header Preview -->
    <button 
      type="button"
      class="absolute top-8 left-8 w-80 h-16 bg-white/10 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/20 opacity-60 cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105 animate-float-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={() => openPreviewModal('header')}
      aria-label="Preview application header">
      <div class="flex items-center justify-between h-full px-6 pointer-events-none">
        <div class="flex items-center space-x-3">
          <div class="w-3 h-3 bg-indigo-400 rounded-full"></div>
          <div class="w-16 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
        <div class="flex space-x-2">
          <div class="w-8 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
          <div class="w-8 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
      </div>
    </button>

    <!-- Top Right - Mini Sidebar Preview -->
    <button 
      type="button"
      class="absolute top-8 right-8 w-64 h-52 bg-white/10 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/20 opacity-60 cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105 animate-float-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={() => openPreviewModal('sidebar')}
      aria-label="Preview navigation sidebar">
      <div class="p-4 space-y-3 pointer-events-none">
        <div class="flex items-center space-x-3">
          <div class="w-4 h-4 bg-indigo-400 rounded"></div>
          <div class="w-20 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="w-4 h-4 bg-purple-400 rounded"></div>
          <div class="w-24 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="w-4 h-4 bg-pink-400 rounded"></div>
          <div class="w-18 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="w-4 h-4 bg-blue-400 rounded"></div>
          <div class="w-22 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="w-4 h-4 bg-green-400 rounded"></div>
          <div class="w-16 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
      </div>
    </button>

        <!-- Bottom Left - Mini Assessment Card -->
    <button 
      type="button"
      class="absolute bottom-8 left-8 w-72 h-40 bg-white/10 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/20 border-l-4 border-l-green-400 opacity-60 cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105 animate-float-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={() => openPreviewModal('assessment')}
      aria-label="Preview assessment card">
      <div class="p-5 pointer-events-none">
        <div class="flex items-center justify-between mb-3">
          <div class="w-20 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
          <div class="w-16 h-5 bg-green-400/80 rounded text-xs"></div>
        </div>
        <div class="w-40 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-2"></div>
        <div class="w-24 h-3 bg-slate-300/30 dark:bg-slate-600/30 rounded mb-2"></div>
        <div class="w-32 h-2 bg-slate-300/20 dark:bg-slate-600/20 rounded"></div>
      </div>
    </button>

    <!-- Bottom Right - Mini Timetable Preview -->
    <button 
      type="button"
      class="absolute bottom-8 right-8 w-72 h-40 bg-white/10 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/20 opacity-60 cursor-pointer transition-all duration-300 hover:opacity-80 hover:scale-105 animate-float-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={() => openPreviewModal('timetable')}
      aria-label="Preview weekly timetable">
      <div class="p-3 pointer-events-none">
        <!-- Timetable Header -->
        <div class="grid grid-cols-6 gap-px mb-2 bg-gradient-to-r from-slate-100/50 to-slate-200/50 dark:from-slate-700/50 dark:to-slate-800/50 rounded-lg p-1">
          <div class="w-8 h-4 bg-slate-300/30 dark:bg-slate-600/30 rounded-sm"></div>
          <div class="h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded-sm flex items-center justify-center">
            <div class="w-3 h-1 bg-slate-400/60 rounded"></div>
          </div>
          <div class="h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded-sm flex items-center justify-center">
            <div class="w-3 h-1 bg-slate-400/60 rounded"></div>
          </div>
          <div class="h-4 bg-indigo-400/80 rounded-sm flex items-center justify-center">
            <div class="w-3 h-1 bg-white/80 rounded"></div>
          </div>
          <div class="h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded-sm flex items-center justify-center">
            <div class="w-3 h-1 bg-slate-400/60 rounded"></div>
          </div>
          <div class="h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded-sm flex items-center justify-center">
            <div class="w-3 h-1 bg-slate-400/60 rounded"></div>
          </div>
        </div>

        <!-- Timetable Grid with Time Labels -->
              <div class="relative">
          <!-- Time labels -->
          <div class="absolute left-0 top-0 w-8 h-24 flex flex-col justify-between text-xs">
            <div class="w-6 h-1 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
            <div class="w-6 h-1 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
            <div class="w-6 h-1 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
            <div class="w-6 h-1 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
                </div>
          
          <!-- Lesson blocks -->
          <div class="ml-8 grid grid-cols-5 gap-px h-24">
            <!-- Monday -->
            <div class="relative">
              <div class="absolute top-1 left-0 right-0 h-5 bg-white/80 dark:bg-slate-700/80 rounded border-l-2 border-purple-400 p-1">
                <div class="w-full h-1 bg-purple-400/60 rounded mb-0.5"></div>
                <div class="w-2/3 h-0.5 bg-slate-400/40 rounded"></div>
              </div>
              <div class="absolute top-8 left-0 right-0 h-6 bg-white/80 dark:bg-slate-700/80 rounded border-l-2 border-green-400 p-1">
                <div class="w-full h-1 bg-green-400/60 rounded mb-0.5"></div>
                <div class="w-3/4 h-0.5 bg-slate-400/40 rounded"></div>
              </div>
            </div>
            
            <!-- Tuesday -->
            <div class="relative">
              <div class="absolute top-2 left-0 right-0 h-8 bg-white/80 dark:bg-slate-700/80 rounded border-l-2 border-blue-400 p-1">
                <div class="w-full h-1 bg-blue-400/60 rounded mb-0.5"></div>
                <div class="w-1/2 h-0.5 bg-slate-400/40 rounded"></div>
              </div>
            </div>
            
            <!-- Wednesday (Today - highlighted) -->
            <div class="relative bg-indigo-400/10 rounded">
              <div class="absolute top-0 left-0 right-0 h-4 bg-white/90 dark:bg-slate-700/90 rounded border-l-2 border-indigo-500 p-1 shadow-sm">
                <div class="w-full h-1 bg-indigo-500/80 rounded mb-0.5"></div>
                <div class="w-3/4 h-0.5 bg-slate-500/60 rounded"></div>
              </div>
              <div class="absolute top-6 left-0 right-0 h-5 bg-white/90 dark:bg-slate-700/90 rounded border-l-2 border-pink-400 p-1 shadow-sm">
                <div class="w-full h-1 bg-pink-400/80 rounded mb-0.5"></div>
                <div class="w-2/3 h-0.5 bg-slate-500/60 rounded"></div>
              </div>
            </div>
            
            <!-- Thursday -->
            <div class="relative">
              <div class="absolute top-3 left-0 right-0 h-6 bg-white/80 dark:bg-slate-700/80 rounded border-l-2 border-orange-400 p-1">
                <div class="w-full h-1 bg-orange-400/60 rounded mb-0.5"></div>
                <div class="w-4/5 h-0.5 bg-slate-400/40 rounded"></div>
              </div>
            </div>
            
            <!-- Friday -->
            <div class="relative">
              <div class="absolute top-1 left-0 right-0 h-7 bg-white/80 dark:bg-slate-700/80 rounded border-l-2 border-red-400 p-1">
                <div class="w-full h-1 bg-red-400/60 rounded mb-0.5"></div>
                <div class="w-3/5 h-0.5 bg-slate-400/40 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>

    <!-- Left Side - Mini Dashboard Widget -->
    <button 
      type="button"
      class="absolute left-8 top-1/2 -translate-y-1/2 w-56 h-36 bg-white/10 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/20 opacity-50 cursor-pointer transition-all duration-300 hover:opacity-70 hover:scale-105 animate-float-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={() => openPreviewModal('dashboard')}
      aria-label="Preview dashboard widget">
      <div class="p-4 pointer-events-none">
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-5 h-5 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"></div>
          <div class="w-24 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
        </div>
        <div class="space-y-3">
          <div class="w-full h-3 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
          <div class="w-4/5 h-3 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
          <div class="w-3/5 h-3 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
          <div class="w-2/3 h-2 bg-slate-300/30 dark:bg-slate-600/30 rounded"></div>
        </div>
      </div>
    </button>

    <!-- Right Side - Mini Analytics Chart -->
    <button 
      type="button"
      class="absolute right-8 top-1/2 -translate-y-1/2 w-64 h-40 bg-white/10 dark:bg-slate-800/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-slate-700/20 opacity-50 cursor-pointer transition-all duration-300 hover:opacity-70 hover:scale-105 animate-float-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      onclick={() => openPreviewModal('analytics')}
      aria-label="Preview analytics dashboard">
      <div class="p-4 pointer-events-none">
        <div class="w-20 h-3 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-4"></div>
        <div class="flex items-end justify-between h-20 space-x-1">
          <div class="w-4 h-10 bg-indigo-400/60 rounded"></div>
          <div class="w-4 h-16 bg-purple-400/60 rounded"></div>
          <div class="w-4 h-8 bg-pink-400/60 rounded"></div>
          <div class="w-4 h-12 bg-blue-400/60 rounded"></div>
          <div class="w-4 h-18 bg-green-400/60 rounded"></div>
          <div class="w-4 h-6 bg-orange-400/60 rounded"></div>
          <div class="w-4 h-11 bg-red-400/60 rounded"></div>
          <div class="w-4 h-14 bg-teal-400/60 rounded"></div>
        </div>
      </div>
    </button>
    {/if}

    <div class="w-full {isMobile ? 'max-w-md' : 'max-w-5xl'}">
      <!-- Main Login Card -->
      <div class="relative overflow-hidden {isMobile ? 'rounded-2xl' : 'rounded-3xl'} bg-white/5 dark:bg-slate-900/5 backdrop-blur-3xl border border-white/20 dark:border-slate-700/15 shadow-2xl">
        <!-- Animated Background Behind Card -->
        <div class="absolute inset-0 bg-gradient-to-br from-slate-50 via-orange-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 {isMobile ? 'rounded-2xl' : 'rounded-3xl'}"></div>
        
        <!-- Animated Pastel Gradient Overlay -->
        <div class="absolute inset-0 opacity-15 dark:opacity-25 {isMobile ? 'rounded-2xl' : 'rounded-3xl'}">
          <div class="absolute inset-0 bg-gradient-to-br from-orange-200/8 via-rose-200/10 to-pink-200/8 dark:from-orange-300/15 dark:via-rose-300/18 dark:to-pink-300/15 animate-gradient-shift {isMobile ? 'rounded-2xl' : 'rounded-3xl'}"></div>
        </div>
        
        <!-- Glass effect overlay -->
        <div class="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-white/5 dark:from-slate-800/20 dark:via-slate-800/10 dark:to-slate-800/5 {isMobile ? 'rounded-2xl' : 'rounded-3xl'}"></div>
        
        <div class="relative flex flex-col {isMobile ? '' : 'lg:flex-row'}">
          <!-- Left side - Hero Section -->
          {#if !isMobile}
          <div class="lg:w-1/2 p-12 flex flex-col justify-center relative overflow-hidden">
            <div class="space-y-8">
              <div class="space-y-4">
                                 <h1 class="text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white leading-tight">
                   Welcome to<br><span class="text-indigo-600 dark:text-indigo-400">DesQTA</span>
                 </h1>
                <p class="text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                  Experience SEQTA Learn like never before with our powerful, modern desktop application
                </p>
              </div>
              
              <!-- Animated feature highlight -->
              <div class="h-16 flex items-center">
                <div class="flex items-center space-x-4 text-slate-600 dark:text-slate-300">
                  <div class="w-2 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                  <span class="text-lg font-medium min-h-[1.75rem] flex items-center">
                    {currentText}<span class="animate-blink text-indigo-500 ml-1">|</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/if}

          <!-- Right side - Login Form -->
          <div class="{isMobile ? 'w-full p-6' : 'lg:w-1/2 p-12 px-20'} flex flex-col justify-center">
            {#if isMobile}
            <!-- Mobile Title -->
            <div class="text-center space-y-4 mb-8">
              <h1 class="text-3xl font-bold text-slate-900 dark:text-white">
                Welcome to <span class="text-indigo-600 dark:text-indigo-400">DesQTA</span>
              </h1>
              <p class="text-slate-600 dark:text-slate-300">
                Experience SEQTA Learn like never before
              </p>
            </div>
            {/if}
            <div class="space-y-8">
              <!-- Login method toggle -->
              {#if !isMobile}
              <div class="flex items-center justify-center">
                <div class="flex p-1 bg-white/15 dark:bg-slate-800/20 backdrop-blur-xl rounded-2xl relative overflow-hidden border border-white/20 dark:border-slate-700/20">
                  <!-- Animated background slider -->
                  <div 
                    class="absolute top-1 bottom-1 bg-white/30 dark:bg-slate-700/40 backdrop-blur-xl rounded-xl shadow-sm transition-all duration-300 ease-out border border-white/40 dark:border-slate-600/40"
                    style="left: {loginMethod === 'qr' ? '4px' : 'calc(50% - 4px)'}; width: calc(50% - 4px)"
                  ></div>
                  <button
                    class="px-6 py-3 rounded-xl font-medium transition-all duration-300 relative z-10 transform hover:scale-105 {loginMethod === 'qr' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}"
                    onclick={() => loginMethod = 'qr'}
                  >
                    <Icon src={QrCode} class="w-5 h-5 inline mr-2 transition-transform duration-300 {loginMethod === 'qr' ? 'scale-110' : ''}" />
                    QR Code
                  </button>
                  <button
                    class="px-6 py-3 rounded-xl font-medium transition-all duration-300 relative z-10 transform hover:scale-105 {loginMethod === 'url' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}"
                    onclick={() => loginMethod = 'url'}
                  >
                    Manual URL
                  </button>
                </div>
              </div>
              {/if}

                            <!-- Content Container with Height Animation -->
              <div class="transition-all duration-500 ease-in-out overflow-hidden" style="height: {isMobile || loginMethod === 'qr' ? '400px' : '200px'};">
                <!-- QR Code Method -->
                {#if isMobile || loginMethod === 'qr'}
                  <div class="space-y-6 px-2">
                    <div class="text-center space-y-2">
                      <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Quick Login</h2>
                      <p class="text-slate-600 dark:text-slate-400">Scan your SEQTA QR code to sign in instantly</p>
                    </div>

                    <!-- QR Code upload area -->
                    <div class="relative">
                      <input
                        id="qr-upload"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        onchange={handleQrFileInput}
                      />
                      <label
                        for="qr-upload"
                        class="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-indigo-300/60 dark:border-indigo-600/60 rounded-2xl cursor-pointer bg-white/5 dark:bg-slate-800/5 backdrop-blur-xl hover:bg-white/15 dark:hover:bg-slate-800/15 transition-all duration-300 group hover:border-indigo-400/80 dark:hover:border-indigo-500/80 hover:scale-[1.02]"
                      >
                        <div class="flex flex-col items-center space-y-4">
                          <div class="p-4 bg-white/15 dark:bg-slate-800/20 backdrop-blur-xl rounded-full group-hover:scale-110 transition-transform duration-200 border border-white/20 dark:border-slate-700/20">
                            <Icon src={ArrowUpTray} class="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div class="text-center">
                            <p class="text-lg font-medium text-indigo-700 dark:text-indigo-300">Upload QR Code</p>
                            <p class="text-sm text-indigo-600 dark:text-indigo-400">Click to browse or drag & drop</p>
                          </div>
                        </div>
                      </label>
                    </div>

                    <!-- Divider -->
                    <div class="flex items-center">
                      <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent"></div>
                      <span class="px-4 text-sm text-slate-500 dark:text-slate-400 font-medium">or</span>
                      <div class="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent"></div>
                    </div>

                                      <!-- Live scan button -->
                  <button
                    type="button"
                    class="w-full py-3 px-6 bg-gradient-to-r from-orange-200 to-pink-200 hover:from-orange-300 hover:to-pink-300 text-slate-700 dark:text-slate-800 font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 ease-out transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-200 focus:ring-offset-2"
                    onclick={startLiveScan}
                  >
                      <Icon src={Camera} class="w-5 h-5 inline mr-3 transition-transform duration-300 group-hover:rotate-12" />
                      Scan with Camera
                    </button>
              </div>
            {/if}
            
                <!-- Manual URL Method -->
                {#if loginMethod === 'url' && !isMobile}
                  <div class="space-y-6">
                    <div class="text-center space-y-2">
                      <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Manual Login</h2>
                      <p class="text-slate-600 dark:text-slate-400">Enter your school's SEQTA URL</p>
                    </div>

                    <div class="space-y-4">
                      <div class="relative px-4">
                        <input
                          type="text"
                          bind:value={seqtaUrl}
                          oninput={(e) => {
                            const url = (e.target as HTMLInputElement).value;
                            onUrlChange(url);
                          }}
                          placeholder="school.seqta.com.au"
                          class="w-full py-4 px-6 bg-white/10 dark:bg-slate-800/10 backdrop-blur-xl border border-white/20 dark:border-slate-700/20 rounded-2xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all duration-300 hover:border-indigo-300/60 dark:hover:border-indigo-600/60 focus:bg-white/20 dark:focus:bg-slate-800/20"
                        />
                      </div>
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Status Messages -->
              {#if qrProcessing}
                <div class="flex items-center justify-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                  <div class="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span class="text-blue-700 dark:text-blue-300 font-medium">Processing QR code...</span>
              </div>
            {/if}
            
            {#if qrSuccess}
                <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800">
                  <div class="flex items-center space-x-3">
                    <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-green-700 dark:text-green-300 font-medium">{qrSuccess}</span>
                  </div>
              </div>
            {/if}
            
            {#if qrError}
                <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
                  <div class="flex items-center space-x-3">
                    <div class="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </div>
                    <span class="text-red-700 dark:text-red-300 font-medium">{qrError}</span>
                  </div>
              </div>
            {/if}
            
            {#if jwtExpiredError}
                <div class="p-6 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <div class="flex items-start space-x-4">
                    <div class="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                    </div>
                    <div class="space-y-2">
                      <h3 class="font-semibold text-amber-800 dark:text-amber-200">QR Code Expired</h3>
                      <p class="text-amber-700 dark:text-amber-300">The QR code from your mobile login email has expired. Please request a new QR code and try again.</p>
                    </div>
                </div>
              </div>
            {/if}

                                          <!-- Sign In Button -->
              <button
                id="signin-button"
                class="w-full py-4 px-6 bg-gradient-to-r from-orange-200 to-pink-200 hover:from-orange-300 hover:to-pink-300 disabled:from-slate-300 disabled:to-slate-400 text-slate-700 dark:text-slate-800 disabled:text-slate-500 font-semibold rounded-2xl shadow-lg hover:shadow-xl disabled:shadow-none transition-all duration-500 ease-out transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-200 focus:ring-offset-2 group"
            onclick={() => {
              jwtExpiredError = false;
              onStartLogin();
            }}
                  disabled={jwtExpiredError || (!isMobile && loginMethod === 'url' && !seqtaUrl.trim()) || ((isMobile || loginMethod === 'qr') && !qrSuccess)}
                >
                  <span class="transition-transform duration-300 group-hover:translate-x-1">Sign In to DesQTA</span>
          </button>

              <!-- Help Link -->
          <div class="text-center">
            <p class="text-sm text-slate-600 dark:text-slate-400">
                  Need help? 
                  <a
                href="https://github.com/betterseqta/desqta"
                target="_blank"
                rel="noopener noreferrer"
                    class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-all duration-300 hover:underline decoration-2 underline-offset-2"
                  >
                    Visit our GitHub
                  </a>
            </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Live Scan Modal -->
  {#if showLiveScan}
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-black/60">
      <div class="bg-white/10 dark:bg-slate-900/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 border border-white/30 dark:border-slate-700/20">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Live QR Scanner</h2>
          <button
            class="p-2 rounded-full bg-white/20 dark:bg-slate-800/30 backdrop-blur-sm hover:bg-white/30 dark:hover:bg-slate-800/40 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 border border-white/30 dark:border-slate-700/30"
            onclick={stopLiveScan}
            aria-label="Close live scan modal"
          >
            <Icon src={XMark} class="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        
        <div class="relative">
          <div id="qr-reader-live" class="w-full h-80 rounded-2xl overflow-hidden bg-black border-4 border-indigo-200 dark:border-indigo-800"></div>
          <div class="absolute inset-0 border-2 border-indigo-500 rounded-2xl pointer-events-none animate-pulse"></div>
        </div>
        
        {#if liveScanError}
          <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800">
            <p class="text-red-700 dark:text-red-300 font-medium">{liveScanError}</p>
          </div>
        {/if}
        
        <p class="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Position the QR code within the frame to scan
        </p>
      </div>
    </div>
  {/if}
  
  <!-- Preview Modal -->
  {#if showPreviewModal && selectedPreview}
    <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-black/70" transition:fade={{ duration: 300 }}>
      <div class="relative w-full max-w-4xl mx-8" transition:fly={{ y: 50, duration: 500 }} style="transform-origin: center;">
        <!-- Close Button -->
        <button
          class="absolute -top-12 right-0 p-3 rounded-full bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl hover:bg-white/30 dark:hover:bg-slate-800/40 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 border border-white/30 dark:border-slate-700/30 z-10"
          onclick={closePreviewModal}
          aria-label="Close preview modal"
        >
          <Icon src={XMark} class="w-6 h-6 text-white" />
        </button>

        <!-- Modal Content -->
        <div class="bg-white/10 dark:bg-slate-900/20 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-slate-700/20 shadow-2xl p-8">
          {#if selectedPreview === 'header'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">Application Header</h2>
              <div class="bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-slate-700/30">
                                 <div class="flex items-center justify-between h-16 px-6">
                   <div class="flex items-center space-x-4">
                     <div class="relative">
                       <div class="w-8 h-8 bg-indigo-400 rounded-full"></div>
                       <div class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                     </div>
                     <div class="w-32 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
                   </div>
                   <div class="flex space-x-3">
                     <div class="w-12 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
                     <div class="w-12 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
                   </div>
                 </div>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                The application header contains navigation controls, branding, and user account access. It stays fixed at the top of the interface for easy access to core functionality.
              </p>
            </div>
          {:else if selectedPreview === 'sidebar'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">Navigation Sidebar</h2>
              <div class="bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-slate-700/30">
                <div class="space-y-4">
                                     {#each [
                     { icon: 'indigo-400', label: 'Dashboard', desc: 'Main overview' },
                     { icon: 'purple-400', label: 'Assessments', desc: 'View assignments' },
                     { icon: 'pink-400', label: 'Timetable', desc: 'Class schedule' },
                     { icon: 'blue-400', label: 'Analytics', desc: 'Performance data' },
                     { icon: 'green-400', label: 'Settings', desc: 'App preferences' }
                   ] as item}
                     <div class="flex items-center space-x-4">
                       <div class="w-8 h-8 bg-{item.icon} rounded"></div>
                       <div class="flex-1">
                         <div class="w-24 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-1"></div>
                         <div class="w-16 h-3 bg-slate-300/30 dark:bg-slate-600/30 rounded"></div>
                       </div>
                     </div>
                   {/each}
                </div>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                The sidebar provides quick navigation between different sections of DesQTA. Each item shows an icon, label, and takes you to the corresponding feature area.
              </p>
            </div>
          {:else if selectedPreview === 'assessment'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">Assessment Card</h2>
              <div class="bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-slate-700/30 border-l-8 border-l-green-400">
                                 <div class="space-y-4">
                   <div class="flex items-center justify-between">
                     <div class="w-32 h-4 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
                     <div class="w-20 h-6 bg-green-400/80 rounded"></div>
                   </div>
                   <div class="w-48 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
                   <div class="w-32 h-4 bg-slate-300/30 dark:bg-slate-600/30 rounded"></div>
                   <div class="w-40 h-3 bg-slate-300/20 dark:bg-slate-600/20 rounded"></div>
                 </div>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                Assessment cards display key information about assignments including due dates, status, and subject details. The colored left border indicates the subject category.
              </p>
            </div>
          {:else if selectedPreview === 'timetable'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">Weekly Timetable</h2>
              <div class="bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-slate-700/30">
                <div class="space-y-4">
                  <div class="grid grid-cols-6 gap-2 mb-4">
                    <div class="text-center text-xs text-slate-600 dark:text-slate-400">Time</div>
                    <div class="text-center text-xs text-slate-600 dark:text-slate-400">Mon</div>
                    <div class="text-center text-xs text-slate-600 dark:text-slate-400">Tue</div>
                    <div class="text-center text-xs text-slate-600 dark:text-slate-400 bg-indigo-400/20 rounded px-2 py-1">Wed (Today)</div>
                    <div class="text-center text-xs text-slate-600 dark:text-slate-400">Thu</div>
                    <div class="text-center text-xs text-slate-600 dark:text-slate-400">Fri</div>
                  </div>
                  <div class="grid grid-cols-6 gap-2 h-32">
                    <div class="flex flex-col justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>9:00</span>
                      <span>10:00</span>
                      <span>11:00</span>
                      <span>12:00</span>
                    </div>
                    {#each Array(5) as _, dayIdx}
                      <div class="relative">
                        {#if dayIdx === 0}
                          <div class="absolute top-2 left-0 right-0 h-8 bg-purple-400/60 rounded border-l-2 border-purple-500 p-1">
                            <div class="text-xs text-white font-medium">Math</div>
                          </div>
                        {:else if dayIdx === 1}
                          <div class="absolute top-4 left-0 right-0 h-12 bg-blue-400/60 rounded border-l-2 border-blue-500 p-1">
                            <div class="text-xs text-white font-medium">Science</div>
                          </div>
                        {:else if dayIdx === 2}
                          <div class="absolute top-0 left-0 right-0 h-6 bg-indigo-500/80 rounded border-l-2 border-indigo-600 p-1 shadow-md">
                            <div class="text-xs text-white font-medium">English</div>
                          </div>
                          <div class="absolute top-8 left-0 right-0 h-8 bg-pink-400/60 rounded border-l-2 border-pink-500 p-1">
                            <div class="text-xs text-white font-medium">History</div>
                          </div>
                        {:else if dayIdx === 3}
                          <div class="absolute top-6 left-0 right-0 h-10 bg-orange-400/60 rounded border-l-2 border-orange-500 p-1">
                            <div class="text-xs text-white font-medium">Art</div>
                          </div>
                        {:else if dayIdx === 4}
                          <div class="absolute top-2 left-0 right-0 h-12 bg-red-400/60 rounded border-l-2 border-red-500 p-1">
                            <div class="text-xs text-white font-medium">PE</div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                The timetable shows your weekly class schedule with color-coded subjects. Today's column is highlighted, and each lesson block shows the subject name, time, and teacher information.
              </p>
            </div>
          {:else if selectedPreview === 'dashboard'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">Dashboard Widget</h2>
              <div class="bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-slate-700/30">
                                 <div class="space-y-4">
                   <div class="flex items-center space-x-4 mb-6">
                     <div class="w-10 h-10 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full"></div>
                     <div class="w-32 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded"></div>
                   </div>
                   <div class="space-y-3">
                     <div class="w-full h-4 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
                     <div class="w-4/5 h-4 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
                     <div class="w-3/5 h-4 bg-slate-300/40 dark:bg-slate-600/40 rounded"></div>
                     <div class="w-2/3 h-3 bg-slate-300/30 dark:bg-slate-600/30 rounded"></div>
                   </div>
                 </div>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                Dashboard widgets provide quick access to important information like upcoming assignments, recent grades, or daily schedules. Each widget has a distinct icon and organized content layout.
              </p>
            </div>
          {:else if selectedPreview === 'analytics'}
            <div class="space-y-6">
              <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-4">Analytics Dashboard</h2>
              <div class="bg-white/20 dark:bg-slate-800/30 backdrop-blur-xl rounded-2xl p-6 border border-white/30 dark:border-slate-700/30">
                                 <div class="space-y-4">
                   <div class="w-32 h-6 bg-slate-300/50 dark:bg-slate-600/50 rounded mb-6"></div>
                   <div class="flex items-end justify-between h-32 space-x-2">
                     {#each [
                       { height: 'h-16', color: 'indigo-400' },
                       { height: 'h-24', color: 'purple-400' },
                       { height: 'h-12', color: 'pink-400' },
                       { height: 'h-20', color: 'blue-400' },
                       { height: 'h-28', color: 'green-400' },
                       { height: 'h-10', color: 'orange-400' },
                       { height: 'h-18', color: 'red-400' },
                       { height: 'h-22', color: 'teal-400' }
                     ] as bar}
                       <div class="w-6 {bar.height} bg-{bar.color}/60 rounded"></div>
                     {/each}
                   </div>
                 </div>
              </div>
              <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
                The analytics section provides visual insights into your academic performance with interactive charts and graphs. Track progress across subjects and identify areas for improvement.
              </p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<div id="qr-reader-temp" style="display:none;"></div>

<style>
  @keyframes gradient-shift {
    0% {
      background-size: 200% 200%;
      background-position: 0% 50%;
    }
    50% {
      background-size: 300% 300%;
      background-position: 100% 50%;
    }
    100% {
      background-size: 200% 200%;
      background-position: 0% 50%;
    }
  }

  @keyframes float-1 {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    25% {
      transform: translateY(-8px) translateX(4px) scale(1.02);
    }
    50% {
      transform: translateY(-4px) translateX(-2px) scale(0.98);
    }
    75% {
      transform: translateY(6px) translateX(3px) scale(1.01);
    }
  }

  @keyframes float-2 {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    30% {
      transform: translateY(6px) translateX(-3px) scale(0.99);
    }
    60% {
      transform: translateY(-5px) translateX(4px) scale(1.02);
    }
    80% {
      transform: translateY(2px) translateX(-1px) scale(0.98);
    }
  }

  @keyframes float-3 {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    20% {
      transform: translateY(-6px) translateX(2px) scale(1.01);
    }
    45% {
      transform: translateY(4px) translateX(-4px) scale(0.99);
    }
    70% {
      transform: translateY(-2px) translateX(3px) scale(1.02);
    }
  }

  @keyframes float-4 {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    35% {
      transform: translateY(7px) translateX(2px) scale(0.98);
    }
    55% {
      transform: translateY(-3px) translateX(-3px) scale(1.01);
    }
    85% {
      transform: translateY(4px) translateX(1px) scale(0.99);
    }
  }

  @keyframes float-5 {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    25% {
      transform: translateY(5px) translateX(-2px) scale(1.02);
    }
    50% {
      transform: translateY(-7px) translateX(3px) scale(0.98);
    }
    75% {
      transform: translateY(3px) translateX(-1px) scale(1.01);
    }
  }

  @keyframes float-6 {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    40% {
      transform: translateY(-4px) translateX(-3px) scale(0.99);
    }
    65% {
      transform: translateY(6px) translateX(2px) scale(1.02);
    }
    90% {
      transform: translateY(-2px) translateX(4px) scale(0.98);
    }
  }

  :global(.animate-gradient-shift) {
    animation: gradient-shift 8s ease-in-out infinite;
  }

  :global(.animate-float-1) {
    animation: float-1 12s ease-in-out infinite;
  }

  :global(.animate-float-2) {
    animation: float-2 14s ease-in-out infinite;
  }

  :global(.animate-float-3) {
    animation: float-3 11s ease-in-out infinite;
  }

  :global(.animate-float-4) {
    animation: float-4 13s ease-in-out infinite;
  }

  :global(.animate-float-5) {
    animation: float-5 15s ease-in-out infinite;
  }

  :global(.animate-float-6) {
    animation: float-6 16s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 50% {
      opacity: 1;
    }
    51%, 100% {
      opacity: 0;
    }
  }

  :global(.animate-blink) {
    animation: blink 1s infinite;
  }
</style>