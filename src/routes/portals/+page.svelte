<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from 'svelte-hero-icons';
  import { GlobeAlt, ExclamationTriangle } from 'svelte-hero-icons';
  import { seqtaFetch } from '../../utils/netUtil';
  import { fade, fly } from 'svelte/transition';
  import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
  import Modal from '$lib/components/Modal.svelte';

  interface Portal {
    is_power_portal: boolean;
    inherit_styles: boolean;
    icon: string;
    id: number;
    label: string;
    priority: number;
    uuid: string;
    url: string;
  }

  interface PortalsResponse {
    payload: Portal[];
    status: string;
  }

  let loading = true;
  let error: string | null = null;
  let portals: Portal[] = [];
  let selectedPortal: Portal | null = null;
  let portalContent: any = null;
  let loadingContent = false;
  let showPortalModal = false;

  onMount(async () => {
    await loadPortals();
  });

  async function loadPortals() {
    loading = true;
    error = null;
    
    try {
      const responseText = await seqtaFetch('/seqta/student/load/portals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {}
      });

      const data: PortalsResponse = JSON.parse(responseText);
      
      if (data.status === '200' && data.payload) {
        portals = data.payload.sort((a, b) => a.priority - b.priority);
      } else {
        error = 'Failed to load portals';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load portals';
      console.error('Error loading portals:', err);
    } finally {
      loading = false;
    }
  }

  function getIconColor(iconClass: string): string {
    // Map SEQTA icon classes to colors
    const colorMap: { [key: string]: string } = {
      'colour-turquoise': '#06b6d4',
      'colour-blue': '#3b82f6',
      'colour-green': '#10b981',
      'colour-red': '#ef4444',
      'colour-orange': '#f97316',
      'colour-purple': '#8b5cf6',
      'colour-pink': '#ec4899',
      'colour-yellow': '#eab308',
      'colour-gray': '#6b7280',
      'colour-grey': '#6b7280',
    };
    
    return colorMap[iconClass] || '#6b7280';
  }

  async function handlePortalClick(portal: Portal) {
    console.log('Portal clicked:', portal);
    selectedPortal = portal;
    loadingContent = true;
    showPortalModal = true;
    portalContent = null;
    console.log('Modal should be showing:', showPortalModal);

    try {
      console.log('Fetching portal content for ID:', portal.uuid);
      const response = await seqtaFetch('/seqta/student/load/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          id: portal.uuid
        }
      });

      console.log('Portal response:', response);
      
      // Check if response is the expected JSON format
      if (typeof response === 'object' && response.status === '200' && response.payload) {
        portalContent = response.payload;
        console.log('Portal content loaded:', portalContent);
      } 
      // Handle case where response is HTML directly (like your example)
      else if (typeof response === 'string') {
        // Create a mock payload structure for HTML responses
        portalContent = {
          contents: response,
          is_power_portal: portal.is_power_portal,
          inherit_styles: portal.inherit_styles
        };
        console.log('Portal HTML content loaded:', portalContent);
      } else {
        throw new Error('Failed to load portal content');
      }
    } catch (err) {
      console.error('Error loading portal content:', err);
      // Don't set error here as it affects the main portals display
    } finally {
      loadingContent = false;
    }
  }

  function closePortalModal() {
    showPortalModal = false;
    selectedPortal = null;
    portalContent = null;
    loadingContent = false;
  }
</script>

<div class="p-6 mx-auto max-w-7xl">
  <div
    class="sticky top-0 z-20 flex flex-col gap-4 justify-between items-start mb-8 sm:flex-row sm:items-center animate-fade-in-up backdrop-blur-md bg-white/80 dark:bg-slate-900/80 py-4 px-6 border-b border-slate-200 dark:border-slate-800 rounded-xl">
    <div class="flex items-center gap-3">
      <Icon src={GlobeAlt} class="w-8 h-8 text-slate-600 dark:text-slate-400" />
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Portals</h1>
    </div>
    <div class="text-sm text-slate-600 dark:text-slate-400">
      {portals.length} portal{portals.length !== 1 ? 's' : ''} available
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-12 animate-fade-in">
      <div class="flex flex-col gap-4 items-center">
        <div
          class="w-8 h-8 rounded-full border-4 animate-spin sm:w-10 sm:h-10 border-indigo-500/30 border-t-indigo-500">
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400 sm:text-base">Loading portals...</p>
      </div>
    </div>
  {:else if error}
    <div class="space-y-6">
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 bg-red-50/80 dark:bg-red-900/20 sm:rounded-2xl border-red-200/50 dark:border-red-800/50 animate-fade-in-up">
        <div class="p-6">
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <Icon src={ExclamationTriangle} class="w-16 h-16 text-red-500 mb-4" />
            <h3 class="text-lg font-medium text-red-700 dark:text-red-300 mb-2">
              Error Loading Portals
            </h3>
            <p class="text-red-600 dark:text-red-400 max-w-md mb-4">
              {error}
            </p>
            <button
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              onclick={loadPortals}>
              Try Again
            </button>
          </div>
        </div>
      </section>
    </div>
  {:else if portals.length === 0}
    <div class="space-y-6">
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 animate-fade-in-up">
        <div class="p-6">
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <Icon src={GlobeAlt} class="w-16 h-16 text-slate-400 dark:text-slate-500 mb-4" />
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Portals Available
            </h3>
            <p class="text-slate-600 dark:text-slate-400 max-w-md">
              There are currently no portals configured for your account.
            </p>
          </div>
        </div>
      </section>
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Portals Grid -->
      <section
        class="overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm transition-all duration-300 bg-white/80 dark:bg-slate-900/50 sm:rounded-2xl border-slate-300/50 dark:border-slate-800/50 animate-fade-in-up">
        <div class="px-6 py-4 border-b border-slate-300/50 dark:border-slate-800/50">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Available Portals</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Click on any portal to open it in a new tab
          </p>
        </div>
        <div class="p-6">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {#each portals as portal (portal.uuid)}
              <button
                class="group relative p-6 rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 cursor-pointer"
                onclick={() => handlePortalClick(portal)}>
                
                <!-- Portal Icon -->
                <div class="flex justify-center mb-4">
                  <div 
                    class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                    style="background-color: {getIconColor(portal.icon)}">
                    {portal.label.charAt(0).toUpperCase()}
                  </div>
                </div>
                
                <!-- Portal Info -->
                <div class="text-center">
                  <h3 class="font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-accent-600 dark:group-hover:text-accent-400 transition-colors">
                    {portal.label}
                  </h3>
                  
                  <!-- Portal Badges -->
                  <div class="flex flex-wrap justify-center gap-1 mt-2">
                    {#if portal.is_power_portal}
                      <span class="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                        Power Portal
                      </span>
                    {/if}
                  </div>
                </div>
                
                <!-- Hover Effect -->
                <div class="absolute inset-0 rounded-xl bg-gradient-to-br from-accent-500/0 to-accent-600/0 group-hover:from-accent-500/5 group-hover:to-accent-600/10 transition-all duration-200 pointer-events-none"></div>
              </button>
            {/each}
          </div>
        </div>
      </section>
    </div>
  {/if}
</div>

<!-- Portal Content Modal -->
<Modal 
  bind:open={showPortalModal} 
  title={selectedPortal?.label || 'Portal Content'}
  onclose={closePortalModal}
>
  {#if loadingContent}
    <div class="flex items-center justify-center py-12">
      <LoadingSpinner />
      <span class="ml-3 text-gray-600 dark:text-gray-400">Loading portal content...</span>
    </div>
  {:else if portalContent}
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-96 overflow-y-auto">
      <div class="p-4">
        {#if portalContent.contents}
          {@html portalContent.contents}
        {:else}
          <div class="text-center py-8">
            <p class="text-gray-600 dark:text-gray-400">No content available for this portal.</p>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="text-center py-12">
      <div class="w-12 h-12 text-gray-400 mx-auto mb-4">⚠️</div>
      <p class="text-gray-600 dark:text-gray-400">Failed to load portal content</p>
    </div>
  {/if}
</Modal>

<style>
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(32px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .animate-fade-in {
    animation: fade-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style> 