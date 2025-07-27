<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { Icon, Eye, Trash, DocumentDuplicate, ArrowPathRoundedSquare, Cog6Tooth, Swatch, DocumentText, Bolt, RectangleStack, Sparkles, XMark, ArrowUpTray, ArrowDownTray, BookmarkSquare } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import { loadAndApplyTheme, currentTheme } from '$lib/stores/theme';
  
  interface ThemeManifest {
    name: string;
    displayName: string;
    description: string;
    version: string;
    author: string;
    category: string;
    tags: string[];
    preview: {
      thumbnail: string;
      screenshots: string[];
    };
    settings: {
      defaultTheme: 'light' | 'dark' | 'system';
      defaultAccentColor: string;
      allowUserCustomization: boolean;
      autoSwitchTime: { light: string; dark: string } | null;
    };
    customProperties: Record<string, string>;
    features: {
      glassmorphism: boolean;
      gradients: boolean;
      animations: boolean;
      customFonts: boolean;
      darkMode: boolean;
      colorSchemes: boolean;
      accessibility: boolean;
      responsive: boolean;
    };
    fonts: {
      primary: string;
      secondary: string;
      monospace: string;
      display: string;
    };
    animations: {
      duration: string;
      easing: string;
      scale: string;
      fadeIn: string;
      slideIn: string;
    };
    colorSchemes: {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
    accessibility: {
      highContrast: boolean;
      reducedMotion: boolean;
      focusIndicators: boolean;
      screenReaderOptimized: boolean;
    };
    responsive: {
      breakpoints: Record<string, string>;
      fluidTypography: boolean;
      adaptiveSpacing: boolean;
    };
  }

  let currentStep = $state(0);
  let themeName = $state('');
  let themeDisplayName = $state('');
  let themeDescription = $state('');
  let themeAuthor = $state('');
  let themeCategory = $state('custom');
  let themeTags = $state<string[]>([]);
  let newTag = $state('');
  let previewMode = $state(false);
  let validationErrors = $state<string[]>([]);
  let isExporting = $state(false);
  let isImporting = $state(false);
  let isSaving = $state(false);
  let showAdvancedOptions = $state(false);

  // Theme configuration
  let themeConfig = $state<ThemeManifest>({
    name: '',
    displayName: '',
    description: '',
    version: '1.0.0',
    author: '',
    category: 'custom',
    tags: [],
    preview: {
      thumbnail: '',
      screenshots: []
    },
    settings: {
      defaultTheme: 'system',
      defaultAccentColor: '#3b82f6',
      allowUserCustomization: true,
      autoSwitchTime: null
    },
    customProperties: {
      '--background-color': '#ffffff',
      '--surface-color': '#f8fafc',
      '--text-color': '#1e293b',
      '--text-secondary': '#64748b',
      '--border-color': '#e2e8f0',
      '--accent-color': '#3b82f6',
      '--accent-hover': '#2563eb',
      '--success-color': '#10b981',
      '--warning-color': '#f59e0b',
      '--error-color': '#ef4444',
      '--info-color': '#06b6d4'
    },
    features: {
      glassmorphism: false,
      gradients: false,
      animations: true,
      customFonts: false,
      darkMode: true,
      colorSchemes: true,
      accessibility: true,
      responsive: true
    },
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Inter, system-ui, sans-serif',
      monospace: 'JetBrains Mono, Consolas, monospace',
      display: 'Inter, system-ui, sans-serif'
    },
    animations: {
      duration: '200ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      scale: '1.05',
      fadeIn: 'opacity 200ms ease-in-out',
      slideIn: 'transform 200ms ease-in-out'
    },
    colorSchemes: {
      light: {},
      dark: {}
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      focusIndicators: true,
      screenReaderOptimized: true
    },
    responsive: {
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      fluidTypography: true,
      adaptiveSpacing: true
    }
  });

  const steps = [
    { id: 'basic', title: 'Basic Info', icon: Cog6Tooth, description: 'Theme name, description, and metadata' },
    { id: 'colors', title: 'Colors', icon: Swatch, description: 'Color scheme and palette configuration' },
    { id: 'typography', title: 'Typography', icon: DocumentText, description: 'Font families and text styling' },
    { id: 'animations', title: 'Animations', icon: Bolt, description: 'Motion and transition effects' },
    { id: 'features', title: 'Features', icon: RectangleStack, description: 'Advanced features and capabilities' },
    { id: 'preview', title: 'Preview', icon: Eye, description: 'Test and preview your theme' }
  ];

  const categories = [
    'custom', 'minimal', 'colorful', 'dark', 'light', 'professional', 'creative', 'retro', 'modern', 'experimental'
  ];

  const commonTags = [
    'minimal', 'colorful', 'gradient', 'glassmorphism', 'high-contrast', 'accessibility', 
    'dark-mode', 'light-mode', 'professional', 'creative', 'retro', 'modern', 'animated'
  ];

  function resetBuilder() {
    currentStep = 0;
    themeName = '';
    themeDisplayName = '';
    themeDescription = '';
    themeAuthor = '';
    themeCategory = 'custom';
    themeTags = [];
    validationErrors = [];
    previewMode = false;
    
    // Reset theme config to defaults
    themeConfig = {
      ...themeConfig,
      name: '',
      displayName: '',
      description: '',
      author: '',
      category: 'custom',
      tags: []
    };
  }

  function nextStep() {
    if (validateCurrentStep()) {
      currentStep = Math.min(currentStep + 1, steps.length - 1);
    }
  }

  function prevStep() {
    currentStep = Math.max(currentStep - 1, 0);
  }

  function goToStep(step: number) {
    if (step <= currentStep || validateStepsUpTo(step)) {
      currentStep = step;
    }
  }

  function validateCurrentStep(): boolean {
    validationErrors = [];
    
    switch (currentStep) {
      case 0: // Basic Info
        if (!themeName.trim()) validationErrors.push('Theme name is required');
        if (!themeDisplayName.trim()) validationErrors.push('Display name is required');
        if (!themeDescription.trim()) validationErrors.push('Description is required');
        if (!themeAuthor.trim()) validationErrors.push('Author name is required');
        if (themeName.includes(' ')) validationErrors.push('Theme name cannot contain spaces');
        if (!/^[a-z0-9-_]+$/.test(themeName)) validationErrors.push('Theme name can only contain lowercase letters, numbers, hyphens, and underscores');
        break;
      case 1: // Colors
        const requiredColors = ['--background-color', '--text-color', '--accent-color'];
        for (const color of requiredColors) {
          if (!themeConfig.customProperties[color]) {
            validationErrors.push(`${color} is required`);
          } else if (!/^#[0-9a-fA-F]{6}$/.test(themeConfig.customProperties[color])) {
            validationErrors.push(`${color} must be a valid hex color`);
          }
        }
        break;
    }
    
    return validationErrors.length === 0;
  }

  function validateStepsUpTo(step: number): boolean {
    const originalStep = currentStep;
    for (let i = 0; i <= step; i++) {
      currentStep = i;
      if (!validateCurrentStep()) {
        currentStep = originalStep;
        return false;
      }
    }
    currentStep = originalStep;
    return true;
  }

  function canGoToStep(step: number): boolean {
    if (step <= currentStep) return true;
    
    // Create a temporary validation without mutating currentStep
    for (let i = 0; i <= step; i++) {
      const tempErrors: string[] = [];
      
      switch (i) {
        case 0: // Basic Info
          if (!themeName.trim()) tempErrors.push('Theme name is required');
          if (!themeDisplayName.trim()) tempErrors.push('Display name is required');
          if (!themeDescription.trim()) tempErrors.push('Description is required');
          if (!themeAuthor.trim()) tempErrors.push('Author name is required');
          if (themeName.includes(' ')) tempErrors.push('Theme name cannot contain spaces');
          if (!/^[a-z0-9-_]+$/.test(themeName)) tempErrors.push('Theme name can only contain lowercase letters, numbers, hyphens, and underscores');
          break;
        case 1: // Colors
          const requiredColors = ['--background-color', '--text-color', '--accent-color'];
          for (const color of requiredColors) {
            if (!themeConfig.customProperties[color]) {
              tempErrors.push(`${color} is required`);
            } else if (!/^#[0-9a-fA-F]{6}$/.test(themeConfig.customProperties[color])) {
              tempErrors.push(`${color} must be a valid hex color`);
            }
          }
          break;
      }
      
      if (tempErrors.length > 0) return false;
    }
    return true;
  }

  function canExportOrSave(): boolean {
    return canGoToStep(steps.length - 1);
  }

  function isCurrentStepValid(): boolean {
    // Non-mutating version of validateCurrentStep for template expressions
    switch (currentStep) {
      case 0: // Basic Info
        if (!themeName.trim()) return false;
        if (!themeDisplayName.trim()) return false;
        if (!themeDescription.trim()) return false;
        if (!themeAuthor.trim()) return false;
        if (themeName.includes(' ')) return false;
        if (!/^[a-z0-9-_]+$/.test(themeName)) return false;
        break;
      case 1: // Colors
        const requiredColors = ['--background-color', '--text-color', '--accent-color'];
        for (const color of requiredColors) {
          if (!themeConfig.customProperties[color]) return false;
          if (!/^#[0-9a-fA-F]{6}$/.test(themeConfig.customProperties[color])) return false;
        }
        break;
    }
    return true;
  }

  function addTag() {
    if (newTag.trim() && !themeTags.includes(newTag.trim())) {
      themeTags = [...themeTags, newTag.trim()];
      newTag = '';
    }
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(tag: string) {
    themeTags = themeTags.filter(t => t !== tag);
  }

  function addCommonTag(tag: string) {
    if (!themeTags.includes(tag)) {
      themeTags = [...themeTags, tag];
    }
  }

  function updateThemeConfig() {
    themeConfig.name = themeName;
    themeConfig.displayName = themeDisplayName;
    themeConfig.description = themeDescription;
    themeConfig.author = themeAuthor;
    themeConfig.category = themeCategory;
    themeConfig.tags = themeTags;
  }

  function generateColorVariations(baseColor: string) {
    // Simple color variation generator
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const lighten = (amount: number) => {
      const nr = Math.min(255, r + amount);
      const ng = Math.min(255, g + amount);
      const nb = Math.min(255, b + amount);
      return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    };
    
    const darken = (amount: number) => {
      const nr = Math.max(0, r - amount);
      const ng = Math.max(0, g - amount);
      const nb = Math.max(0, b - amount);
      return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    };
    
    return {
      lighter: lighten(40),
      light: lighten(20),
      base: baseColor,
      dark: darken(20),
      darker: darken(40)
    };
  }

  function applyColorScheme(scheme: 'blue' | 'green' | 'purple' | 'orange') {
    const schemes = {
      blue: { accent: '#3b82f6', hover: '#2563eb' },
      green: { accent: '#10b981', hover: '#059669' },
      purple: { accent: '#8b5cf6', hover: '#7c3aed' },
      orange: { accent: '#f59e0b', hover: '#d97706' }
    };
    
    const colors = schemes[scheme];
    themeConfig.customProperties['--accent-color'] = colors.accent;
    themeConfig.customProperties['--accent-hover'] = colors.hover;
  }

  function applyPreview() {
    if (!previewMode) return;
    
    // Apply theme properties to document root
    const root = document.documentElement;
    Object.entries(themeConfig.customProperties).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    
    // Apply font properties
    if (themeConfig.features.customFonts) {
      root.style.setProperty('--font-primary', themeConfig.fonts.primary);
      root.style.setProperty('--font-secondary', themeConfig.fonts.secondary);
      root.style.setProperty('--font-monospace', themeConfig.fonts.monospace);
      root.style.setProperty('--font-display', themeConfig.fonts.display);
    }
    
    // Apply animation properties
    if (themeConfig.features.animations) {
      root.style.setProperty('--animation-duration', themeConfig.animations.duration);
      root.style.setProperty('--animation-easing', themeConfig.animations.easing);
      root.style.setProperty('--animation-scale', themeConfig.animations.scale);
    }
  }

  function togglePreview() {
    previewMode = !previewMode;
    if (previewMode) {
      updateThemeConfig();
      applyPreview();
    } else {
      // Reset to original theme
      location.reload();
    }
  }

  async function exportTheme() {
    if (!validateStepsUpTo(steps.length - 1)) return;
    
    isExporting = true;
    try {
      updateThemeConfig();
      
      const themeData = {
        ...themeConfig,
        version: themeConfig.version,
        exportedAt: new Date().toISOString(),
        exportedBy: 'DesQTA Theme Builder'
      };
      
      const filePath = await save({
        filters: [{
          name: 'Theme Files',
          extensions: ['json']
        }],
        defaultPath: `${themeConfig.name}.theme.json`
      });
      
      if (filePath) {
        await invoke('export_theme_to_file', { 
          filePath, 
          themeData 
        });
        console.log('Theme exported successfully to:', filePath);
      }
    } catch (error) {
      console.error('Failed to export theme:', error);
    } finally {
      isExporting = false;
    }
  }

  async function importTheme() {
    isImporting = true;
    try {
      // This would open a file picker and import theme
      // Implementation depends on Tauri file system APIs
      console.log('Import theme functionality');
    } catch (error) {
      console.error('Failed to import theme:', error);
    } finally {
      isImporting = false;
    }
  }

  async function saveTheme() {
    if (!validateStepsUpTo(steps.length - 1)) return;
    
    isSaving = true;
    try {
      updateThemeConfig();
      
      // Save theme to app data directory
      await invoke('save_custom_theme', {
        themeName: themeConfig.name,
        themeData: themeConfig
      });
      
      console.log('Theme saved successfully');
      // closeBuilder(); // This function is removed, so no need to call it here
    } catch (error) {
      console.error('Failed to save theme:', error);
    } finally {
      isSaving = false;
    }
  }

  function duplicateTheme() {
    themeName = `${themeName}-copy`;
    themeDisplayName = `${themeDisplayName} (Copy)`;
  }

  onMount(() => {
    previewMode = true;
  });

  onDestroy(() => {
    location.reload();
  });

  // Reactive updates
  $effect(() => {
    if (previewMode) {
      applyPreview();
    }
  });
</script>

<!-- Theme Builder Sidebar Content (single scrollable form, no stepper) -->
<div class="flex flex-col h-full w-full max-w-xl bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-700 pt-16">
  <!-- Header -->
  <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800">
    <div class="flex items-center gap-3">
      <div class="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <Icon src={Swatch} class="w-6 h-6" />
      </div>
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Theme Builder</h2>
        <p class="text-sm text-slate-600 dark:text-slate-400">Create and customize your perfect theme</p>
      </div>
    </div>
    <slot name="close" />
  </div>

  <!-- Scrollable Content -->
  <div class="flex-1 overflow-y-auto p-6 space-y-10">
    <!-- Basic Info Section -->
    <section>
      <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Basic Information</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="themeName">
                Theme Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="themeName"
                bind:value={themeName}
                placeholder="my-awesome-theme"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Lowercase letters, numbers, hyphens, and underscores only
              </p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="themeDisplayName">
                Display Name <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="themeDisplayName"
                bind:value={themeDisplayName}
                placeholder="My Awesome Theme"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="themeDescription">
                Description <span class="text-red-500">*</span>
              </label>
              <textarea
                id="themeDescription"
                bind:value={themeDescription}
                placeholder="A beautiful theme with..."
                rows="3"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
              ></textarea>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="themeAuthor">
                Author <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="themeAuthor"
                bind:value={themeAuthor}
                placeholder="Your Name"
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="themeCategory">
                Category
              </label>
              <select
                id="themeCategory"
                bind:value={themeCategory}
                class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {#each categories as category}
                  <option value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>
                {/each}
              </select>
            </div>
          </div>
          
          <!-- Tags -->
          <div class="mt-6">
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="newTagInput">Tags</label>
            
            <div class="flex flex-wrap gap-2 mb-3">
              {#each themeTags as tag}
                <span class="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm">
                  {tag}
                  <button type="button" onclick={() => removeTag(tag)} class="hover:text-indigo-900 dark:hover:text-indigo-100">
                    <Icon src={XMark} class="w-3 h-3" />
                  </button>
                </span>
              {/each}
            </div>
            
            <div class="flex gap-2 mb-3">
              <input
                type="text"
                id="newTagInput"
                bind:value={newTag}
                placeholder="Add a tag..."
                class="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                onkeydown={handleTagKeydown}
              />
              <button
                type="button"
                onclick={addTag}
                class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            
            <div class="flex flex-wrap gap-1">
              <span class="text-xs text-slate-500 dark:text-slate-400 mr-2">Quick add:</span>
              {#each commonTags as tag}
                <button
                  type="button"
                  onclick={() => addCommonTag(tag)}
                  class="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  disabled={themeTags.includes(tag)}
                >
                  {tag}
                </button>
              {/each}
            </div>
          </div>
        </section>

    <!-- Colors Section -->
    <section>
      <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Colors & Background</h3>
          
          <!-- Primary Colors -->
          <div class="mb-6">
            <h4 class="text-md font-medium text-slate-800 dark:text-slate-200 mb-3">Primary Colors</h4>
            <div class="grid grid-cols-2 gap-4">
              {#each Object.entries(themeConfig.customProperties) as [property, value]}
                {#if property.includes('color')}
                  <div class="flex items-center gap-3">
                    <input
                      type="color"
                      id={property + '-color'}
                      bind:value={themeConfig.customProperties[property]}
                      class="w-12 h-12 rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <div class="flex-1">
                      <label class="block text-sm font-medium text-slate-700 dark:text-slate-300" for={property + '-color'}>
                        {property.replace('--', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <input
                        type="text"
                        id={property + '-text'}
                        bind:value={themeConfig.customProperties[property]}
                        class="w-full text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
          
          <!-- Color Scheme Generator -->
          <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 class="text-md font-medium text-slate-800 dark:text-slate-200 mb-3">Quick Color Schemes</h4>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                onclick={() => applyColorScheme('blue')}
                class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Blue
              </button>
              <button
                type="button"
                onclick={() => applyColorScheme('green')}
                class="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                Green
              </button>
              <button
                type="button"
                onclick={() => applyColorScheme('purple')}
                class="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
              >
                Purple
              </button>
              <button
                type="button"
                onclick={() => applyColorScheme('orange')}
                class="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                Orange
              </button>
            </div>
          </div>
        </section>

    <!-- Typography Section -->
    <section>
      <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Typography</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {#each Object.entries(themeConfig.fonts) as [fontType, fontValue]}
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for={fontType + 'Font'}>
                  {fontType.charAt(0).toUpperCase() + fontType.slice(1)} Font
                </label>
                <input
                  type="text"
                  id={fontType + 'Font'}
                  bind:value={themeConfig.fonts[fontType as keyof typeof themeConfig.fonts]}
                  placeholder="Font family name"
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <div class="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm" style="font-family: {fontValue}">
                  The quick brown fox jumps over the lazy dog
                </div>
              </div>
            {/each}
          </div>
          
          <!-- Font Presets -->
          <div class="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 class="text-md font-medium text-slate-800 dark:text-slate-200 mb-3">Font Presets</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onclick={() => {
                  themeConfig.fonts.primary = 'Inter, system-ui, sans-serif';
                  themeConfig.fonts.secondary = 'Inter, system-ui, sans-serif';
                  themeConfig.fonts.display = 'Inter, system-ui, sans-serif';
                }}
                class="p-3 text-left bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600"
              >
                <div class="font-medium">Modern Sans</div>
                <div class="text-sm text-slate-600 dark:text-slate-400">Inter, clean and readable</div>
              </button>
              <button
                type="button"
                onclick={() => {
                  themeConfig.fonts.primary = 'Georgia, serif';
                  themeConfig.fonts.secondary = 'Georgia, serif';
                  themeConfig.fonts.display = 'Georgia, serif';
                }}
                class="p-3 text-left bg-white dark:bg-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600"
              >
                <div class="font-medium">Classic Serif</div>
                <div class="text-sm text-slate-600 dark:text-slate-400">Georgia, traditional and elegant</div>
              </button>
            </div>
          </div>
        </section>

    <!-- Features Section -->
    <section>
      <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Features</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each Object.entries(themeConfig.features) as [feature, enabled]}
              <label class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={themeConfig.features[feature as keyof typeof themeConfig.features]}
                  class="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <div class="font-medium text-slate-900 dark:text-white">
                    {feature.charAt(0).toUpperCase() + feature.slice(1).replace(/([A-Z])/g, ' $1')}
                  </div>
                  <div class="text-sm text-slate-600 dark:text-slate-400">
                    {feature === 'glassmorphism' && 'Translucent glass-like effects'}
                    {feature === 'gradients' && 'Gradient backgrounds and elements'}
                    {feature === 'animations' && 'Smooth transitions and animations'}
                    {feature === 'customFonts' && 'Custom font family support'}
                    {feature === 'darkMode' && 'Dark mode compatibility'}
                    {feature === 'colorSchemes' && 'Multiple color scheme support'}
                    {feature === 'accessibility' && 'Enhanced accessibility features'}
                    {feature === 'responsive' && 'Responsive design support'}
                  </div>
                </div>
              </label>
            {/each}
          </div>
        </section>

    <!-- Animations Section -->
    <section>
      <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Animations</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {#each Object.entries(themeConfig.animations) as [animType, animValue]}
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for={animType + 'Animation'}>
                  {animType.charAt(0).toUpperCase() + animType.slice(1)}
                </label>
                <input
                  type="text"
                  id={animType + 'Animation'}
                  bind:value={themeConfig.animations[animType as keyof typeof themeConfig.animations]}
                  placeholder="Animation value"
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            {/each}
          </div>
        </section>

    <!-- Custom Properties Section -->
    <section>
      <h3 class="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Custom Properties</h3>
      <!-- ... Custom CSS variables ... -->
    </section>
  </div>

  <!-- Sticky Footer Actions -->
  <div class="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky bottom-0 z-10">
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={importTheme}
        disabled={isImporting}
        class="flex items-center gap-2 px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
      >
        <Icon src={ArrowUpTray} class="w-4 h-4" />
        {isImporting ? 'Importing...' : 'Import'}
      </button>
      
      <button
        type="button"
        onclick={exportTheme}
        disabled={isExporting || !canExportOrSave()}
        class="flex items-center gap-2 px-3 py-2 text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
      >
        <Icon src={ArrowDownTray} class="w-4 h-4" />
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
    </div>
    
    <div class="flex items-center gap-2">
      {#if currentStep > 0}
        <button
          type="button"
          onclick={prevStep}
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          Previous
        </button>
      {/if}
      
      {#if currentStep < steps.length - 1}
        <button
          type="button"
          onclick={nextStep}
          disabled={!isCurrentStepValid()}
          class="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          Next
        </button>
      {:else}
        <button
          type="button"
          onclick={saveTheme}
          disabled={isSaving || !canExportOrSave()}
          class="flex items-center gap-2 px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          <Icon src={BookmarkSquare} class="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Theme'}
        </button>
      {/if}
    </div>
  </div>
</div> 