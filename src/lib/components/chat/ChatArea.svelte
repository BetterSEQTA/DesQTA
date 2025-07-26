<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ChatBubbleLeftRight } from 'svelte-hero-icons';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import type { Friend, Group, Message } from './types.js';
  import { getFullPfpUrl } from './types.js';

  let { 
    selectedFriend, 
    selectedGroup, 
    cloudUser, 
    messages, 
    messagesLoading, 
    messagesError, 
    hasMoreMessages, 
    loadingOlderMessages, 
    newMessage, 
    sending, 
    uploadingAttachment, 
    replyTo, 
    attachmentFile, 
    attachmentPreview, 
    sendError, 
    onLoadOlderMessages, 
    onSendMessage, 
    onReply, 
    onCancelReply, 
    onAttachmentChange, 
    onRemoveAttachment 
  } = $props<{
    selectedFriend: Friend | null;
    selectedGroup: Group | null;
    cloudUser: any;
    messages: Message[];
    messagesLoading: boolean;
    messagesError: string | null;
    hasMoreMessages: boolean;
    loadingOlderMessages: boolean;
    newMessage: string;
    sending: boolean;
    uploadingAttachment: boolean;
    replyTo: Message | null;
    attachmentFile: File | null;
    attachmentPreview: string | null;
    sendError: string | null;
    onLoadOlderMessages: () => void;
    onSendMessage: () => void;
    onReply: (message: Message) => void;
    onCancelReply: () => void;
    onAttachmentChange: (event: Event) => void;
    onRemoveAttachment: () => void;
  }>();

  // Internal DOM references
  let messageInput: HTMLInputElement | null = null;
  let chatEnd = $state<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages are added
  $effect(() => {
    // Track messages length to trigger scroll when new messages are added
    messages.length;
    if (chatEnd) {
      chatEnd.scrollIntoView({ behavior: 'smooth' });
    }
  });
</script>

<section class="flex-1 flex flex-col h-full bg-white/10 dark:bg-slate-900/60 shadow-md rounded-xl m-2 p-4 backdrop-blur-sm border border-slate-300/50 dark:border-slate-800/50">
  {#if selectedFriend || selectedGroup}
    <div class="flex items-center gap-3 mb-4">
      {#if selectedFriend}
        {#if selectedFriend.pfpUrl}
          <img src={getFullPfpUrl(selectedFriend.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${selectedFriend.id}`} alt={selectedFriend.displayName || selectedFriend.username} class="w-10 h-10 rounded-full object-cover" />
        {:else}
          <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${selectedFriend.id}`} alt={selectedFriend.displayName || selectedFriend.username} class="w-10 h-10 rounded-full object-cover" />
        {/if}
        <span class="font-semibold text-lg text-slate-900 dark:text-white">{selectedFriend.displayName || selectedFriend.username}</span>
      {:else if selectedGroup}
        <span class="font-semibold text-lg text-slate-900 dark:text-white">{selectedGroup.name}</span>
        <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">{selectedGroup.members?.length || 0} members</span>
      {/if}
    </div>
    
    <div class="flex-1 overflow-y-auto flex flex-col gap-2 pb-4">
      {#if messagesLoading}
        <div class="text-slate-500 dark:text-slate-300">Loading messages...</div>
      {:else if messagesError}
        <div class="text-red-500 dark:text-red-400">{messagesError}</div>
      {:else if messages.length === 0}
        <div class="text-slate-500 dark:text-slate-300">No messages yet. Say hi!</div>
      {:else}
        {#if hasMoreMessages}
          <div class="flex justify-center mb-4">
            <button 
              class="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" 
              on:click={onLoadOlderMessages}
              disabled={loadingOlderMessages}
            >
              {loadingOlderMessages ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        {/if}
        
        {#each messages as msg}
          <ChatMessage 
            message={msg}
            isOwnMessage={msg.senderId === (cloudUser?.id ?? -1)}
            showSenderName={!!selectedGroup && !!msg.sender}
            onReply={onReply}
          />
        {/each}
        
        <div bind:this={chatEnd}></div>
      {/if}
    </div>
    
    <ChatInput 
      {newMessage}
      {sending}
      {uploadingAttachment}
      {replyTo}
      {attachmentFile}
      {attachmentPreview}
      {sendError}
      {messageInput}
      onSendMessage={onSendMessage}
      onCancelReply={onCancelReply}
      onAttachmentChange={onAttachmentChange}
      onRemoveAttachment={onRemoveAttachment}
    />
  {:else}
    <div class="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-300">
      <Icon src={ChatBubbleLeftRight} class="w-12 h-12 mb-2 text-accent-500" />
      <div class="text-lg font-semibold">Select a friend or group to start chatting</div>
    </div>
  {/if}
</section> 