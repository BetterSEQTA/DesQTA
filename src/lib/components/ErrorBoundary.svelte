<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ExclamationTriangle, ArrowPath, InformationCircle, Cog } from 'svelte-hero-icons';
  import { logger } from '../../utils/logger';

  let { 
    children, 
    fallback,
    showTroubleshooting = false,
    componentName = 'Component',
    logLevel = 'error' 
  } = $props<{
    children: any;
    fallback?: (error: unknown, reset: () => void) => any;
    showTroubleshooting?: boolean;
    componentName?: string;
    logLevel?: 'error' | 'warn' | 'info';
  }>();

  let showDetails = $state(false);
  let errorDetails = $state<{ message: string; stack?: string; timestamp: string } | null>(null);

  function onerror(error: unknown, reset: () => void) {
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    // Store error details for display
    errorDetails = { message, stack, timestamp };
    
    // Log the error based on the specified level
    const logData = {
      component: componentName,
      message,
      stack,
      timestamp,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    switch (logLevel) {
      case 'error':
        logger.error('ErrorBoundary', componentName, `Error caught in ${componentName}`, logData);
        break;
      case 'warn':
        logger.warn('ErrorBoundary', componentName, `Warning caught in ${componentName}`, logData);
        break;
      case 'info':
        logger.info('ErrorBoundary', componentName, `Info caught in ${componentName}`, logData);
        break;
    }
  }

  function handleReset(reset: () => void) {
    errorDetails = null;
    showDetails = false;
    reset();
  }

  function toggleDetails() {
    showDetails = !showDetails;
  }

  function openTroubleshooting() {
    // This could trigger a global troubleshooting modal or custom handling
    const event = new CustomEvent('open-troubleshooting', {
      detail: { error: errorDetails, component: componentName }
    });
    window.dispatchEvent(event);
  }
</script>

<svelte:boundary {onerror}>
  {@render children()}
  
  {#snippet failed(error, reset)}
    {#if fallback}
      {@render fallback(error, handleReset.bind(null, reset))}
    {:else}
      <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-center gap-3 mb-3">
          <Icon src={ExclamationTriangle} size="20" class="text-red-500 dark:text-red-400" />
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">
            {componentName} Error
          </h3>
        </div>
        
        <p class="text-sm text-slate-600 dark:text-slate-300 mb-3">
          {errorDetails?.message || 'An error occurred in this component'}
        </p>
        
        <div class="flex flex-wrap gap-2">
          <button
            onclick={() => handleReset(reset)}
            class="px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:bg-red-200 dark:hover:bg-red-700"
          >
            <Icon src={ArrowPath} size="14" class="inline mr-1" />
            Retry
          </button>
          
          <button
            onclick={toggleDetails}
            class="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 hover:bg-slate-200 dark:hover:bg-slate-600"
          >
            <Icon src={InformationCircle} size="14" class="inline mr-1" />
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
          
          {#if showTroubleshooting}
            <button
              onclick={openTroubleshooting}
              class="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-200 dark:hover:bg-blue-700"
            >
              <Icon src={Cog} size="14" class="inline mr-1" />
              Troubleshoot
            </button>
          {/if}
        </div>
        
        {#if showDetails && errorDetails}
          <div class="mt-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs">
            <div class="mb-2">
              <strong class="text-slate-700 dark:text-slate-300">Time:</strong>
              <span class="text-slate-600 dark:text-slate-400">{new Date(errorDetails.timestamp).toLocaleString()}</span>
            </div>
            <div class="mb-2">
              <strong class="text-slate-700 dark:text-slate-300">Component:</strong>
              <span class="text-slate-600 dark:text-slate-400">{componentName}</span>
            </div>
            {#if errorDetails.stack}
              <div>
                <strong class="text-slate-700 dark:text-slate-300">Stack Trace:</strong>
                <pre class="mt-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-xs text-slate-600 dark:text-slate-400 overflow-auto max-h-32">{errorDetails.stack}</pre>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}
</svelte:boundary>