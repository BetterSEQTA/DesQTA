<script lang="ts">
  import type { Message } from './types.js';

  let { 
    message, 
    isOwnMessage, 
    showSenderName, 
    onReply 
  } = $props<{
    message: Message;
    isOwnMessage: boolean;
    showSenderName: boolean;
    onReply: (message: Message) => void;
  }>();
</script>

<div class="flex {isOwnMessage ? 'justify-end' : 'justify-start'}">
  <div class="max-w-[70%] px-4 py-2 rounded-2xl shadow-md
    {isOwnMessage
      ? 'bg-accent-500 text-white border border-accent-600 dark:border-accent-400 drop-shadow-lg'
      : 'bg-white/30 dark:bg-slate-800/60 text-slate-900 dark:text-white'}">
    
    {#if showSenderName && message.sender}
      <div class="text-xs font-semibold mb-1 text-accent-500">{message.sender.displayName || message.sender.username}</div>
    {/if}
    
    {#if message.replyTo}
      <div class="mb-1 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
        Replying to: {message.replyTo.content}
      </div>
    {/if}
    
    <div class="text-sm">{message.content}</div>
    
    {#if message.attachment}
      <div class="mt-2">
        {#if message.attachment.mimeType?.startsWith('image/')}
          <img 
            src="https://accounts.betterseqta.adenmgb.com/api/files/public/{message.attachment.storedName}" 
            alt={message.attachment.filename} 
            class="max-w-xs rounded-lg" 
          />
        {:else}
          <a 
            href="https://accounts.betterseqta.adenmgb.com/api/files/public/{message.attachment.storedName}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="text-xs text-blue-500 underline"
          >
            📎 {message.attachment.filename || 'Download Attachment'}
          </a>
        {/if}
      </div>
    {/if}
    
    <div class="text-xs mt-1 text-slate-200/80 dark:text-slate-100/70">
      {new Date(message.createdAt).toLocaleString()}
    </div>
    
    <button 
      class="mt-1 text-xs text-accent-500 hover:underline" 
      on:click={() => onReply(message)}
    >
      Reply
    </button>
  </div>
</div> 