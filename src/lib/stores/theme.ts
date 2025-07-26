import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import { themeService, type ThemeManifest } from '../services/themeService';

// Create a writable store with the default accent color
export const accentColor = writable('#3b82f6');

// Create a writable store for the theme
export const theme = writable<'light' | 'dark' | 'system'>('system');

// New theme system stores
export const currentTheme = writable('default');
export const themeManifest = writable<ThemeManifest | null>(null);
export const customCSS = writable('');

// Derived store for theme properties
export const themeProperties = derived(
  [currentTheme, themeManifest],
  ([$currentTheme, $manifest]) => {
    if (!$manifest) return {};
    return $manifest.customProperties;
  }
);

// Function to get the system theme preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

// Function to apply theme to the DOM
function applyTheme(themeValue: 'light' | 'dark' | 'system') {
  if (typeof document === 'undefined') return;

  const resolvedTheme = themeValue === 'system' ? getSystemTheme() : themeValue;

  // Add or remove the dark class
  if (resolvedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // Keep the data attribute for compatibility
  document.documentElement.setAttribute('data-theme', resolvedTheme);
}

// Function to load the accent color from settings
export async function loadAccentColor() {
  try {
    const settings = await invoke<{ accent_color: string }>('get_settings');
    accentColor.set(settings.accent_color || '#3b82f6');
  } catch (e) {
    console.error('Failed to load accent color:', e);
  }
}

// Function to load the theme from settings
export async function loadTheme() {
  try {
    const settings = await invoke<{ theme: 'light' | 'dark' | 'system' }>('get_settings');
    const loadedTheme = settings.theme || 'system';
    theme.set(loadedTheme);
    applyTheme(loadedTheme);

    // Listen for system theme changes if using system theme
    if (loadedTheme === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        theme.update((currentTheme) => {
          if (currentTheme === 'system') {
            applyTheme('system');
          }
          return currentTheme;
        });
      };

      // Remove any existing listener first
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    }
  } catch (e) {
    console.error('Failed to load theme:', e);
    // Fallback to system theme
    theme.set('system');
    applyTheme('system');
  }
}

// Function to update the accent color
export async function updateAccentColor(color: string) {
  logger.info('themeStore', 'updateAccentColor', `Updating accent color to: ${color}`);
  
  try {
    const settings = await invoke<any>('get_settings');
    await invoke('save_settings', {
      newSettings: {
        ...settings,
        accent_color: color,
      },
    });
    accentColor.set(color);
    logger.debug('themeStore', 'updateAccentColor', 'Accent color updated successfully');
  } catch (e) {
    logger.error('themeStore', 'updateAccentColor', `Failed to update accent color: ${e}`, { error: e, color });
  }
}

// Function to update the theme
export async function updateTheme(newTheme: 'light' | 'dark' | 'system') {
  try {
    const settings = await invoke<any>('get_settings');
    await invoke('save_settings', {
      newSettings: {
        ...settings,
        theme: newTheme,
      },
    });
    theme.set(newTheme);
    applyTheme(newTheme);

    // Set up system theme listener if switching to system
    if (newTheme === 'system' && typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        theme.update((currentTheme) => {
          if (currentTheme === 'system') {
            applyTheme('system');
          }
          return currentTheme;
        });
      };

      // Remove any existing listener first
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    }
  } catch (e) {
    console.error('Failed to update theme:', e);
  }
}

// New theme system functions

// Load theme and apply it
export async function loadAndApplyTheme(themeName: string) {
  try {
    await themeService.loadTheme(themeName);
    currentTheme.set(themeName);

    const manifest = await themeService.getThemeManifest(themeName);
    themeManifest.set(manifest);

    if (themeName === 'default') {
      // Reset accent color to default and save
      accentColor.set('#3b82f6');
      let settings = await invoke<any>('get_settings');
      await invoke('save_settings', {
        newSettings: {
          ...settings,
          current_theme: 'default',
          accent_color: '#3b82f6',
          theme: 'dark', // or 'system' if you want system default
        },
      });
      theme.set('dark'); // or 'system'
      applyTheme('dark'); // or 'system'
      return;
    }

    if (manifest) {
      // 1. Set and save accent color first
      accentColor.set(manifest.settings.defaultAccentColor);
      let settings = await invoke<any>('get_settings');
      await invoke('save_settings', {
        newSettings: {
          ...settings,
          accent_color: manifest.settings.defaultAccentColor,
        },
      });

      // 2. Set and save theme
      theme.set(manifest.settings.defaultTheme);
      settings = await invoke<any>('get_settings');
      await invoke('save_settings', {
        newSettings: {
          ...settings,
          current_theme: themeName,
          theme: manifest.settings.defaultTheme,
        },
      });

      // 3. Apply theme visually
      applyTheme(manifest.settings.defaultTheme);
    }
  } catch (error) {
    console.error('Failed to load and apply theme:', error);
  }
}

// Apply custom CSS
export function applyCustomCSS(css: string) {
  customCSS.set(css);
  // Inject into DOM
  import('../services/cssInjectionService').then(({ cssInjectionService }) => {
    cssInjectionService.injectCustomCSS(css);
  });
}

// Load current theme from settings
export async function loadCurrentTheme() {
  try {
    const settings = await invoke<any>('get_settings');
    const savedTheme = settings.current_theme || settings.theme || 'default';
    currentTheme.set(savedTheme);

    // Actually apply the theme on startup!
    await themeService.loadTheme(savedTheme);

    if (savedTheme !== 'default') {
      const manifest = await themeService.getThemeManifest(savedTheme);
      themeManifest.set(manifest);
    }
  } catch (error) {
    console.error('Failed to load current theme:', error);
    currentTheme.set('default');
  }
}

// Reset to default theme
export async function resetToDefault() {
  try {
    await themeService.resetToDefault();
    currentTheme.set('default');
    themeManifest.set(null);
    // Save current_theme to settings
    const settings = await invoke<any>('get_settings');
    await invoke('save_settings', {
      newSettings: {
        ...settings,
        current_theme: 'default',
      },
    });
  } catch (error) {
    console.error('Failed to reset to default theme:', error);
  }
}

// Subscribe to theme changes and apply them
if (typeof window !== 'undefined') {
  theme.subscribe((themeValue) => {
    applyTheme(themeValue);
  });
}
