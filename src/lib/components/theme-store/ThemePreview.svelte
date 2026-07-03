<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { Icon, XMark, ChevronLeft, ChevronRight, CheckCircle, Star, Link } from 'svelte-hero-icons';
  import type { CloudTheme } from '$lib/services/themeStoreService';
  import {
    resolveImageUrl,
    resolveImageUrlSync,
    themeStoreService,
  } from '$lib/services/themeStoreService';
  import type { ThemeManifest } from '$lib/services/themeService';
  import { cloudAuthService } from '$lib/services/cloudAuthService';
  import { copyThemeInstallLink } from '$lib/utils/themeDeeplink';
  import { logger } from '../../../utils/logger';

  interface Props {
    theme: CloudTheme;
    manifest?: ThemeManifest;
    open: boolean;
    onClose: () => void;
    onApply?: () => void;
    onThemeUpdate?: (updatedTheme: CloudTheme) => void;
  }

  let { theme, manifest, open, onClose, onApply, onThemeUpdate }: Props = $props();

  let currentScreenshot = $state(0);
  let screenshots = $state<string[]>([]);

  $effect(() => {
    const urls = theme.preview?.screenshots || manifest?.preview?.screenshots || [];
    if (urls.length === 0) {
      screenshots = [];
      return;
    }
    (async () => {
      const resolved = await Promise.all(
        urls.map((url) => resolveImageUrl(url, theme.id, 'screenshot').then((r) => r || url)),
      );
      screenshots = resolved;
    })();
  });

  // Rating/Review state
  let showRatingForm = $state(false);
  let userRating = $state(0);
  let hoveredRating = $state(0);
  let reviewComment = $state('');
  let submittingRating = $state(false);
  let isAuthenticated = $state(false);
  let copyingLink = $state(false);

  async function handleCopyInstallLink() {
    if (copyingLink) return;
    copyingLink = true;
    try {
      await copyThemeInstallLink(theme.id);
    } catch (error) {
      logger.error('ThemePreview', 'handleCopyInstallLink', 'Failed to copy install link', {
        error,
      });
    } finally {
      copyingLink = false;
    }
  }

  // Initialize rating form with existing user rating if available
  $effect(() => {
    if (open) {
      checkAuth();
      // Pre-fill form if user has already rated
      if (theme.user_rating) {
        userRating = theme.user_rating.rating;
        reviewComment = theme.user_rating.comment || '';
        showRatingForm = true; // Show form with existing rating
      } else {
        userRating = 0;
        reviewComment = '';
        showRatingForm = false;
      }
    }
  });

  async function checkAuth() {
    try {
      const token = await cloudAuthService.getToken();
      isAuthenticated = !!token;
    } catch {
      isAuthenticated = false;
    }
  }

  async function handleRatingSubmit() {
    if (userRating === 0) return;
    if (!isAuthenticated) {
      logger.warn('ThemePreview', 'handleRatingSubmit', 'User not authenticated');
      return;
    }

    submittingRating = true;
    try {
      const success = await themeStoreService.rateTheme(
        theme.id,
        userRating,
        reviewComment.trim() || undefined,
      );
      if (success) {
        // Update theme rating stats (optimistic update)
        theme.rating_count = (theme.rating_count || 0) + 1;
        // Recalculate average (simplified - ideally would get from server)
        const currentAvg = theme.rating_average || 0;
        const currentCount = theme.rating_count - 1;
        theme.rating_average = (currentAvg * currentCount + userRating) / theme.rating_count;

        // Update theme object with new rating
        theme.user_rating = {
          rating: userRating,
          comment: reviewComment.trim() || undefined,
        };

        // Notify parent if callback provided
        if (onThemeUpdate) {
          onThemeUpdate(theme);
        }

        showRatingForm = false;
        userRating = 0;
        reviewComment = '';
        logger.info('ThemePreview', 'handleRatingSubmit', 'Rating submitted successfully');
      }
    } catch (e) {
      logger.error('ThemePreview', 'handleRatingSubmit', 'Failed to submit rating', { error: e });
    } finally {
      submittingRating = false;
    }
  }

  function setRating(rating: number) {
    userRating = rating;
  }

  function nextScreenshot() {
    if (screenshots.length > 0) {
      currentScreenshot = (currentScreenshot + 1) % screenshots.length;
    }
  }

  function prevScreenshot() {
    if (screenshots.length > 0) {
      currentScreenshot = (currentScreenshot - 1 + screenshots.length) % screenshots.length;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'ArrowLeft') {
      prevScreenshot();
    } else if (event.key === 'ArrowRight') {
      nextScreenshot();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 mobile-modal-inset"
    role="dialog"
    aria-modal="true"
    aria-labelledby="theme-preview-title"
    tabindex="-1"
    transition:fade={{ duration: 300 }}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    }}>
    <button
      type="button"
      class="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      aria-label="Close preview"
      onclick={onClose}
      transition:fade={{ duration: 300 }}></button>

    <!-- Modal -->
    <div
      class="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 mobile-modal-max-h"
      role="document"
      transition:fly={{ y: 20, duration: 300, easing: cubicOut }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          onClose();
        }
      }}>
      <!-- Header -->
      <div
        class="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-700">
        <div>
          <h2 id="theme-preview-title" class="text-2xl font-bold text-zinc-900 dark:text-white">
            {theme.name}
          </h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            by {theme.author} • v{theme.version}
          </p>
        </div>
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-all duration-200 transform hover:scale-110 active:scale-95"
          onclick={onClose}
          aria-label="Close">
          <Icon src={XMark} class="w-6 h-6" />
        </button>
      </div>

      <!-- Screenshot Carousel -->
      <div class="relative flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        {#if screenshots.length > 0}
          <div class="relative h-full">
            {#each screenshots as screenshot, i}
              {#if i === currentScreenshot}
                <img
                  src={screenshot}
                  alt={`${theme.name} screenshot ${i + 1}`}
                  class="absolute inset-0 w-full h-full object-contain transition-opacity duration-300"
                  transition:fade={{ duration: 300 }} />
              {/if}
            {/each}

            <!-- Navigation -->
            {#if screenshots.length > 1}
              <button
                type="button"
                class="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                onclick={prevScreenshot}
                aria-label="Previous screenshot">
                <Icon src={ChevronLeft} class="w-6 h-6" />
              </button>
              <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                onclick={nextScreenshot}
                aria-label="Next screenshot">
                <Icon src={ChevronRight} class="w-6 h-6" />
              </button>

              <!-- Dots -->
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {#each screenshots as _, i}
                  <button
                    type="button"
                    class="h-2 rounded-full transition-all duration-200 {i === currentScreenshot
                      ? 'w-8 accent-bg'
                      : 'w-2 bg-white/50 dark:bg-zinc-700/50'}"
                    onclick={() => (currentScreenshot = i)}
                    aria-label={`Go to screenshot ${i + 1}`}></button>
                {/each}
              </div>

              <!-- Counter -->
              <div
                class="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm">
                {currentScreenshot + 1} / {screenshots.length}
              </div>
            {/if}
          </div>
        {:else if theme.preview?.thumbnail || manifest?.preview?.thumbnail}
          <img
            src={resolveImageUrlSync(
              theme.preview?.thumbnail || manifest?.preview?.thumbnail,
            ) || ''}
            alt={`${theme.name} preview`}
            class="w-full h-full object-contain" />
        {:else}
          <div class="flex items-center justify-center h-full text-zinc-400">
            No preview available
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-zinc-200 dark:border-zinc-700">
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{theme.description}</p>

        <!-- Stats -->
        <div class="flex items-center gap-6 mb-4 text-sm">
          {#if theme.rating_count > 0}
            <div class="flex items-center gap-1">
              <Icon src={Star} class="w-4 h-4 text-yellow-500 fill-current" />
              <span class="text-zinc-900 dark:text-white font-medium">
                {theme.rating_average.toFixed(1)}
              </span>
              <span class="text-zinc-500">({theme.rating_count})</span>
            </div>
          {:else}
            <div class="text-zinc-500 text-sm">No ratings yet</div>
          {/if}
          <div class="text-zinc-600 dark:text-zinc-400">
            {theme.download_count.toLocaleString()} downloads
          </div>
          <div class="text-zinc-600 dark:text-zinc-400">{theme.favorite_count} favorites</div>
        </div>

        <!-- Rating/Review Section -->
        {#if isAuthenticated}
          {#if !showRatingForm && !theme.user_rating}
            <button
              type="button"
              class="w-full mb-4 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
              onclick={() => (showRatingForm = true)}>
              <Icon src={Star} class="w-4 h-4" />
              Rate & Review
            </button>
          {:else if showRatingForm || theme.user_rating}
            <div
              class="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                {theme.user_rating ? 'Your Rating' : 'Rate this theme'}
              </h3>

              <!-- Star Rating -->
              <div class="flex items-center gap-1 mb-3">
                {#each Array(5) as _, i}
                  <button
                    type="button"
                    class="focus:outline-none transition-all duration-200 transform hover:scale-110"
                    onmouseenter={() => (hoveredRating = i + 1)}
                    onmouseleave={() => (hoveredRating = 0)}
                    onclick={() => setRating(i + 1)}>
                    <Icon
                      src={Star}
                      class="w-6 h-6 transition-colors duration-200 {hoveredRating > i ||
                      userRating > i
                        ? 'text-yellow-500 fill-current'
                        : 'text-zinc-300 dark:text-zinc-600'}" />
                  </button>
                {/each}
                {#if userRating > 0}
                  <span class="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {userRating}
                    {userRating === 1 ? 'star' : 'stars'}
                  </span>
                {/if}
              </div>

              <!-- Comment -->
              <textarea
                placeholder="Write a review (optional)..."
                bind:value={reviewComment}
                class="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none"
                rows="3"></textarea>

              <!-- Actions -->
              <div class="flex gap-2 mt-3">
                <button
                  type="button"
                  class="flex-1 px-4 py-2 text-sm font-medium text-white accent-bg hover:accent-bg-hover rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  onclick={handleRatingSubmit}
                  disabled={userRating === 0 || submittingRating}>
                  {#if submittingRating}
                    <span
                      class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"
                    ></span>
                    Submitting...
                  {:else}
                    Submit Review
                  {/if}
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg transition-all duration-200"
                  onclick={() => {
                    showRatingForm = false;
                    userRating = 0;
                    reviewComment = '';
                  }}>
                  Cancel
                </button>
              </div>
            </div>
          {/if}
        {:else}
          <div
            class="mb-4 p-3 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg text-center">
            <a
              href="https://accounts.betterseqta.org"
              target="_blank"
              class="text-accent-500 hover:text-accent-600 underline">
              Sign in
            </a>
            {' '}to rate and review themes
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex gap-3">
          {#if onApply}
            <button
              type="button"
              class="flex-1 px-6 py-3 rounded-xl accent-bg hover:accent-bg-hover text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              onclick={onApply}>
              <Icon src={CheckCircle} class="w-5 h-5" />
              Apply Theme
            </button>
          {/if}
          <button
            type="button"
            class="px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            title="Copy install link"
            aria-label="Copy install link"
            disabled={copyingLink}
            onclick={handleCopyInstallLink}>
            <Icon src={Link} class="w-5 h-5" />
          </button>
          <button
            type="button"
            class="px-6 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 font-medium transition-all duration-200 transform hover:scale-105 active:scale-95"
            onclick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
