# Timetable Components

This document covers the comprehensive timetable system in DesQTA, including the grid layout, lesson management, and scheduling components that provide students with their weekly class schedules.

## 🏗 Timetable System Architecture

The timetable system consists of several interconnected components that work together to display and manage class schedules:

### Core Components
- **TimetableGrid** - Main weekly schedule grid layout
- **TimetableLesson** - Individual lesson display blocks
- **TimetableHeader** - Navigation and export controls
- **TimetableExport** - Export functionality (CSV, PDF, iCal)
- **TimetablePdfViewer** - PDF viewing modal
- **TodaySchedule** - Dashboard widget for daily lessons

### Supporting Components
- **FocusTimer** - Pomodoro-style study timer
- **ShortcutsWidget** - Quick access to external tools

## 📅 TimetableGrid Component

The TimetableGrid is the core component that displays the weekly class schedule in a time-based grid layout.

### Interface

```typescript
interface Props {
  lessons: any[];           // Array of lesson objects
  selectedDay: number;      // Currently selected day (1-5)
  loadingLessons: boolean;  // Loading state
  error: string | null;     // Error message
  onRetry: () => void;      // Retry function for errors
}

interface Lesson {
  dayIdx: number;           // Day index (0-4 for Mon-Fri)
  from: string;             // Start time (HH:MM format)
  until: string;            // End time (HH:MM format)
  description: string;      // Subject/lesson name
  staff: string;            // Teacher name
  room: string;             // Room number/location
  colour: string;           // Subject color (hex)
  attendanceTitle?: string; // Attendance status
  code: string;             // Subject code
}
```

### Grid System Architecture

#### Time-Based Layout
The grid uses a sophisticated time-based positioning system:

```typescript
// Convert time string to minutes for calculations
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// Calculate vertical position based on time bounds
function timeToY(time: number, min: number, max: number): number {
  return ((time - min) / (max - min)) * gridHeight;
}

// Get time boundaries for the day
function getTimeBounds() {
  if (!lessons.length) return { min: 8 * 60, max: 16 * 60 };
  const allTimes = lessons.flatMap((l: any) => [
    timeToMinutes(l.from), 
    timeToMinutes(l.until)
  ]);
  return {
    min: Math.min(...allTimes),
    max: Math.max(...allTimes),
  };
}
```

#### Responsive Grid Structure
```css
.timetable-grid-cols {
  grid-template-columns: 56px repeat(5, 1fr);
  gap: 0.5rem;
}
```

- **Time Column**: Fixed 56px width for time labels
- **Day Columns**: 5 equal-width columns for Monday-Friday
- **Responsive Behavior**: Collapses to single day view on mobile

### Lesson Grouping & Overlap Handling

The grid intelligently handles overlapping lessons:

```typescript
function getLessonsGroupedByTime(dayIdx: number) {
  const dayLessons = getLessonsFor(dayIdx);
  const grouped: { [key: string]: any[] } = {};
  
  dayLessons.forEach((lesson: any) => {
    const timeKey = `${lesson.from}-${lesson.until}`;
    if (!grouped[timeKey]) {
      grouped[timeKey] = [];
    }
    grouped[timeKey].push(lesson);
  });
  
  return Object.entries(grouped).map(([timeKey, lessons]) => ({
    timeKey,
    lessons,
    from: lessons[0].from,
    until: lessons[0].until
  }));
}
```

**Overlap Rendering:**
- **Single Lesson**: Full width lesson block
- **Multiple Lessons**: Side-by-side layout with equal width distribution
- **Flexible Height**: Lessons scale vertically based on duration

### Mobile Navigation

Mobile devices show a single-day view with navigation controls:

```typescript
function prevDay() {
  selectedDayState = selectedDayState === 1 ? 5 : selectedDayState - 1;
}

function nextDay() {
  selectedDayState = selectedDayState === 5 ? 1 : selectedDayState + 1;
}
```

**Mobile Features:**
- **Day Navigation**: Swipe-like navigation between days
- **Today Indicator**: Highlights current day
- **Touch-Friendly**: Large navigation buttons
- **Responsive Text**: Adapts font sizes for mobile

### Visual Design Features

#### Time Labels
```typescript
function formatTime(time: string): string {
  const [hour, minute] = time.split(':');
  const hourNum = parseInt(hour);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const displayHour = hourNum % 12 || 12;
  return `${displayHour}:${minute} ${ampm}`;
}
```

#### Header Design
- **Gradient Background**: `bg-gradient-to-r from-slate-50 to-slate-100`
- **Today Highlighting**: Blue background for current day
- **Responsive Typography**: Scales with screen size

#### Loading & Error States
- **Loading Animation**: Spinning indicator with descriptive text
- **Error Handling**: Retry button with error message
- **Empty State**: Friendly message when no lessons exist

## 📚 TimetableLesson Component

Individual lesson blocks that display within the grid system.

### Interface

```typescript
interface Props {
  lesson: {
    description: string;      // Subject name
    staff: string;           // Teacher name
    room: string;            // Room location
    attendanceTitle?: string; // Attendance status
    from: string;            // Start time
    until: string;           // End time
    colour: string;          // Subject color
  };
  overlap?: boolean;         // Whether lesson overlaps with others
}
```

### Interactive Features

#### Expandable Information
```typescript
let expanded = $state(false);
let isTouch = false;

// Detect touch device for click-to-expand
onMount(() => {
  isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
});

function handleClick() {
  if (isTouch) expanded = !expanded;
}
```

**Interaction Modes:**
- **Desktop**: Hover to reveal additional details
- **Mobile**: Tap to expand/collapse
- **Keyboard**: Focus support for accessibility

#### Progressive Disclosure
```css
.attendance-details {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
}

.lesson-block:hover .attendance-details,
.lesson-block:focus-within .attendance-details,
.lesson-block.expanded .attendance-details {
  max-height: 100px;
  opacity: 1;
}
```

### Visual Design

#### Subject Color Integration
- **Left Border**: 4px border using subject color
- **Background**: Semi-transparent white/dark background
- **Glass Effect**: Backdrop blur for modern appearance

#### Content Hierarchy
1. **Primary**: Subject name and time
2. **Secondary**: Teacher and room information
3. **Tertiary**: Attendance details (on hover/expand)

#### Responsive Text
- **Truncation**: Long text truncates with ellipsis
- **Word Breaking**: Prevents overflow in narrow columns
- **Font Scaling**: Adjusts for overlap scenarios

## 🎯 TimetableHeader Component

Navigation and control header for the timetable view.

### Interface

```typescript
interface Props {
  selectedWeekStart: Date;   // Start of selected week
  loadingLessons: boolean;   // Loading state
  onPrevWeek: () => void;    // Previous week navigation
  onNextWeek: () => void;    // Next week navigation
  onExportCsv: () => void;   // CSV export function
  onExportPdf: () => void;   // PDF export function
  onExportIcal: () => void;  // iCal export function
}
```

### Week Navigation

```typescript
function weekRangeLabel(): string {
  const start = selectedWeekStart;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  
  return `${start.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric'
  })} - ${end.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })}`;
}
```

**Navigation Features:**
- **Week Range Display**: Shows current week date range
- **Smooth Transitions**: Animated navigation buttons
- **Loading States**: Disabled buttons during data loading
- **Keyboard Navigation**: Arrow key support

### Export Integration

The header integrates with the TimetableExport component:

```svelte
<TimetableExport 
  bind:showExportMenu
  {onExportCsv}
  {onExportPdf}
  {onExportIcal}
/>
```

## 📤 TimetableExport Component

Dropdown menu for exporting timetable data in various formats.

### Export Options

#### CSV Export
```typescript
// Export as spreadsheet format
onExportCsv: () => void
```
- **Format**: Comma-separated values
- **Use Case**: Excel/Google Sheets import
- **Icon**: Table cells icon with green accent

#### PDF Export
```typescript
// Export as portable document
onExportPdf: () => void
```
- **Format**: Portable Document Format
- **Use Case**: Printing and sharing
- **Icon**: Document icon with red accent

#### iCal Export
```typescript
// Export as calendar format
onExportIcal: () => void
```
- **Format**: iCalendar (.ics) format
- **Use Case**: Import into calendar apps
- **Icon**: Calendar icon with blue accent

### Visual Design

#### Dropdown Animation
```svelte
{#if showExportMenu}
  <div transition:fly={{ y: -8, duration: 200, opacity: 0 }}>
    <!-- Export options -->
  </div>
{/if}
```

#### Option Layout
- **Icon Containers**: Color-coded backgrounds for each format
- **Descriptive Text**: Format name and use case description
- **Hover Effects**: Subtle background changes on interaction

## 📱 TimetablePdfViewer Component

Modal component for viewing generated PDF timetables.

### Interface

```typescript
interface Props {
  showPdfViewer: boolean;   // Visibility state
  pdfUrl: string | null;    // PDF blob URL
  pdfLoading: boolean;      // Loading state
  onClose: () => void;      // Close callback
}
```

### Features

#### PDF Display
```svelte
<iframe 
  src={pdfUrl} 
  class="w-full min-h-[70vh] rounded-lg border"
  title="Timetable PDF">
</iframe>
```

#### Download Functionality
```typescript
import { saveAs } from 'file-saver';

function downloadPdf() {
  if (pdfUrl) {
    saveAs(pdfUrl, 'timetable.pdf');
  }
}
```

#### Modal Integration
- **Full-Screen**: Large modal for optimal PDF viewing
- **Custom Controls**: Download and close buttons
- **Loading State**: Spinner during PDF generation

## 📊 TodaySchedule Component

Dashboard widget showing the current day's lessons.

### Interface

```typescript
interface Props {
  // No external props - self-contained widget
}

interface Lesson {
  description: string;      // Subject name
  staff: string;           // Teacher name
  room: string;            // Room location
  from: string;            // Start time
  until: string;           // End time
  colour: string;          // Subject color
  active: boolean;         // Currently in progress
  attendanceTitle: string; // Attendance status
}
```

### Real-Time Updates

#### Current Lesson Detection
```typescript
function checkCurrentLessons() {
  const now = new Date();
  lessons = lessons.map((l: any) => {
    const [sh, sm] = l.from.split(':').map(Number);
    const [eh, em] = l.until.split(':').map(Number);

    const start = new Date(currentSelectedDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(currentSelectedDate);
    end.setHours(eh, em, 0, 0);

    l.active = now >= start && now <= end && 
               now.toDateString() === currentSelectedDate.toDateString();
    return l;
  });
}
```

#### Automatic Updates
- **Interval Updates**: Checks every minute for active lessons
- **Visual Indicators**: "Now" badge for current lessons
- **Cleanup**: Proper interval cleanup on component destroy

### Date Navigation

#### Smart Date Labels
```typescript
function lessonsSubtitle() {
  const today = new Date();
  const diff = ~~((today.getTime() - currentSelectedDate.getTime()) / 86_400_000);
  if (diff === 0) return "Today's Lessons";
  if (diff === -1) return "Tomorrow's Lessons";
  if (diff === 1) return "Yesterday's Lessons";
  return currentSelectedDate.toLocaleDateString('en-AU', {
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}
```

### Visual Design

#### Lesson Cards
- **Color Borders**: Top border matching subject color
- **Active Indicators**: Animated "Now" badge for current lessons
- **Information Hierarchy**: Subject → Teacher → Room → Time
- **Responsive Layout**: Horizontal scroll on mobile

#### Empty States
- **No Lessons**: Celebratory emoji with encouraging message
- **Loading**: Spinner with descriptive loading text

## ⏱ FocusTimer Component

Pomodoro-style timer for study sessions, integrated with the timetable system.

### Interface

```typescript
interface TimerState {
  timeLeft: number;         // Seconds remaining
  isRunning: boolean;       // Timer active state
  selectedDuration: number; // Session length (minutes)
  isBreak: boolean;         // Break mode indicator
}
```

### Timer Logic

#### Session Management
```typescript
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
        new Audio('/notification.mp3').play().catch(() => {});
        // Toggle between work and break
        isBreak = !isBreak;
        timeLeft = (isBreak ? 5 : selectedDuration) * 60;
      }
    }, 1000);
  }
}
```

#### Time Formatting
```typescript
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
```

### Visual Design

#### Circular Progress
- **Large Display**: 48x48 circular timer display
- **Color Coding**: Different colors for work/break sessions
- **Typography**: Large, readable time display

#### Control Buttons
- **Start/Pause**: Primary action button
- **Reset**: Secondary action for timer reset
- **Preset Durations**: Quick selection buttons

## 🔗 Data Integration

### API Endpoints

#### Timetable Data
```typescript
// Load weekly timetable
const response = await seqtaFetch('/seqta/student/load/timetable?', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { 
    from: startDate,    // YYYY-MM-DD format
    until: endDate,     // YYYY-MM-DD format
    student: studentId  // Student identifier
  },
});
```

#### Subject Colors
```typescript
// Load user color preferences
const response = await seqtaFetch('/seqta/student/load/prefs?', {
  method: 'POST',
  body: { 
    request: 'userPrefs', 
    asArray: true, 
    user: studentId 
  },
});
```

### Data Processing

#### Color Application
```typescript
lessons = lessonsData.map((lesson: any) => {
  const colourPrefName = `timetable.subject.colour.${lesson.code}`;
  const subjectColour = colours.find((c: any) => c.name === colourPrefName);
  
  lesson.colour = subjectColour ? subjectColour.value : '#8e8e8e';
  lesson.from = lesson.from.substring(0, 5);  // HH:MM format
  lesson.until = lesson.until.substring(0, 5);
  
  return lesson;
});
```

#### Caching Strategy
- **Lesson Data**: Cache daily lessons for performance
- **Color Preferences**: Cache user color settings
- **Export Data**: Cache generated exports temporarily

## 🎨 Styling & Theming

### Consistent Design Language

#### Grid Styling
```css
.timetable-header-row {
  min-height: 36px;
  height: 36px;
  font-size: 0.98rem;
  padding-top: 0;
  padding-bottom: 0;
}

.timetable-day-label {
  padding: 0.25rem 0.25rem 0.1rem 0.25rem;
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.1;
}

.timetable-time-label {
  width: 56px;
  min-width: 56px;
  max-width: 56px;
  padding: 0.1rem 0.1rem;
  font-size: 0.92rem;
}
```

#### Color System
- **Subject Colors**: Dynamic colors from user preferences
- **Status Indicators**: Consistent color coding
  - Blue: Current day highlight
  - Green: Active lesson indicator
  - Accent: Interactive elements

#### Glass Morphism
- **Backdrop Blur**: `backdrop-blur-sm` for modern appearance
- **Transparency**: Semi-transparent backgrounds
- **Borders**: Subtle border colors for definition

### Responsive Design

#### Breakpoint Strategy
```css
/* Mobile-first approach */
.hidden.sm\:block {
  display: none;
}

@media (min-width: 640px) {
  .hidden.sm\:block {
    display: block;
  }
}
```

#### Mobile Optimizations
- **Single Day View**: Shows one day at a time on mobile
- **Touch Interactions**: Larger touch targets
- **Swipe Navigation**: Gesture-friendly day switching

## 🔧 Best Practices

### Performance Optimization

#### Efficient Rendering
```typescript
// Use derived stores for reactive filtering
const todayLessons = $derived(
  lessons.filter(lesson => lesson.dayIdx === selectedDay)
);

// Minimize DOM updates with keyed each blocks
{#each lessons as lesson (lesson.id)}
  <TimetableLesson {lesson} />
{/each}
```

#### Memory Management
- **Interval Cleanup**: Clear timers on component destroy
- **Event Listeners**: Remove resize listeners properly
- **Cache Management**: Implement appropriate cache expiration

### Accessibility

#### Keyboard Navigation
```svelte
<button
  tabindex="0"
  aria-label="Previous week"
  on:keydown={(e) => e.key === 'Enter' && prevWeek()}
>
```

#### Screen Reader Support
- **ARIA Labels**: Descriptive labels for all interactive elements
- **Semantic HTML**: Proper heading hierarchy and structure
- **Focus Management**: Logical focus order and visible indicators

### Error Handling

#### Graceful Degradation
```typescript
try {
  const response = await seqtaFetch('/api/timetable');
  lessons = JSON.parse(response).payload.items;
} catch (error) {
  console.error('Failed to load timetable:', error);
  showError = true;
  errorMessage = 'Unable to load timetable. Please try again.';
}
```

#### Loading States
- **Skeleton Loading**: Show placeholder content during loading
- **Progressive Enhancement**: Basic functionality works without JavaScript
- **Retry Mechanisms**: Allow users to retry failed operations

## 🚀 Future Enhancements

### Planned Features
- **Drag & Drop**: Rearrange personal schedule items
- **Integration**: Sync with external calendar applications
- **Notifications**: Reminders for upcoming classes
- **Offline Support**: Cache timetable data for offline viewing

### Performance Improvements
- **Virtual Scrolling**: For very long timetables
- **Lazy Loading**: Load lessons on demand
- **WebWorkers**: Background processing for complex calculations

---

**Related Documentation:**
- [Layout Components](./layout.md) - Header and navigation integration
- [Assessment Components](./assessments.md) - Integration with assessment deadlines
- [Frontend Architecture](../frontend/README.md) - Overall application structure
- [Theme System](../frontend/theme-system.md) - Styling and theming 