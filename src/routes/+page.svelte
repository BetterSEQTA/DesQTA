<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import Modal from '$lib/components/Modal.svelte';
  import TodaySchedule from '$lib/components/TodaySchedule.svelte';
  import NoticesPane from '$lib/components/NoticesPane.svelte';
  import UpcomingAssessments from '$lib/components/UpcomingAssessments.svelte';
  import WelcomePortal from '$lib/components/WelcomePortal.svelte';
  import TodoList from '$lib/components/TodoList.svelte';
  import FocusTimer from '$lib/components/FocusTimer.svelte';
  import Homework from '$lib/components/Homework.svelte';
  import ShortcutsWidget from '$lib/components/ShortcutsWidget.svelte';
  import { Icon } from 'svelte-hero-icons';
  import { 
    ArrowsPointingOut, 
    ArrowsPointingIn, 
    XMark, 
    ArrowPath,
    ChevronUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ArrowsRightLeft,
    Squares2x2
  } from 'svelte-hero-icons';

  let currentSelectedDate: Date = new Date();
  let lessons = $state<any[]>([]);
  let isMobile = $state(false);

  let lessonInterval: ReturnType<typeof setInterval> | null = null;

  interface Shortcut {
    name: string;
    icon: string;
    url: string;
  }

  interface WidgetLayout {
    id: string;
    x: number;
    y: number;
    width: number; // 1 = half width, 2 = full width (desktop only)
    height: number; // 1 = normal height, 2 = double height
    enabled: boolean;
  }

  interface Widget {
    id: string;
    component: any;
    title: string;
    icon: string;
    defaultWidth: number;
    defaultHeight: number;
  }

  let homepageShortcuts = $state<Shortcut[]>([
    { name: 'Outlook', icon: '📅', url: 'https://outlook.office.com' },
    { name: 'Office365', icon: '🏢', url: 'https://office365.com' },
    { name: 'Google', icon: '🌐', url: 'https://google.com' },
  ]);

  let showPortalModal = $state(false);
  let portalUrl = $state<string>('');
  let widgetLayouts = $state<WidgetLayout[]>([]);
  let isEditMode = $state(false);
  let showWidgetPicker = $state(false);

  function checkCurrentLessons() {
    const now = new Date();
    lessons = lessons.map((l: any) => {
      const [sh, sm] = l.from.split(':').map(Number);
      const [eh, em] = l.until.split(':').map(Number);

      const start = new Date(currentSelectedDate);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(currentSelectedDate);
      end.setHours(eh, em, 0, 0);

      l.active =
        now >= start && now <= end && now.toDateString() === currentSelectedDate.toDateString();
      return l;
    });
  }

  // Widget definitions
  const widgets: Widget[] = [
    { id: 'shortcuts', component: ShortcutsWidget, title: 'Shortcuts', icon: '🔗', defaultWidth: 2, defaultHeight: 1 },
    { id: 'today_schedule', component: TodaySchedule, title: 'Today\'s Schedule', icon: '📅', defaultWidth: 2, defaultHeight: 1 },
    { id: 'notices', component: NoticesPane, title: 'Notices', icon: '📢', defaultWidth: 2, defaultHeight: 1 },
    { id: 'upcoming_assessments', component: UpcomingAssessments, title: 'Upcoming Assessments', icon: '📝', defaultWidth: 2, defaultHeight: 1 },
    { id: 'welcome_portal', component: WelcomePortal, title: 'Welcome Portal', icon: '🏠', defaultWidth: 2, defaultHeight: 1 },
    { id: 'homework', component: Homework, title: 'Homework', icon: '📚', defaultWidth: 1, defaultHeight: 1 },
    { id: 'todo_list', component: TodoList, title: 'Todo List', icon: '✅', defaultWidth: 1, defaultHeight: 1 },
    { id: 'focus_timer', component: FocusTimer, title: 'Focus Timer', icon: '⏱️', defaultWidth: 1, defaultHeight: 2 },
  ];

  function checkMobile() {
    // Check if screen width is mobile size
    isMobile = window.innerWidth < 1024; // lg breakpoint
  }

  // Get the effective layout for current screen size
  function getEffectiveLayouts(): WidgetLayout[] {
    if (!isMobile) {
      return widgetLayouts.filter(w => w.enabled);
    }

    // Mobile: convert all widgets to single column
    const enabledWidgets = widgetLayouts.filter(w => w.enabled);
    const mobileLayouts: WidgetLayout[] = [];
    
    // Sort by original position (y first, then x)
    const sortedWidgets = [...enabledWidgets].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // Convert to single column layout
    sortedWidgets.forEach((widget, index) => {
      mobileLayouts.push({
        ...widget,
        x: 0, // All widgets go to column 0 on mobile
        y: index, // Sequential positioning
        width: 1, // All widgets are single width on mobile
      });
    });

    return mobileLayouts;
  }

  // Get grid layout info for positioning calculations
  function getGridInfo() {
    const maxCols = isMobile ? 1 : 2;
    const enabledWidgets = getEffectiveLayouts();
    const maxY = enabledWidgets.length > 0 ? Math.max(...enabledWidgets.map(w => w.y + w.height)) : 0;
    
    return { maxCols, maxY, enabledWidgets };
  }

  // Check if a position is occupied by another widget
  function isPositionOccupied(x: number, y: number, width: number, height: number, excludeId?: string): boolean {
    const { enabledWidgets } = getGridInfo();
    
    for (const widget of enabledWidgets) {
      if (excludeId && widget.id === excludeId) continue;
      
      // Check for overlap
      const widgetRight = widget.x + widget.width;
      const widgetBottom = widget.y + widget.height;
      const checkRight = x + width;
      const checkBottom = y + height;
      
      if (!(x >= widgetRight || checkRight <= widget.x || y >= widgetBottom || checkBottom <= widget.y)) {
        return true; // Overlap detected
      }
    }
    
    return false;
  }

  // Find the next available position
  function findNextAvailablePosition(width: number, height: number, excludeId?: string): { x: number; y: number } {
    const { maxCols, maxY } = getGridInfo();
    
    // Try each row starting from 0
    for (let y = 0; y <= maxY + 5; y++) {
      for (let x = 0; x <= maxCols - width; x++) {
        if (!isPositionOccupied(x, y, width, height, excludeId)) {
          return { x, y };
        }
      }
    }
    
    // Fallback: place at bottom
    return { x: 0, y: maxY + 1 };
  }

  // Move widget in a specific direction
  function moveWidget(widgetId: string, direction: 'up' | 'down' | 'left' | 'right') {
    if (isMobile && (direction === 'left' || direction === 'right')) {
      return; // No horizontal movement on mobile
    }

    const widget = widgetLayouts.find(w => w.id === widgetId);
    if (!widget) return;

    let newX = widget.x;
    let newY = widget.y;

    switch (direction) {
      case 'up':
        newY = Math.max(0, widget.y - 1);
        break;
      case 'down':
        newY = widget.y + 1;
        break;
      case 'left':
        newX = Math.max(0, widget.x - 1);
        break;
      case 'right':
        const { maxCols } = getGridInfo();
        newX = Math.min(maxCols - widget.width, widget.x + 1);
        break;
    }

    // Check if new position is valid
    if (!isPositionOccupied(newX, newY, widget.width, widget.height, widgetId)) {
      widget.x = newX;
      widget.y = newY;
      saveWidgetLayouts();
    } else {
      // Try to push other widgets out of the way
      const success = pushWidgetsAndMove(widgetId, newX, newY, direction);
      if (success) {
        saveWidgetLayouts();
      }
    }
  }

  // Push other widgets and move the current widget
  function pushWidgetsAndMove(widgetId: string, newX: number, newY: number, direction: 'up' | 'down' | 'left' | 'right'): boolean {
    const widget = widgetLayouts.find(w => w.id === widgetId);
    if (!widget) return false;

    const { enabledWidgets } = getGridInfo();
    const conflictingWidgets: WidgetLayout[] = [];

    // Find widgets that would conflict with the new position
    for (const otherWidget of enabledWidgets) {
      if (otherWidget.id === widgetId) continue;
      
      const widgetRight = otherWidget.x + otherWidget.width;
      const widgetBottom = otherWidget.y + otherWidget.height;
      const checkRight = newX + widget.width;
      const checkBottom = newY + widget.height;
      
      if (!(newX >= widgetRight || checkRight <= otherWidget.x || newY >= widgetBottom || checkBottom <= otherWidget.y)) {
        conflictingWidgets.push(otherWidget);
      }
    }

    if (conflictingWidgets.length === 0) {
      // No conflicts, just move
      widget.x = newX;
      widget.y = newY;
      return true;
    }

    // Try to push conflicting widgets
    const pushDirection = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 
                         direction === 'left' ? 'left' : 'right';
    
    const originalPositions = conflictingWidgets.map(w => ({ id: w.id, x: w.x, y: w.y }));
    
    // Calculate push distances and new positions
    const pushMoves: Array<{ widget: WidgetLayout; newX: number; newY: number }> = [];
    
    for (const conflictWidget of conflictingWidgets) {
      let pushX = conflictWidget.x;
      let pushY = conflictWidget.y;
      
      switch (pushDirection) {
        case 'up':
          pushY = newY - conflictWidget.height;
          break;
        case 'down':
          pushY = newY + widget.height;
          break;
        case 'left':
          pushX = newX - conflictWidget.width;
          break;
        case 'right':
          pushX = newX + widget.width;
          break;
      }
      
      // Make sure push position is valid
      if (pushX < 0 || pushY < 0) {
        // Can't push in this direction, find alternative position
        const altPos = findNextAvailablePosition(conflictWidget.width, conflictWidget.height, conflictWidget.id);
        pushX = altPos.x;
        pushY = altPos.y;
      }
      
      pushMoves.push({ widget: conflictWidget, newX: pushX, newY: pushY });
    }
    
    // Check if all push moves are valid
    const tempUpdates = new Map<string, { x: number; y: number }>();
    tempUpdates.set(widgetId, { x: newX, y: newY });
    
    for (const move of pushMoves) {
      tempUpdates.set(move.widget.id, { x: move.newX, y: move.newY });
    }
    
    // Validate no overlaps with the temporary positions
    let valid = true;
    for (const [id1, pos1] of tempUpdates) {
      const w1 = widgetLayouts.find(w => w.id === id1)!;
      for (const [id2, pos2] of tempUpdates) {
        if (id1 === id2) continue;
        const w2 = widgetLayouts.find(w => w.id === id2)!;
        
        const overlap = !(pos1.x >= pos2.x + w2.width || pos1.x + w1.width <= pos2.x || 
                         pos1.y >= pos2.y + w2.height || pos1.y + w1.height <= pos2.y);
        if (overlap) {
          valid = false;
          break;
        }
      }
      if (!valid) break;
    }
    
    if (valid) {
      // Apply all moves
      widget.x = newX;
      widget.y = newY;
      for (const move of pushMoves) {
        move.widget.x = move.newX;
        move.widget.y = move.newY;
      }
      return true;
    }
    
    return false;
  }

  async function loadHomepageShortcuts() {
    try {
      const settings = await invoke<{ shortcuts: Shortcut[] }>('get_settings');
      if (settings.shortcuts && settings.shortcuts.length > 0) {
        homepageShortcuts = settings.shortcuts;
      }
    } catch (e) {}
  }

  async function loadWidgetLayouts() {
    try {
      const settings = await invoke<{ widget_layout: WidgetLayout[] }>('get_settings');
      if (settings.widget_layout && settings.widget_layout.length > 0) {
        widgetLayouts = settings.widget_layout;
      } else {
        // Use default layout
        widgetLayouts = widgets.map((widget, index) => ({
          id: widget.id,
          x: index < 5 ? 0 : (index === 5 || index === 6 ? 0 : 1),
          y: index,
          width: widget.defaultWidth,
          height: widget.defaultHeight,
          enabled: true,
        }));
      }
    } catch (e) {
      console.error('Failed to load widget layouts:', e);
    }
  }

  async function saveWidgetLayouts() {
    try {
      const currentSettings = await invoke<any>('get_settings');
      const newSettings = {
        ...currentSettings,
        widget_layout: widgetLayouts,
      };
      await invoke('save_settings', { newSettings });
    } catch (e) {
      console.error('Failed to save widget layouts:', e);
    }
  }

  function toggleEditMode() {
    isEditMode = !isEditMode;
  }

  function toggleWidgetSize(widgetId: string) {
    if (isMobile) return; // No size toggle on mobile
    
    const widget = widgetLayouts.find(w => w.id === widgetId);
    if (widget) {
      const newWidth = widget.width === 1 ? 2 : 1;
      
      // Check if the new size fits
      if (!isPositionOccupied(widget.x, widget.y, newWidth, widget.height, widgetId)) {
        widget.width = newWidth;
        saveWidgetLayouts();
      } else {
        // Try to find a new position for the resized widget
        const newPos = findNextAvailablePosition(newWidth, widget.height, widgetId);
        widget.x = newPos.x;
        widget.y = newPos.y;
        widget.width = newWidth;
        saveWidgetLayouts();
      }
    }
  }

  function toggleWidgetEnabled(widgetId: string) {
    const widget = widgetLayouts.find(w => w.id === widgetId);
    if (widget) {
      widget.enabled = !widget.enabled;
      
      if (widget.enabled) {
        // Re-enabling: find a good position
        const newPos = findNextAvailablePosition(widget.width, widget.height);
        widget.x = newPos.x;
        widget.y = newPos.y;
      }
      
      saveWidgetLayouts();
    }
  }

  function addWidget() {
    showWidgetPicker = true;
  }

  function selectWidget(widgetId: string) {
    const widget = getWidgetById(widgetId);
    if (widget) {
      // Check if widget already exists but is disabled
      const existingWidget = widgetLayouts.find(w => w.id === widgetId);
      if (existingWidget) {
        // Re-enable the existing widget
        existingWidget.enabled = true;
        const newPos = findNextAvailablePosition(existingWidget.width, existingWidget.height);
        existingWidget.x = newPos.x;
        existingWidget.y = newPos.y;
      } else {
        // Find the next available position
        const newPos = findNextAvailablePosition(widget.defaultWidth, widget.defaultHeight);
        
        const newLayout: WidgetLayout = {
          id: widgetId,
          x: newPos.x,
          y: newPos.y,
          width: widget.defaultWidth,
          height: widget.defaultHeight,
          enabled: true,
        };
        widgetLayouts = [...widgetLayouts, newLayout];
      }
      saveWidgetLayouts();
    }
    showWidgetPicker = false;
  }

  function getAvailableWidgets() {
    const usedIds = new Set(widgetLayouts.filter(w => w.enabled).map(w => w.id));
    return widgets.filter(w => !usedIds.has(w.id));
  }

  function resetLayout() {
    // Reset to default layout
    widgetLayouts = widgets.map((widget, index) => ({
      id: widget.id,
      x: index < 5 ? 0 : (index === 5 || index === 6 ? 0 : 1),
      y: index,
      width: widget.defaultWidth,
      height: widget.defaultHeight,
      enabled: true,
    }));
    saveWidgetLayouts();
  }

  function compactLayout() {
    const { enabledWidgets } = getGridInfo();
    const { maxCols } = getGridInfo();
    
    // Sort widgets by their current position
    const sortedWidgets = [...enabledWidgets].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    
    // Reassign positions to eliminate gaps
    let currentY = 0;
    let currentX = 0;
    
    for (const widget of sortedWidgets) {
      // Find next available position
      let placed = false;
      
      for (let y = currentY; y <= currentY + 10 && !placed; y++) {
        for (let x = 0; x <= maxCols - widget.width && !placed; x++) {
          if (!isPositionOccupied(x, y, widget.width, widget.height, widget.id)) {
            widget.x = x;
            widget.y = y;
            placed = true;
            
            // Update current position for next widget
            if (y === currentY && x + widget.width < maxCols) {
              currentX = x + widget.width;
            } else {
              currentY = y + widget.height;
              currentX = 0;
            }
          }
        }
      }
    }
    
    saveWidgetLayouts();
  }

  function getWidgetById(id: string): Widget | undefined {
    return widgets.find(w => w.id === id);
  }

  function renderWidget(widgetId: string) {
    const widget = getWidgetById(widgetId);
    const layout = widgetLayouts.find(w => w.id === widgetId);
    
    if (!widget || !layout || !layout.enabled) return null;
    
    if (widgetId === 'shortcuts') {
      return {
        component: widget.component,
        props: { shortcuts: homepageShortcuts }
      };
    }
    
    return {
      component: widget.component,
      props: {}
    };
  }

  function closeModal() {
    showPortalModal = false;
  }

  onMount(() => {
    loadHomepageShortcuts();
    loadWidgetLayouts();
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
  });

  onDestroy(() => {
    if (lessonInterval) clearInterval(lessonInterval);
    window.removeEventListener('resize', checkMobile);
  });
</script>

<div class="p-4 sm:p-6 lg:p-8 xl:p-12 mx-auto min-h-screen max-w-7xl">
  <!-- Edit Mode Toggle -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
    {#if isEditMode}
      <div class="flex flex-wrap gap-2">
        <button
          onclick={() => addWidget()}
          class="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg bg-accent text-white hover:accent-bg transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          + Add Widget
        </button>
        <button
          onclick={compactLayout}
          class="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Icon src={Squares2x2} class="w-4 h-4" />
          Compact
        </button>
        <button
          onclick={resetLayout}
          class="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg bg-slate-500 text-white hover:bg-slate-600 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          <Icon src={ArrowPath} class="w-4 h-4" />
          Reset Layout
        </button>
      </div>
    {/if}
  </div>

  <!-- Widget Grid -->
  <div class="widget-grid relative grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 min-h-screen">
    {#each getEffectiveLayouts().sort((a, b) => a.y - b.y || a.x - b.x) as layout (layout.id)}
      {@const widget = getWidgetById(layout.id)}
      {@const renderedWidget = renderWidget(layout.id)}
      
      {#if renderedWidget}
        <div
          class="widget-container relative bg-white/80 dark:bg-slate-900/60 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 transition-all duration-200 hover:shadow-md {isEditMode ? 'hover:border-accent dark:hover:border-accent' : ''}"
          style="grid-column: {!isMobile && layout.width === 2 ? '1 / span 2' : layout.x === 0 ? '1 / span 1' : '2 / span 1'}; grid-row: {layout.y + 1} / span {layout.height};"
        >
          <!-- Widget Header (Edit Mode) -->
          {#if isEditMode}
            <div class="absolute top-2 right-2 z-10 flex flex-col gap-1" role="toolbar" aria-label="Widget controls" tabindex="0" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') e.stopPropagation(); }}>
                             <!-- Movement Controls -->
               <div class="flex flex-col bg-slate-800/90 rounded-lg p-2 gap-2">
                 <!-- Up Arrow -->
                 <button
                   onclick={() => moveWidget(layout.id, 'up')}
                   class="p-2 sm:p-2.5 rounded bg-slate-700/80 text-white hover:bg-slate-600/80 transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
                   title="Move Up"
                   disabled={layout.y === 0}
                 >
                   <Icon src={ChevronUp} class="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
                 
                 <!-- Horizontal Controls (Desktop Only) -->
                 {#if !isMobile}
                   <div class="flex gap-2">
                     <button
                       onclick={() => moveWidget(layout.id, 'left')}
                       class="p-2 sm:p-2.5 rounded bg-slate-700/80 text-white hover:bg-slate-600/80 transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
                       title="Move Left"
                       disabled={layout.x === 0}
                     >
                       <Icon src={ChevronLeft} class="w-4 h-4 sm:w-5 sm:h-5" />
                     </button>
                     <button
                       onclick={() => moveWidget(layout.id, 'right')}
                       class="p-2 sm:p-2.5 rounded bg-slate-700/80 text-white hover:bg-slate-600/80 transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
                       title="Move Right"
                       disabled={layout.x + layout.width >= 2}
                     >
                       <Icon src={ChevronRight} class="w-4 h-4 sm:w-5 sm:h-5" />
                     </button>
                   </div>
                 {/if}
                 
                 <!-- Down Arrow -->
                 <button
                   onclick={() => moveWidget(layout.id, 'down')}
                   class="p-2 sm:p-2.5 rounded bg-slate-700/80 text-white hover:bg-slate-600/80 transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
                   title="Move Down"
                 >
                   <Icon src={ChevronDown} class="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
               </div>
              
                             <!-- Widget Controls -->
               <div class="flex gap-2">
                 {#if !isMobile}
                   <button
                     onclick={() => toggleWidgetSize(layout.id)}
                     class="p-2 sm:p-2.5 rounded bg-slate-800/80 text-white hover:bg-slate-700/80 transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
                     title={layout.width === 1 ? 'Expand to Full Width' : 'Shrink to Half Width'}
                   >
                     <Icon src={ArrowsRightLeft} class="w-4 h-4 sm:w-5 sm:h-5" />
                   </button>
                 {/if}
                 <button
                   onclick={() => toggleWidgetEnabled(layout.id)}
                   class="p-2 sm:p-2.5 rounded bg-red-600/80 text-white hover:bg-red-500/80 transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center"
                   title="Remove Widget"
                 >
                   <Icon src={XMark} class="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
               </div>
            </div>
          {/if}

          <!-- Widget Content -->
          <div class="h-full">
            {#if renderedWidget.component}
              <renderedWidget.component {...renderedWidget.props} />
            {/if}
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Edit Layout button at bottom -->
  <div class="flex justify-end mt-6 sm:mt-8">
    <button
      onclick={toggleEditMode}
      class="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
    >
      {#if isEditMode}
        <Icon src={ArrowsPointingIn} class="w-4 h-4" />
        Exit Edit Mode
      {:else}
        <Icon src={ArrowsPointingOut} class="w-4 h-4" />
        Edit Layout
      {/if}
    </button>
  </div>
</div>

<Modal
  bind:open={showPortalModal}
  onclose={closeModal}
  maxWidth="w-[80%]"
  maxHeight="h-[80%]"
  customClasses="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl"
  ariaLabel="Welcome Portal Modal">
  {#if portalUrl}
    <iframe src={portalUrl} class="w-full h-full rounded-2xl border-0" title="Welcome Portal"
    ></iframe>
  {/if}
</Modal>

<!-- Widget Picker Modal -->
<Modal
  bind:open={showWidgetPicker}
  onclose={() => showWidgetPicker = false}
  maxWidth="w-[90vw] sm:w-96"
  maxHeight="h-auto"
  customClasses="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl"
  ariaLabel="Widget Picker Modal">
  <div class="p-4 sm:p-6">
    <h2 class="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-4">Add Widget</h2>
    <div class="grid grid-cols-1 gap-3">
      {#each getAvailableWidgets() as widget}
        <button
          onclick={() => selectWidget(widget.id)}
          class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          <span class="text-xl sm:text-2xl">{widget.icon}</span>
          <div class="text-left">
            <div class="font-medium text-slate-900 dark:text-white text-sm sm:text-base">{widget.title}</div>
            <div class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {!isMobile && widget.defaultWidth === 1 ? 'Half width' : 'Full width'} • 
              {widget.defaultHeight === 1 ? 'Normal height' : 'Double height'}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
</Modal>

<style>
  .widget-container {
    min-height: 150px;
  }
  
  @media (min-width: 640px) {
    .widget-container {
      min-height: 200px;
    }
  }
  
  @media (min-width: 1024px) {
    .widget-container {
      min-height: 250px;
    }
  }
</style>