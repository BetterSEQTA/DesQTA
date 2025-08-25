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
    const subset = await invoke<any>('get_settings_subset', { keys: ['accent_color'] });
    accentColor.set(subset?.accent_color || '#3b82f6');
  } catch (e) {
    console.error('Failed to load accent color:', e);
  }
}

// Function to load the theme from settings
export async function loadTheme() {
  try {
    const subset = await invoke<any>('get_settings_subset', { keys: ['theme'] });
    const loadedTheme = subset?.theme || 'system';
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
  try {
    await invoke('save_settings_merge', { patch: { accent_color: color } });
    accentColor.set(color);
    logger.debug('themeStore', 'updateAccentColor', 'Accent color updated successfully', { color });
  } catch (e) {
    logger.error('themeStore', 'updateAccentColor', `Failed to update accent color: ${e}`, { error: e, color });
  }
}

// Function to update the theme
export async function updateTheme(newTheme: 'light' | 'dark' | 'system') {
  try {
    await invoke('save_settings_merge', { patch: { theme: newTheme } });
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

    // Only fetch what we need
    let subset = await invoke<any>('get_settings_subset', { keys: ['current_theme','accent_color','theme'] });

    if (themeName === 'default') {
      // Reset accent color and theme to defaults, then save once
      const defaultAccent = '#3b82f6';
      const defaultTheme: 'light' | 'dark' | 'system' = 'dark';
      accentColor.set(defaultAccent);
      theme.set(defaultTheme);
      await invoke('save_settings_merge', { patch: { current_theme: 'default', accent_color: defaultAccent, theme: defaultTheme } });
      applyTheme(defaultTheme);
      return;
    }

    if (manifest) {
      // Use manifest values, save once
      const nextAccent = manifest.settings.defaultAccentColor;
      const nextTheme = manifest.settings.defaultTheme;
      accentColor.set(nextAccent);
      theme.set(nextTheme);
      await invoke('save_settings_merge', { patch: { current_theme: themeName, accent_color: nextAccent, theme: nextTheme } });

      // Apply theme visually after stores updated and settings persisted
      applyTheme(nextTheme);
    }
  } catch (error) {
    logger.error('themeStore', 'loadAndApplyTheme', 'Failed to load and apply theme', { error, themeName });
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
    const subset = await invoke<any>('get_settings_subset', { keys: ['current_theme','theme'] });
    const savedThemeName: string = subset?.current_theme || subset?.theme || 'default';
    currentTheme.set(savedThemeName);

    // Load the theme pack
    await themeService.loadTheme(savedThemeName);

    if (savedThemeName !== 'default') {
      const manifest = await themeService.getThemeManifest(savedThemeName);
      themeManifest.set(manifest);
      if (manifest) {
        // Ensure accent and theme stores reflect manifest on startup
        accentColor.set(manifest.settings.defaultAccentColor);
        theme.set(manifest.settings.defaultTheme);
        applyTheme(manifest.settings.defaultTheme);
      }
    } else {
      // Default theme fallback
      const defaultAccent = '#3b82f6';
      const defaultTheme: 'light' | 'dark' | 'system' = 'dark';
      accentColor.set(defaultAccent);
      theme.set(defaultTheme);
      applyTheme(defaultTheme);
    }
  } catch (error) {
    logger.error('themeStore', 'loadCurrentTheme', 'Failed to load current theme', { error });
    currentTheme.set('default');
    // Apply safe defaults
    const defaultAccent = '#3b82f6';
    const defaultTheme: 'light' | 'dark' | 'system' = 'dark';
    accentColor.set(defaultAccent);
    theme.set(defaultTheme);
    applyTheme(defaultTheme);
  }
}

// Reset to default theme
export async function resetToDefault() {
  try {
    await themeService.resetToDefault();
    currentTheme.set('default');
    themeManifest.set(null);
    // Save current_theme to settings
    await invoke('save_settings_merge', { patch: { current_theme: 'default' } });
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
