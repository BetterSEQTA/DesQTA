<script lang="ts">
  import {
    themePreviewSession,
    applyThemePreviewSession,
    dismissThemePreviewSession,
  } from '$lib/services/themePreviewSessionService';
  import { previewingTheme } from '$lib/stores/theme';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import T from '$lib/components/T.svelte';

  let applying = $state(false);
  let dismissing = $state(false);

  let isTempCloudPreview = $derived(
    !!$themePreviewSession?.cloudThemeId && !!$themePreviewSession?.tempSlug,
  );

  async function handleApply() {
    if (applying) return;
    applying = true;
    try {
      await applyThemePreviewSession();
    } finally {
      applying = false;
    }
  }

  async function handleDismiss() {
    if (dismissing) return;
    dismissing = true;
    try {
      await dismissThemePreviewSession();
    } finally {
      dismissing = false;
    }
  }
</script>

{#if $previewingTheme && $themePreviewSession}
  <div
    class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[min(100vw-2rem,36rem)] max-md:bottom-[4.75rem]"
    transition:fly={{ y: 16, duration: 250, easing: cubicOut }}>
    <div
      class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-zinc-900 dark:text-white truncate">
          <T key="settings.previewing" fallback="Previewing" />
          {$themePreviewSession.displayName}
        </p>
        <p class="text-xs text-zinc-600 dark:text-zinc-400">
          {#if $themePreviewSession.source === 'deeplink'}
            Shared theme link — install it to keep using this theme?
          {:else if isTempCloudPreview}
            Install this theme to keep it after you leave settings.
          {:else}
            Apply this theme to keep it after previewing.
          {/if}
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg accent-bg hover:accent-bg-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          disabled={applying || dismissing}
          onclick={handleApply}>
          {applying
            ? isTempCloudPreview
              ? 'Installing…'
              : 'Applying…'
            : isTempCloudPreview
              ? 'Install'
              : 'Apply'}
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-sm font-medium transition-colors disabled:opacity-50"
          disabled={applying || dismissing}
          onclick={handleDismiss}>
          {dismissing ? 'Closing…' : 'Cancel'}
        </button>
      </div>
    </div>
  </div>
{/if}
