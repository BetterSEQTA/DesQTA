<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, ArrowTopRightOnSquare } from 'svelte-hero-icons';
  import Modal from './Modal.svelte';

  let portalUrl = $state<string>('');
  let loadingPortal = $state<boolean>(true);
  let portalError = $state<string>('');
  let showPortalModal = $state(false);

  const parser = new DOMParser();

  async function loadPortal() {
    try {
      const response = await seqtaFetch('/seqta/student/load/portals?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { splash: true },
      });

      const data = JSON.parse(response);
      if (data.status === '200' && (data.payload?.url || data.payload?.contents)) {
        if (data.payload?.url) {
          portalUrl = data.payload.url;
        } else {
          const html = parser.parseFromString(data.payload?.contents, 'text/html');
          const iframe = html.getElementsByTagName('iframe')[0];
          portalUrl = iframe.src;
        }
      } else {
        portalError = 'Failed to load portal URL';
      }
    } catch (e) {
      portalError = 'Error loading portal';
    } finally {
      loadingPortal = false;
    }
  }

  function closeModal() {
    showPortalModal = false;
  }

  onMount(async () => {
    await loadPortal();
  });
</script>

<div
  class="overflow-hidden relative rounded-2xl border shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
  <div
    class="flex justify-between items-center px-4 py-3 bg-gradient-to-br border-b from-slate-100/70 dark:from-slate-800/70 to-slate-100/30 dark:to-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
    <h3 class="text-xl font-semibold text-slate-900 dark:text-white">Welcome Portal</h3>
    <button
      onclick={() => (showPortalModal = true)}
      class="px-3 py-1.5 text-sm rounded-lg transition-all duration-300 text-nowrap accent-text hover:accent-bg-hover hover:text-white">
      Open Full Screen
      <Icon src={ArrowTopRightOnSquare} class="inline ml-1 w-4 h-4" />
    </button>
  </div>

  <div class="h-[400px]">
    {#if loadingPortal}
      <div class="flex flex-col justify-center items-center h-full">
        <div
          class="w-16 h-16 rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500">
        </div>
        <p class="mt-4 text-slate-400">Loading welcome portal...</p>
      </div>
    {:else if portalError}
      <div class="flex flex-col justify-center items-center h-full">
        <div
          class="w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-3xl shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-gradient">
          ⚠️
        </div>
        <p class="mt-4 text-xl text-slate-300">{portalError}</p>
      </div>
    {:else if portalUrl}
      <iframe src={portalUrl} class="w-full h-full border-0" title="Welcome Portal"></iframe>
    {/if}
  </div>
</div>

<Modal
  bind:open={showPortalModal}
  onclose={closeModal}
  maxWidth="w-[80%]"
  maxHeight="h-[80%]"
  customClasses="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl"
  ariaLabel="Welcome Portal Modal">
  {#if portalUrl}
    <iframe src={portalUrl} class="w-full h-full rounded-2xl border-0" title="Welcome Portal"></iframe>
  {/if}
</Modal> 