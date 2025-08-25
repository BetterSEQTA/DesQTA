<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { Icon, XMark } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';
  import { Button } from '$lib/components/ui';

  interface Props {
    open: boolean;
    title?: string;
    maxWidth?: string;
    maxHeight?: string;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    ariaLabel?: string;
    customClasses?: string;
    onclose?: () => void;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    title,
    maxWidth = 'max-w-4xl',
    maxHeight = '',
    showCloseButton = true,
    closeOnBackdrop = true,
    closeOnEscape = true,
    ariaLabel = 'Modal',
    customClasses = '',
    onclose = $bindable(() => {}),
    children,
  }: Props = $props();

  function closeModal() {
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEscape && e.key === 'Escape') {
      closeModal();
    }
  }

  function handleBackdropClick() {
    if (closeOnBackdrop) {
      closeModal();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="flex fixed right-0 bottom-0 left-0 top-16 z-50 justify-center items-center p-6"
    style="background-color: transparent;"
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}>
    <div
      class="fixed right-0 bottom-0 left-0 top-16 backdrop-blur-md bg-black/40"
      onclick={handleBackdropClick}
      onkeydown={handleKeydown}
      role="button"
      tabindex="0"
      transition:fade={{ duration: 200 }}>
    </div>
    <div
      class="overflow-hidden relative w-full {maxWidth} {maxHeight} {customClasses} rounded-3xl border shadow-2xl backdrop-blur-xl bg-white/90 border-slate-200/60 dark:bg-slate-900/90 dark:border-slate-700/60"
      style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="button"
      tabindex="0"
      aria-label={ariaLabel}
      transition:scale={{ duration: 300, start: 0.9 }}>
      {#if showCloseButton}
        <div class="absolute top-6 right-6 z-10">
          <Button
            variant="ghost"
            size="sm"
            icon={XMark}
            onclick={closeModal}
            ariaLabel="Close modal"
            class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          />
        </div>
      {/if}

      {#if title}
        <div class="px-8 pt-8 pb-4">
          <h2
            class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300">
            {title}
          </h2>
        </div>
      {/if}

      {@render children()}
    </div>
  </div>
{/if}
