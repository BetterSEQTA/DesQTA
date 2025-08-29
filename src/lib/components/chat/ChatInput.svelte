<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { PaperAirplane } from 'svelte-hero-icons';
  import type { Message } from './types.js';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  import { Input, Button } from '$lib/components/ui';

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

  function renderPreview(md: string): string {
    const html = marked.parse(md || '', { breaks: true }) as string;
    return DOMPurify.sanitize(html);
  }

  function applyWrap(prefix: string, suffix: string = prefix) {
    if (!messageInput) return;
    const start = messageInput.selectionStart ?? newMessage.length;
    const end = messageInput.selectionEnd ?? newMessage.length;
    const before = newMessage.slice(0, start);
    const selected = newMessage.slice(start, end) || '';
    const after = newMessage.slice(end);
    const next = `${before}${prefix}${selected}${suffix}${after}`;
    newMessage = next;
    // Reset cursor to end of inserted selection
    const caretPos = (before + prefix + selected + suffix).length;
    setTimeout(() => {
      if (!messageInput) return;
      messageInput.focus();
      messageInput.setSelectionRange(caretPos, caretPos);
    }, 0);
  }

  function applyLinePrefix(prefix: string) {
    if (!messageInput) return;
    const start = messageInput.selectionStart ?? 0;
    const end = messageInput.selectionEnd ?? newMessage.length;
    const before = newMessage.slice(0, start);
    const selected = newMessage.slice(start, end) || '';
    const after = newMessage.slice(end);
    const lines = selected.split(/\r?\n/);
    const formatted = lines.map((l: string) => (l ? `${prefix} ${l}` : prefix)).join('\n');
    const next = `${before}${formatted}${after}`;
    newMessage = next;
    const caretPos = (before + formatted).length;
    setTimeout(() => {
      if (!messageInput) return;
      messageInput.focus();
      messageInput.setSelectionRange(caretPos, caretPos);
    }, 0);
  }

  function applyLink() {
    if (!messageInput) return;
    const start = messageInput.selectionStart ?? newMessage.length;
    const end = messageInput.selectionEnd ?? newMessage.length;
    const before = newMessage.slice(0, start);
    const selected = newMessage.slice(start, end) || 'link text';
    const after = newMessage.slice(end);
    const snippet = `[${selected}](https://)`;
    newMessage = `${before}${snippet}${after}`;
    // Place cursor inside the URL placeholder
    const caretPos = (before + `[${selected}](https://`).length;
    setTimeout(() => {
      if (!messageInput) return;
      messageInput.focus();
      messageInput.setSelectionRange(caretPos, caretPos);
    }, 0);
  }

  function applyCodeBlock() {
    if (!messageInput) return;
    const start = messageInput.selectionStart ?? newMessage.length;
    const end = messageInput.selectionEnd ?? newMessage.length;
    const before = newMessage.slice(0, start);
    const selected = newMessage.slice(start, end) || '';
    const after = newMessage.slice(end);
    const block = `\n\n\
\`\`\`\n${selected}\n\`\`\`\n`;
    newMessage = `${before}${block}${after}`;
    const caretPos = (before + block).length;
    setTimeout(() => {
      if (!messageInput) return;
      messageInput.focus();
      messageInput.setSelectionRange(caretPos, caretPos);
    }, 0);
  }
</script>

{#if replyTo}
  <div class="mb-2 p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
    Replying to: {replyTo.content}
    <button class="ml-auto text-xs text-red-500 hover:underline" onclick={onCancelReply}>Cancel</button>
  </div>
{/if}

{#if sendError}
  <div class="mb-2 p-2 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">
    {sendError}
    <button class="ml-2 text-red-500 hover:underline" onclick={() => sendError = null}>✕</button>
  </div>
{/if}

<!-- Formatting toolbar -->
<div class="flex flex-wrap items-center gap-2 mb-2">
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyWrap('**')} title="Bold (Ctrl+B)">B</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyWrap('_')} title="Italic (Ctrl+I)">I</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyWrap('~~')} title="Strikethrough">S</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyWrap('`')} title="Inline code">`</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={applyCodeBlock} title="Code block">{"```"}</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={applyLink} title="Link">🔗</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyLinePrefix('-')} title="Bulleted list">•</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyLinePrefix('1.')} title="Numbered list">1.</button>
  <button type="button" class="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700/50 text-slate-800 dark:text-white transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500" onclick={() => applyLinePrefix('>')} title="Blockquote">“</button>
</div>

<form class="flex gap-2 mt-auto" onsubmit={(e) => { e.preventDefault(); onSendMessage(); }}>
  <Input
    bind:value={newMessage}
    placeholder="Type a message..."
    disabled={sending}
    class="flex-1"
    inputClass="bg-white/60 dark:bg-slate-900/80"
  />
  
  <input 
    type="file" 
    accept="image/*" 
    class="hidden" 
    id="attachment-input" 
    onchange={onAttachmentChange} 
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
        onclick={onRemoveAttachment}
      >
        ✕
      </button>
    </div>
  {/if}
  
  <button 
    type="submit" 
    class="px-4 py-2 rounded-lg bg-accent-500 text-white font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50" 
    disabled={!newMessage.trim() || sending || uploadingAttachment}
    onclick={onSendMessage}
  >
    <Icon src={PaperAirplane} class="w-5 h-5" />
    <span>{sending ? 'Sending...' : 'Send'}</span>
  </button>
</form>

<!-- Live Markdown preview -->
{#if newMessage.trim().length > 0}
  <div class="mt-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
    <div class="text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">Preview</div>
    <div class="prose prose-sm dark:prose-invert max-w-none">{@html renderPreview(newMessage)}</div>
  </div>
{/if} 