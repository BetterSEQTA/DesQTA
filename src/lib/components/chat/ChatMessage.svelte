<script lang="ts">
  import type { Message } from './types.js';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { openUrl } from '@tauri-apps/plugin-opener';

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

  function renderMarkdown(md?: string): string {
    if (!md) return '';
    const html = marked.parse(md, { breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }

  async function handleLinkClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;
    let href = anchor.getAttribute('href');
    if (!href) return;

    // Prepend https:// if no scheme is provided (e.g., example.com or www.example.com)
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href);
    if (!hasScheme) {
      if (href.startsWith('//')) {
        href = 'https:' + href;
      } else {
        href = 'https://' + href.replace(/^\/+/, '');
      }
    }

    event.preventDefault();
    try {
      await openUrl(href);
    } catch (e) {
      // Fallback: if opener fails, allow default behavior
      window.open(href, '_blank');
    }
  }
</script>

<div class="flex {isOwnMessage ? 'justify-end' : 'justify-start'}">
  <div class="max-w-[70%] px-4 py-2 rounded-2xl shadow-md
    {isOwnMessage
      ? 'bg-accent-500 text-white border border-accent-600 dark:border-accent-400 drop-shadow-lg'
      : 'bg-white/30 dark:bg-slate-800/60 text-slate-900 dark:text-white'}" 
    onclick={handleLinkClick} 
    role="button" 
    tabindex="0" 
    onkeydown={(e) => e.key === 'Enter' && handleLinkClick(new MouseEvent('click'))}>
    
    {#if showSenderName && message.sender}
      <div class="text-xs font-semibold mb-1 text-accent-500">{message.sender.displayName || message.sender.username}</div>
    {/if}
    
    {#if message.replyTo}
      <div class="mb-1 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
        <div class="prose prose-sm dark:prose-invert max-w-none">{@html renderMarkdown(message.replyTo.content)}</div>
      </div>
    {/if}
    
    <div class="text-sm prose prose-sm dark:prose-invert max-w-none">{@html renderMarkdown(message.content)}</div>
    
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
      onclick={() => onReply(message)}
    >
      Reply
    </button>
  </div>
</div> 