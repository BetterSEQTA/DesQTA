<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';

  let portalUrl = $state<string>('');
  let loading = $state<boolean>(true);
  let error = $state<string>('');

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
        error = 'Failed to load portal URL';
      }
    } catch (e) {
      error = 'Error loading portal';
    } finally {
      loading = false;
    }
  }

  onMount(loadPortal);
</script>

<div class="flex flex-col w-full h-full">
  {#if loading}
    <div class="flex flex-col justify-center items-center h-full">
      <div
        class="w-16 h-16 rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500">
      </div>
      <p class="mt-4 text-slate-400">Loading welcome page...</p>
    </div>
  {:else if error}
    <div class="flex flex-col justify-center items-center h-full">
      <div
        class="w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-3xl shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-gradient">
        ⚠️
      </div>
      <p class="mt-4 text-xl text-slate-300">{error}</p>
    </div>
  {:else if portalUrl}
    <iframe src={portalUrl} class="w-full h-full border-0" title="Welcome Portal"></iframe>
  {/if}
</div>

<style>
  @keyframes gradient-shift {
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
    animation: gradient-shift 8s ease infinite;
  }
</style>
