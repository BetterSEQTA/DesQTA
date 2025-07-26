# Frontend Architecture

DesQTA's frontend is built with **SvelteKit**, providing a modern, reactive web application experience within a Tauri desktop container. This document covers the overall architecture, routing system, and core application structure.

## 🏗 Architecture Overview

### Technology Stack
- **Framework**: SvelteKit with TypeScript
- **Styling**: TailwindCSS with custom theme system
- **Icons**: Heroicons via `svelte-hero-icons`
- **State Management**: Svelte stores + reactive state
- **Build Tool**: Vite
- **Desktop Container**: Tauri v2

### Project Structure
```
src/
├── routes/                    # SvelteKit file-based routing
├── lib/
│   ├── components/           # Reusable UI components
│   ├── services/            # Business logic and API services
│   ├── stores/              # Global state management
│   └── types.ts             # TypeScript type definitions
├── utils/                   # Utility functions
├── app.css                  # Global styles
└── app.html                 # HTML template
```

## 🛣 Routing System

DesQTA uses SvelteKit's file-based routing with a comprehensive page structure:

### Core Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `+page.svelte` | Dashboard with customizable widgets |
| `/courses` | `courses/+page.svelte` | Course content and materials |
| `/assessments` | `assessments/+page.svelte` | Assessment management |
| `/assessments/[id]/[metaclass]` | Dynamic route | Individual assessment details |
| `/timetable` | `timetable/+page.svelte` | Schedule management |
| `/direqt-messages` | `direqt-messages/+page.svelte` | Messaging system |
| `/portals` | `portals/+page.svelte` | External portal integration |
| `/notices` | `notices/+page.svelte` | School notices |
| `/news` | `news/+page.svelte` | News feed |
| `/directory` | `directory/+page.svelte` | Student/staff directory |
| `/reports` | `reports/+page.svelte` | Academic reports |
| `/analytics` | `analytics/+page.svelte` | Data analytics dashboard |
| `/settings` | `settings/+page.svelte` | Application settings |
| `/welcome` | `welcome/+page.svelte` | Welcome portal |

### Layout System

The application uses a hierarchical layout system:

#### Root Layout (`+layout.svelte`)
The main layout component that wraps all pages and provides:

```typescript
// Core layout features
- Authentication state management
- Theme system integration
- Header and sidebar components
- Mobile responsiveness
- Weather integration
- Notification system
- User session management
```

**Key Layout Components:**
- `AppHeader`: Top navigation bar with user info and controls
- `AppSidebar`: Main navigation sidebar with menu items
- `LoginScreen`: Authentication interface when not logged in

#### Layout Configuration
```typescript
// +layout.ts - Static generation configuration
export const prerender = true; // Enable SSG for Tauri
```

## 🎨 Theme & Styling Architecture

### Theme System
DesQTA implements a sophisticated theming system with multiple layers:

#### 1. Base Theme Store (`lib/stores/theme.ts`)
```typescript
// Core theme stores
export const theme = writable<'light' | 'dark' | 'system'>('system');
export const accentColor = writable('#3b82f6');
export const currentTheme = writable('default');
export const themeManifest = writable<ThemeManifest | null>(null);
```

#### 2. Theme Management Functions
- `loadTheme()`: Load theme from settings
- `updateTheme()`: Update and persist theme changes
- `loadAndApplyTheme()`: Apply custom theme with manifest
- `resetToDefault()`: Reset to default theme

#### 3. Custom Theme Support
The application supports custom themes located in `static/themes/`:
- Each theme has a `theme-manifest.json` configuration
- Custom CSS files for different modes (light/dark)
- Theme preview images
- Custom properties and accent colors

### TailwindCSS Integration
```javascript
// tailwind.config.js integration with theme system
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class', // Controlled by theme store
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent-color)', // Dynamic accent color
      }
    }
  }
}
```

## 🔄 State Management

### Store Architecture
DesQTA uses Svelte's reactive stores for state management:

#### Global Stores
- **Theme Store**: Manages theming and appearance
- **Auth Store**: User authentication state (via `authService`)
- **Weather Store**: Weather data integration
- **Settings Store**: Application configuration

#### Component-Level State
Each page and component manages local state using Svelte's `$state` runes:

```typescript
// Example from dashboard (+page.svelte)
let widgets = $state<WidgetLayout[]>([]);
let isEditMode = $state(false);
let isMobile = $state(false);
```

### Data Flow Pattern
```
User Action → Component State → Service Layer → API Call → State Update → UI Refresh
```

## 📱 Responsive Design

### Breakpoint System
Following TailwindCSS conventions:
- `sm:` - Small screens (640px+)
- `md:` - Medium screens (768px+)
- `lg:` - Large screens (1024px+)
- `xl:` - Extra large screens (1280px+)

### Mobile-First Approach
- Components adapt layout for mobile devices
- Sidebar collapses to overlay on mobile
- Touch-friendly interaction patterns
- Responsive typography and spacing

### Mobile Detection
```typescript
// Mobile detection pattern used throughout
let isMobile = $state(false);

function checkMobile() {
  isMobile = window.innerWidth < 1024; // lg breakpoint
}

onMount(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});
```

## 🔧 Build Configuration

### Vite Configuration
```javascript
// vite.config.js
export default defineConfig({
  plugins: [sveltekit()],
  define: {
    global: 'globalThis',
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
});
```

### SvelteKit Configuration
```javascript
// svelte.config.js
const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true
    })
  },
  preprocess: [vitePreprocess(), preprocess()]
};
```

## 🎯 Key Architectural Decisions

### 1. File-Based Routing
- **Benefit**: Intuitive URL structure matching file system
- **Implementation**: SvelteKit's built-in routing with dynamic parameters
- **Example**: `/assessments/[id]/[metaclass]` for assessment details

### 2. Component Composition
- **Pattern**: Reusable components in `lib/components/`
- **Naming**: Descriptive names (e.g., `AssessmentCard`, `TimetableGrid`)
- **Props**: TypeScript interfaces for type safety

### 3. Service Layer
- **Purpose**: Separate business logic from UI components
- **Location**: `lib/services/`
- **Examples**: `authService`, `themeService`, `weatherService`

### 4. Utility Functions
- **Purpose**: Shared helper functions
- **Location**: `utils/`
- **Examples**: `cache.ts`, `netUtil.ts`, `notify.ts`

## 🔄 Page Lifecycle

### Typical Page Flow
1. **Route Navigation**: User navigates to page
2. **Component Mount**: `onMount()` executes
3. **Data Loading**: API calls via service layer
4. **State Updates**: Reactive state triggers UI updates
5. **User Interaction**: Events trigger state changes
6. **Component Cleanup**: `onDestroy()` handles cleanup

### Example Page Structure
```typescript
<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  
  // State management
  let data = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  
  // Lifecycle
  onMount(async () => {
    await loadData();
  });
  
  // Data loading
  async function loadData() {
    try {
      const response = await seqtaFetch('/api/endpoint');
      data = JSON.parse(response);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<!-- Template with reactive updates -->
{#if loading}
  <LoadingSpinner />
{:else if error}
  <ErrorMessage {error} />
{:else}
  <DataDisplay {data} />
{/if}
```

## 🚀 Performance Considerations

### Code Splitting
- Automatic route-based code splitting via SvelteKit
- Dynamic imports for heavy components
- Lazy loading of non-critical features

### Caching Strategy
- Service worker for offline functionality
- Local storage for user preferences
- In-memory caching for frequently accessed data

### Bundle Optimization
- Tree shaking for unused code elimination
- Asset optimization through Vite
- CSS purging via TailwindCSS

## 🔗 Integration Points

### Tauri Integration
- Native API access via `@tauri-apps/api`
- File system operations
- System notifications
- Window management

### External Services
- SEQTA API integration
- Weather service integration
- RSS feed processing
- Portal iframe embedding

---

**Next Steps**: 
- [Component Library Documentation](./components/README.md)
- [Theme System Deep Dive](./theme-system.md)
- [State Management Guide](./state-management.md) 