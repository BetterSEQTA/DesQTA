<script lang="ts">
  import { onMount } from 'svelte';
  import { themeService, type ThemeManifest } from '$lib/services/themeService';
  import { loadAndApplyTheme, currentTheme } from '$lib/stores/theme';
  import { get } from 'svelte/store';
  import ThemeBuilder from '$lib/components/ThemeBuilder.svelte';
  import { themeBuilderSidebarOpen } from '$lib/stores/themeBuilderSidebar';
  import { Icon, Swatch } from 'svelte-hero-icons';

  let availableThemes: ThemeManifest[] = [];
  let selectedTheme: ThemeManifest | null = null;
  let loading = true;
  let error: string | null = null;
  let currentThemeName = 'default';
  let imgErrors: boolean[] = [];
  let themeOptions: any = {};
  let showAdvanced = false;
  let showFeatures = false;
  let showFonts = false;
  let showAnimations = false;
  let showCustom = false;

  // Load all themes dynamically from both static and custom directories
  async function loadThemes() {
    loading = true;
    error = null;
    try {
      // Get available theme names from backend
      const themeNames = await themeService.getAvailableThemes();
      
      // Load manifests for all available themes
      const themePromises = themeNames.map(async (name) => {
        try {
          return await themeService.getThemeManifest(name);
        } catch (err) {
          console.warn(`Failed to load theme manifest for ${name}:`, err);
          return null;
        }
      });
      
      const themes = await Promise.all(themePromises);
      availableThemes = themes.filter((t): t is ThemeManifest => t !== null);
      
      console.log(`Loaded ${availableThemes.length} themes:`, availableThemes.map(t => t.name));
    } catch (e) {
      console.error('Failed to load themes:', e);
      error = 'Failed to load themes. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function loadCurrentTheme() {
    try {
      currentThemeName = get(currentTheme);
    } catch {
      currentThemeName = 'default';
    }
  }

  onMount(async () => {
    await loadThemes();
    await loadCurrentTheme();
    currentTheme.subscribe((val) => {
      currentThemeName = val;
    });
  });

  async function handleApplyTheme(themeName: string) {
    await loadAndApplyTheme(themeName);
    selectedTheme = null;
  }

  function openThemeModal(theme: ThemeManifest) {
    selectedTheme = theme;
    // Deep copy to avoid mutating the manifest directly
    themeOptions = JSON.parse(JSON.stringify(theme));
  }

  function closeThemeModal() {
    selectedTheme = null;
  }

  function getThemePreviewStyle(theme: ThemeManifest) {
    if (theme.features.glassmorphism) {
      return `backdrop-filter: blur(8px); background: ${theme.customProperties.backgroundColor}`;
    }
    if (theme.features.gradients && theme.customProperties.primaryColor && theme.customProperties.secondaryColor) {
      return `background: linear-gradient(135deg, ${theme.customProperties.primaryColor} 0%, ${theme.customProperties.secondaryColor} 100%)`;
    }
    return `background: ${theme.customProperties.backgroundColor}`;
  }

  function handleOptionChange(section: string, key: string, value: any) {
    if (section === 'settings') themeOptions.settings[key] = value;
    if (section === 'customProperties') themeOptions.customProperties[key] = value;
    if (section === 'features') themeOptions.features[key] = value;
    if (section === 'fonts') themeOptions.fonts[key] = value;
    if (section === 'animations') themeOptions.animations[key] = value;
    // Live apply custom properties
    themeService.setCustomProperties(themeOptions.customProperties);
    themeService.setThemeFonts(themeOptions.fonts);
  }

  async function handleApplyThemeWithOptions() {
    if (!selectedTheme) return;
    themeService.setCustomProperties(themeOptions.customProperties);
    themeService.setThemeFonts(themeOptions.fonts);
    await handleApplyTheme(selectedTheme.name.toLowerCase());
    selectedTheme = null;
  }

  function capitalizeName(name: string) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  async function handleThemeDeleted(themeName: string) {
    try {
      await themeService.deleteCustomTheme(themeName);
      // Reload themes to reflect the deletion
      await loadThemes();
      
      // If the deleted theme was the current theme, switch to default
      if (currentThemeName === themeName) {
        await handleApplyTheme('default');
      }
    } catch (error) {
      console.error('Failed to delete theme:', error);
    }
  }

  async function handleThemeCreated() {
    // Reload themes to show the new custom theme
    await loadThemes();
  }
  
</script>

<div class="p-8 max-w-5xl mx-auto">
  <div class="flex justify-between items-center mb-8">
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
      <h1 class="text-3xl font-bold">Theme Store</h1>
    </div>
    <div class="flex items-center gap-4">
      <button
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        onclick={() => themeBuilderSidebarOpen.set(true)}
      >
        <Icon src={Swatch} class="w-5 h-5" />
        Open Theme Builder
      </button>
      <div class="text-sm text-slate-600 dark:text-slate-400">Current theme: {capitalizeName(currentThemeName)}</div>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center py-16">
      <div class="flex flex-col gap-4 items-center">
        <div class="w-8 h-8 rounded-full border-4 animate-spin border-accent/30 border-t-accent"></div>
        <p class="text-sm text-slate-600 dark:text-slate-400">Loading themes...</p>
      </div>
    </div>
  {:else if error}
    <div class="text-red-500 text-center py-8">{error}</div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
      {#each availableThemes as theme, i (theme.name)}
        <div class="relative group">
          <button
            type="button"
            class="rounded-xl shadow-lg p-6 flex flex-col items-center bg-white/10 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 transition-all duration-200 hover:scale-105 hover:shadow-2xl cursor-pointer {currentThemeName === theme.name.toLowerCase() ? 'ring-2 ring-accent' : ''} focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            onclick={() => openThemeModal(theme)}
            aria-label="Select {theme.name} theme"
          >
            {#if !imgErrors[i]}
              <img
                src={theme.preview.thumbnail}
                alt={theme.name + ' preview'}
                class="w-16 h-16 rounded-full mb-4 border-2 object-cover"
                style="border-color: {theme.customProperties.primaryColor}; {getThemePreviewStyle(theme)}"
                onerror={() => imgErrors[i] = true}
              />
            {:else}
              <div class="w-16 h-16 rounded-full mb-4 border-2 flex items-center justify-center" style="border-color: {theme.customProperties.primaryColor}; {getThemePreviewStyle(theme)}">
                <span class="text-xs text-slate-400">No Image</span>
              </div>
            {/if}
            <div class="font-semibold text-lg mb-2">{theme.name}</div>
            <div class="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">{theme.description}</div>
            <div class="flex gap-2 items-center text-xs text-slate-400">
              <span>v{theme.version}</span>
              <span>•</span>
              <span>by {theme.author}</span>
            </div>
            <div class="flex items-center justify-between mt-2">
              {#if currentThemeName === theme.name.toLowerCase()}
                <div class="px-2 py-1 text-xs bg-accent text-white rounded-full">Active</div>
              {:else}
                <div></div>
              {/if}
            </div>
          </button>
          {#if theme.category === 'custom'}
            <button
              type="button"
              onclick={() => { if (confirm(`Are you sure you want to delete the theme "${theme.name}"?`)) { handleThemeDeleted(theme.name); } }}
              class="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors z-10 bg-white dark:bg-slate-900 rounded-full shadow"
              aria-label="Delete custom theme"
              tabindex="0"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          {/if}
        </div>
      {/each}
    </div>

    {#if selectedTheme}
      <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden animate-fade-in-up relative flex flex-col"
          style="{getThemePreviewStyle(selectedTheme)}"
        >
          <button
            class="absolute top-4 right-4 text-xl text-white bg-black/30 rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/60 transition"
            onclick={closeThemeModal}
          >
            ×
          </button>
          <div class="flex flex-col h-full">
            <div class="flex h-64">
              <div
                class="w-20 flex flex-col items-center py-4"
                style="background: {selectedTheme.customProperties.primaryColor}"
              >
                <div class="w-8 h-8 rounded-lg bg-white/80 mb-4"></div>
                <div class="w-8 h-8 rounded-lg bg-white/60 mb-4"></div>
                <div class="w-8 h-8 rounded-lg bg-white/40 mb-4"></div>
                <div class="w-8 h-8 rounded-lg bg-white/20"></div>
              </div>
              <div class="flex-1 flex flex-col">
                <div
                  class="h-12 flex items-center px-6 text-white"
                  style="background: {selectedTheme.customProperties.primaryColor}"
                >
                  <span class="font-bold text-lg">DesQTA</span>
                  <span class="ml-auto text-sm opacity-80">User</span>
                </div>
                <div class="flex-1 bg-white/80 dark:bg-slate-900/80 p-6 flex flex-col gap-4">
                  <div class="h-6 w-1/3 rounded bg-slate-300 dark:bg-slate-700 mb-2"></div>
                  <div class="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800 mb-2"></div>
                  <div class="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-800 mb-2"></div>
                  <div class="h-32 rounded-lg bg-slate-100 dark:bg-slate-800"></div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-6 pt-6 pb-2">
              <div class="font-semibold text-lg mb-2 text-slate-800 dark:text-white">{selectedTheme.name} Theme</div>
              <div class="text-sm text-slate-700 dark:text-slate-200 mb-4 text-center">{selectedTheme.description}</div>
              <!-- Theme Options Section -->
              <div class="w-full max-w-3xl mx-auto mb-4 p-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md">
                <div class="accent-bg accent-text px-4 py-2 rounded-lg shadow font-medium text-base mb-4 transition-colors duration-200">
                  Theme Options
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                  <!-- Accent Color -->
                  <div class="flex items-center gap-2">
                    <label class="block text-base font-medium flex-1 text-slate-800 dark:text-white" for="accentColor">Accent Color</label>
                    <div class="flex items-center gap-2">
                      <input id="accentColor" aria-label="Accent Color" type="color" class="w-10 h-10 border border-gray-300 rounded-lg shadow focus:ring-2 focus:ring-accent transition-all" bind:value={themeOptions.settings.defaultAccentColor} oninput={e => handleOptionChange('settings', 'defaultAccentColor', (e.target && (e.target as HTMLInputElement).value) || themeOptions.settings.defaultAccentColor)} />
                      <span class="w-8 h-8 rounded-lg border border-gray-300" style="background: {themeOptions.settings.defaultAccentColor}"></span>
                    </div>
                  </div>
                  <!-- Default Theme -->
                  <div>
                    <label class="block text-base font-medium mb-1 text-slate-800 dark:text-white" for="defaultTheme">Default Theme</label>
                    <select id="defaultTheme" aria-label="Default Theme" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow px-3 py-2 focus:ring-2 focus:ring-accent transition-all bg-white dark:bg-gray-900 text-base text-slate-800 dark:text-white" bind:value={themeOptions.settings.defaultTheme} onchange={e => handleOptionChange('settings', 'defaultTheme', (e.target && (e.target as HTMLSelectElement).value) || themeOptions.settings.defaultTheme)}>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </div>
                <!-- Advanced Options Accordion -->
                <div class="mb-2">
                  <button class="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-slate-200 dark:bg-gray-700 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showAdvanced = !showAdvanced} aria-expanded={showAdvanced} aria-controls="advanced-options">
                    Advanced Options
                    <svg class="w-5 h-5 ml-2 transition-transform duration-200" style="transform: rotate({showAdvanced ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {#if showAdvanced}
                    <div id="advanced-options" class="mt-4 space-y-4">
                      <!-- Features Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showFeatures = !showFeatures} aria-expanded={showFeatures} aria-controls="features-options">
                          Features
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showFeatures ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showFeatures}
                          <div id="features-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.features) as feat}
                              <div class="flex items-center gap-2">
                                <input type="checkbox" class="w-4 h-4 text-accent bg-gray-100 border-gray-300 rounded focus:ring-accent dark:focus:ring-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" checked={themeOptions.features[feat]} onchange={e => handleOptionChange('features', feat, (e.target && (e.target as HTMLInputElement).checked) || false)} />
                                <label class="text-base font-medium text-slate-800 dark:text-white" for={feat}>{feat}</label>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <!-- Fonts Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showFonts = !showFonts} aria-expanded={showFonts} aria-controls="fonts-options">
                          Fonts
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showFonts ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showFonts}
                          <div id="fonts-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.fonts) as fontKey}
                              <div>
                                <label class="block text-base font-medium mb-1 text-slate-800 dark:text-white" for={fontKey + '-font'}>{fontKey} font</label>
                                <input type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900 text-slate-800 dark:text-white" bind:value={themeOptions.fonts[fontKey]} oninput={e => handleOptionChange('fonts', fontKey, (e.target && (e.target as HTMLInputElement).value) || themeOptions.fonts[fontKey])} />
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <!-- Animations Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showAnimations = !showAnimations} aria-expanded={showAnimations} aria-controls="animations-options">
                          Animations
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showAnimations ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showAnimations}
                          <div id="animations-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.animations) as animKey}
                              <div>
                                <label class="block text-base font-medium mb-1 text-slate-800 dark:text-white" for={animKey + '-anim'}>{animKey}</label>
                                <input type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900 text-slate-800 dark:text-white" bind:value={themeOptions.animations[animKey]} oninput={e => handleOptionChange('animations', animKey, (e.target && (e.target as HTMLInputElement).value) || themeOptions.animations[animKey])} />
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      <!-- Custom Properties Accordion -->
                      <div>
                        <button class="w-full flex items-center justify-between px-3 py-2 rounded bg-slate-100 dark:bg-gray-800 text-slate-800 dark:text-slate-200 font-medium shadow transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent" onclick={() => showCustom = !showCustom} aria-expanded={showCustom} aria-controls="custom-options">
                          Custom Properties
                          <svg class="w-4 h-4 ml-2 transition-transform duration-200" style="transform: rotate({showCustom ? 90 : 0}deg);" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        {#if showCustom}
                          <div id="custom-options" class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            {#each Object.keys(themeOptions.customProperties) as prop}
                              <div class="flex items-center gap-2">
                                <label class="block text-base font-medium flex-1 text-slate-800 dark:text-white" for={prop}>{prop}</label>
                                {#if themeOptions.customProperties[prop]?.startsWith('#') || themeOptions.customProperties[prop]?.startsWith('rgb')}
                                  <input type="color" class="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900" bind:value={themeOptions.customProperties[prop]} oninput={e => handleOptionChange('customProperties', prop, (e.target && (e.target as HTMLInputElement).value) || themeOptions.customProperties[prop])} />
                                  <span class="w-8 h-8 rounded-lg border border-gray-300" style="background: {themeOptions.customProperties[prop]}"></span>
                                {:else}
                                  <input type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-accent focus:border-accent bg-white dark:bg-gray-900 text-slate-800 dark:text-white" bind:value={themeOptions.customProperties[prop]} oninput={e => handleOptionChange('customProperties', prop, (e.target && (e.target as HTMLInputElement).value) || themeOptions.customProperties[prop])} />
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            <!-- Sticky action buttons -->
            <div class="flex gap-4 justify-center items-center p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-10">
              <button
                class="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent accent-bg hover:accent-bg-hover active:scale-95"
                onclick={handleApplyThemeWithOptions}
              >
                Apply Theme
              </button>
              {#if currentThemeName !== 'default'}
                <button
                  class="px-4 py-2 rounded-lg font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95"
                  onclick={() => handleApplyTheme('default')}
                >
                  Reset to Default
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  @keyframes fade-in-up {
    0% { opacity: 0; transform: translateY(32px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in-up {
    animation: fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
</style> 