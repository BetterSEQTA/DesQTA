# Layout Components

This document covers the core layout components that form the structural foundation of DesQTA's user interface.

## 🏗 Architecture Overview

The layout system consists of three primary components:
- **AppHeader**: Top navigation bar with user controls and global features
- **AppSidebar**: Main navigation sidebar with menu items
- **Modal**: Reusable modal dialog system

## 📋 Modal Component

The Modal component provides a flexible, accessible dialog system used throughout the application.

### Interface

```typescript
interface Props {
  open: boolean;                    // Controls modal visibility
  title?: string;                   // Optional modal title
  maxWidth?: string;                // CSS max-width class (default: 'max-w-4xl')
  maxHeight?: string;               // CSS max-height class
  showCloseButton?: boolean;        // Show X button (default: true)
  closeOnBackdrop?: boolean;        // Close when clicking backdrop (default: true)
  closeOnEscape?: boolean;          // Close on Escape key (default: true)
  ariaLabel?: string;               // Accessibility label (default: 'Modal')
  customClasses?: string;           // Additional CSS classes
  onclose?: () => void;             // Close callback function
  children: Snippet;                // Modal content
}
```

### Usage Examples

#### Basic Modal
```svelte
<script>
  import Modal from '$lib/components/Modal.svelte';
  let showModal = false;
</script>

<Modal bind:open={showModal} title="Settings">
  <div class="p-6">
    <p>Modal content goes here</p>
  </div>
</Modal>
```

#### Custom Styled Modal
```svelte
<Modal 
  bind:open={showModal}
  title="Large Modal"
  maxWidth="max-w-6xl"
  customClasses="min-h-96"
  closeOnBackdrop={false}>
  <div class="p-8">
    <p>This modal won't close when clicking the backdrop</p>
  </div>
</Modal>
```

### Features

#### Visual Design
- **Backdrop**: Blurred background with fade transition (`backdrop-blur-md bg-black/40`)
- **Container**: Rounded corners with glass morphism effect
- **Animation**: Scale transition on open/close (300ms duration)
- **Shadow**: Custom box shadow for depth (`box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)`)

#### Accessibility
- **ARIA**: Proper `role="dialog"` and `aria-modal="true"`
- **Focus Management**: Traps focus within modal when open
- **Keyboard Navigation**: Escape key support for closing
- **Screen Readers**: Configurable `aria-label` for context

#### Responsive Behavior
- **Mobile Optimized**: Adjusts padding and sizing for mobile devices
- **Flexible Sizing**: Configurable max-width and max-height
- **Backdrop Handling**: Touch-friendly backdrop interaction

## 🎯 AppHeader Component

The AppHeader provides the top navigation bar with user controls, notifications, and global features.

### Interface

```typescript
interface Props {
  sidebarOpen: boolean;             // Sidebar visibility state
  weatherEnabled: boolean;          // Weather widget visibility
  weatherData: any;                 // Weather information
  userInfo?: UserInfo;              // Current user information
  showUserDropdown: boolean;        // User dropdown visibility
  onToggleSidebar: () => void;      // Sidebar toggle callback
  onToggleUserDropdown: () => void; // User dropdown toggle callback
  onLogout: () => void;             // Logout callback
  onShowAbout: () => void;          // About modal callback
  onClickOutside: (event: MouseEvent) => void; // Outside click handler
  disableSchoolPicture?: boolean;   // Disable profile picture
}
```

### Features

#### Core Elements
1. **Sidebar Toggle Button**: Hamburger menu to toggle navigation sidebar
2. **Brand Area**: Application logo and title with weather widget
3. **Global Search**: Centralized search functionality (when enabled)
4. **Notifications**: Bell icon with notification count and dropdown
5. **User Dropdown**: Profile access and user controls
6. **Window Controls**: Minimize, maximize, close buttons (desktop only)

#### Notification System
```typescript
interface Notification {
  notificationID: number;
  type: string;
  timestamp: string;
  report?: { title: string; };
  coneqtAssessments?: {
    programmeID: number;
    metaclassID: number;
    subtitle: string;
    term: string;
    title: string;
    assessmentID: number;
    subjectCode: string;
  };
}
```

**Notification Features:**
- **Real-time Updates**: Fetches notifications via heartbeat API
- **Smart Routing**: Clicking notifications navigates to relevant pages
- **Time Formatting**: Relative time display (e.g., "2 hours ago")
- **Mobile Support**: Full-screen modal on mobile devices
- **Badge Counter**: Shows unread notification count

#### Weather Integration
When enabled, displays weather information in the header:
```svelte
{#if weatherEnabled && weatherData}
  <WeatherWidget {weatherData} />
{/if}
```

#### Platform Detection
```typescript
const checkMobile = async () => {
  const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM
  if (tauri_platform == "ios" || tauri_platform == "android") {
    isMobile = true
  } else {
    isMobile = false
  }
};
```

### Styling & Theming

The header uses consistent theming with the application:
```svelte
<header 
  class="flex justify-between items-center px-3 pr-2 w-full h-16 relative z-[999999]" 
  data-tauri-drag-region 
  style="background: var(--background-color);">
```

**Key Classes:**
- `data-tauri-drag-region`: Enables window dragging on desktop
- `z-[999999]`: Ensures header stays above all other elements
- `playful`: Custom animation class for interactive elements

## 🧭 AppSidebar Component

The AppSidebar provides the main navigation menu with dynamic menu items and responsive behavior.

### Interface

```typescript
interface MenuItem {
  label: string;    // Display name
  icon: any;        // Heroicon component
  path: string;     // Route path
}

interface Props {
  sidebarOpen: boolean;           // Visibility state
  menu: MenuItem[];               // Navigation items
  onMenuItemClick?: () => void;   // Click handler
}
```

### Menu Structure

The sidebar displays a dynamic menu loaded from the application configuration:

```typescript
// Default menu items
const menu = [
  { label: 'Dashboard', icon: Home, path: '/' },
  { label: 'Courses', icon: BookOpen, path: '/courses' },
  { label: 'Assessments', icon: ClipboardDocumentList, path: '/assessments' },
  { label: 'Timetable', icon: CalendarDays, path: '/timetable' },
  { label: 'Messages', icon: ChatBubbleLeftRight, path: '/direqt-messages' },
  { label: 'Portals', icon: GlobeAlt, path: '/portals' },
  { label: 'Notices', icon: DocumentText, path: '/notices' },
  { label: 'News', icon: Newspaper, path: '/news' },
  { label: 'Directory', icon: User, path: '/directory' },
  { label: 'Reports', icon: ChartBar, path: '/reports' },
  { label: 'Settings', icon: Cog6Tooth, path: '/settings' },
  { label: 'Analytics', icon: AcademicCap, path: '/analytics' },
];
```

### Responsive Behavior

#### Desktop Layout
- **Fixed Width**: 256px (16rem) when open
- **Smooth Transitions**: 300ms ease-in-out animations
- **Persistent**: Remains visible alongside main content

#### Mobile Layout
- **Overlay Mode**: Full-width overlay when open
- **Close Button**: X button in top-right corner
- **Backdrop**: Closes when tapping outside
- **Mobile Header**: Shows "Menu" title with accent underline

### Active State Management

The sidebar automatically highlights the current page:

```svelte
class="{(
  item.path === '/'
    ? $page.url.pathname === '/'
    : $page.url.pathname.startsWith(item.path)
)
  ? 'bg-accent text-white'
  : 'text-slate-900 dark:text-slate-300'}"
```

**Active State Features:**
- **Exact Match**: Home page uses exact path matching
- **Prefix Match**: Other pages use `startsWith()` for sub-routes
- **Visual Feedback**: Accent background and white text for active items
- **Icon Coloring**: Icons change color to match text state

### Animation & Interactions

```svelte
class="transition-all duration-200 hover:bg-accent-100 hover:text-slate-900 
       dark:hover:bg-accent-600 dark:hover:text-white playful"
```

**Interaction States:**
- **Hover**: Subtle background color change with accent tint
- **Focus**: Keyboard navigation support with focus rings
- **Active**: Pressed state with scale animation via `playful` class
- **Transitions**: Smooth 200ms transitions for all state changes

## 🎨 Theming Integration

All layout components integrate with the application's theme system:

### CSS Variables
```css
style="background: var(--background-color);"
```

### Accent Color Classes
- `accent-bg`: Dynamic accent background
- `accent-ring`: Focus ring colors
- `bg-accent`: Solid accent background
- `text-accent`: Accent text color

### Dark Mode Support
Components automatically adapt to dark mode using Tailwind's `dark:` prefix:
```svelte
class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
```

## 🔧 Best Practices

### Modal Usage
1. **Always bind `open`**: Use `bind:open={modalState}` for two-way binding
2. **Provide titles**: Include descriptive titles for accessibility
3. **Handle cleanup**: Implement proper `onclose` handlers
4. **Size appropriately**: Use `maxWidth` and `maxHeight` for content

### Header Integration
1. **Pass all required props**: Ensure all callbacks are properly connected
2. **Handle platform differences**: Account for mobile vs desktop behavior
3. **Manage state properly**: Keep notification and dropdown states in sync

### Sidebar Configuration
1. **Dynamic menus**: Load menu items from configuration when possible
2. **Handle navigation**: Implement proper click handlers for mobile
3. **Maintain consistency**: Use consistent icons and naming

## 🚀 Performance Considerations

### Lazy Loading
- Modal content can be lazily loaded using dynamic imports
- Sidebar icons are tree-shaken automatically by bundler

### Animation Performance
- Uses CSS transforms for smooth animations
- GPU-accelerated transitions with `transform` and `opacity`
- Minimal reflows with `will-change` hints where appropriate

### Memory Management
- Event listeners are properly cleaned up in `onDestroy`
- Component state is reset when components unmount
- No memory leaks from interval timers or subscriptions

---

**Related Documentation:**
- [UI Components](./ui.md) - Buttons, forms, and interactive elements
- [Theme System](../frontend/theme-system.md) - Theming and styling
- [State Management](../frontend/state-management.md) - Global state handling 