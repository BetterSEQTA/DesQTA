<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { Icon, Eye, Trash, DocumentDuplicate, ArrowPathRoundedSquare, Cog6Tooth, Swatch, DocumentText, Bolt, RectangleStack, Sparkles, XMark, ArrowUpTray, ArrowDownTray, BookmarkSquare } from 'svelte-hero-icons';
  import { invoke } from '@tauri-apps/api/core';
  import { save, open } from '@tauri-apps/plugin-dialog';
  import { loadAndApplyTheme, currentTheme } from '$lib/stores/theme';
  import { themeService, type ThemeManifest } from '$lib/services/themeService';
  import type { Snippet } from 'svelte';

  interface Props {
    close?: Snippet;
  }

  let { close }: Props = $props();
  
  // Extended theme manifest for theme builder with additional properties
  interface ExtendedThemeManifest extends ThemeManifest {
    displayName?: string;
    tags?: string[];
    settings: ThemeManifest['settings'] & {
      allowUserCustomization?: boolean;
      autoSwitchTime?: { light: string; dark: string } | null;
    };
    fonts: ThemeManifest['fonts'] & {
      display?: string;
    };
    animations: ThemeManifest['animations'] & {
      scale?: string;
      fadeIn?: string;
      slideIn?: string;
    };
    features: ThemeManifest['features'] & {
      animations?: boolean;
      customFonts?: boolean;
      darkMode?: boolean;
      colorSchemes?: boolean;
      accessibility?: boolean;
      responsive?: boolean;
    };
    colorSchemes?: {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
    accessibility?: {
      highContrast: boolean;
      reducedMotion: boolean;
      focusIndicators: boolean;
      screenReaderOptimized: boolean;
    };
    responsive?: {
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
  let availableThemes = $state<string[]>([]);
  let showLoadThemeModal = $state(false);
  let loadingThemes = $state(false);

  // Theme configuration
  let themeConfig = $state<ExtendedThemeManifest>({
    name: '',
    displayName: '',
    description: '',
    version: '1.0.0',
    author: '',
    license: 'MIT',
    category: 'custom',
    tags: [],
    compatibility: {
      minVersion: '1.0.0',
      maxVersion: '2.0.0'
    },
    preview: {
      thumbnail: '',
      screenshots: []
    },
    settings: {
      defaultTheme: 'system',
      defaultAccentColor: '#3b82f6',
      supportsLightMode: true,
      supportsDarkMode: true,
      supportsSystemMode: true,
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
      customScrollbars: false,
      glassmorphism: false,
      gradients: false,
      shadows: true,
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
      enableEnhanced: true,
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

  // Font autocomplete options (sample common families)
  const fontOptions = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'Roboto', value: 'Roboto, system-ui, sans-serif' },
    { label: 'Poppins', value: 'Poppins, system-ui, sans-serif' },
    { label: 'Nunito', value: 'Nunito, system-ui, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, system-ui, sans-serif' },
    { label: 'Lato', value: 'Lato, system-ui, sans-serif' },
    { label: 'Open Sans', value: 'Open Sans, system-ui, sans-serif' },
    { label: 'Source Sans Pro', value: 'Source Sans Pro, system-ui, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, serif' },
    { label: 'JetBrains Mono', value: 'JetBrains Mono, Consolas, monospace' },
    { label: 'Fira Code', value: 'Fira Code, Consolas, monospace' },
    { label: 'Manrope', value: 'Manrope, system-ui, sans-serif' },
    { label: 'Work Sans', value: 'Work Sans, system-ui, sans-serif' },
    { label: 'DM Sans', value: 'DM Sans, system-ui, sans-serif' },
    { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, system-ui, sans-serif' },
    { label: 'SF Pro Text', value: 'SF Pro Text, -apple-system, system-ui, sans-serif' },
    { label: 'Segoe UI', value: 'Segoe UI, system-ui, sans-serif' },
    { label: 'Helvetica Neue', value: 'Helvetica Neue, Arial, sans-serif' },
    { label: 'Avenir', value: 'Avenir, system-ui, sans-serif' },
    { label: 'IBM Plex Sans', value: 'IBM Plex Sans, system-ui, sans-serif' },
    { label: 'IBM Plex Mono', value: 'IBM Plex Mono, Consolas, monospace' },
    { label: 'Space Grotesk', value: 'Space Grotesk, system-ui, sans-serif' },
    { label: 'Space Mono', value: 'Space Mono, Consolas, monospace' },
    { label: 'Raleway', value: 'Raleway, system-ui, sans-serif' },
    { label: 'Oswald', value: 'Oswald, system-ui, sans-serif' },
    { label: 'Ubuntu', value: 'Ubuntu, system-ui, sans-serif' },
    { label: 'Cascadia Code', value: 'Cascadia Code, Consolas, monospace' },
    { label: 'Menlo', value: 'Menlo, Consolas, monospace' },
    { label: 'Monaco', value: 'Monaco, Consolas, monospace' },
    { label: 'Consolas', value: 'Consolas, monospace' },
    { label: 'Courier New', value: 'Courier New, monospace' },
  ];

  let fontQuery = $state('');
  let showFontDropdown = $state(false);
  function coercePrimaryFromQuery(query: string): string {
    const q = (query || '').trim();
    if (!q) return themeConfig.fonts.primary;
    // If user provided a full stack with comma or generic family, accept as-is
    const lower = q.toLowerCase();
    if (q.includes(',') || lower.includes('serif') || lower.includes('monospace') || lower.includes('sans-serif')) {
      return q;
    }
    // Otherwise append sensible fallbacks
    return `${q}, system-ui, sans-serif`;
  }
  function filteredFonts() {
    if (!fontQuery) return fontOptions;
    return fontOptions.filter(f => f.label.toLowerCase().includes(fontQuery.toLowerCase()));
  }
  function selectFont(opt: { label: string; value: string }) {
    themeConfig.fonts.primary = opt.value;
    fontQuery = opt.label;
    showFontDropdown = false;
  }

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
        if (!themeDescription.trim()) validationErrors.push('Description is required');
        break;
      case 1: // Colors (no required fields)
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
          if (!themeDescription.trim()) tempErrors.push('Description is required');
          break;
        case 1: // Colors (no required fields)
          break;
      }
      
      if (tempErrors.length > 0) return false;
    }
    return true;
  }

  function canSaveApplyValid(): boolean {
    // Only require name and description
    if (!themeName || !themeName.trim()) return false;
    if (!themeDescription || !themeDescription.trim()) return false;
    return true;
  }

  function isCurrentStepValid(): boolean {
    // Non-mutating version of validateCurrentStep for template expressions
    switch (currentStep) {
      case 0: // Basic Info
        if (!themeName.trim()) return false;
        if (!themeDescription.trim()) return false;
        break;
      case 1: // Colors (no required fields)
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
    themeConfig.settings.defaultAccentColor = colors.accent;
    themeConfig.customProperties['--accent-color'] = colors.accent;
    themeConfig.customProperties['--accent-hover'] = colors.hover;
  }

  function applyPreview() {
    if (!previewMode) return;
    
    // Apply theme properties to document root
    const root = document.documentElement;
    
    // Apply all custom properties
    Object.entries(themeConfig.customProperties).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    
    // Apply accent color specifically for TailwindCSS integration
    if (themeConfig.settings.defaultAccentColor) {
      root.style.setProperty('--accent-color-value', themeConfig.settings.defaultAccentColor);
    }
    
    // Apply font properties (always apply, not just when customFonts is enabled)
    root.style.setProperty('--font-primary', themeConfig.fonts.primary);
    root.style.setProperty('--font-secondary', themeConfig.fonts.secondary);
    root.style.setProperty('--font-monospace', themeConfig.fonts.monospace);
    root.style.setProperty('--font-display', themeConfig.fonts.display || themeConfig.fonts.primary);
    
    // Apply font family to body for immediate visual feedback
    if (themeConfig.fonts.primary) {
      root.style.setProperty('font-family', themeConfig.fonts.primary);
    }
    
    // Apply animation properties (always apply, not just when animations is enabled)
    root.style.setProperty('--animation-duration', themeConfig.animations.duration);
    root.style.setProperty('--animation-easing', themeConfig.animations.easing);
    root.style.setProperty('--animation-scale', themeConfig.animations.scale || '1.05');
    
    // Apply fade and slide animations
    root.style.setProperty('--fade-in-animation', themeConfig.animations.fadeIn || 'opacity 200ms ease-in-out');
    root.style.setProperty('--slide-in-animation', themeConfig.animations.slideIn || 'transform 200ms ease-in-out');
    
    // Apply common theme-based classes
    if (themeConfig.features.glassmorphism) {
      root.style.setProperty('--glassmorphism-blur', 'blur(10px)');
      root.style.setProperty('--glassmorphism-bg', 'rgba(255, 255, 255, 0.1)');
    }
    
    // Apply responsive breakpoints
    if (themeConfig.responsive?.breakpoints) {
      Object.entries(themeConfig.responsive.breakpoints).forEach(([key, value]) => {
        root.style.setProperty(`--breakpoint-${key}`, value);
      });
    }
    
    console.log('Applied theme preview:', {
      customProperties: themeConfig.customProperties,
      fonts: themeConfig.fonts,
      animations: themeConfig.animations,
      accent: themeConfig.settings.defaultAccentColor
    });
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
    if (!canSaveApplyValid()) return;
    
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
      // Open file picker to select theme file
      const filePath = await open({
        filters: [{
          name: 'Theme Files',
          extensions: ['json', 'theme.json']
        }],
        multiple: false
      });
      
      if (filePath) {
        // Import the theme using Tauri command
        const themeName = await invoke<string>('import_theme_from_file', { 
          filePath: filePath 
        });
        
        console.log('Theme imported successfully:', themeName);
        
        // Load the imported theme into the builder
        await loadThemeIntoBuilder(themeName);
      }
    } catch (error) {
      console.error('Failed to import theme:', error);
      alert('Failed to import theme: ' + error);
    } finally {
      isImporting = false;
    }
  }

  async function saveTheme() {
    if (!canSaveApplyValid()) return;
    
    isSaving = true;
    try {
      updateThemeConfig();
      
      // Convert extended manifest back to basic manifest for saving
      const basicManifest: ThemeManifest = {
        name: themeConfig.name,
        // Ensure displayName is provided for backend schema
        // Use provided displayName or fallback to name
        ...(themeConfig.displayName ? { displayName: themeConfig.displayName } : { displayName: themeConfig.name }),
        version: themeConfig.version,
        description: themeConfig.description,
        author: themeConfig.author,
        license: themeConfig.license,
        category: themeConfig.category,
        // Provide tags array (can be empty)
        tags: themeConfig.tags || [],
        compatibility: themeConfig.compatibility,
        preview: themeConfig.preview,
        settings: {
          defaultAccentColor: themeConfig.settings.defaultAccentColor,
          defaultTheme: themeConfig.settings.defaultTheme,
          supportsLightMode: themeConfig.settings.supportsLightMode,
          supportsDarkMode: themeConfig.settings.supportsDarkMode,
          supportsSystemMode: themeConfig.settings.supportsSystemMode
        },
        customProperties: themeConfig.customProperties,
        fonts: {
          primary: themeConfig.fonts.primary,
          secondary: themeConfig.fonts.secondary,
          monospace: themeConfig.fonts.monospace,
          display: themeConfig.fonts.display || themeConfig.fonts.primary
        },
        animations: {
          duration: themeConfig.animations.duration,
          easing: themeConfig.animations.easing,
          enableEnhanced: themeConfig.animations.enableEnhanced,
          // Provide optional fields to satisfy backend defaults
          // even if not used by CSS generation directly
          ...(themeConfig.animations.scale ? { scale: themeConfig.animations.scale } : {}),
          ...(themeConfig.animations.fadeIn ? { fadeIn: themeConfig.animations.fadeIn } : {}),
          ...(themeConfig.animations.slideIn ? { slideIn: themeConfig.animations.slideIn } : {}),
        },
        features: {
          customScrollbars: themeConfig.features.customScrollbars,
          glassmorphism: themeConfig.features.glassmorphism,
          gradients: themeConfig.features.gradients,
          shadows: themeConfig.features.shadows
        },
        // Provide optional nested objects expected by backend schema
        colorSchemes: themeConfig.colorSchemes || { light: {}, dark: {} },
        accessibility: themeConfig.accessibility || {
          highContrast: false,
          reducedMotion: false,
          focusIndicators: true,
          screenReaderOptimized: true
        },
        responsive: themeConfig.responsive || {
          breakpoints: {
            sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px'
          },
          fluidTypography: true,
          adaptiveSpacing: true
        }
      };
      
      // Save theme to app data directory via service (clears cache)
      await themeService.saveCustomTheme(basicManifest.name, basicManifest as any);
      
      console.log('Theme saved successfully');
    } catch (error) {
      console.error('Failed to save theme:', error);
    } finally {
      isSaving = false;
    }
  }

  async function applyThemeFromBuilder() {
    if (!validateStepsUpTo(steps.length - 1)) return;
    try {
      await saveTheme();
      await loadAndApplyTheme(themeConfig.name);
      // Reload to ensure all assets and classes apply consistently
      location.reload();
    } catch (error) {
      console.error('Failed to apply theme from builder:', error);
    }
  }

  function duplicateTheme() {
    themeName = `${themeName}-copy`;
    themeDisplayName = `${themeDisplayName} (Copy)`;
  }

  async function loadAvailableThemes() {
    loadingThemes = true;
    try {
      // Only show custom themes from app data
      availableThemes = await themeService.getCustomThemes();
    } catch (error) {
      console.error('Failed to load available themes:', error);
    } finally {
      loadingThemes = false;
    }
  }

  async function loadThemeIntoBuilder(themeNameToLoad: string) {
    try {
      const manifest = await themeService.getThemeManifest(themeNameToLoad);
      if (!manifest) {
        throw new Error('Theme manifest not found');
      }

      // Convert the basic manifest to extended manifest with defaults
      const extendedManifest: ExtendedThemeManifest = {
        ...manifest,
        displayName: manifest.name,
        tags: [],
        settings: {
          ...manifest.settings,
          allowUserCustomization: true,
          autoSwitchTime: null
        },
        fonts: {
          ...manifest.fonts,
          display: manifest.fonts.primary
        },
        animations: {
          ...manifest.animations,
          scale: '1.05',
          fadeIn: 'opacity 200ms ease-in-out',
          slideIn: 'transform 200ms ease-in-out'
        },
        features: {
          ...manifest.features,
          animations: true,
          customFonts: true,
          darkMode: true,
          colorSchemes: true,
          accessibility: true,
          responsive: true
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
      };

      // Populate the theme builder with the loaded theme data
      themeConfig = extendedManifest;
      
      // Update the basic info state
      themeName = extendedManifest.name;
      themeDisplayName = extendedManifest.displayName || extendedManifest.name;
      themeDescription = extendedManifest.description;
      themeAuthor = extendedManifest.author;
      themeCategory = extendedManifest.category || 'custom';
      themeTags = extendedManifest.tags || [];

      // Close the load modal
      showLoadThemeModal = false;

      // Apply the theme preview
      if (previewMode) {
        applyPreview();
      }

      console.log('Theme loaded into builder:', extendedManifest.name);
    } catch (error) {
      console.error('Failed to load theme into builder:', error);
      alert('Failed to load theme: ' + error);
    }
  }

  function openLoadThemeModal() {
    loadAvailableThemes();
    showLoadThemeModal = true;
  }

  onMount(() => {
    previewMode = true;
  });

  onDestroy(() => {
    location.reload();
  });

  // Reactive updates - watch for changes in theme properties
  $effect(() => {
    if (previewMode) {
      applyPreview();
    }
  });

  // Watch for changes in custom properties (colors)
  $effect(() => {
    if (previewMode) {
      const props = JSON.stringify(themeConfig.customProperties);
      applyPreview();
    }
  });

  // Watch for changes in fonts
  $effect(() => {
    if (previewMode) {
      const fonts = JSON.stringify(themeConfig.fonts);
      applyPreview();
    }
  });

  // Watch for changes in animations
  $effect(() => {
    if (previewMode) {
      const animations = JSON.stringify(themeConfig.animations);
      applyPreview();
    }
  });

  // Watch for changes in settings (accent color)
  $effect(() => {
    if (previewMode) {
      const settings = JSON.stringify(themeConfig.settings);
      applyPreview();
    }
  });

  // Watch for changes in features
  $effect(() => {
    if (previewMode) {
      const features = JSON.stringify(themeConfig.features);
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
      <!-- Action buttons -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={openLoadThemeModal}
          class="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <Icon src={DocumentDuplicate} class="w-4 h-4" />
          Load
        </button>
      </div>
    </div>
    {@render close?.()}
  </div>

  <!-- Live Preview Panel -->
  <!-- Live preview removed per request; the app reflects changes directly. -->

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
          
          <!-- Accent Color -->
          <div class="mb-6">
            <h4 class="text-md font-medium text-slate-800 dark:text-slate-200 mb-3">Accent Color</h4>
            <div class="flex items-center gap-3">
              <input
                type="color"
                id="accent-color"
                bind:value={themeConfig.settings.defaultAccentColor}
                class="w-12 h-12 rounded-lg border-2 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <div class="flex-1">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300" for="accent-color">
                  Primary Accent Color
                </label>
                <input
                  type="text"
                  id="accent-color-text"
                  bind:value={themeConfig.settings.defaultAccentColor}
                  class="w-full text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
          
          <!-- Primary Colors -->
          <div class="mb-6">
            <h4 class="text-md font-medium text-slate-800 dark:text-slate-200 mb-3">Primary Colors</h4>
            <div class="grid grid-cols-2 gap-4">
              {#each ['--background-color','--text-color','--accent-color'] as property}
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
            <div class="relative">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2" for="primaryFont">
                Primary Font
              </label>
              <div class="relative">
                <input
                  id="primaryFont"
                  type="text"
                  placeholder="Search fonts..."
                  bind:value={fontQuery}
                  onfocus={() => { showFontDropdown = true; fontQuery = fontQuery || (themeConfig.fonts.primary.split(',')[0] || ''); }}
                  oninput={(e) => { showFontDropdown = true; themeConfig.fonts.primary = coercePrimaryFromQuery((e.target as HTMLInputElement).value); }}
                  class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  style="font-family: {themeConfig.fonts.primary}"
                />
                {#if showFontDropdown}
                  <div class="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {#each filteredFonts() as opt}
                      <button
                        type="button"
                        class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        style="font-family: {opt.value}"
                        onclick={() => selectFont(opt)}
                      >
                        {opt.label}
                      </button>
                    {/each}
                    {#if filteredFonts().length === 0}
                      <div class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No matches</div>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-sm" style="font-family: {themeConfig.fonts.primary}">
                The quick brown fox jumps over the lazy dog
              </div>
            </div>
          </div>
          
          <!-- Font Presets -->
          <div class="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <h4 class="text-md font-medium text-slate-800 dark:text-slate-200 mb-3">Font Presets</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onclick={() => {
                  themeConfig.fonts.primary = 'Inter, system-ui, sans-serif';
                  fontQuery = 'Inter';
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
                  fontQuery = 'Georgia';
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
    <div class="flex items-center gap-2"></div>
    
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={saveTheme}
        disabled={isSaving || !canSaveApplyValid()}
        class="flex items-center gap-2 px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        <Icon src={BookmarkSquare} class="w-4 h-4" />
        {isSaving ? 'Saving...' : 'Save'}
      </button>
      <button
        type="button"
        onclick={applyThemeFromBuilder}
        disabled={isSaving || !canSaveApplyValid()}
        class="flex items-center gap-2 px-6 py-2 accent-bg hover:accent-bg-hover text-white rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        Apply
      </button>
    </div>
  </div>
</div>

<!-- Load Theme Modal -->
{#if showLoadThemeModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" transition:fade>
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md" transition:scale>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Load Existing Theme</h3>
          <button
            type="button"
            onclick={() => showLoadThemeModal = false}
            class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Icon src={XMark} class="w-5 h-5" />
          </button>
        </div>
        
        {#if loadingThemes}
          <div class="flex items-center justify-center py-8">
            <div class="w-6 h-6 rounded-full border-2 animate-spin border-slate-300 border-t-slate-600"></div>
          </div>
        {:else if availableThemes.length === 0}
          <div class="text-center py-8">
            <div class="text-slate-500 dark:text-slate-400 mb-2">No custom themes found</div>
            <div class="text-sm text-slate-400 dark:text-slate-500">Create a theme or import one to get started</div>
          </div>
        {:else}
          <div class="space-y-2 max-h-60 overflow-y-auto">
            {#each availableThemes as theme}
              <button
                type="button"
                onclick={() => loadThemeIntoBuilder(theme)}
                class="w-full p-3 text-left rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div class="font-medium text-slate-900 dark:text-white">{theme}</div>
                <div class="text-sm text-slate-500 dark:text-slate-400">Custom theme</div>
              </button>
            {/each}
          </div>
        {/if}
        
        <div class="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onclick={() => showLoadThemeModal = false}
            class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 