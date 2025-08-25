<script lang="ts">
  import type { Message } from '../../routes/direqt-messages/types';

  interface Props {
    item: Message;
    index: number;
    selectedMessage: Message | null;
    openMessage: (msg: Message) => void;
  }

  let { item: msg, index, selectedMessage, openMessage }: Props = $props();

  // Format date to readable format
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if date is today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Check if date is yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Check if date is within this year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // Otherwise return full date
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Check if message has attachments
  function hasAttachment(preview: string): boolean {
    return preview.includes('(Attachment)');
  }
</script>

<button
  class="w-full text-left p-3 mb-2 transition-all duration-200 flex flex-col gap-2
    rounded-lg relative animate-fadeIn shadow-md
    {selectedMessage?.id === msg.id
    ? 'border-2 border-accent-500 focus:ring-2 accent-ring'
    : 'border border-slate-300/30 dark:border-slate-800/30 hover:border-accent-500/30 dark:hover:border-accent-700/30 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02]'}
    {msg.unread ? 'border-l-4 border-l-accent-500' : ''}
    focus:outline-none focus:ring-2 accent-ring"
  onclick={() => openMessage(msg)}>
  <!-- Top row: sender and date -->
  <div class="flex justify-between items-center w-full">
    <div class="flex gap-2 items-center">
      <span
        class="font-bold text-sm {msg.unread
          ? 'text-indigo-400'
          : 'text-slate-800 dark:text-slate-200'}">{msg.sender}</span>
      {#if msg.unread}
        <span class="w-2 h-2 bg-indigo-500 rounded-full"></span>
      {/if}
    </div>
    <span
      class="px-2 py-1 text-xs rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
      >{formatDate(msg.date)}</span>
  </div>

  <!-- Middle row: subject -->
  <div
    class="font-semibold text-sm {msg.unread
      ? 'text-indigo-400'
      : 'text-slate-800 dark:text-slate-200'} flex items-center">
    <span class="line-clamp-1">{msg.subject}</span>
    {#if hasAttachment(msg.preview)}
      <span class="ml-2 text-slate-600 dark:text-slate-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </span>
    {/if}
  </div>

  <!-- Bottom row: to and preview -->
  <div class="flex items-center text-xs text-slate-600 dark:text-slate-400">
    <span class="flex items-center whitespace-nowrap">
      <span class="inline-block mr-1 opacity-70">To:</span>
      <span class="max-w-[100px] truncate">{msg.to}</span>
    </span>
    <span class="mx-1">•</span>
    <span class="opacity-70 line-clamp-1">
      {hasAttachment(msg.preview) ? msg.preview.replace(/\(Attachment\)/, '') : msg.preview}
    </span>
  </div>
</button> 