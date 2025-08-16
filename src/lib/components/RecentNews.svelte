<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from 'svelte-hero-icons';
  import { ArrowPath, ArrowTopRightOnSquare } from 'svelte-hero-icons';
  import { ChevronLeft, ChevronRight } from 'svelte-hero-icons';
  import dayjs from 'dayjs';
  import relativeTime from 'dayjs/plugin/relativeTime';
  import { logger } from '../../utils/logger';
  import { getRSS } from '../../utils/netUtil';
  import { invoke } from '@tauri-apps/api/core';

  dayjs.extend(relativeTime);

  interface NewsItem {
    title: string;
    link: string;
    published_at?: string;
    source?: string;
    image?: string | null;
  }

  let loading = $state(true);
  let error = $state('');
  let items = $state<NewsItem[]>([]);
  let selectedSource = $state('australia');

  const rssFeedsByCountry: Record<string, string[]> = {
    usa: [
      'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      'https://www.huffpost.com/section/front-page/feed',
      'https://www.npr.org/rss/rss.php',
    ],
    taiwan: [
      'https://news.ltn.com.tw/rss/all.xml',
      'https://www.taipeitimes.com/xml/index.rss',
      'https://international.thenewslens.com/rss',
    ],
    hong_kong: [
      'https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml',
      'https://www.scmp.com/rss/91/feed',
    ],
    canada: [
      'https://www.cbc.ca/cmlink/rss-topstories',
    ],
    uk: ['http://feeds.bbci.co.uk/news/rss.xml', 'https://www.theguardian.com/uk/rss'],
  };

  async function fetchAustraliaNews(): Promise<NewsItem[]> {
    try {
      const date = new Date();
      const from = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate() - 5}`;
      // Use the same Rust command as +page.svelte
      const response: any = await invoke('get_news_australia', { from, domains: 'abc.net.au' });

      const articles = (response?.articles || []) as any[];
      return articles.map((a) => ({
        title: a.title,
        link: a.url,
        published_at: a.publishedAt,
        source: 'abc.net.au',
        image: a.urlToImage ?? null,
      }));
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : (e?.message ?? 'Failed to fetch Australia news');
      if (String(msg).includes('rate_limited')) {
        error = 'News temporarily unavailable due to rate limits. Please try again later.';
      } else {
        error = 'Failed to fetch Australia news.';
      }
      logger.error('RecentNews', 'fetchAustraliaNews', 'Failed to fetch Australia news', { error: e });
      return [];
    }
  }

  async function fetchFromRSS(feeds: string[]): Promise<NewsItem[]> {
    const results = await Promise.all(
      feeds.map(async (feedUrl) => {
        try {
          const feed = await getRSS(feedUrl);
          if (!feed || !feed.items || !Array.isArray(feed.items)) return [];
          return feed.items.map((item: any) => ({
            title: item.title || 'No Title',
            link: item.link || feedUrl,
            published_at: item.isoDate || item.pubDate,
            image: item.enclosure?.url || item.image || null,
          }));
        } catch (e) {
          logger.warn('RecentNews', 'fetchFromRSS', 'Failed to fetch RSS feed', { feedUrl, error: e });
          return [];
        }
      })
    );
    return results.flat();
  }

  async function fetchNews() {
    loading = true;
    error = '';
    try {
      let fetched: NewsItem[] = [];
      if (selectedSource === 'australia') {
        fetched = await fetchAustraliaNews();
      } else if (rssFeedsByCountry[selectedSource]) {
        fetched = await fetchFromRSS(rssFeedsByCountry[selectedSource]);
      } else {
        // Default fallback to UK feeds
        fetched = await fetchFromRSS(rssFeedsByCountry['uk']);
      }
      items = fetched.filter((n) => n.title && n.link).slice(0, 20);
      logger.info('RecentNews', 'fetchNews', 'Loaded recent news', { count: items.length, source: selectedSource });
    } catch (e) {
      error = 'Failed to load news.';
      items = [];
      logger.error('RecentNews', 'fetchNews', 'Failed to load news', { error: e });
    } finally {
      loading = false;
    }
  }

  function timeAgo(iso?: string) {
    if (!iso) return '';
    return dayjs(iso).fromNow();
  }

  function openLink(url: string) {
    window.open(url, '_blank');
  }

  onMount(fetchNews);

  let scroller: HTMLDivElement | null = null;
  const scrollAmount = 360; // px per click for wider tiles

  function scrollLeft() {
    if (scroller) scroller.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }

  function scrollRight() {
    if (scroller) scroller.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }
</script>

<div class="flex flex-col gap-3 text-slate-900 dark:text-white">
  <div class="flex items-center justify-between">
    <h3 class="text-base sm:text-lg font-semibold">Recent News</h3>
    <button
      class="px-3 py-1.5 rounded-lg bg-slate-800/80 text-white hover:bg-slate-700/80 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      onclick={fetchNews}
      aria-label="Refresh news"
      title="Refresh"
    >
      <Icon src={ArrowPath} class="w-4 h-4" />
    </button>
  </div>

  {#if loading}
    <div class="text-sm opacity-80">Loading news…</div>
  {:else if error}
    <div class="text-sm text-red-500">{error}</div>
  {:else if items.length === 0}
    <div class="text-sm opacity-80">No news available.</div>
  {:else}
    <div class="relative">
      <!-- Scroll controls -->
      <button
        class="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-slate-900/70 text-white hover:bg-slate-800/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onclick={scrollLeft}
        aria-label="Scroll left"
      >
        <Icon src={ChevronLeft} class="w-6 h-6 sm:w-7 sm:h-7" />
      </button>
      <button
        class="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full bg-slate-900/70 text-white hover:bg-slate-800/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onclick={scrollRight}
        aria-label="Scroll right"
      >
        <Icon src={ChevronRight} class="w-6 h-6 sm:w-7 sm:h-7" />
      </button>

      <div
        bind:this={scroller}
        class="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth pr-1"
      >
        {#each items as n}
          <a
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            title={n.title}
            class="group relative min-w-[260px] max-w-[320px] h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 hover:scale-[1.02] transition-all duration-200"
          >
            {#if n.image}
              <img src={n.image} alt={n.title} class="absolute inset-0 w-full h-full object-cover" />
            {/if}
            <!-- Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
            <!-- Text -->
            <div class="absolute inset-x-0 bottom-0 p-3 text-white">
              <div class="font-semibold line-clamp-2">{n.title}</div>
              <div class="text-xs opacity-85 mt-1 flex items-center gap-2">
                {#if n.published_at}<span>{timeAgo(n.published_at)}</span>{/if}
                <Icon src={ArrowTopRightOnSquare} class="w-4 h-4 opacity-80 group-hover:opacity-100" />
              </div>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style> 