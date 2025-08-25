<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ArrowPath, ExclamationTriangle } from 'svelte-hero-icons';
  import LoadingSpinner from '../LoadingSpinner.svelte';
  import EmptyState from '../EmptyState.svelte';
  import ErrorBoundary from '../ErrorBoundary.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    loading?: boolean;
    error?: string | Error | null;
    data?: any;
    empty?: boolean;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: string;
    loadingMessage?: string;
    retryable?: boolean;
    componentName?: string;
    onretry?: () => void;
    children?: Snippet<[any]>;
    loadingSlot?: Snippet;
    errorSlot?: Snippet<[string | Error, () => void]>;
    emptySlot?: Snippet;
  }

  let {
    loading = false,
    error = null,
    data = null,
    empty = false,
    emptyTitle = 'No data found',
    emptyMessage = 'There is no data to display at the moment.',
    emptyIcon = '📭',
    loadingMessage = 'Loading...',
    retryable = true,
    componentName = 'AsyncWrapper',
    onretry = () => {},
    children,
    loadingSlot,
    errorSlot,
    emptySlot
  }: Props = $props();

  function handleRetry() {
    if (onretry) {
      onretry();
    }
  }

  let errorMessage = $derived(error instanceof Error ? error.message : (error || 'An error occurred'));
  let showEmpty = $derived(!loading && !error && (empty || (Array.isArray(data) && data.length === 0) || (!data && data !== 0)));
  let showContent = $derived(!loading && !error && !showEmpty);
</script>

<ErrorBoundary {componentName}>
  {#if loading}
    {#if loadingSlot}
      {@render loadingSlot()}
    {:else}
      <LoadingSpinner message={loadingMessage} />
    {/if}
  {:else if error}
    {#if errorSlot}
      {@render errorSlot(error, handleRetry)}
    {:else}
      <div class="flex flex-col items-center justify-center py-12 space-y-4">
        <div class="text-red-500 bg-red-100 dark:bg-red-900/30 rounded-full p-3">
          <Icon src={ExclamationTriangle} size="24" />
        </div>
        <div class="text-center">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Something went wrong
          </h3>
          <p class="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
            {errorMessage}
          </p>
        </div>
        {#if retryable}
          <button
            onclick={handleRetry}
            class="inline-flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors duration-200 transform hover:scale-105 active:scale-95"
          >
            <Icon src={ArrowPath} size="16" />
            Try Again
          </button>
        {/if}
      </div>
    {/if}
  {:else if showEmpty}
    {#if emptySlot}
      {@render emptySlot()}
    {:else}
      <EmptyState 
        title={emptyTitle} 
        message={emptyMessage} 
        icon={emptyIcon} 
      />
    {/if}
  {:else if showContent && children}
    {@render children(data)}
  {/if}
</ErrorBoundary>
