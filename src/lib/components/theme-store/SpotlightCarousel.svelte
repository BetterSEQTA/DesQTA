<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import {
    Icon,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Heart,
    ArrowDownTray,
    CheckCircle,
    Star,
  } from 'svelte-hero-icons';
  import type { CloudTheme } from '$lib/services/themeStoreService';
  import { resolveImageUrl } from '$lib/services/themeStoreService';
  import type { ThemeManifest } from '$lib/services/themeService';

  interface Props {
    themes: CloudTheme[];
    manifests?: Map<string, ThemeManifest>;
    currentThemeSlug?: string;
    installedThemeSlugs?: Set<string>;
    themeUserStatus?: Map<
      string,
      {
        is_favorited: boolean;
        has_rated: boolean;
        rating: { rating: number; comment?: string } | null;
      }
    >;
    themeUpdates?: Map<
      string,
      { hasUpdate: boolean; currentVersion?: string; latestVersion?: string }
    >;
    onQuickPreview?: (themeId: string) => Promise<void>;
    onDownload?: (themeId: string) => Promise<void>;
    onUpdate?: (themeId: string) => Promise<void>;
    onFavorite?: (themeId: string, favorited: boolean) => Promise<void>;
    onApply?: (themeSlug: string) => Promise<void>;
  }

  let {
    themes,
    manifests = new Map(),
    currentThemeSlug,
    installedThemeSlugs = new Set(),
    themeUserStatus = new Map(),
    themeUpdates = new Map(),
    onQuickPreview,
    onDownload,
    onUpdate,
    onFavorite,
    onApply,
  }: Props = $props();

  let currentIndex = $state(0);
  let autoRotateInterval: ReturnType<typeof setInterval> | null = null;
  let hovered = $state(false);
  let downloading = $state(false);
  let favoriting = $state(false);
  let previewImageUrls = $state<Map<string, string | null>>(new Map());
  const ROTATE_INTERVAL = 6000; // 6 seconds

  // Load preview images with caching
  $effect(() => {
    (async () => {
      for (const theme of themes) {
        if (!previewImageUrls.has(theme.id)) {
          const url = await resolveImageUrl(
            theme.preview?.thumbnail || null,
            theme.id,
            'thumbnail',
            undefined,
            theme.updated_at,
          );
          previewImageUrls.set(theme.id, url);
        }
      }
    })();
  });

  function nextSlide() {
    if (themes.length > 0) {
      currentIndex = (currentIndex + 1) % themes.length;
    }
  }

  function prevSlide() {
    if (themes.length > 0) {
      currentIndex = (currentIndex - 1 + themes.length) % themes.length;
    }
  }

  function goToSlide(index: number) {
    currentIndex = index;
  }

  function startAutoRotate() {
    if (themes.length <= 1 || hovered) return;
    autoRotateInterval = setInterval(() => {
      nextSlide();
    }, ROTATE_INTERVAL);
  }

  function stopAutoRotate() {
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
      autoRotateInterval = null;
    }
  }

  function handleMouseEnter() {
    hovered = true;
    stopAutoRotate();
  }

  function handleMouseLeave() {
    hovered = false;
    startAutoRotate();
  }

  async function handleDownload(theme: CloudTheme) {
    if (!onDownload || downloading) return;
    downloading = true;
    try {
      await onDownload(theme.id);
    } finally {
      downloading = false;
    }
  }

  async function handleFavorite(theme: CloudTheme, favorited: boolean) {
    if (!onFavorite || favoriting) return;
    favoriting = true;
    try {
      await onFavorite(theme.id, favorited);
    } finally {
      favoriting = false;
    }
  }

  async function handleApply(theme: CloudTheme) {
    if (!onApply) return;
    await onApply(theme.slug);
  }

  $effect(() => {
    if (!hovered) {
      startAutoRotate();
    }
    return () => {
      stopAutoRotate();
    };
  });

  onMount(() => {
    startAutoRotate();
  });

  onDestroy(() => {
    stopAutoRotate();
  });
</script>

{#if themes.length > 0}
  <div
    class="relative w-full h-[500px] overflow-hidden mb-12 rounded-2xl flex"
    role="region"
    aria-label="Featured themes carousel"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}>
    <!-- Side navigation (outside content, never overlaps text) -->
    {#if themes.length > 1}
      <div class="flex shrink-0 items-center px-3 z-20">
        <button
          type="button"
          onclick={prevSlide}
          class="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 transition-all duration-200 transform hover:scale-110 active:scale-95"
          aria-label="Previous theme">
          <Icon src={ChevronLeft} class="w-6 h-6" />
        </button>
      </div>
    {/if}

    <div class="relative flex-1 min-w-0 h-full">
      <!-- Featured Badge -->
      <div
        class="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-lg">
        <Icon src={Sparkles} class="w-4 h-4 accent-text" />
        <span class="text-sm font-semibold text-zinc-900 dark:text-white">Featured</span>
      </div>

      <!-- Slides Container -->
      <div class="relative w-full h-full">
      {#each themes as theme, i}
        {#if i === currentIndex}
          {@const previewUrl = previewImageUrls.get(theme.id) || null}
          {@const isDownloaded = installedThemeSlugs.has(theme.slug)}
          {@const isFavorited = themeUserStatus.get(theme.id)?.is_favorited || false}
          {@const hasUpdate = themeUpdates.get(theme.id)?.hasUpdate || false}

          <div
            class="absolute inset-0 w-full h-full"
            transition:fly={{ x: i > currentIndex ? 100 : -100, duration: 500, easing: cubicOut }}>
            <!-- Background Image -->
            <div
              class="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900"
              style="background-image: {previewUrl
                ? `url('${previewUrl}')`
                : 'none'}; background-size: cover; background-position: center;">
              <!-- Overlay Gradient -->
              <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/80">
              </div>
            </div>

            <!-- Content -->
            <div class="relative z-10 h-full flex items-center px-6 lg:px-10 pb-16" role="presentation">
              <div class="w-full mx-auto">
                <div class="grid lg:grid-cols-2 gap-8 items-center">
                  <!-- Left: Theme Info -->
                  <div class="space-y-6 text-white">
                    <div>
                      <h2
                        class="text-4xl lg:text-5xl font-bold mb-4 leading-tight"
                        transition:fade={{ duration: 300, delay: 100 }}>
                        {theme.name}
                      </h2>
                      <p
                        class="text-lg lg:text-xl text-white/90 mb-6 line-clamp-3"
                        transition:fade={{ duration: 300, delay: 200 }}>
                        {theme.description || 'A beautiful theme for DesQTA'}
                      </p>
                    </div>

                    <!-- Stats -->
                    <div
                      class="flex flex-wrap items-center gap-6 text-white/80"
                      transition:fade={{ duration: 300, delay: 300 }}>
                      {#if theme.rating_average > 0}
                        <div class="flex items-center gap-2">
                          <Icon src={Star} class="w-5 h-5 text-yellow-400 fill-current" />
                          <span class="font-medium">{theme.rating_average.toFixed(1)}</span>
                          <span class="text-sm">({theme.rating_count})</span>
                        </div>
                      {/if}
                      <div class="flex items-center gap-2">
                        <Icon src={ArrowDownTray} class="w-5 h-5" />
                        <span class="font-medium">{theme.download_count.toLocaleString()}</span>
                        <span class="text-sm">downloads</span>
                      </div>
                      {#if theme.author}
                        <div class="text-sm">
                          by <span class="font-medium">{theme.author}</span>
                        </div>
                      {/if}
                    </div>

                    <!-- Actions -->
                    <div
                      class="flex flex-wrap items-center gap-4"
                      transition:fade={{ duration: 300, delay: 400 }}>
                      {#if isDownloaded}
                        <button
                          type="button"
                          onclick={() => handleApply(theme)}
                          class="px-6 py-3 bg-white text-zinc-900 font-semibold rounded-xl hover:bg-zinc-100 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg">
                          <Icon src={CheckCircle} class="w-5 h-5" />
                          Apply Theme
                        </button>
                      {:else if hasUpdate}
                        <button
                          type="button"
                          onclick={() => onUpdate?.(theme.id)}
                          class="px-6 py-3 accent-bg text-white font-semibold rounded-xl hover:accent-bg-hover transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg">
                          <Icon src={ArrowDownTray} class="w-5 h-5" />
                          Update Available
                        </button>
                      {:else}
                        <button
                          type="button"
                          onclick={() => handleDownload(theme)}
                          disabled={downloading}
                          class="px-6 py-3 accent-bg text-white font-semibold rounded-xl hover:accent-bg-hover transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg">
                          <Icon src={ArrowDownTray} class="w-5 h-5" />
                          {downloading ? 'Downloading...' : 'Download'}
                        </button>
                      {/if}
                      {#if onQuickPreview}
                        <button
                          type="button"
                          onclick={async () => {
                            if (onQuickPreview) {
                              await onQuickPreview(theme.id);
                            }
                          }}
                          class="px-6 py-3 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl hover:bg-white/20 border border-white/20 transition-all duration-200 transform hover:scale-105 active:scale-95">
                          Preview
                        </button>
                      {/if}
                      <button
                        type="button"
                        onclick={() => handleFavorite(theme, !isFavorited)}
                        disabled={favoriting}
                        class="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 border border-white/20 transition-all duration-200 transform hover:scale-110 active:scale-95 disabled:opacity-50">
                        <Icon
                          src={Heart}
                          class="w-5 h-5 {isFavorited ? 'fill-current text-red-500' : ''}" />
                      </button>
                    </div>
                  </div>

                  <!-- Right: Preview Image (optional, can be hidden on mobile) -->
                  {#if previewUrl}
                    <div class="hidden lg:block">
                      <div
                        class="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                        transition:fade={{ duration: 300, delay: 200 }}>
                        <img src={previewUrl} alt={theme.name} class="w-full h-auto object-cover" />
                        <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent">
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/each}
      </div>

      <!-- Navigation Dots -->
      {#if themes.length > 1}
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
          {#each themes as _, i}
            <button
              type="button"
              class="h-2 rounded-full transition-all duration-300 {i === currentIndex
                ? 'w-8 accent-bg'
                : 'w-2 bg-white/40 hover:bg-white/60'}"
              onclick={() => goToSlide(i)}
              aria-label={`Go to theme ${i + 1}`}></button>
          {/each}
        </div>
      {/if}
    </div>

    {#if themes.length > 1}
      <div class="flex shrink-0 items-center px-3 z-20">
        <button
          type="button"
          onclick={nextSlide}
          class="p-3 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 transition-all duration-200 transform hover:scale-110 active:scale-95"
          aria-label="Next theme">
          <Icon src={ChevronRight} class="w-6 h-6" />
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
