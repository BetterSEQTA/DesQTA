<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Plus, Inbox, PaperAirplane, Trash, Star, Rss, ChatBubbleLeftRight } from 'svelte-hero-icons';
  import { getRSS } from '../../../utils/netUtil';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  let { selectedFolder, openFolder, openCompose } = $props<{
    selectedFolder: any;
    openFolder: (folder: any) => void;
    openCompose: () => void;
  }>();

  interface Feed {
    url: string;
  }
  async function a() {
    // Folder definitions
    let folders = [
      { name: 'Inbox', icon: Inbox, id: 'inbox' },
      { name: 'Sent', icon: PaperAirplane, id: 'sent' },
      { name: 'Starred', icon: Star, id: 'starred' },
      { name: 'Trash', icon: Trash, id: 'trash' },
    ];
    const feeds = await invoke<{
      feeds: Feed[];
    }>('get_settings');
    console.log(feeds.feeds);
    for (let item of feeds.feeds) {
      console.log(item.url);
      let title = await getRSS(item.url);
      folders.push({
        name: `RSS: ${title.channel.title}`,
        icon: Rss,
        id: `rss-${item.url}`,
      });
    }
    return folders;
  }
  const rssFeeds = a();
</script>

<aside
  class="flex flex-col border-r backdrop-blur-sm xl:w-64 border-slate-300/50 dark:border-slate-800/50 bg-white dark:bg-slate-900 shadow-md rounded-xl m-2">
  <div class="p-4 border-b border-slate-300/50 dark:border-slate-800/50">
    <button
      class="flex gap-2 items-center px-4 py-2.5 w-full text-sm font-semibold text-white accent-bg rounded-xl shadow-lg transition-all duration-200 sm:text-base hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
      onclick={openCompose}>
      <Icon src={Plus} class="w-5 h-5" />
      <span>Compose</span>
    </button>
  </div>
  {#await rssFeeds}
    <p>Loading Data...</p>
  {:then folders}
    <nav class="flex flex-col flex-1 gap-1 px-2 py-4">
      {#each folders as folder}
        <button
          class="w-full flex items-center gap-3 px-4 sm:px-6 py-2.5 text-left text-sm sm:text-base font-medium rounded-lg transition-all duration-200 relative group
            {selectedFolder === folder.name
              ? 'accent-bg text-white border-l-4 accent-bg pl-[1.25rem] shadow-md'
              : 'border-l-4 border-transparent text-slate-700 dark:text-white hover:bg-accent-100 dark:hover:bg-accent-700 hover:scale-[1.02]'}
            focus:outline-none focus:ring-2 accent-ring"
          onclick={() => openFolder(folder)}>
          <Icon src={folder.icon} class="w-5 h-5" />
          <span>{folder.name}</span>
          {#if selectedFolder === folder.name}
            <div
              class="absolute right-2 top-1/2 w-1.5 h-1.5 accent-bg rounded-full -translate-y-1/2">
            </div>
          {/if}
        </button>
      {/each}
    </nav>
  {:catch error}
    <p>Error! {error}</p>
  {/await}
</aside>
