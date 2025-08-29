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
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';

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
      const cacheKey = 'courses_subjects_folders';
      const cached = cache.get<Folder[]>(cacheKey) || await getWithIdbFallback<Folder[]>(cacheKey, cacheKey, () => cache.get<Folder[]>(cacheKey));
      if (cached) {
        folders = cached;
        const activeFolder = folders.find((f: Folder) => f.active === 1);
        activeSubjects = activeFolder ? activeFolder.subjects : [];
        otherFolders = folders.filter((f: Folder) => f.active !== 1);
        loading = false;
        return;
      }

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

      cache.set(cacheKey, folders, 60);
      console.info('[IDB] courses folders cached (mem+idb)', { count: folders.length });
      await setIdb(cacheKey, folders);
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
      const cacheKey = `course_${subject.programme}_${subject.metaclass}`;
      const cached = cache.get<CoursePayload>(cacheKey) || await getWithIdbFallback<CoursePayload>(cacheKey, cacheKey, () => cache.get<CoursePayload>(cacheKey));
      if (cached) {
        coursePayload = cached;
        if (coursePayload?.document) {
          try { parsedDocument = JSON.parse(coursePayload.document); } catch {}
        }
        loadingCourse = false;
        return;
      }

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
      cache.set(cacheKey, coursePayload, 60);
      console.info('[IDB] course payload cached (mem+idb)', { key: cacheKey });
      await setIdb(cacheKey, coursePayload);
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

<div class="flex w-full h-full overflow-y-hidden transition-colors duration-200">
  <!-- Mobile Toggle Buttons -->
  {#if isMobile}
    <div class="fixed top-4 left-4 z-50 flex gap-2">
      <button
        onclick={() => (showSubjectSidebar = !showSubjectSidebar)}
        class="px-3 py-2 rounded-lg bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-white hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 shadow-md"
        aria-label="Toggle subjects sidebar"
      >
        📚
      </button>
      {#if selectedSubject}
        <button
          onclick={() => (showScheduleSidebar = !showScheduleSidebar)}
          class="px-3 py-2 rounded-lg bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-white hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 shadow-md"
          aria-label="Toggle schedule sidebar"
        >
          📅
        </button>
      {/if}
    </div>
  {/if}

  <!-- Subject Selection Sidebar -->
  {#if !isMobile || showSubjectSidebar}
    <div class="h-full border-r border-gray-200 dark:border-gray-700 transition-all duration-200">
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
        on:close={() => (showSubjectSidebar = false)}
      />
    </div>
  {/if}

  <!-- Course Content Area -->
  <div class="flex flex-1 h-full">
    {#if selectedSubject}
      {#if loadingCourse}
        <div class="flex justify-center items-center w-full p-6">
          <div class="text-lg text-gray-600 dark:text-gray-300">Loading course content...</div>
        </div>
      {:else if courseError}
        <div class="flex justify-center items-center w-full p-6">
          <div class="text-lg text-red-600 dark:text-red-400">Error loading course: {courseError}</div>
        </div>
      {:else if coursePayload}
        <!-- Schedule Navigation -->
        {#if !isMobile || showScheduleSidebar}
          <div class="h-full border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <ScheduleSidebar
              schedule={coursePayload.d}
              {selectedLesson}
              {showingOverview}
              {coursePayload}
              onSelectLesson={handleSelectLesson}
              onSelectOverview={handleSelectOverview}
              onClose={() => (showScheduleSidebar = false)}
            />
          </div>
        {/if}

        <!-- Main Content -->
        <div class="flex-1 overflow-y-auto">
          <div class="p-4 md:p-6 lg:p-8">
            <div class="course-content border border-gray-200 dark:border-gray-700 rounded-lg shadow-md transition-colors duration-200">
              <CourseContent {coursePayload} {parsedDocument} {selectedLessonContent} {showingOverview} />
            </div>
          </div>
        </div>
      {:else}
        <div class="flex justify-center items-center w-full p-6">
          <div class="text-lg text-gray-600 dark:text-gray-300">No course content available</div>
        </div>
      {/if}
    {:else}
      <div class="flex justify-center items-center w-full p-6">
        <div class="text-lg text-gray-600 dark:text-gray-300">Select a subject to view course content</div>
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.course-content) {
    width: 100%;
    height: 100%;
  }

  /* Headings styled with accent background and white text in dark mode */
  :global(.course-content h1) {
    font-size: 1.875rem;
    line-height: 2.25rem;
    font-weight: 700;
    color: var(--text-color);
    padding: 1.5rem 1rem 0.75rem 1rem;
    margin: 0 1rem 0.25rem 1rem;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  :global(.course-content h2) {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    color: var(--text-color);
    padding: 0.75rem 1rem;
    margin: 0.5rem 1rem 0.5rem 1rem;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  :global(.course-content p) {
    color: var(--text-color);
    padding-left: 1rem;
    padding-right: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    line-height: 1.625;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  /* dark mode inherits text-color via theming */

  :global(.course-content .section) {
    margin: 1rem;
    background-color: transparent;
    border-radius: 0.75rem;
    overflow: hidden;
    border-width: 1px;
    border-color: rgb(229 231 235 / 0.3);
    box-shadow: none;
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  /* dark mode inherits transparent background via theming */

  :global(.course-content a) {
    color: var(--accent-color);
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-duration: 200ms;
  }

  :global(.course-content a:hover) {
    color: var(--accent-color-hover);
  }

  :global(.course-content img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }

  /* File/document styling */
  :global(.course-content .file-item) {
    border-width: 1px;
    border-color: rgb(229 231 235 / 0.3);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 0.5rem;
    cursor: pointer;
    transition-property: all;
    transition-duration: 200ms;
  }

  :global(.course-content .file-item:hover) {
    transform: scale(1.02);
    border-color: var(--accent-color);
  }

  /* dark mode inherits border via theming */

  :global(.course-content .file-grid) {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  @media (min-width: 768px) {
    :global(.course-content .file-grid) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    :global(.course-content .file-grid) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  /* Make embedded content responsive */
  :global(.course-content iframe) {
    width: 100%;
    border-radius: 0.5rem;
  }

  :global(.course-content video) {
    width: 100%;
    border-radius: 0.5rem;
  }
</style>
