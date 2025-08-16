<script lang="ts">
  import type { Message } from '../types';
  import VirtualList from '$lib/components/VirtualList.svelte';
  import VirtualMessageItem from '$lib/components/VirtualMessageItem.svelte';

  let { selectedFolder, messages, loading, error, selectedMessage, openMessage } = $props<{
    selectedFolder: string;
    messages: Message[];
    loading: boolean;
    error: string | null;
    selectedMessage: Message | null;
    openMessage: (msg: Message) => void;
  }>();

  // Filter messages for the selected folder
  const filteredMessages = $derived(messages.filter((m: Message) => m.folder === selectedFolder));
  
  // Message item height for virtual scrolling (estimated based on current design)
  const MESSAGE_ITEM_HEIGHT = 120;
</script>

<section
  class="w-full xl:w-[28rem] h-full border-r border-slate-300/50 dark:border-slate-800/50 flex flex-col bg-white dark:bg-slate-900 backdrop-blur-sm shadow-md rounded-xl m-2">
  <div
    class="flex items-center p-4 text-base font-semibold border-b text-slate-900 sm:text-lg border-slate-300/50 dark:border-slate-800/50 dark:text-white">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mr-2 w-5 h-5"
      viewBox="0 0 20 20"
      fill="currentColor">
      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
    {selectedFolder}
  </div>

  <div class="flex-1 p-2">
    {#if loading}
      <div
        class="flex flex-col justify-center items-center p-8 h-32 text-center text-slate-600 dark:text-slate-300">
        <div
          class="w-8 h-8 rounded-full border-4 animate-spin sm:w-10 sm:h-10 border-accent-500/30 border-t-accent-500">
        </div>
        <p class="mt-4 text-sm sm:text-base">Loading messages...</p>
      </div>
    {:else if error}
      <div class="flex justify-center items-center p-8 h-32 text-center text-red-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="mr-2 w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm sm:text-base">{error}</span>
      </div>
    {:else if filteredMessages.length === 0}
      <div
        class="flex flex-col justify-center items-center p-8 h-32 text-center text-slate-600 dark:text-slate-300">
        <div
          class="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-2xl sm:text-3xl shadow-[0_0_20px_rgba(99,102,241,0.3)] animate-gradient">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-8 h-8 sm:w-10 sm:h-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p class="mt-4 text-sm sm:text-base">No messages in this folder.</p>
      </div>
    {:else}
      <div class="flex-1 scrollbar-thin scrollbar-thumb-accent-500/30 scrollbar-track-slate-800/10">
        <VirtualList
          items={filteredMessages}
          itemHeight={MESSAGE_ITEM_HEIGHT}
          containerHeight={600}
          keyFunction={(item) => item.id}
          let:item>
          <VirtualMessageItem 
            {item}
            index={0}
            {selectedMessage}
            {openMessage}
          />
        </VirtualList>
      </div>
    {/if}
  </div>
</section>

<style>
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
  }

  @keyframes gradient {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
</style>
