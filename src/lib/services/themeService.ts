import { invoke } from '@tauri-apps/api/core';

export interface ThemeManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category?: string;
  compatibility: {
    minVersion: string;
    maxVersion: string;
  };
  preview: {
    thumbnail: string;
    screenshots: string[];
  };
  settings: {
    defaultAccentColor: string;
    defaultTheme: 'light' | 'dark' | 'system';
    supportsLightMode: boolean;
    supportsDarkMode: boolean;
    supportsSystemMode: boolean;
  };
  customProperties: Record<string, string>;
  fonts: {
    primary: string;
    secondary: string;
    monospace: string;
  };
  animations: {
    duration: string;
    easing: string;
    enableEnhanced: boolean;
  };
  features: {
    customScrollbars: boolean;
    glassmorphism: boolean;
    gradients: boolean;
    shadows: boolean;
  };
}

class ThemeService {
  private currentTheme: string = 'default';
  private loadedThemes: Map<string, ThemeManifest> = new Map();
  private activeCSSLinks: HTMLLinkElement[] = [];

  async loadTheme(themeName: string): Promise<void> {
    // If it's the default theme, remove all custom theme CSS
    if (themeName === 'default') {
      this.removeActiveCSS();
      this.currentTheme = 'default';
      return;
    }

    try {
      // Load theme manifest
      const manifest = await this.loadThemeManifest(themeName);
      
      // Load CSS files
      await this.loadThemeCSS(themeName, manifest);
      
      // Apply custom properties
      this.applyCustomProperties(manifest.customProperties);
      
      // Load fonts
      await this.loadThemeFonts(manifest.fonts);
      
      // Update current theme
      this.currentTheme = themeName;
      
      // Save to settings
      await this.saveThemePreference(themeName);
    } catch (error) {
      console.error('Failed to load theme:', error);
      // Fallback to default theme
      await this.loadTheme('default');
    }
  }

  async loadThemeManifest(themeName: string): Promise<ThemeManifest> {
    try {
      // First try to load from backend (supports both static and custom themes)
      const manifest = await invoke<ThemeManifest>('load_theme_manifest', { themeName });
      this.loadedThemes.set(themeName, manifest);
      return manifest;
    } catch (backendError) {
      console.warn('Backend theme loading failed, trying static fallback:', backendError);
      
      // Fallback to static themes directory
      const manifestPath = `/themes/${themeName}/theme-manifest.json`;
      
      try {
        const response = await fetch(manifestPath);
        if (!response.ok) {
          throw new Error(`Failed to load theme manifest: ${response.statusText}`);
        }
        
        const manifest: ThemeManifest = await response.json();
        this.loadedThemes.set(themeName, manifest);
        return manifest;
      } catch (staticError) {
        console.error('Error loading theme manifest from static:', staticError);
        throw staticError;
      }
    }
  }

  async loadThemeCSS(themeName: string, manifest: ThemeManifest): Promise<void> {
    // Remove existing theme CSS
    this.removeActiveCSS();
    
    try {
      // Load global CSS
      await this.loadCSSFile(`/themes/${themeName}/styles/global.css`);
      
      // Load theme-specific CSS based on current mode
      const currentMode = this.getCurrentThemeMode();
      await this.loadCSSFile(`/themes/${themeName}/styles/${currentMode}.css`);
      
      // Load component CSS
      await this.loadCSSFile(`/themes/${themeName}/styles/components.css`);
    } catch (error) {
      console.warn('Some theme CSS files could not be loaded:', error);
    }
  }

  private async loadCSSFile(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = path;
      link.dataset.theme = 'true';
      
      link.onload = () => {
        this.activeCSSLinks.push(link);
        resolve();
      };
      
      link.onerror = () => {
        // Silently fail for missing CSS files
        resolve();
      };
      
      document.head.appendChild(link);
    });
  }

  private removeActiveCSS(): void {
    this.activeCSSLinks.forEach(link => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });
    this.activeCSSLinks = [];
  }

  private applyCustomProperties(properties: Record<string, string>): void {
    const root = document.documentElement;
    
    Object.entries(properties).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }

  private async loadThemeFonts(fonts: ThemeManifest['fonts']): Promise<void> {
    // For now, just apply font family CSS variables
    const root = document.documentElement;
    root.style.setProperty('--font-primary', fonts.primary);
    root.style.setProperty('--font-secondary', fonts.secondary);
    root.style.setProperty('--font-monospace', fonts.monospace);
  }

  private getCurrentThemeMode(): string {
    // Get current theme mode from the theme store
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      return 'dark';
    } else {
      return 'light';
    }
  }

  private async saveThemePreference(themeName: string): Promise<void> {
    try {
      const settings = await invoke<any>('get_settings');
      await invoke('save_settings', {
        newSettings: {
          ...settings,
          current_theme: themeName,
        },
      });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }

  async getAvailableThemes(): Promise<string[]> {
    try {
      return await invoke<string[]>('get_available_themes');
    } catch (error) {
      console.error('Failed to get available themes:', error);
      // Fallback to built-in themes
      return ['default', 'sunset', 'light', 'mint', 'grape', 'midnight', 'bubblegum', 'solarized', 'glass', 'aero'];
    }
  }

  async getCurrentTheme(): Promise<string> {
    return this.currentTheme;
  }

  async getThemeManifest(themeName: string): Promise<ThemeManifest | null> {
    if (this.loadedThemes.has(themeName)) {
      return this.loadedThemes.get(themeName)!;
    }
    
    try {
      return await this.loadThemeManifest(themeName);
    } catch (error) {
      return null;
    }
  }

  // Method to reset to default theme (no custom CSS)
  async resetToDefault(): Promise<void> {
    this.removeActiveCSS();
    this.currentTheme = 'default';
    
    // Clear any custom properties
    const root = document.documentElement;
    const customProperties = [
      'primaryColor', 'secondaryColor', 'successColor', 'warningColor', 'errorColor',
      'backgroundColor', 'surfaceColor', 'textColor', 'borderColor', 'shadowColor',
      'font-primary', 'font-secondary', 'font-monospace'
    ];
    
    customProperties.forEach(prop => {
      root.style.removeProperty(`--${prop}`);
    });
    
    await this.saveThemePreference('default');
  }

  public setCustomProperties(properties: Record<string, string>): void {
    this.applyCustomProperties(properties);
  }

  public setThemeFonts(fonts: ThemeManifest['fonts']): void {
    this.loadThemeFonts(fonts);
  }

  // Custom theme management methods
  async saveCustomTheme(themeName: string, themeData: any): Promise<void> {
    try {
      await invoke('save_custom_theme', { themeName, themeData });
      // Clear cached themes to force reload
      this.loadedThemes.clear();
    } catch (error) {
      console.error('Failed to save custom theme:', error);
      throw error;
    }
  }

  async deleteCustomTheme(themeName: string): Promise<void> {
    try {
      await invoke('delete_custom_theme', { themeName });
      // Remove from cache
      this.loadedThemes.delete(themeName);
    } catch (error) {
      console.error('Failed to delete custom theme:', error);
      throw error;
    }
  }

  async importThemeFromFile(filePath: string): Promise<string> {
    try {
      const themeName = await invoke<string>('import_theme_from_file', { filePath });
      // Clear cached themes to force reload
      this.loadedThemes.clear();
      return themeName;
    } catch (error) {
      console.error('Failed to import theme from file:', error);
      throw error;
    }
  }

  async getThemesDirectoryPath(): Promise<string> {
    try {
      return await invoke<string>('get_themes_directory_path');
    } catch (error) {
      console.error('Failed to get themes directory path:', error);
      throw error;
    }
  }

  // Enhanced theme loading with better error handling and caching
  async loadThemeWithFallback(themeName: string): Promise<void> {
    try {
      await this.loadTheme(themeName);
    } catch (error) {
      console.error(`Failed to load theme '${themeName}', falling back to default:`, error);
      await this.loadTheme('default');
    }
  }

  // Validate theme data structure
  validateThemeData(themeData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!themeData.name || typeof themeData.name !== 'string') {
      errors.push('Theme name is required and must be a string');
    }
    
    if (!themeData.displayName || typeof themeData.displayName !== 'string') {
      errors.push('Display name is required and must be a string');
    }
    
    if (!themeData.version || typeof themeData.version !== 'string') {
      errors.push('Version is required and must be a string');
    }
    
    if (!themeData.customProperties || typeof themeData.customProperties !== 'object') {
      errors.push('Custom properties are required and must be an object');
    } else {
      const requiredProps = ['--background-color', '--text-color', '--accent-color'];
      for (const prop of requiredProps) {
        if (!themeData.customProperties[prop]) {
          errors.push(`Required property '${prop}' is missing`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate theme preview CSS for testing
  generatePreviewCSS(themeData: any): string {
    let css = ':root {\n';
    
    if (themeData.customProperties) {
      for (const [key, value] of Object.entries(themeData.customProperties)) {
        css += `  ${key}: ${value};\n`;
      }
    }
    
    if (themeData.fonts && themeData.features?.customFonts) {
      css += `  --font-primary: ${themeData.fonts.primary};\n`;
      css += `  --font-secondary: ${themeData.fonts.secondary};\n`;
      css += `  --font-monospace: ${themeData.fonts.monospace};\n`;
      css += `  --font-display: ${themeData.fonts.display};\n`;
    }
    
    if (themeData.animations && themeData.features?.animations) {
      css += `  --animation-duration: ${themeData.animations.duration};\n`;
      css += `  --animation-easing: ${themeData.animations.easing};\n`;
      css += `  --animation-scale: ${themeData.animations.scale};\n`;
    }
    
    css += '}\n';
    
    return css;
  }

  // Apply temporary theme for preview without saving
  applyTemporaryTheme(themeData: any): void {
    const css = this.generatePreviewCSS(themeData);
    
    // Remove existing preview styles
    const existingPreview = document.getElementById('theme-preview-styles');
    if (existingPreview) {
      existingPreview.remove();
    }
    
    // Add new preview styles
    const style = document.createElement('style');
    style.id = 'theme-preview-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Remove temporary theme preview
  removeTemporaryTheme(): void {
    const existingPreview = document.getElementById('theme-preview-styles');
    if (existingPreview) {
      existingPreview.remove();
    }
  }
}

// Export singleton instance
export const themeService = new ThemeService(); 