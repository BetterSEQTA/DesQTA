<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from 'svelte-hero-icons';
  import { ArrowPath, PencilSquare } from 'svelte-hero-icons';
  import { logger } from '../../utils/logger';
  import { seqtaFetch } from '../../utils/netUtil';

  interface MessagePreview {
    id: string;
    subject: string;
    from?: string;
    snippet?: string;
    timestamp?: string;
    unread?: boolean;
  }

  let loading = $state(true);
  let error = $state('');
  let items = $state<MessagePreview[]>([]);

  async function fetchMessages() {
    loading = true;
    error = '';
    try {
      const response = await seqtaFetch('/seqta/student/load/message?', {
        method: 'POST',
        body: {
          searchValue: '',
          sortBy: 'date',
          sortOrder: 'desc',
          action: 'list',
          label: 'inbox',
          offset: 0,
          limit: 20,
          datetimeUntil: null,
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const msgs = (data?.payload?.messages || []) as any[];
      items = msgs.slice(0, 5).map((m) => ({
        id: m.id,
        subject: m.subject,
        from: m.sender,
        snippet: m.subject + (m.attachments ? ' (Attachment)' : ''),
        timestamp: m.date?.replace('T', ' ').slice(0, 16) || '',
        unread: !m.read,
      }));
      logger.info('MessagesPreview', 'fetchMessages', 'Loaded recent messages', { count: items.length });
    } catch (e) {
      error = 'Failed to load messages.';
      items = [];
      logger.error('MessagesPreview', 'fetchMessages', 'Failed to load messages', { error: e });
    } finally {
      loading = false;
    }
  }

  function openMessage(id: string) {
    // Navigate to direqt-messages page, ideally selecting the message.
    // For now, open the messages route; deep-linking can be added later.
    window.location.href = '/direqt-messages';
  }

  function composeMessage() {
    // Navigate to messages page and open compose.
    window.location.href = '/direqt-messages';
  }

  onMount(fetchMessages);
</script>

<div class="flex flex-col gap-3 text-slate-900 dark:text-white">
  <div class="flex items-center justify-between">
    <h3 class="text-base sm:text-lg font-semibold">Messages</h3>
    <div class="flex gap-2">
      <button
        class="px-3 py-1.5 rounded-lg bg-slate-800/80 text-white hover:bg-slate-700/80 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onclick={fetchMessages}
        aria-label="Refresh messages"
        title="Refresh"
      >
        <Icon src={ArrowPath} class="w-4 h-4" />
      </button>
      <button
        class="px-3 py-1.5 rounded-lg accent-bg text-white hover:opacity-90 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        onclick={composeMessage}
        aria-label="Compose message"
        title="Compose"
      >
        <Icon src={PencilSquare} class="w-4 h-4" />
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-sm opacity-80">Loading messages…</div>
  {:else if error}
    <div class="text-sm text-red-500">{error}</div>
  {:else if items.length === 0}
    <div class="text-sm opacity-80">No recent messages.</div>
  {:else}
    <ul class="space-y-2">
      {#each items as m}
        <li>
          <button
            class="w-full text-left group p-2 rounded-lg transition-all duration-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            onclick={() => openMessage(m.id)}
            title={m.subject}
          >
            <div class="flex items-center justify-between gap-2">
              <div class="truncate">
                <div class="font-medium truncate {m.unread ? 'text-white' : ''}">{m.subject}</div>
                {#if m.snippet}
                  <div class="text-xs opacity-80 truncate">{m.snippet}</div>
                {/if}
              </div>
              <div class="text-xs opacity-80 shrink-0">{m.timestamp}</div>
            </div>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div> 