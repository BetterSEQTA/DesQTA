<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { PaperAirplane } from 'svelte-hero-icons';
  import type { Message } from './types.js';

  let { 
    newMessage, 
    sending, 
    uploadingAttachment, 
    replyTo, 
    attachmentFile, 
    attachmentPreview, 
    sendError, 
    messageInput, 
    onSendMessage, 
    onCancelReply, 
    onAttachmentChange, 
    onRemoveAttachment 
  } = $props<{
    newMessage: string;
    sending: boolean;
    uploadingAttachment: boolean;
    replyTo: Message | null;
    attachmentFile: File | null;
    attachmentPreview: string | null;
    sendError: string | null;
    messageInput: HTMLInputElement | null;
    onSendMessage: () => void;
    onCancelReply: () => void;
    onAttachmentChange: (event: Event) => void;
    onRemoveAttachment: () => void;
  }>();
</script>

{#if replyTo}
  <div class="mb-2 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
    Replying to: {replyTo.content}
    <button class="ml-auto text-xs text-red-500 hover:underline" on:click={onCancelReply}>Cancel</button>
  </div>
{/if}

{#if sendError}
  <div class="mb-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
    {sendError}
    <button class="ml-2 text-red-500 hover:underline" on:click={() => sendError = null}>✕</button>
  </div>
{/if}

<form class="flex gap-2 mt-auto" on:submit|preventDefault={onSendMessage}>
  <input 
    bind:this={messageInput}
    type="text" 
    class="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ring-accent-500 transition-colors duration-200" 
    placeholder="Type a message..." 
    bind:value={newMessage} 
    disabled={sending} 
  />
  
  <input 
    type="file" 
    accept="image/*" 
    class="hidden" 
    id="attachment-input" 
    on:change={onAttachmentChange} 
  />
  
  <label 
    for="attachment-input" 
    class="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600/50 focus:ring-2 focus:ring-blue-500 cursor-pointer {uploadingAttachment ? 'opacity-50 cursor-not-allowed' : ''}" 
    class:disabled={uploadingAttachment}
  >
    {uploadingAttachment ? 'Uploading...' : 'Attach'}
  </label>
  
  {#if attachmentPreview}
    <div class="relative">
      <img src={attachmentPreview} alt="Attachment preview" class="w-10 h-10 object-cover rounded" />
      <button 
        type="button" 
        class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center" 
        on:click={onRemoveAttachment}
      >
        ✕
      </button>
    </div>
  {/if}
  
  <button 
    type="submit" 
    class="px-4 py-2 rounded-lg bg-accent-500 text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" 
    disabled={!newMessage.trim() || sending || uploadingAttachment}
  >
    <Icon src={PaperAirplane} class="w-5 h-5" />
    <span>{sending ? 'Sending...' : 'Send'}</span>
  </button>
</form> 