<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { notify } from '../../../utils/notify';
  import { marked } from 'marked';

  interface Plugin {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    installed: boolean;
    icon: string;
    longDescription: string;
    requirements: string[];
    features: string[];
    size: string;
    lastUpdated: string;
    // New fields for GitHub integration
    repository: {
      owner: string;
      repo: string;
      branch?: string;
    };
    banner: {
      light: string; // URL for light theme banner
      dark: string; // URL for dark theme banner
    };
    readme: string; // Markdown content
    screenshots: string[]; // Array of screenshot URLs
    downloads: number;
    rating: number;
    tags: string[];
    license: string;
    minVersion: string; // Minimum DesQTA version required
    dependencies?: {
      name: string;
      version: string;
    }[];
    changelog: {
      version: string;
      date: string;
      changes: string[];
    }[];
  }

  let plugins: Plugin[] = [];
  let loading = true;
  let selectedPlugin: Plugin | null = null;

  async function loadPlugins() {
    loading = true;
    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/AdenMGB/desqta-plugins/refs/heads/main/plugins.json',
      );
      const data = await response.json();
      // Initialize all plugins as not installed for now
      plugins = data.plugins.map((plugin: Plugin) => ({
        ...plugin,
        installed: false,
      }));
    } catch (e) {
      console.error('Failed to load plugins:', e);
      plugins = [];
    }
    loading = false;
  }

  async function installPlugin(pluginId: string) {
    try {
      // For now, just update the UI state
      plugins = plugins.map((plugin) =>
        plugin.id === pluginId ? { ...plugin, installed: true } : plugin,
      );
      await notify({
        title: 'Plugin Installed',
        body: 'The plugin has been successfully installed.',
      });
    } catch (e) {
      await notify({
        title: 'Installation Failed',
        body: 'Failed to install the plugin. Please try again.',
      });
    }
  }

  async function uninstallPlugin(pluginId: string) {
    try {
      // For now, just update the UI state
      plugins = plugins.map((plugin) =>
        plugin.id === pluginId ? { ...plugin, installed: false } : plugin,
      );
      await notify({
        title: 'Plugin Uninstalled',
        body: 'The plugin has been successfully uninstalled.',
      });
    } catch (e) {
      await notify({
        title: 'Uninstallation Failed',
        body: 'Failed to uninstall the plugin. Please try again.',
      });
    }
  }

  function openPluginDetails(plugin: Plugin) {
    selectedPlugin = plugin;
  }

  function closePluginDetails() {
    selectedPlugin = null;
  }

  onMount(loadPlugins);
</script>

<div class="p-8 mx-auto max-w-4xl">
  <!-- Notice Banner -->
  <div
    class="p-4 mb-8 text-yellow-200 bg-yellow-900 rounded-lg border border-yellow-700 animate-fade-in">
    <div class="flex gap-2 items-center">
      <span class="text-xl">⚠️</span>
      <div>
        <h3 class="font-semibold">Plugin Store Coming Soon</h3>
        <p class="text-sm text-yellow-300">
          The plugin store is currently in development. Installation and management features are not
          yet functional.
        </p>
      </div>
    </div>
  </div>

  <div class="flex justify-between items-center mb-8 animate-fade-in-up">
    <div class="flex items-center gap-4">
      <a 
        href="/settings" 
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back to Settings
      </a>
    <h1 class="text-2xl font-bold">Plugin Store</h1>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-12 animate-fade-in">
      <p class="text-slate-600 dark:text-slate-400">Loading plugins...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      {#each plugins as plugin}
        <button
          type="button"
          class="overflow-hidden bg-white rounded-2xl border shadow-xl transition-all duration-300 cursor-pointer dark:bg-slate-900 border-slate-300 dark:border-slate-800 hover:shadow-2xl hover:border-blue-700 animate-fade-in-up w-full text-left focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          on:click={() => openPluginDetails(plugin)}>
          <div class="overflow-hidden relative h-32">
            <img
              src={plugin.banner.dark}
              alt={`${plugin.name} banner`}
              class="object-cover w-full h-full" />
            <div class="absolute inset-0 bg-gradient-to-t to-transparent from-slate-900"></div>
          </div>
          <div class="p-6">
            <div class="flex gap-4 items-start">
              <div class="text-4xl">{plugin.icon}</div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
                  {plugin.name}
                </h3>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {plugin.description}
                </p>
                <div
                  class="flex gap-2 items-center mt-2 text-sm text-slate-500 dark:text-slate-500">
                  <span>v{plugin.version}</span>
                  <span>•</span>
                  <span>by {plugin.author}</span>
                  <span>•</span>
                  <span>⭐ {plugin.rating}</span>
                </div>
                <div class="flex flex-wrap gap-2 mt-2">
                  {#each plugin.tags as tag}
                    <span
                      class="px-2 py-1 text-xs text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-200">
                      {tag}
                    </span>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if selectedPlugin}
  <div class="fixed inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm animate-fade-in">
    <div class="overflow-y-auto fixed inset-0">
      <div class="flex justify-center items-center p-4 min-h-screen">
        <div
          class="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fade-in-up">
          <!-- Plugin Header with Banner -->
          <div class="overflow-hidden relative h-48">
            <img
              src={selectedPlugin.banner.dark}
              alt={`${selectedPlugin.name} banner`}
              class="object-cover w-full h-full" />
            <div class="absolute inset-0 bg-gradient-to-t to-transparent from-slate-900"></div>
            <div class="absolute right-0 bottom-0 left-0 p-6">
              <div class="flex justify-between items-start">
                <div class="flex gap-4 items-start">
                  <div class="text-5xl">{selectedPlugin.icon}</div>
                  <div>
                    <h2 class="text-2xl font-bold text-white">
                      {selectedPlugin.name}
                    </h2>
                    <div class="flex gap-2 items-center mt-1 text-blue-100">
                      <span>v{selectedPlugin.version}</span>
                      <span>•</span>
                      <span>by {selectedPlugin.author}</span>
                      <span>•</span>
                      <span>{selectedPlugin.size}</span>
                      <span>•</span>
                      <span>⭐ {selectedPlugin.rating}</span>
                    </div>
                  </div>
                </div>
                <button
                  class="text-white transition-colors hover:text-blue-100"
                  on:click={closePluginDetails}>
                  ✕
                </button>
              </div>
            </div>
          </div>

          <!-- Plugin Content -->
          <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div class="space-y-6">
              <!-- Tags -->
              <div class="flex flex-wrap gap-2">
                {#each selectedPlugin.tags as tag}
                  <span class="px-3 py-1 text-sm text-blue-200 bg-blue-900 rounded-full">
                    {tag}
                  </span>
                {/each}
              </div>

              <!-- Description -->
              <div>
                <h3 class="mb-2 text-lg font-semibold">Description</h3>
                <div class="max-w-none prose prose-invert">
                  {@html marked(selectedPlugin.readme)}
                </div>
              </div>

              <!-- Screenshots -->
              {#if selectedPlugin.screenshots.length > 0}
                <div>
                  <h3 class="mb-2 text-lg font-semibold">Screenshots</h3>
                  <div class="grid grid-cols-2 gap-4">
                    {#each selectedPlugin.screenshots as screenshot}
                      <img src={screenshot} alt="Plugin screenshot" class="rounded-lg shadow-lg" />
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Features -->
              <div>
                <h3 class="mb-2 text-lg font-semibold">Features</h3>
                <ul class="space-y-1 list-disc list-inside text-slate-300">
                  {#each selectedPlugin.features as feature}
                    <li>{feature}</li>
                  {/each}
                </ul>
              </div>

              <!-- Requirements -->
              <div>
                <h3 class="mb-2 text-lg font-semibold">Requirements</h3>
                <ul class="space-y-1 list-disc list-inside text-slate-300">
                  {#each selectedPlugin.requirements as requirement}
                    <li>{requirement}</li>
                  {/each}
                </ul>
              </div>

              <!-- Changelog -->
              <div>
                <h3 class="mb-2 text-lg font-semibold">Changelog</h3>
                <div class="space-y-4">
                  {#each selectedPlugin.changelog as entry}
                    <div class="p-4 rounded-lg bg-slate-800">
                      <div class="flex justify-between items-center mb-2">
                        <span class="font-semibold">v{entry.version}</span>
                        <span class="text-sm text-slate-400">{entry.date}</span>
                      </div>
                      <ul class="space-y-1 list-disc list-inside text-slate-300">
                        {#each entry.changes as change}
                          <li>{change}</li>
                        {/each}
                      </ul>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Additional Info -->
              <div class="grid grid-cols-2 gap-4 text-sm text-slate-400">
                <div>
                  <span class="font-semibold">License:</span>
                  {selectedPlugin.license}
                </div>
                <div>
                  <span class="font-semibold">Downloads:</span>
                  {selectedPlugin.downloads.toLocaleString()}
                </div>
                <div>
                  <span class="font-semibold">Last Updated:</span>
                  {selectedPlugin.lastUpdated}
                </div>
                <div>
                  <span class="font-semibold">Min Version:</span>
                  {selectedPlugin.minVersion}
                </div>
              </div>
            </div>
          </div>

          <!-- Plugin Footer -->
          <div class="p-6 border-t bg-slate-800 border-slate-700">
            {#if selectedPlugin.installed}
              <button
                class="px-6 py-3 w-full text-white bg-red-600 rounded shadow transition-transform duration-200 hover:bg-red-700 focus:ring-2 focus:ring-red-400 active:scale-95 hover:scale-105"
                on:click={() => selectedPlugin && uninstallPlugin(selectedPlugin.id)}>
                Uninstall Plugin
              </button>
            {:else}
              <button
                class="px-6 py-3 w-full text-white bg-blue-600 rounded shadow transition-transform duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 active:scale-95 hover:scale-105"
                on:click={() => selectedPlugin && installPlugin(selectedPlugin.id)}>
                Install Plugin
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

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
