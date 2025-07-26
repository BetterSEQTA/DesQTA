<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import SubjectSidebar from './components/SubjectSidebar.svelte';
  import ScheduleSidebar from './components/ScheduleSidebar.svelte';
  import CourseContent from './components/CourseContent.svelte';
  import type {
    Subject,
    Folder,
    CoursePayload,
    ParsedDocument,
    Lesson,
    TermSchedule,
    WeeklyLessonContent,
  } from './types';

  let folders: Folder[] = $state([]);
  let activeSubjects: Subject[] = $state([]);
  let otherFolders: Folder[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  let expandedFolders: Record<string, boolean> = $state({});
  let selectedSubject: Subject | null = $state(null);
  let coursePayload: CoursePayload | null = $state(null);
  let parsedDocument: ParsedDocument | null = $state(null);
  let loadingCourse = $state(false);
  let courseError: string | null = $state(null);
  let search = $state('');

  // Schedule navigation state
  let selectedLesson: Lesson | null = $state(null);
  let selectedLessonContent: WeeklyLessonContent | null = $state(null);
  let showingOverview = $state(true); // Start with overview by default
  let isMobile = $state(false);
  let showSubjectSidebar = $state(true);
  let showScheduleSidebar = $state(true);

  async function loadSubjects() {
    loading = true;
    error = null;
    try {
      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const data = JSON.parse(res);
      folders = data.payload;
      const activeFolder = folders.find((f: Folder) => f.active === 1);
      activeSubjects = activeFolder ? activeFolder.subjects : [];
      otherFolders = folders.filter((f: Folder) => f.active !== 1);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function loadCourseContent(subject: Subject) {
    loadingCourse = true;
    courseError = null;
    coursePayload = null;
    parsedDocument = null;
    selectedLesson = null;
    selectedLessonContent = null;

    try {
      const res = await seqtaFetch('/seqta/student/load/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          programme: subject.programme.toString(),
          metaclass: subject.metaclass.toString(),
        },
      });
      const data = JSON.parse(res);
      coursePayload = data.payload;

      // Parse the main document JSON string
      if (coursePayload?.document) {
        try {
          parsedDocument = JSON.parse(coursePayload.document);
        } catch (e) {
          console.error('Failed to parse document JSON:', e);
        }
      }
    } catch (e) {
      courseError = e instanceof Error ? e.message : String(e);
    } finally {
      loadingCourse = false;
    }
  }

  async function selectSubject(subject: Subject) {
    selectedSubject = subject;
    showingOverview = true; // Reset to overview when selecting a new subject
    selectedLesson = null;
    selectedLessonContent = null;
    await loadCourseContent(subject);
  }

  function selectLesson(termSchedule: TermSchedule, lesson: Lesson, lessonIndex: number) {
    selectedLesson = lesson;
    showingOverview = false;

    // Find the corresponding weekly lesson content
    if (coursePayload?.w?.[termSchedule.n]?.[lessonIndex]) {
      selectedLessonContent = coursePayload.w[termSchedule.n][lessonIndex];
    } else {
      selectedLessonContent = null;
    }
  }

  function selectOverview() {
    showingOverview = true;
    selectedLesson = null;
    selectedLessonContent = null;
  }

  function subjectMatches(subj: Subject) {
    const q = search.trim().toLowerCase();
    return (
      subj.title.toLowerCase().includes(q) ||
      subj.code.toLowerCase().includes(q) ||
      subj.description.toLowerCase().includes(q)
    );
  }

  function folderMatches(folder: Folder) {
    const q = search.trim().toLowerCase();
    return folder.code.toLowerCase().includes(q) || folder.subjects.some(subjectMatches);
  }

  // Event handlers with proper typing
  function handleSelectSubject(event: CustomEvent<Subject>) {
    selectSubject(event.detail);
    // Close subject sidebar on mobile when subject is selected
    if (isMobile) {
      showSubjectSidebar = false;
    }
  }

  function handleToggleFolder(event: CustomEvent<string>) {
    expandedFolders[event.detail] = !expandedFolders[event.detail];
  }

  function handleSelectLesson(data: {
    termSchedule: TermSchedule;
    lesson: Lesson;
    lessonIndex: number;
  }) {
    selectLesson(data.termSchedule, data.lesson, data.lessonIndex);
    // Close schedule sidebar on mobile when lesson is selected
    if (isMobile) {
      showScheduleSidebar = false;
    }
  }

  function handleSelectOverview() {
    selectOverview();
    // Close schedule sidebar on mobile when overview is selected
    if (isMobile) {
      showScheduleSidebar = false;
    }
  }

  function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get('code'),
      date: params.get('date'),
    };
  }

  async function autoSelectFromQuery() {
    const { code, date } = getQueryParams();
    if (!code || !date) return;
    // Find the subject by code
    const subject = activeSubjects.find((s) => s.code === code);
    if (!subject) return;
    // Load course content for the subject
    loadingCourse = true;
    courseError = null;
    coursePayload = null;
    parsedDocument = null;
    selectedLesson = null;
    selectedLessonContent = null;
    try {
      const res = await seqtaFetch('/seqta/student/load/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {
          programme: subject.programme.toString(),
          metaclass: subject.metaclass.toString(),
        },
      });
      const data = JSON.parse(res);
      coursePayload = data.payload;
      if (coursePayload?.document) {
        try {
          parsedDocument = JSON.parse(coursePayload.document);
        } catch (e) {
          console.error('Failed to parse document JSON:', e);
        }
      }
      // Find the lesson closest to the date
      if (coursePayload?.d && coursePayload?.w) {
        let closest: {
          termSchedule: TermSchedule | null;
          lesson: Lesson | null;
          lessonIndex: number;
          diff: number;
        } = {
          termSchedule: null,
          lesson: null,
          lessonIndex: -1,
          diff: Infinity,
        };
        const targetDate = new Date(date);
        coursePayload.d.forEach((termSchedule, termIdx) => {
          termSchedule.l.forEach((lesson, lessonIndex) => {
            const lessonDate = new Date(lesson.d);
            const diff = Math.abs(lessonDate.getTime() - targetDate.getTime());
            if (diff < closest.diff) {
              closest = { termSchedule, lesson, lessonIndex, diff };
            }
          });
        });
        if (closest.lesson && closest.termSchedule) {
          selectedSubject = subject;
          selectLesson(closest.termSchedule, closest.lesson, closest.lessonIndex);
        }
      }
    } catch (e) {
      courseError = e instanceof Error ? e.message : String(e);
    } finally {
      loadingCourse = false;
    }
  }

  onMount(() => {
    loadSubjects();
    autoSelectFromQuery();
    
    // Check for mobile on mount and resize
    const checkMobile = () => {
      const tauri_platform = import.meta.env.TAURI_ENV_PLATFORM
      if (tauri_platform == "ios" || tauri_platform == "android") {
        isMobile = true
      } else {
        isMobile = false
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });
</script>

<div class="flex w-full h-full overflow-y-hidden">
  <!-- Mobile Toggle Buttons -->
  {#if isMobile}
    <div class="fixed top-4 left-4 z-50 flex gap-2">
      <button
        onclick={() => showSubjectSidebar = !showSubjectSidebar}
        class="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 shadow-lg"
        aria-label="Toggle subjects sidebar"
      >
        📚
      </button>
      {#if selectedSubject}
        <button
          onclick={() => showScheduleSidebar = !showScheduleSidebar}
          class="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 shadow-lg"
          aria-label="Toggle schedule sidebar"
        >
          📅
        </button>
      {/if}
    </div>
  {/if}

  <!-- Subject Selection Sidebar -->
      {#if !isMobile || showSubjectSidebar}
      <SubjectSidebar
        bind:search
        {loading}
        {error}
        {activeSubjects}
        {otherFolders}
        {selectedSubject}
        {expandedFolders}
        on:selectSubject={handleSelectSubject}
        on:toggleFolder={handleToggleFolder}
        on:close={() => showSubjectSidebar = false} />
    {/if}

  <!-- Course Content Area -->
  <div class="flex flex-1 h-full">
    {#if selectedSubject}
      {#if loadingCourse}
        <div class="flex justify-center items-center w-full">
          <div class="text-lg text-slate-600 dark:text-slate-400">Loading course content...</div>
        </div>
      {:else if courseError}
        <div class="flex justify-center items-center w-full">
          <div class="text-lg text-red-500 dark:text-red-400">
            Error loading course: {courseError}
          </div>
        </div>
      {:else if coursePayload}
        <!-- Schedule Navigation -->
        {#if !isMobile || showScheduleSidebar}
          <ScheduleSidebar
            schedule={coursePayload.d}
            {selectedLesson}
            {showingOverview}
            {coursePayload}
            onSelectLesson={handleSelectLesson}
            onSelectOverview={handleSelectOverview}
            onClose={() => showScheduleSidebar = false} />
        {/if}

        <!-- Main Content -->
        <CourseContent {coursePayload} {parsedDocument} {selectedLessonContent} {showingOverview} />
      {:else}
        <div class="flex justify-center items-center w-full">
          <div class="text-lg text-slate-600 dark:text-slate-400">No course content available</div>
        </div>
      {/if}
    {:else}
      <div class="flex justify-center items-center w-full">
        <div class="text-lg text-slate-600 dark:text-slate-400">
          Select a subject to view course content
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.course-content) {
    @apply w-full h-full;
  }

  /* Style the course content to match the screenshot */
  :global(.course-content h1) {
    @apply text-3xl font-bold text-white bg-blue-500 p-6 rounded-t-xl m-4 mb-0;
  }

  :global(.course-content h2) {
    @apply text-xl font-bold text-white bg-blue-500 p-4 rounded-xl m-4 mb-2;
  }

  :global(.course-content p) {
    @apply text-slate-300 px-4 py-2;
  }

  :global(.course-content .section) {
    @apply m-4 bg-slate-800/50 rounded-xl overflow-hidden;
  }

  :global(.course-content a) {
    @apply text-blue-400 hover:text-blue-300 transition-colors;
  }

  :global(.course-content img) {
    @apply max-w-full h-auto rounded-lg;
  }

  /* File/document styling */
  :global(.course-content .file-item) {
    @apply bg-slate-700/50 rounded-lg p-4 m-2 hover:bg-slate-600/50 transition-colors cursor-pointer;
  }

  :global(.course-content .file-grid) {
    @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4;
  }

  /* Make embedded content responsive */
  :global(.course-content iframe) {
    @apply w-full rounded-lg;
  }

  :global(.course-content video) {
    @apply w-full rounded-lg;
  }
</style>
