# Theme System

DesQTA features a sophisticated theming system that supports dynamic theme switching, custom themes, accent colors, and both light/dark modes. This document covers the complete theming architecture.

## 🏗 Architecture Overview

The theme system consists of several interconnected layers:

1. **Theme Store** (`lib/stores/theme.ts`) - Reactive state management
2. **Theme Service** (`lib/services/themeService.ts`) - Theme loading and management
3. **CSS Injection Service** (`lib/services/cssInjectionService.ts`) - Dynamic CSS injection
4. **TailwindCSS Integration** - Dynamic color system
5. **Theme Manifests** - Configuration files for custom themes

## 🎨 Theme Store

The theme store provides reactive state management for all theming functionality.

### Core Stores

```typescript
// Basic theme preference (light/dark/system)
export const theme = writable<'light' | 'dark' | 'system'>('system');

// Dynamic accent color
export const accentColor = writable('#3b82f6');

// Current active theme name
export const currentTheme = writable('default');

// Theme manifest data
export const themeManifest = writable<ThemeManifest | null>(null);

// Custom CSS injection
export const customCSS = writable('');
```

### Derived Stores

```typescript
// Theme properties from manifest
export const themeProperties = derived(
  [currentTheme, themeManifest],
  ([$currentTheme, $manifest]) => {
    if (!$manifest) return {};
    return $manifest.customProperties;
  }
);
```

### Core Functions

#### Theme Loading
```typescript
// Load theme preference from settings
export async function loadTheme(): Promise<void>

// Load and apply a specific theme
export async function loadAndApplyTheme(themeName: string): Promise<void>

// Load current theme on startup
export async function loadCurrentTheme(): Promise<void>
```

#### Theme Management
```typescript
// Update theme preference
export async function updateTheme(newTheme: 'light' | 'dark' | 'system'): Promise<void>

// Update accent color
export async function updateAccentColor(color: string): Promise<void>

// Reset to default theme
export async function resetToDefault(): Promise<void>
```

#### CSS Integration
```typescript
// Apply custom CSS
export function applyCustomCSS(css: string): void
```

### System Theme Detection

The theme system automatically detects and responds to system theme changes:

```typescript
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

// Auto-apply system theme changes
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
  
  mediaQuery.addEventListener('change', handleSystemThemeChange);
}
```

## 🛠 Theme Service

The ThemeService class handles theme loading, CSS management, and theme switching.

### Theme Manifest Structure

```typescript
export interface ThemeManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
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
```

### Core Methods

#### Theme Loading
```typescript
class ThemeService {
  // Load a theme by name
  async loadTheme(themeName: string): Promise<void>
  
  // Load theme manifest
  async loadThemeManifest(themeName: string): Promise<ThemeManifest>
  
  // Load theme CSS files
  async loadThemeCSS(themeName: string, manifest: ThemeManifest): Promise<void>
}
```

#### CSS Management
```typescript
// Load individual CSS file
private async loadCSSFile(path: string): Promise<void>

// Remove all active theme CSS
private removeActiveCSS(): void

// Apply CSS custom properties
private applyCustomProperties(properties: Record<string, string>): void
```

#### Theme Discovery
```typescript
// Get available themes
async getAvailableThemes(): Promise<string[]>

// Get current active theme
async getCurrentTheme(): Promise<string>

// Get theme manifest
async getThemeManifest(themeName: string): Promise<ThemeManifest | null>
```

### Theme File Structure

Each theme follows this directory structure:

```
static/themes/[theme-name]/
├── theme-manifest.json      # Theme configuration
├── preview.png             # Theme preview image
├── styles/
│   ├── global.css          # Global theme styles
│   ├── light.css           # Light mode specific styles
│   ├── dark.css            # Dark mode specific styles
│   └── components.css      # Component-specific styles
└── screenshots/            # Additional preview images
```

### Example Theme Manifest

```json
{
  "name": "Sunset",
  "version": "1.0.0",
  "description": "Warm orange-pink sunset gradient theme with cozy vibes",
  "author": "DesQTA Team",
  "license": "MIT",
  "settings": {
    "defaultAccentColor": "#ff7e5f",
    "defaultTheme": "dark",
    "supportsLightMode": false,
    "supportsDarkMode": true,
    "supportsSystemMode": true
  },
  "customProperties": {
    "primaryColor": "#ff7e5f",
    "secondaryColor": "#feb47b",
    "backgroundColor": "#1a0f0f",
    "surfaceColor": "#2d1b1b",
    "textColor": "#ffffff",
    "borderColor": "#4a2f2f"
  },
  "fonts": {
    "primary": "Inter",
    "secondary": "SF Pro Display",
    "monospace": "JetBrains Mono"
  },
  "features": {
    "glassmorphism": true,
    "gradients": true,
    "shadows": true
  }
}
```

## 💉 CSS Injection Service

The CSS Injection Service manages dynamic CSS loading and custom user styles.

### Core Methods

```typescript
class CSSInjectionService {
  // Inject CSS with unique ID
  injectCSS(id: string, css: string): void
  
  // Remove CSS by ID
  removeCSS(id: string): void
  
  // Inject theme-specific CSS
  injectThemeCSS(themeName: string, css: string): void
  
  // Inject user custom CSS
  injectCustomCSS(userCSS: string): void
  
  // Remove all injected CSS
  removeAllCSS(): void
  
  // Check if CSS is injected
  hasInjectedCSS(id: string): boolean
}
```

### Usage Examples

```typescript
import { cssInjectionService } from '$lib/services/cssInjectionService';

// Inject custom theme CSS
cssInjectionService.injectThemeCSS('sunset', `
  :root {
    --primary-color: #ff7e5f;
    --background-color: #1a0f0f;
  }
`);

// Inject user custom CSS
cssInjectionService.injectCustomCSS(`
  .custom-button {
    background: linear-gradient(45deg, #ff7e5f, #feb47b);
  }
`);
```

## 🎯 TailwindCSS Integration

The theme system integrates deeply with TailwindCSS for dynamic color management.

### Dynamic Accent Colors

```javascript
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--accent-color-value)',
          text: 'var(--accent-color-value)',
          bg: 'var(--accent-color-value)',
          border: 'var(--accent-color-value)',
          ring: 'var(--accent-color-value)',
          50: 'color-mix(in srgb, var(--accent-color-value) 10%, white)',
          100: 'color-mix(in srgb, var(--accent-color-value) 20%, white)',
          200: 'color-mix(in srgb, var(--accent-color-value) 30%, white)',
          300: 'color-mix(in srgb, var(--accent-color-value) 40%, white)',
          400: 'color-mix(in srgb, var(--accent-color-value) 50%, white)',
          500: 'var(--accent-color-value)',
          600: 'color-mix(in srgb, var(--accent-color-value) 80%, black)',
          700: 'color-mix(in srgb, var(--accent-color-value) 60%, black)',
          800: 'color-mix(in srgb, var(--accent-color-value) 40%, black)',
          900: 'color-mix(in srgb, var(--accent-color-value) 20%, black)',
          950: 'color-mix(in srgb, var(--accent-color-value) 10%, black)',
        }
      }
    }
  }
}
```

### Custom Slate Colors

The system includes custom slate colors optimized for dark themes:

```javascript
slate: {
  50: '#f8fafc',   // Very light gray
  100: '#f1f5f9',  // Light gray (primary text on dark bg)
  200: '#e2e8f0',  // 
  300: '#cbd5e1',  // Secondary text on dark bg
  400: '#94a3b8',  // Subtle text, icons, borders
  500: '#64748b',  // Mid gray
  600: '#475569',  // Darker mid gray
  700: '#334155',  // Hover states on surface-alt
  800: '#232428',  // Surface-alt
  850: '#1e1f22',  // Between 800 and 900
  900: '#18191c',  // Surface
  950: '#121212',  // Background
}
```

### Usage in Components

```svelte
<!-- Dynamic accent colors -->
<button class="bg-accent hover:bg-accent-600 text-white">
  Primary Button
</button>

<!-- Theme-aware colors -->
<div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  Content adapts to theme
</div>

<!-- Accent variations -->
<div class="border-accent-200 dark:border-accent-800">
  Subtle accent border
</div>
```

## 🎨 Built-in Themes

DesQTA includes several built-in themes:

### Available Themes
- **default** - Clean, minimal design with blue accent
- **sunset** - Warm orange-pink gradient theme
- **light** - Light mode optimized theme
- **midnight** - Deep dark theme with purple accents
- **mint** - Fresh green theme
- **grape** - Purple gradient theme
- **glass** - Glassmorphism effect theme
- **bubblegum** - Pink playful theme
- **aero** - Windows Aero inspired theme
- **solarized** - Solarized color scheme

### Theme Switching

```typescript
// Switch to a specific theme
await loadAndApplyTheme('sunset');

// Reset to default
await resetToDefault();

// Change just the accent color
await updateAccentColor('#ff6b6b');

// Change light/dark mode
await updateTheme('dark');
```

## 🔧 Custom Theme Development

### Creating a Custom Theme

1. **Create Theme Directory**
```bash
mkdir static/themes/my-theme
```

2. **Create Theme Manifest**
```json
{
  "name": "My Custom Theme",
  "version": "1.0.0",
  "description": "My awesome custom theme",
  "author": "Your Name",
  "settings": {
    "defaultAccentColor": "#your-color",
    "defaultTheme": "dark",
    "supportsLightMode": true,
    "supportsDarkMode": true
  },
  "customProperties": {
    "primaryColor": "#your-primary",
    "backgroundColor": "#your-bg"
  }
}
```

3. **Create Style Files**
```css
/* styles/global.css */
:root {
  --primary-color: var(--primaryColor);
  --background-color: var(--backgroundColor);
}

/* styles/dark.css */
.dark {
  --surface-color: #1a1a1a;
}

/* styles/light.css */
:root:not(.dark) {
  --surface-color: #ffffff;
}
```

### Theme Development Guidelines

#### CSS Custom Properties
- Use descriptive property names
- Provide fallback values
- Follow naming conventions: `--component-element-state`

#### Color Accessibility
- Ensure sufficient contrast ratios
- Test with both light and dark modes
- Provide alternative colors for accessibility

#### Performance
- Minimize CSS file sizes
- Use efficient selectors
- Avoid excessive custom properties

## 🎯 Advanced Features

### Runtime Theme Switching

```typescript
// Listen for theme changes
theme.subscribe((newTheme) => {
  console.log('Theme changed to:', newTheme);
});

// Apply theme with animation
const applyThemeWithTransition = async (themeName: string) => {
  document.documentElement.style.transition = 'all 0.3s ease';
  await loadAndApplyTheme(themeName);
  setTimeout(() => {
    document.documentElement.style.transition = '';
  }, 300);
};
```

### Custom CSS Injection

```typescript
// Apply user custom CSS
const userCSS = `
  .custom-header {
    background: linear-gradient(45deg, var(--accent-color-value), transparent);
  }
`;

applyCustomCSS(userCSS);
```

### Theme Persistence

Themes are automatically saved to user settings:

```typescript
// Theme preferences are saved to:
{
  "theme": "dark",           // light/dark/system preference
  "accent_color": "#3b82f6", // Current accent color
  "current_theme": "sunset"  // Active theme name
}
```

## 🚀 Performance Optimization

### CSS Loading Strategy
- **Lazy Loading**: CSS files loaded only when theme is activated
- **Caching**: Theme manifests cached in memory
- **Cleanup**: Unused CSS automatically removed

### Memory Management
- Theme CSS properly cleaned up on switch
- Event listeners removed on component destroy
- No memory leaks from theme switching

### Bundle Size
- Themes not included in main bundle
- Dynamic imports for theme resources
- Tree-shaking of unused theme code

## 🔍 Debugging & Troubleshooting

### Common Issues

#### Theme Not Loading
```typescript
// Check if theme exists
const available = await themeService.getAvailableThemes();
console.log('Available themes:', available);

// Check theme manifest
const manifest = await themeService.getThemeManifest('theme-name');
console.log('Theme manifest:', manifest);
```

#### CSS Not Applying
```typescript
// Check injected CSS
console.log('Injected CSS:', cssInjectionService.getInjectedCSS('theme-sunset'));

// Check custom properties
const root = document.documentElement;
console.log('CSS variables:', getComputedStyle(root));
```

#### Performance Issues
```typescript
// Monitor theme switching performance
console.time('theme-switch');
await loadAndApplyTheme('new-theme');
console.timeEnd('theme-switch');
```

## 📚 API Reference

### Theme Store Functions
```typescript
loadTheme(): Promise<void>
updateTheme(theme: 'light' | 'dark' | 'system'): Promise<void>
loadAccentColor(): Promise<void>
updateAccentColor(color: string): Promise<void>
loadAndApplyTheme(themeName: string): Promise<void>
loadCurrentTheme(): Promise<void>
resetToDefault(): Promise<void>
applyCustomCSS(css: string): void
```

### Theme Service Methods
```typescript
loadTheme(themeName: string): Promise<void>
loadThemeManifest(themeName: string): Promise<ThemeManifest>
getAvailableThemes(): Promise<string[]>
getCurrentTheme(): Promise<string>
getThemeManifest(themeName: string): Promise<ThemeManifest | null>
resetToDefault(): Promise<void>
```

### CSS Injection Service Methods
```typescript
injectCSS(id: string, css: string): void
removeCSS(id: string): void
injectThemeCSS(themeName: string, css: string): void
injectCustomCSS(userCSS: string): void
removeAllCSS(): void
hasInjectedCSS(id: string): boolean
```

---

**Related Documentation:**
- [Frontend Architecture](./README.md) - Overall frontend structure
- [Layout Components](../components/layout.md) - Theme integration in components
- [State Management](./state-management.md) - Store architecture 