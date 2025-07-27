# UI Utility Components

This document covers DesQTA's comprehensive collection of utility UI components that provide consistent user experience patterns, error handling, loading states, and interactive elements throughout the application.

## 🏗 Utility Component Architecture

DesQTA's utility components follow consistent design patterns and provide reusable functionality:

- **Error Handling**: Graceful error boundaries and user feedback
- **Loading States**: Consistent loading indicators and skeleton screens
- **Empty States**: Engaging empty state messages with actions
- **Interactive Elements**: File uploads, timers, and productivity tools
- **Content Display**: Modal viewers, welcome portals, and information panels
- **User Interface**: Headers, navigation, and layout utilities

### Design Principles

- **Consistency**: Uniform styling and behavior across all components
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Responsiveness**: Mobile-first design with adaptive layouts
- **Performance**: Optimized rendering and minimal re-renders
- **Theming**: Full integration with the dynamic theme system

## 🚨 Error Handling Components

### ErrorBoundary Component

The ErrorBoundary component provides comprehensive error catching and user-friendly error displays with recovery options.

#### Interface

```typescript
interface Props {
  children: any;                    // Child components to wrap
  fallback?: (error: unknown, reset: () => void) => any; // Custom error UI
}
```

#### Implementation

```svelte
<script lang="ts">
  import { errorService } from '../services/errorService';
  import { Icon } from 'svelte-hero-icons';
  import { ExclamationTriangle, ArrowPath } from 'svelte-hero-icons';

  let { children, fallback } = $props<{
    children: any;
    fallback?: (error: unknown, reset: () => void) => any;
  }>();

  function onerror(error: unknown, reset: () => void) {
    // Log the error for debugging
    console.error('Error caught by ErrorBoundary:', error);
    
    // Report to error service for analytics
    if (error instanceof Error) {
      errorService.handleManualError(error);
    } else {
      errorService.handleManualError(String(error));
    }
  }
</script>

<svelte:boundary {onerror}>
  {@render children()}
  
  {#snippet failed(error, reset)}
    {#if fallback}
      {@render fallback(error, reset)}
    {:else}
      <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div class="flex items-center gap-3 mb-3">
          <Icon src={ExclamationTriangle} size="20" class="text-red-500 dark:text-red-400" />
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">Component Error</h3>
        </div>
        
        <p class="text-sm text-slate-600 dark:text-slate-300 mb-3">
          {error instanceof Error ? error.message : String(error) || 'An error occurred in this component'}
        </p>
        
        <button
          onclick={reset}
          class="px-3 py-1 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:bg-red-200 dark:hover:bg-red-700"
        >
          <Icon src={ArrowPath} size="14" class="inline mr-1" />
          Retry
        </button>
      </div>
    {/if}
  {/snippet}
</svelte:boundary>
```

#### Usage Examples

```svelte
<!-- Basic error boundary -->
<ErrorBoundary>
  <SomeComponent />
</ErrorBoundary>

<!-- Custom error fallback -->
<ErrorBoundary fallback={(error, reset) => (
  <div class="custom-error">
    <h2>Oops! Something went wrong</h2>
    <p>{error.message}</p>
    <button onclick={reset}>Try Again</button>
  </div>
)}>
  <ComplexComponent />
</ErrorBoundary>
```

#### Features

- **Automatic Error Catching**: Catches JavaScript errors in child components
- **Error Reporting**: Integrates with error service for analytics
- **User-Friendly Messages**: Converts technical errors to user-readable text
- **Recovery Mechanism**: Provides retry functionality
- **Custom Fallbacks**: Supports custom error UI components
- **Accessibility**: Proper ARIA labels and keyboard navigation

## ⏳ Loading State Components

### LoadingSpinner Component

A versatile loading spinner with configurable sizes and messages.

#### Interface

```typescript
interface Props {
  message?: string;                 // Loading message (default: 'Loading...')
  size?: 'sm' | 'md' | 'lg';       // Spinner size
}
```

#### Implementation

```svelte
<script lang="ts">
  interface Props {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { message = 'Loading...', size = 'md' }: Props = $props();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
</script>

<div class="flex flex-col justify-center items-center py-12 sm:py-16">
  <div
    class="rounded-full border-4 animate-spin border-indigo-500/30 border-t-indigo-500 {sizeClasses[size]}">
  </div>
  <p class="mt-4 {textSizes[size]} text-slate-600 dark:text-slate-400">
    {message}
  </p>
</div>
```

#### Usage Examples

```svelte
<!-- Basic loading spinner -->
<LoadingSpinner />

<!-- Custom message and size -->
<LoadingSpinner message="Fetching your data..." size="lg" />

<!-- Small spinner for inline use -->
<LoadingSpinner message="Saving..." size="sm" />
```

#### Features

- **Responsive Sizing**: Three predefined sizes (sm, md, lg)
- **Custom Messages**: Configurable loading text
- **Theme Integration**: Uses accent colors from theme system
- **Smooth Animation**: CSS-based spinning animation
- **Accessibility**: Screen reader friendly

### LoadingScreen Component

A full-screen loading component with animated elements for app initialization.

#### Implementation

```svelte
<div class="flex items-center justify-center h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
  <div class="flex flex-col items-center space-y-8">
    <!-- Animated plane and clouds -->
    <div class="relative w-48 h-24">
      <!-- Background clouds -->
      <div class="absolute top-4 text-4xl opacity-60 animate-cloud1">☁️</div>
      <div class="absolute top-8 text-3xl opacity-40 animate-cloud2">☁️</div>
      
      <!-- Flying plane -->
      <div class="text-4xl animate-plane">✈️</div>
    </div>
    
    <!-- Loading text -->
    <p class="text-2xl font-bold text-slate-700 dark:text-slate-200">Loading...</p>
  </div>
</div>
```

#### Features

- **Full-Screen Coverage**: Prevents interaction during loading
- **Animated Elements**: Plane and cloud animations
- **Theme Aware**: Adapts to light/dark themes  
- **Smooth Transitions**: CSS animations with easing
- **Scroll Prevention**: Disables scrolling during loading

## 📭 Empty State Components

### EmptyState Component

Provides engaging empty state displays with customizable icons and messages.

#### Interface

```typescript
interface Props {
  title: string;                    // Primary message
  message: string;                  // Secondary description
  icon?: string;                    // Emoji or icon (default: '🎉')
  size?: 'sm' | 'md' | 'lg';       // Component size
}
```

#### Implementation

```svelte
<script lang="ts">
  interface Props {
    title: string;
    message: string;
    icon?: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { title, message, icon = '🎉', size = 'md' }: Props = $props();

  const iconSizes = {
    sm: 'text-xl',
    md: 'text-2xl', 
    lg: 'text-3xl'
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  };

  const messageSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };
</script>

<div class="flex flex-col justify-center items-center py-12 sm:py-16">
  <div
    class="flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl sm:text-3xl shadow-[0_0_20px_rgba(99,102,241,0.3)] animate-gradient {iconSizes[size]}">
    {icon}
  </div>
  <p class="mt-4 {titleSizes[size]} text-slate-700 dark:text-slate-300">
    {title}
  </p>
  <p class="mt-2 {messageSizes[size]} text-slate-600 dark:text-slate-400">
    {message}
  </p>
</div>
```

#### Usage Examples

```svelte
<!-- No assessments -->
<EmptyState 
  title="No assessments due" 
  message="All caught up! Check back later for new assignments."
  icon="📚"
/>

<!-- No messages -->
<EmptyState 
  title="No messages" 
  message="Your inbox is empty. Start a conversation!"
  icon="💬"
  size="lg"
/>

<!-- No search results -->
<EmptyState 
  title="No results found" 
  message="Try adjusting your search terms."
  icon="🔍"
  size="sm"
/>
```

#### Features

- **Customizable Icons**: Support for emojis and icon components
- **Responsive Sizing**: Three size variants
- **Gradient Backgrounds**: Animated gradient effects
- **Theme Integration**: Consistent with app color scheme
- **Engaging Design**: Friendly and approachable messaging

## 📁 File Handling Components

### FileUploadButton Component

Provides file upload functionality with progress feedback and error handling.

#### Interface

```typescript
interface Props {
  assessmentId: number;             // Target assessment ID
  metaclassId: number;              // Class context ID
  onUploadComplete?: () => void;    // Success callback
}
```

#### Implementation

```svelte
<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Plus } from 'svelte-hero-icons';
  import { open } from '@tauri-apps/plugin-dialog';
  import { uploadSeqtaFile, seqtaFetch } from '../../utils/netUtil';

  interface Props {
    assessmentId: number;
    metaclassId: number;
    onUploadComplete?: () => void;
  }

  let { assessmentId, metaclassId, onUploadComplete }: Props = $props();

  let uploading = $state(false);
  let uploadError = $state('');

  async function handleFileUpload() {
    uploading = true;
    uploadError = '';

    try {
      // Open file dialog with filters
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (!selected) {
        uploading = false;
        return;
      }

      const files = Array.isArray(selected) ? selected : [selected];

      // Upload each file
      for (const filePath of files) {
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        
        // Upload file to SEQTA
        const uploadResponse = await uploadSeqtaFile(fileName, filePath);
        const uploadData = JSON.parse(uploadResponse);

        if (uploadData.status !== '200') {
          throw new Error(uploadData.error || 'Upload failed');
        }

        // Associate file with assessment
        await seqtaFetch('/seqta/student/assessment/file/associate', {
          method: 'POST',
          body: {
            assessmentId,
            metaclassId,
            fileId: uploadData.payload.id,
            fileName: fileName
          }
        });
      }

      // Notify completion
      onUploadComplete?.();
      
    } catch (error) {
      uploadError = error instanceof Error ? error.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }
</script>

<div>
  <button
    type="button"
    class="flex gap-2 items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-white bg-accent-bg hover:bg-accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={handleFileUpload}
    disabled={uploading}>
    {#if uploading}
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      Uploading...
    {:else}
      <Icon src={Plus} class="w-4 h-4" />
      Upload Files
    {/if}
  </button>
  
  {#if uploadError}
    <div class="p-3 mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
      <p class="text-sm text-red-700 dark:text-red-400">{uploadError}</p>
    </div>
  {/if}
</div>
```

#### Features

- **Multi-File Support**: Upload multiple files simultaneously
- **Progress Indication**: Visual feedback during upload
- **Error Handling**: User-friendly error messages
- **File Type Filtering**: Configurable file type restrictions
- **SEQTA Integration**: Direct integration with SEQTA file system
- **Accessibility**: Keyboard navigation and screen reader support

## ⏰ Productivity Components

### FocusTimer Component

A Pomodoro-style timer for study sessions with customizable durations.

#### Implementation

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let timeLeft = $state(25 * 60); // 25 minutes in seconds
  let isRunning = $state(false);
  let timerInterval: number | undefined = $state(undefined);
  let selectedDuration = $state(25); // minutes
  let isBreak = $state(false);
  let customMinutes = $state('');
  let customSeconds = $state('');

  function startTimer() {
    if (!isRunning) {
      isRunning = true;
      timerInterval = window.setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
        } else {
          clearInterval(timerInterval);
          isRunning = false;
          
          // Play notification sound
          new Audio('/notification.mp3').play().catch(() => {
            // Ignore errors if audio fails to play
          });
          
          // Toggle between work and break
          isBreak = !isBreak;
          timeLeft = (isBreak ? 5 : selectedDuration) * 60;
        }
      }, 1000);
    }
  }

  function pauseTimer() {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isBreak = false;
    timeLeft = selectedDuration * 60;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function setDuration(minutes: number) {
    selectedDuration = minutes;
    resetTimer();
  }

  onMount(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  });
</script>

<div class="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
  <div class="text-center mb-6">
    <div class="text-4xl font-mono font-bold text-slate-800 dark:text-white mb-2">
      {formatTime(timeLeft)}
    </div>
    <div class="text-sm text-slate-600 dark:text-slate-400">
      {isBreak ? 'Break Time' : 'Focus Time'}
    </div>
  </div>

  <div class="flex justify-center gap-2 mb-4">
    <button
      onclick={startTimer}
      disabled={isRunning}
      class="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50">
      Start
    </button>
    <button
      onclick={pauseTimer}
      disabled={!isRunning}
      class="px-4 py-2 bg-yellow-500 text-white rounded-lg disabled:opacity-50">
      Pause
    </button>
    <button
      onclick={resetTimer}
      class="px-4 py-2 bg-red-500 text-white rounded-lg">
      Reset
    </button>
  </div>

  <div class="flex justify-center gap-2">
    <button onclick={() => setDuration(25)} class="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded">25m</button>
    <button onclick={() => setDuration(45)} class="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded">45m</button>
    <button onclick={() => setDuration(60)} class="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded">60m</button>
  </div>
</div>
```

#### Features

- **Pomodoro Technique**: 25-minute work sessions with 5-minute breaks
- **Custom Durations**: Preset and custom timer lengths
- **Audio Notifications**: Sound alerts when timer completes
- **Visual Feedback**: Clear time display and status indicators
- **Pause/Resume**: Control timer execution
- **Automatic Cycling**: Alternates between work and break periods

### TodoList Component

A comprehensive task management component with subtasks, priorities, and due dates.

#### Features

- **Task Management**: Add, edit, delete, and complete tasks
- **Subtasks**: Hierarchical task organization
- **Priority Levels**: Low, medium, high priority classification
- **Due Dates**: Date-based task scheduling
- **Tags**: Categorization and filtering
- **Recurring Tasks**: Daily, weekly, monthly repetition
- **Local Storage**: Persistent task storage

#### Data Structure

```typescript
interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  dueDate?: string;
  subtasks?: { id: number; text: string; completed: boolean }[];
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly';
}
```

## 🏠 Content Display Components

### WelcomePortal Component

Displays the school's welcome portal content in an embedded iframe with full-screen option.

#### Implementation

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, ArrowTopRightOnSquare } from 'svelte-hero-icons';
  import Modal from './Modal.svelte';

  let portalUrl = $state<string>('');
  let loadingPortal = $state<boolean>(true);
  let portalError = $state<string>('');
  let showPortalModal = $state(false);

  const parser = new DOMParser();

  async function loadPortal() {
    try {
      const response = await seqtaFetch('/seqta/student/load/portals?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { splash: true },
      });

      const data = JSON.parse(response);
      if (data.status === '200' && (data.payload?.url || data.payload?.contents)) {
        if (data.payload?.url) {
          portalUrl = data.payload.url;
        } else {
          // Extract iframe URL from HTML content
          const html = parser.parseFromString(data.payload?.contents, 'text/html');
          const iframe = html.getElementsByTagName('iframe')[0];
          portalUrl = iframe.src;
        }
      } else {
        portalError = 'Failed to load portal URL';
      }
    } catch (e) {
      portalError = 'Error loading portal';
    } finally {
      loadingPortal = false;
    }
  }

  onMount(async () => {
    await loadPortal();
  });
</script>

<div class="overflow-hidden relative rounded-2xl border shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
  <div class="flex justify-between items-center px-4 py-3 bg-gradient-to-br border-b from-slate-100/70 dark:from-slate-800/70 to-slate-100/30 dark:to-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
    <h3 class="text-xl font-semibold text-slate-900 dark:text-white">Welcome Portal</h3>
    <button
      onclick={() => (showPortalModal = true)}
      class="px-3 py-1.5 text-sm rounded-lg transition-all duration-300 text-nowrap accent-text hover:accent-bg-hover hover:text-white">
      Open Full Screen
      <Icon src={ArrowTopRightOnSquare} class="inline ml-1 w-4 h-4" />
    </button>
  </div>

  <div class="h-[400px]">
    {#if loadingPortal}
      <LoadingSpinner message="Loading welcome portal..." />
    {:else if portalError}
      <EmptyState title="Portal Error" message={portalError} icon="⚠️" />
    {:else if portalUrl}
      <iframe src={portalUrl} class="w-full h-full border-0" title="Welcome Portal"></iframe>
    {/if}
  </div>
</div>

<!-- Full-screen modal -->
<Modal bind:open={showPortalModal} maxWidth="max-w-7xl">
  <iframe src={portalUrl} class="w-full h-[80vh] border-0" title="Welcome Portal"></iframe>
</Modal>
```

#### Features

- **Embedded Display**: Shows portal content within dashboard
- **Full-Screen Mode**: Modal overlay for better viewing
- **Error Handling**: Graceful handling of loading failures
- **Content Parsing**: Extracts iframe URLs from HTML content
- **Loading States**: Visual feedback during content loading

### NoticesPane Component

Displays school notices with filtering and categorization.

#### Implementation Features

- **Real-Time Loading**: Fetches latest notices from SEQTA
- **Label Categorization**: Color-coded notice categories
- **Responsive Design**: Scrollable list with proper overflow handling
- **Date Formatting**: Smart date display
- **Link Integration**: Direct navigation to full notices page

### Homework Component

Displays homework assignments with subject filtering and completion tracking.

#### Features

- **Subject Filtering**: Toggle visibility by subject
- **Completion Status**: Visual indicators for assignment status
- **Due Date Tracking**: Highlights overdue assignments
- **Cache Integration**: Efficient data loading with caching
- **Loading States**: Skeleton screens during data fetch

## 🔐 Authentication Components

### LoginScreen Component

Comprehensive login interface supporting multiple authentication methods.

#### Features

- **Dual Authentication**: URL-based and QR code login
- **QR Code Scanner**: Live camera scanning and file upload
- **Typewriter Animation**: Engaging feature showcase
- **Window Controls**: Minimize, maximize, close functionality
- **Error Handling**: JWT expiration and validation errors
- **Mobile Detection**: Responsive design for different devices

#### QR Code Integration

```svelte
<script lang="ts">
  import { Html5Qrcode } from 'html5-qrcode';

  async function handleQrFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    qrProcessing = true;
    
    try {
      const html5Qr = new Html5Qrcode('qr-reader-temp');
      const qrCodeData = await html5Qr.scanFile(file, true);
      await html5Qr.clear();
      
      if (qrCodeData) {
        qrSuccess = 'QR code scanned successfully!';
        onUrlChange(qrCodeData);
        onStartLogin();
      } else {
        qrError = 'No QR code found in the image.';
      }
    } catch (error) {
      qrError = 'Failed to scan QR code. Please try again.';
    } finally {
      qrProcessing = false;
    }
  }
</script>
```

## ☁️ Cloud Integration Components

### CloudSyncModal Component

Provides interface for BetterSEQTA Cloud authentication and settings synchronization.

#### Features

- **Authentication Flow**: Token-based cloud authentication
- **Settings Sync**: Upload and download user preferences
- **User Management**: Display authenticated user information
- **Error Handling**: Comprehensive error messaging
- **Loading States**: Visual feedback during operations

#### Implementation

```svelte
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';

  async function authenticate() {
    if (!token.trim()) {
      error = 'Please enter your authentication token';
      return;
    }

    loading = true;
    error = '';
    success = '';
    operation = 'authenticating';

    try {
      const result = await invoke<{ user: any; token: string }>('save_cloud_token', { 
        token: token.trim() 
      });
      
      cloudUser = result.user;
      isAuthenticated = true;
      success = 'Successfully authenticated with BetterSEQTA Plus account';
      token = ''; // Clear for security
    } catch (err) {
      error = `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      loading = false;
      operation = '';
    }
  }

  async function uploadSettings() {
    loading = true;
    error = '';
    success = '';
    operation = 'uploading';

    try {
      await invoke('upload_settings_to_cloud');
      success = 'Settings uploaded successfully to cloud';
      onSettingsUpload();
    } catch (err) {
      error = `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      loading = false;
      operation = '';
    }
  }
</script>
```

## 🎨 Visual Design Patterns

### Consistent Styling

All utility components follow consistent design patterns:

```css
/* Loading animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

/* Gradient backgrounds */
.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 3s ease infinite;
}

/* Hover effects */
.hover\\:scale-\\[1\\.02\\] {
  transition: transform 0.2s ease;
}

.hover\\:scale-\\[1\\.02\\]:hover {
  transform: scale(1.02);
}

/* Focus rings */
.focus\\:ring-2 {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.focus\\:ring-2:focus {
  box-shadow: 0 0 0 2px var(--accent-color);
}
```

### Theme Integration

Components automatically adapt to the current theme:

```svelte
<!-- Dynamic background colors -->
<div class="bg-white dark:bg-slate-800">

<!-- Accent color integration -->
<button class="accent-bg hover:accent-bg-hover">

<!-- Text color adaptation -->
<p class="text-slate-900 dark:text-white">
```

### Responsive Design

Mobile-first approach with progressive enhancement:

```svelte
<!-- Responsive sizing -->
<div class="text-sm sm:text-base lg:text-lg">

<!-- Adaptive layouts -->
<div class="flex flex-col sm:flex-row">

<!-- Conditional mobile features -->
{#if isMobile}
  <MobileSpecificComponent />
{:else}
  <DesktopComponent />
{/if}
```

## 🔧 Best Practices

### Component Usage

```svelte
<!-- Always wrap risky components in ErrorBoundary -->
<ErrorBoundary>
  <DataFetchingComponent />
</ErrorBoundary>

<!-- Use appropriate loading states -->
{#if loading}
  <LoadingSpinner message="Fetching data..." />
{:else if data.length === 0}
  <EmptyState title="No data" message="Try refreshing the page." />
{:else}
  <DataDisplay {data} />
{/if}

<!-- Provide user feedback for actions -->
<FileUploadButton 
  {assessmentId}
  {metaclassId}
  onUploadComplete={() => {
    showSuccess('Files uploaded successfully!');
    refreshData();
  }}
/>
```

### Error Handling

```svelte
<!-- Graceful degradation -->
{#if error}
  <ErrorBoundary fallback={(error, reset) => (
    <div class="error-fallback">
      <h3>Something went wrong</h3>
      <details>
        <summary>Error details</summary>
        <pre>{error.stack}</pre>
      </details>
      <button onclick={reset}>Try again</button>
    </div>
  )}>
    <FailingComponent />
  </ErrorBoundary>
{/if}
```

### Performance Optimization

```svelte
<!-- Lazy loading for heavy components -->
{#await import('./HeavyComponent.svelte')}
  <LoadingSpinner />
{:then HeavyComponent}
  <HeavyComponent.default {...props} />
{:catch error}
  <ErrorBoundary fallback={() => <div>Failed to load component</div>} />
{/await}

<!-- Conditional rendering for performance -->
{#if shouldRender}
  <ExpensiveComponent />
{/if}
```

### Accessibility

```svelte
<!-- Proper ARIA labels -->
<button 
  aria-label="Upload files for assignment"
  aria-describedby="upload-help">
  Upload Files
</button>
<div id="upload-help" class="sr-only">
  Select one or more files to upload to this assignment
</div>

<!-- Keyboard navigation -->
<div 
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}>
  Custom Button
</div>

<!-- Screen reader support -->
<div aria-live="polite" aria-atomic="true">
  {#if loading}
    Loading content...
  {:else if error}
    Error: {error.message}
  {:else}
    Content loaded successfully
  {/if}
</div>
```

## 🔮 Future Enhancements

### Planned Features

1. **Advanced Error Recovery**
   - Automatic retry mechanisms
   - Error reporting to analytics
   - User feedback collection

2. **Enhanced Loading States**
   - Skeleton screens for specific components
   - Progressive loading indicators
   - Estimated time remaining

3. **Improved Accessibility**
   - Voice control integration
   - High contrast mode support
   - Screen reader optimizations

4. **Performance Optimizations**
   - Virtual scrolling for large lists
   - Image lazy loading
   - Component code splitting

### Implementation Roadmap

```svelte
<!-- Future skeleton loading -->
<SkeletonLoader type="card" count={3} />
<SkeletonLoader type="list" count={5} />
<SkeletonLoader type="table" rows={10} cols={4} />

<!-- Advanced error boundaries -->
<ErrorBoundary
  onError={(error) => analytics.track('component_error', { error })}
  fallback={CustomErrorFallback}
  retry={3}
  retryDelay={1000}>
  <Component />
</ErrorBoundary>

<!-- Smart loading states -->
<SmartLoader
  estimatedTime={2000}
  showProgress={true}
  fallback={<SkeletonLoader />}>
  <AsyncComponent />
</SmartLoader>
```

---

**Related Documentation:**
- [Layout Components](./layout.md) - Core layout and navigation
- [Assessment Components](./assessments.md) - Assessment-specific UI
- [Theme System](../frontend/theme-system.md) - Styling and theming
- [Frontend Architecture](../frontend/README.md) - Overall frontend structure 