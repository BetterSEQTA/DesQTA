<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { seqtaFetch, getRSS } from '../../utils/netUtil';
  import { type Message } from './types';
  import { cache } from '../../utils/cache';
  import { invoke } from '@tauri-apps/api/core';

  // Components
  import Sidebar from './components/Sidebar.svelte';
  import MessageList from './components/MessageList.svelte';
  import MessageDetail from './components/Message.svelte';
  import ComposeModal from './components/ComposeModal.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import BetterSeqtaChat from './components/BetterSeqtaChat.svelte';

  // External Libraries
  import dayjs from 'dayjs';

  let messages = $state<Message[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selectedFolder = $state('Inbox');
  let selectedRSS = $state();
  let selectedMessage = $state<Message | null>(null);
  let showComposeModal = $state(false);
  let composeSubject = $state('');
  let composeBody = $state('');

  let detailLoading = $state(false);
  let detailError = $state<string | null>(null);

  let starring = $state(false);
  let deleting = $state(false);
  let restoring = $state(false);

  // Derived state for mobile modal
  let showMobileModal = $derived(!!selectedMessage);
  let selectedTab = $state('SEQTA'); // 'SEQTA' or 'BetterSEQTA'
  let seqtaLoadFailed = $state(false);
  let seqtaMessagesEnabled = $state<boolean | null>(null);

  onMount(async () => {
    // Always enable both tabs regardless of SEQTA config
    seqtaMessagesEnabled = true;
  });

  async function fetchMessages(folderLabel: string = 'inbox', rssname: string = '') {
    loading = true;
    error = null;
    seqtaLoadFailed = false;
    console.log(folderLabel);
    try {
      if (folderLabel === 'sent') {
        // Fetch both sent and outbox, then combine
        const [sentRes, outboxRes] = await Promise.all([
          seqtaFetch('/seqta/student/load/message?', {
            method: 'POST',
            body: {
              searchValue: '',
              sortBy: 'date',
              sortOrder: 'desc',
              action: 'list',
              label: 'sent',
              offset: 0,
              limit: 100,
              datetimeUntil: null,
            },
          }),
          seqtaFetch('/seqta/student/load/message?', {
            method: 'POST',
            body: {
              searchValue: '',
              sortBy: 'date',
              sortOrder: 'desc',
              action: 'list',
              label: 'outbox',
              offset: 0,
              limit: 100,
              datetimeUntil: null,
            },
          }),
        ]);
        const sentData = typeof sentRes === 'string' ? JSON.parse(sentRes) : sentRes;
        const outboxData = typeof outboxRes === 'string' ? JSON.parse(outboxRes) : outboxRes;
        const sentMsgs = (sentData?.payload?.messages || []).map((msg: any) => ({
          id: msg.id,
          folder: 'Sent',
          sender: msg.sender,
          to: msg.participants?.[0]?.name || '',
          subject: msg.subject,
          preview: msg.subject + (msg.attachments ? ' (Attachment)' : ''),
          body: '',
          date: msg.date?.replace('T', ' ').slice(0, 16) || '',
          unread: !msg.read,
        }));
        const outboxMsgs = (outboxData?.payload?.messages || []).map((msg: any) => ({
          id: msg.id,
          folder: 'Sent',
          sender: msg.sender,
          to: msg.participants?.[0]?.name || '',
          subject: msg.subject,
          preview: msg.subject + (msg.attachments ? ' (Attachment)' : ''),
          body: '',
          date: msg.date?.replace('T', ' ').slice(0, 16) || '',
          unread: !msg.read,
        }));
        messages = [...sentMsgs, ...outboxMsgs].sort((a, b) => b.date.localeCompare(a.date));
      } else if (folderLabel.includes('rss-')) {
        let rssfeeddata: any = [];
        console.log();
        let rss = await getRSS(folderLabel.replace('rss-', ''));
        console.log(rss);
        rssfeeddata = rss.feeds
          ?.map((msg: any) => {
            let date;
            let description;
            if (msg.description === undefined) {
              description = 'No description available';
            } else {
              description = msg.description;
            }
            if (msg.pubDate === null) {
              date = '';
            } else {
              date = dayjs(msg.pubDate).format('YYYY-MM-DD HH:mm:ss');
            }
            console.log(date);
            return {
              id: Math.floor(Math.random() * 10000000) + 1,
              folder: rssname,
              sender: rss.channel.title,
              to: '',
              subject: msg.title,
              preview: `${msg.title} from ${rss.title}`,
              date: date,
              body: `<a href="${msg.link}">View the RSS feed link.</a> <br> ${description}`,
            };
          })
          .sort((a: any, b: any) => b.date.localeCompare(a.date));
        // console.log(rssfeeddata)
        messages = rssfeeddata;
      } else {
        const response = await seqtaFetch('/seqta/student/load/message?', {
          method: 'POST',
          body: {
            searchValue: '',
            sortBy: 'date',
            sortOrder: 'desc',
            action: 'list',
            label: folderLabel,
            offset: 0,
            limit: 100,
            datetimeUntil: null,
          },
        });

        const data = typeof response === 'string' ? JSON.parse(response) : response;
        if (data?.payload?.messages) {
          messages = data.payload.messages.map((msg: any) => ({
            id: msg.id,
            folder: folderLabel.charAt(0).toUpperCase() + folderLabel.slice(1),
            sender: msg.sender,
            to: msg.participants?.[0]?.name || '',
            subject: msg.subject,
            preview: msg.subject + (msg.attachments ? ' (Attachment)' : ''),
            body: '',
            date: msg.date?.replace('T', ' ').slice(0, 16) || '',
            unread: !msg.read,
            starred: !!msg.starred,
          }));
        } else {
          messages = [];
        }
      }
    } catch (e) {
      error = 'Failed to load messages.';
      messages = [];
      seqtaLoadFailed = true;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (selectedTab === 'SEQTA') {
    fetchMessages('inbox');
    }
  });

  async function openMessage(msg: Message) {
    selectedMessage = msg;
    msg.unread = false;

    // Check cache first
    const cacheKey = `message_${msg.id}`;
    const cachedContent = cache.get<string>(cacheKey);

    if (cachedContent) {
      msg.body = cachedContent;
      return;
    }

    detailLoading = true;
    detailError = null;
    try {
      const response = await seqtaFetch('/seqta/student/load/message?', {
        method: 'POST',
        body: {
          action: 'message',
          id: msg.id,
        },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (data?.payload?.contents) {
        msg.body = data.payload.contents;
        // Cache the message content for 24 hours
        cache.set(cacheKey, msg.body, 1440); // 24 hours TTL
      } else if (selectedFolder.includes('RSS')) {
        msg.body = msg.body;
      } else {
        msg.body = '<em>No content.</em>';
      }
      // If the API returns starred in the detail, update it
      if (typeof data?.payload?.starred !== 'undefined') {
        msg.starred = !!data.payload.starred;
      }
    } catch (e) {
      detailError = 'Failed to load message.';
      msg.body = '';
    } finally {
      detailLoading = false;
    }
  }

  function openFolder(folder: any) {
    selectedFolder = folder.name;
    selectedMessage = null;
    console.log(folder.id);
    if (folder.id.includes('rss-')) {
      selectedRSS = folder.id;
      fetchMessages(folder.id, folder.name);
    } else fetchMessages(folder.id);
  }

  function openCompose() {
    showComposeModal = true;
    composeSubject = '';
    composeBody = '';
  }

  function closeModal() {
    showComposeModal = false;
  }

  async function starMessage(msg: Message) {
    if (starring) return;
    starring = true;
    try {
      let newStarred = true;
      // If in Starred folder and already starred, unstar
      if (selectedFolder === 'Starred' && msg.starred) {
        newStarred = false;
      }
      const response = await seqtaFetch('/seqta/student/save/message?', {
        method: 'POST',
        body: {
          mode: 'x-star',
          starred: newStarred,
          items: [msg.id],
        },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (typeof data?.payload?.starred !== 'undefined') {
        msg.starred = !!data.payload.starred;
        // If unstarred in Starred folder, remove from list
        if (!msg.starred && selectedFolder === 'Starred') {
          messages = messages.filter((m) => m.id !== msg.id);
          if (selectedMessage && selectedMessage.id === msg.id) {
            selectedMessage = null;
          }
        }
      }
    } catch (e) {
      // Optionally show error
    } finally {
      starring = false;
    }
  }

  async function deleteMessage(msg: Message) {
    if (deleting) return;
    deleting = true;
    try {
      const response = await seqtaFetch('/seqta/student/save/message?', {
        method: 'POST',
        body: {
          mode: 'x-label',
          label: 'trash',
          items: [msg.id],
        },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (data?.payload?.label === 'trash') {
        // Remove from messages list
        messages = messages.filter((m) => m.id !== msg.id);
        // If this was the open message, clear detail
        if (selectedMessage && selectedMessage.id === msg.id) {
          selectedMessage = null;
        }
      }
    } catch (e) {
      // Optionally show error
    } finally {
      deleting = false;
    }
  }

  async function restoreMessage(msg: Message) {
    if (restoring) return;
    restoring = true;
    try {
      const response = await seqtaFetch('/seqta/student/save/message?', {
        method: 'POST',
        body: {
          mode: 'x-label',
          label: 'inbox',
          items: [msg.id],
        },
      });
      const data = typeof response === 'string' ? JSON.parse(response) : response;
      if (data?.payload?.label === 'inbox') {
        // Remove from messages list
        messages = messages.filter((m) => m.id !== msg.id);
        // If this was the open message, clear detail
        if (selectedMessage && selectedMessage.id === msg.id) {
          selectedMessage = null;
        }
      }
    } catch (e) {
      // Optionally show error
    } finally {
      restoring = false;
    }
  }

  function openTab(tab: string) {
    selectedTab = tab;
    selectedMessage = null;
  }
</script>

<!-- Tab Switcher -->
<div class="flex gap-2 p-4 border-b border-slate-300/50 dark:border-slate-800/50 bg-white dark:bg-slate-900">
  <button
    class="px-4 py-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 accent-ring text-base
      {selectedTab === 'SEQTA' ? 'accent-bg text-white' : 'text-slate-700 dark:text-white hover:bg-accent-100 dark:hover:bg-accent-700'}"
    onclick={() => openTab('SEQTA')}
    disabled={selectedTab === 'SEQTA'}>
    SEQTA Messages
  </button>
  <button
    class="px-4 py-2 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 accent-ring text-base
      {selectedTab === 'BetterSEQTA' ? 'accent-bg text-white' : 'text-slate-700 dark:text-white hover:bg-accent-100 dark:hover:bg-accent-700'}"
    onclick={() => openTab('BetterSEQTA')}
    disabled={selectedTab === 'BetterSEQTA'}>
    Cloud Messaging
  </button>
</div>

<div class="flex h-full">
  <div class="flex w-full h-full max-xl:flex-col">
    {#if selectedTab === 'SEQTA'}
      {#if seqtaLoadFailed}
        <div class="flex flex-col items-center justify-center w-full h-full p-8 text-center">
          <div class="text-red-500 dark:text-red-400 text-lg font-semibold mb-4">SEQTA messaging failed to load.</div>
          <div class="text-slate-500 dark:text-slate-300 mb-4">You can still use Cloud Messaging by switching tabs above.</div>
        </div>
      {:else}
        <Sidebar {selectedFolder} {openFolder} {openCompose} />
        <MessageList {selectedFolder} {messages} {loading} {error} {selectedMessage} {openMessage} />
        <!-- Message detail view - full screen on mobile -->
        <div class="hidden flex-1 xl:block">
          <MessageDetail
            {selectedMessage}
            {selectedFolder}
            {detailLoading}
            {detailError}
            {openCompose}
            {starMessage}
            {deleteMessage}
            {restoreMessage}
            {starring}
            {deleting}
            {restoring} />
        </div>
      {/if}
    {:else if selectedTab === 'BetterSEQTA'}
      <BetterSeqtaChat />
    {/if}
  </div>

  <!-- Mobile message detail modal -->
  {#if selectedTab === 'SEQTA' && !seqtaLoadFailed}
    <div class="xl:hidden">
      <Modal
        open={showMobileModal}
        onclose={() => (selectedMessage = null)}
        maxWidth="w-full"
        maxHeight="h-full"
        customClasses="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-none"
        showCloseButton={false}
        closeOnBackdrop={false}
        ariaLabel="Message Detail">
        <div class="flex flex-col h-full">
          <div
            class="flex justify-between items-center p-4 border-b border-slate-300/50 dark:border-slate-800/50">
            <button
              class="flex gap-2 items-center transition-colors text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              onclick={() => (selectedMessage = null)}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                viewBox="0 0 20 20"
                fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clip-rule="evenodd" />
              </svg>
              <span class="text-sm font-medium">Back</span>
            </button>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Message</span>
            <div class="w-8"></div>
            <!-- Spacer for alignment -->
          </div>

          <div class="overflow-y-auto flex-1">
            <MessageDetail
              {selectedMessage}
              {selectedFolder}
              {detailLoading}
              {detailError}
              {openCompose}
              {starMessage}
              {deleteMessage}
              {restoreMessage}
              {starring}
              {deleting}
              {restoring} />
          </div>
        </div>
      </Modal>
    </div>
  {/if}
</div>

<ComposeModal {showComposeModal} {composeSubject} {composeBody} {closeModal} />

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-in {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes scale-in {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
