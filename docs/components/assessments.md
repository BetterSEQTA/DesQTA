# Assessment Components

This document covers the comprehensive assessment system in DesQTA, including all components, data flow, and user interactions for managing student assessments.

## 🏗 Assessment System Architecture

The assessment system consists of multiple interconnected components that work together to provide a complete assessment management experience:

### Core Components
- **AssessmentCard** - Individual assessment display cards
- **AssessmentListView** - List-based assessment display
- **AssessmentBoardView** - Kanban-style board view
- **AssessmentCalendarView** - Calendar-based assessment view
- **AssessmentViewTabs** - View switching interface
- **AssessmentDetails** - Detailed assessment information
- **AssessmentOverview** - Assessment description and resources
- **AssessmentSubmissions** - File submission management
- **AssessmentHeader** - Navigation header for assessment pages
- **AssessmentTabs** - Tab navigation within assessments

### Supporting Components
- **UpcomingAssessments** - Dashboard widget for upcoming items
- **GradePredictions** - AI-powered grade prediction system
- **GradeDistribution** - Visual grade analytics
- **FileUploadButton** - File submission interface
- **FileCard** - File display component

## 📋 AssessmentCard Component

The AssessmentCard is the fundamental building block for displaying assessment information throughout the application.

### Interface

```typescript
interface Assessment {
  id: number;           // Unique assessment identifier
  title: string;        // Assessment title/name
  code: string;         // Subject code
  due: string;          // Due date (ISO string)
  status: string;       // Assessment status
  colour: string;       // Subject color (hex)
  metaclass: number;    // Metaclass identifier
}

interface Props {
  assessment: Assessment;
  showSubject?: boolean;  // Show subject code (default: false)
}
```

### Status Badge Logic

The component includes intelligent status determination:

```typescript
function getStatusBadge(status: string, due: string) {
  const dueDate = new Date(due);
  const now = new Date();

  if (status === 'MARKS_RELEASED') {
    return { text: 'Marked', color: 'bg-green-500' };
  } else if (dueDate < now) {
    return { text: 'Overdue', color: 'bg-red-500' };
  } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return { text: 'Due Soon', color: 'bg-yellow-500' };
  } else {
    return { text: 'Upcoming', color: 'bg-blue-500' };
  }
}
```

### Visual Design Features

- **Subject Color Border**: Left border matches subject color
- **Hover Effects**: Subtle scale animation (`hover:scale-[1.02]`)
- **Glass Morphism**: Backdrop blur with transparency
- **Responsive Text**: Truncated titles to prevent overflow
- **Status Indicators**: Color-coded status badges

### Usage Examples

```svelte
<!-- Basic assessment card -->
<AssessmentCard {assessment} />

<!-- Assessment card with subject display -->
<AssessmentCard {assessment} showSubject={true} />

<!-- In a list context -->
{#each assessments as assessment}
  <AssessmentCard {assessment} showSubject={groupBy !== 'subject'} />
{/each}
```

## 📊 Assessment View Components

### AssessmentListView

Displays assessments in a grouped list format organized by subject.

#### Features
- **Subject Grouping**: Assessments grouped by subject with headers
- **Active Subject Indicators**: Shows which subjects are currently active
- **Smooth Scrolling**: Navigation links with smooth scroll behavior
- **Highlight Animation**: Visual feedback when navigating to subjects

#### Implementation
```typescript
interface Props {
  assessments: Assessment[];
  subjects: Subject[];
  activeSubjects: Subject[];
}

// Scroll to specific subject
function scrollToSubject(event: MouseEvent, subjectCode: string) {
  event.preventDefault();
  const element = document.getElementById(`subject-${subjectCode}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.classList.add('highlight-subject');
    setTimeout(() => element.classList.remove('highlight-subject'), 1500);
  }
}
```

### AssessmentBoardView

Kanban-style board view with customizable grouping options.

#### Grouping Options
- **By Subject**: Columns for each subject
- **By Month**: Columns for each month
- **By Status**: Columns for different status types

#### Features
```typescript
interface Props {
  assessments: Assessment[];
  subjects: Subject[];
  activeSubjects: Subject[];
  groupBy: 'subject' | 'month' | 'status';
  onGroupByChange: (group: 'subject' | 'month' | 'status') => void;
}

// Month grouping logic
function getAssessmentsByMonth() {
  const grouped = new Map<string, Assessment[]>();
  assessments.forEach((assessment) => {
    const date = new Date(assessment.due);
    const monthKey = getMonthName(date);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)?.push(assessment);
  });
  return Array.from(grouped.entries()).sort((a, b) => {
    const dateA = new Date(a[0]);
    const dateB = new Date(b[0]);
    return dateA.getTime() - dateB.getTime();
  });
}
```

### AssessmentCalendarView

Calendar-based view showing assessments on their due dates.

#### Features
- **Monthly Navigation**: Previous/next month controls
- **Date-based Filtering**: Shows assessments for specific dates
- **Color Coding**: Assessment dots match subject colors
- **Responsive Grid**: Adapts to different screen sizes

#### Implementation
```typescript
interface Props {
  assessments: Assessment[];
}

// Get assessments for specific date
function getAssessmentsForDate(date: Date) {
  return assessments.filter((a) => {
    const assessmentDate = new Date(a.due);
    return (
      assessmentDate.getDate() === date.getDate() &&
      assessmentDate.getMonth() === date.getMonth() &&
      assessmentDate.getFullYear() === date.getFullYear()
    );
  });
}

// Color utility functions
function hexToRgb(hex: string) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map((x) => x + x).join('');
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function isColorLight(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
```

## 🎯 Assessment Detail Components

### AssessmentDetails

Displays detailed marking information and teacher feedback.

#### Interface
```typescript
interface Criterion {
  results?: {
    grade?: string;
    percentage?: number;
  };
}

interface Engagement {
  feedbackComment?: string;
}

interface AssessmentData {
  marked?: boolean;
  criteria?: Criterion[];
  engagement?: Engagement;
}
```

#### Features
- **Grade Visualization**: Animated progress bar showing percentage
- **Teacher Feedback**: Formatted feedback comments
- **Empty States**: Appropriate messaging for ungraded assessments
- **Responsive Design**: Adapts to different screen sizes

### AssessmentOverview

Shows assessment description and attached resources.

#### Features
- **Rich Text Description**: HTML content support
- **Resource Display**: File attachments with metadata
- **Empty States**: Helpful messaging when no content available

### AssessmentSubmissions

Manages student file submissions for assessments.

#### Interface
```typescript
interface Submission {
  filename: string;
  mimetype: string;
  size: string;
  uuid?: string;
  created_date?: string;
  staff?: boolean;
  created_by?: number;
}

interface Props {
  submissions: Submission[];
  assessmentId: number;
  metaclassId: number;
  onUploadComplete?: () => void;
}
```

#### Features
- **File Upload**: Drag-and-drop or click to upload
- **File Management**: View and manage submitted files
- **Student vs Staff Files**: Filters to show only student submissions
- **Upload Progress**: Visual feedback during file uploads

## 📁 File Management Components

### FileUploadButton

Handles file selection and upload process.

#### Implementation
```typescript
async function handleFileUpload() {
  uploading = true;
  uploadError = '';

  try {
    // Open file dialog
    const selected = await open({
      multiple: true,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });

    if (!selected) return;

    const files = Array.isArray(selected) ? selected : [selected];

    for (const filePath of files) {
      const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
      
      // Upload file
      const uploadResponse = await uploadSeqtaFile(fileName, filePath);
      const uploadResult = JSON.parse(uploadResponse);
      
      if (uploadResult.status === '200' && uploadResult.payload) {
        // Link to assessment
        const linkResponse = await seqtaFetch('/seqta/student/assessment/submissions/save', {
          method: 'POST',
          body: {
            action: 'link',
            assID: assessmentId,
            metaclass: metaclassId,
            files: [uploadResult.payload.id]
          },
        });
        
        if (linkResult.status === '200' && onUploadComplete) {
          onUploadComplete();
        }
      }
    }
  } catch (e) {
    uploadError = e instanceof Error ? e.message : 'Upload failed';
  } finally {
    uploading = false;
  }
}
```

### FileCard

Displays individual file information with download/preview options.

## 🎨 Navigation Components

### AssessmentViewTabs

Provides view switching between List, Board, and Calendar views.

```typescript
type ViewType = 'list' | 'board' | 'calendar';

interface Props {
  selectedTab: ViewType;
  onTabChange: (tab: ViewType) => void;
}
```

### AssessmentTabs

Tab navigation within individual assessment pages.

```typescript
interface Tab {
  id: string;      // Tab identifier
  label: string;   // Display name
  icon: string;    // Emoji or icon
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}
```

### AssessmentHeader

Simple navigation header with back button.

```svelte
<div class="flex sticky top-0 z-10 gap-4 items-center px-6 py-4 bg-opacity-80 border-b backdrop-blur-sm">
  <a href="/assessments" class="flex gap-2 items-center transition-colors duration-200">
    <Icon src={ArrowLeft} class="w-5 h-5" />
    <span>Back to Assessments</span>
  </a>
</div>
```

## 🤖 AI-Powered Components

### GradePredictions

Uses AI to predict grades based on assessment history.

#### Features
- **Machine Learning Integration**: Uses Gemini AI service
- **Historical Analysis**: Analyzes past performance patterns
- **Subject-specific Predictions**: Tailored predictions per subject
- **Confidence Scoring**: Provides prediction confidence levels

#### Implementation
```typescript
async function generateGradePredictions() {
  generatingPredictions = true;
  predictionError = null;

  try {
    // Filter assessments for selected year
    const yearAssessments = assessments.filter((a: any) => {
      const assessmentYear = new Date(a.due).getFullYear();
      return assessmentYear === selectedYear;
    });

    // Add final grades to marked assessments
    const assessmentsWithGrades = yearAssessments.map((a: any) => {
      let finalGrade = undefined;
      if (a.status === 'MARKS_RELEASED') {
        if (a.criteria && a.criteria[0]?.results?.percentage !== undefined) {
          finalGrade = a.criteria[0].results.percentage;
        } else if (a.results && a.results.percentage !== undefined) {
          finalGrade = a.results.percentage;
        }
      }
      return { ...a, finalGrade };
    });

    // Generate predictions using AI service
    const predictions = await GeminiService.generateGradePredictions(assessmentsWithGrades);
    gradePredictions = new Map(Object.entries(predictions));
  } catch (error) {
    predictionError = 'Failed to generate grade predictions';
  } finally {
    generatingPredictions = false;
  }
}
```

### GradeDistribution

Visualizes grade distribution across assessments.

#### Features
- **SVG-based Charts**: Custom line graphs using SVG
- **Grade Range Analysis**: Groups grades into ranges (A+, A, B+, etc.)
- **Color Coding**: Visual indicators for grade performance
- **Responsive Design**: Adapts to container size

## 📊 Dashboard Integration

### UpcomingAssessments

Dashboard widget showing upcoming assessments.

#### Features
- **Caching**: 1-hour cache for performance
- **Subject Filtering**: Toggle visibility by subject
- **Status Indicators**: Color-coded status badges
- **Date Sorting**: Chronological ordering

#### Data Loading
```typescript
async function loadAssessments() {
  loadingAssessments = true;

  try {
    // Check cache first
    const cachedData = cache.get('upcoming_assessments_data');
    if (cachedData) {
      upcomingAssessments = cachedData.assessments;
      activeSubjects = cachedData.subjects;
      subjectFilters = cachedData.filters;
      return;
    }

    // Parallel API calls
    const [assessmentsRes, classesRes] = await Promise.all([
      seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        body: { student: studentId },
      }),
      seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        body: {},
      }),
    ]);

    // Process and filter data
    const colours = await loadLessonColours();
    const classesResJson = JSON.parse(classesRes);
    const activeClass = classesResJson.payload.find((c: any) => c.active);
    activeSubjects = activeClass ? activeClass.subjects : [];

    // Apply subject colors and filtering
    upcomingAssessments = JSON.parse(assessmentsRes)
      .payload.filter((a: any) => activeCodes.includes(a.code))
      .filter((a: any) => new Date(a.due) >= new Date())
      .map((a: any) => {
        const prefName = `timetable.subject.colour.${a.code}`;
        const c = colours.find((p: any) => p.name === prefName);
        a.colour = c ? c.value : '#8e8e8e';
        return a;
      })
      .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));

    // Cache results
    cache.set('upcoming_assessments_data', {
      assessments: upcomingAssessments,
      subjects: activeSubjects,
      filters: subjectFilters,
    }, 60);
  } catch (e) {
    console.error('Error loading assessments:', e);
  } finally {
    loadingAssessments = false;
  }
}
```

## 🔄 Data Flow & State Management

### Assessment Data Structure

```typescript
interface Assessment {
  id: number;              // Unique identifier
  title: string;           // Assessment name
  code: string;            // Subject code
  due: string;             // Due date (ISO string)
  status: string;          // Current status
  colour: string;          // Subject color
  metaclass: number;       // Metaclass ID
  programmeID?: number;    // Programme identifier
  graded?: boolean;        // Whether graded
  overdue?: boolean;       // Overdue status
  hasFeedback?: boolean;   // Has teacher feedback
  finalGrade?: number;     // Final grade percentage
  criteria?: Criterion[];  // Grading criteria
  resources?: Resource[];  // Attached resources
  submissions?: Submission[]; // Student submissions
}
```

### API Integration

#### Assessment List Endpoint
```typescript
// Load upcoming assessments
const response = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: { student: studentId },
});
```

#### Assessment Details Endpoint
```typescript
// Load specific assessment details
const response = await seqtaFetch('/seqta/student/assessment/get?', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: {
    assessment: parseInt(assessmentId),
    student: 69,
    metaclass: parseInt(metaclassId),
  },
});
```

#### Submission Management
```typescript
// Load submissions
const subRes = await seqtaFetch('/seqta/student/assessment/submissions/get?', {
  method: 'POST',
  body: {
    assessment: parseInt(assessmentId),
    student: 69,
    metaclass: parseInt(metaclassId),
  },
});

// Save submission
const linkResponse = await seqtaFetch('/seqta/student/assessment/submissions/save', {
  method: 'POST',
  body: {
    action: 'link',
    assID: assessmentId,
    metaclass: metaclassId,
    files: [fileId]
  },
});
```

## 🎨 Styling & Theming

### Consistent Design Language

All assessment components follow the application's design system:

#### Color Scheme
- **Subject Colors**: Dynamic border colors from subject preferences
- **Status Colors**: Consistent color coding across components
  - Green: Marked/Completed
  - Red: Overdue
  - Yellow: Due Soon
  - Blue: Upcoming

#### Animation & Transitions
```css
/* Hover effects */
.hover\:scale-\[1\.02\]:hover {
  transform: scale(1.02);
}

/* Fade-in animation */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
```

#### Glass Morphism Effects
```css
/* Backdrop blur with transparency */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

.bg-white\/80 {
  background-color: rgb(255 255 255 / 0.8);
}

.dark\:bg-slate-900\/50:is(.dark *) {
  background-color: rgb(15 23 42 / 0.5);
}
```

## 🔧 Best Practices

### Component Usage

#### Assessment Card Implementation
```svelte
<!-- Always provide required props -->
<AssessmentCard {assessment} />

<!-- Conditional subject display -->
<AssessmentCard {assessment} showSubject={!groupedBySubject} />

<!-- In responsive contexts -->
<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {#each assessments as assessment}
    <AssessmentCard {assessment} />
  {/each}
</div>
```

#### View Management
```svelte
<!-- Consistent view switching -->
<AssessmentViewTabs 
  selectedTab={currentView} 
  onTabChange={(tab) => currentView = tab} 
/>

<!-- Conditional rendering based on view -->
{#if currentView === 'list'}
  <AssessmentListView {assessments} {subjects} {activeSubjects} />
{:else if currentView === 'board'}
  <AssessmentBoardView {assessments} {subjects} {activeSubjects} {groupBy} {onGroupByChange} />
{:else if currentView === 'calendar'}
  <AssessmentCalendarView {assessments} />
{/if}
```

### Performance Optimization

#### Caching Strategy
- **API Response Caching**: 1-hour cache for assessment lists
- **Subject Color Caching**: Cache color preferences
- **Image Optimization**: Lazy loading for file previews

#### Efficient Filtering
```typescript
// Use derived stores for reactive filtering
const filteredAssessments = $derived(
  assessments.filter((a: any) => {
    const assessmentYear = new Date(a.due).getFullYear();
    return assessmentYear === selectedYear && subjectFilters[a.code];
  })
);
```

### Error Handling

#### Graceful Degradation
```typescript
try {
  const response = await seqtaFetch('/api/assessments');
  assessments = JSON.parse(response).payload;
} catch (error) {
  console.error('Failed to load assessments:', error);
  // Show error state
  showError = true;
  errorMessage = 'Unable to load assessments. Please try again.';
}
```

#### Empty States
```svelte
{#if assessments.length === 0}
  <div class="flex flex-col items-center justify-center py-12">
    <Icon src={DocumentText} class="w-16 h-16 text-slate-400 mb-4" />
    <h3 class="text-lg font-semibold mb-2">No Assessments Found</h3>
    <p class="text-slate-600 dark:text-slate-400">
      There are no assessments to display for the selected criteria.
    </p>
  </div>
{/if}
```

## 🚀 Future Enhancements

### Planned Features
- **Offline Support**: Cache assessments for offline viewing
- **Push Notifications**: Reminders for due assessments
- **Bulk Operations**: Select multiple assessments for actions
- **Advanced Filtering**: More granular filtering options
- **Export Functionality**: Export assessment data to various formats

### Performance Improvements
- **Virtual Scrolling**: For large assessment lists
- **Image Lazy Loading**: Optimize file preview loading
- **Bundle Splitting**: Separate assessment code from main bundle

---

**Related Documentation:**
- [Layout Components](./layout.md) - Header and navigation integration
- [Data Components](./data.md) - Charts and visualization components
- [Frontend Architecture](../frontend/README.md) - Overall application structure
- [Theme System](../frontend/theme-system.md) - Styling and theming 