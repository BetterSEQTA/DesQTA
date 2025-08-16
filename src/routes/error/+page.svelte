<script lang="ts">
  import { page } from '$app/stores';
  import { Icon } from 'svelte-hero-icons';
  import { ExclamationTriangle, Home, ArrowLeft, ArrowPath, Cog } from 'svelte-hero-icons';
  import { goto } from '$app/navigation';
  import { accentColor } from '../../lib/stores/theme';
  import TroubleshootingModal from '../../lib/components/TroubleshootingModal.svelte';
  import { logger } from '../../utils/logger';

  // Get error details from URL parameters
  let errorStatus = $derived(parseInt($page.url.searchParams.get('status') || '500'));
  let errorMessage = $derived(
    decodeURIComponent($page.url.searchParams.get('message') || 'An unexpected error occurred'),
  );

  // Error type classification
  let isNetworkError = $derived(
    errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('Failed to fetch'),
  );
  let isAuthError = $derived(errorStatus === 401 || errorStatus === 403);
  let isNotFoundError = $derived(errorStatus === 404);
  let isServerError = $derived(errorStatus >= 500);

  let errorType = $derived(
    isAuthError
      ? 'Authentication Error'
      : isNotFoundError
        ? 'Page Not Found'
        : isNetworkError
          ? 'Network Error'
          : isServerError
            ? 'Server Error'
            : 'Application Error',
  );

  let errorDescription = $derived(
    isAuthError
      ? 'You need to log in to access this page.'
      : isNotFoundError
        ? "The page you're looking for doesn't exist."
        : isNetworkError
          ? 'Unable to connect to the server. Please check your internet connection.'
          : isServerError
            ? 'Something went wrong on our end. Please try again later.'
            : 'Something unexpected happened. Please try again.',
  );

  function goHome() {
    goto('/');
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      goHome();
    }
  }

  function refreshPage() {
    window.location.reload();
  }

  // Troubleshooting modal state
  let showTroubleshootingModal = $state(false);

  function openTroubleshooting() {
    logger.info(
      'errorPage',
      'openTroubleshooting',
      'Opening troubleshooting modal from error page',
      {
        errorStatus,
        errorType,
        errorMessage,
      },
    );
    showTroubleshootingModal = true;
  }

  function closeTroubleshooting() {
    logger.debug('errorPage', 'closeTroubleshooting', 'Closing troubleshooting modal');
    showTroubleshootingModal = false;
  }
</script>

<svelte:head>
  <title>Error {errorStatus} - DesQTA</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
  <div class="max-w-lg w-full">
    <div
      class="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
      <!-- Error Icon -->
      <div class="mb-6 flex justify-center">
        <div
          class="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Icon src={ExclamationTriangle} size="40" class="text-red-500 dark:text-red-400" />
        </div>
      </div>

      <!-- Error Status -->
      <div class="mb-6 text-center">
        <h1 class="text-5xl font-bold text-red-500 dark:text-red-400 mb-2">{errorStatus}</h1>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">{errorType}</h2>
      </div>

      <!-- Error Description -->
      <div class="mb-8 text-center">
        <p class="text-slate-600 dark:text-slate-300 leading-relaxed">{errorDescription}</p>
        {#if !isAuthError && !isNotFoundError}
          <p
            class="text-sm text-slate-500 dark:text-slate-400 mt-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <span class="font-medium">Error:</span>
            {errorMessage}
          </p>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="space-y-3">
        {#if isAuthError}
          <button
            onclick={goHome}
            class="w-full px-4 py-3 bg-accent-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 hover:bg-accent-600">
            <Icon src={Home} size="20" class="inline mr-2" />
            Go to Login
          </button>
        {:else}
          <button
            onclick={goBack}
            class="w-full px-4 py-3 bg-accent-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 hover:bg-accent-600">
            <Icon src={ArrowLeft} size="20" class="inline mr-2" />
            Go Back
          </button>
        {/if}

        <button
          onclick={refreshPage}
          class="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 hover:bg-red-600">
          <Icon src={ArrowPath} size="20" class="inline mr-2" />
          Try Again
        </button>

        <button
          onclick={goHome}
          class="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">
          <Icon src={Home} size="20" class="inline mr-2" />
          Go Home
        </button>

        <button
          onclick={openTroubleshooting}
          class="w-full px-4 py-3 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg font-normal transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 hover:bg-gray-200 dark:hover:bg-gray-700">
          <Icon src={Cog} size="20" class="inline mr-2" />
          View Troubleshooting
        </button>
      </div>

      <!-- Debug Info (only in development) -->
      {#if import.meta.env.DEV}
        <div
          class="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-left border border-slate-200 dark:border-slate-700">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Debug Information:
          </h3>
          <pre
            class="text-xs text-slate-600 dark:text-slate-400 overflow-auto bg-white dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700">{JSON.stringify(
              {
                status: errorStatus,
                message: errorMessage,
                url: $page.url.href,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            )}</pre>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Troubleshooting Modal -->
<TroubleshootingModal open={showTroubleshootingModal} onclose={closeTroubleshooting} />
