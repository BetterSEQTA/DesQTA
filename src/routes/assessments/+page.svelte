<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { notify } from '../../utils/notify';
  import { invoke } from '@tauri-apps/api/core';
  import AssessmentViewTabs from '../../lib/components/AssessmentViewTabs.svelte';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import YearFilter from '../../lib/components/YearFilter.svelte';
  import GradePredictions from '../../lib/components/GradePredictions.svelte';
  import AssessmentBoardView from '../../lib/components/AssessmentBoardView.svelte';
  import AssessmentCalendarView from '../../lib/components/AssessmentCalendarView.svelte';
  import AssessmentListView from '../../lib/components/AssessmentListView.svelte';
  import LoadingSpinner from '../../lib/components/LoadingSpinner.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';

  const studentId = 69;

  let upcomingAssessments = $state<any[]>([]);
  let allSubjects = $state<any[]>([]);
  let activeSubjects = $state<any[]>([]);
  let lessonColours = $state<any[]>([]);
  let loadingAssessments = $state<boolean>(true);
  let selectedTab = $state<'list' | 'board' | 'calendar'>('list');
  let subjectFilters: Record<string, boolean> = {};
  let remindersEnabled = true;
  let groupBy = $state<'subject' | 'month' | 'status'>('subject');
  
  // Year filter state
  let selectedYear = $state<number>(new Date().getFullYear());
  let availableYears = $state<number[]>([]);

  let aiIntegrationsEnabled = $state(false);
  let gradeAnalyserEnabled = $state(true);

  const filteredAssessments = $derived(
    upcomingAssessments.filter((a: any) => {
      // Filter by year only
      const assessmentYear = new Date(a.due).getFullYear();
      if (assessmentYear !== selectedYear) return false;
      
      return true;
    }),
  );

  async function loadLessonColours() {
    // Check cache first
    const cachedColours = cache.get<any[]>('lesson_colours') || await getWithIdbFallback<any[]>('lesson_colours', 'lesson_colours', () => cache.get<any[]>('lesson_colours'));
    if (cachedColours) {
      lessonColours = cachedColours;
      return lessonColours;
    }

    const res = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { request: 'userPrefs', asArray: true, user: studentId },
    });
    lessonColours = JSON.parse(res).payload;
    // Cache for 10 minutes
    cache.set('lesson_colours', lessonColours, 10);
    await setIdb('lesson_colours', lessonColours);
    return lessonColours;
  }

  async function loadAssessments() {
    loadingAssessments = true;

    try {
      // Check cache first
      const cachedData = cache.get<{
        assessments: any[];
        subjects: any[];
        allSubjects: any[];
        filters: Record<string, boolean>;
        years: number[];
      }>('assessments_overview_data') || await getWithIdbFallback<{
        assessments: any[];
        subjects: any[];
        allSubjects: any[];
        filters: Record<string, boolean>;
        years: number[];
      }>('assessments_overview_data', 'assessments_overview_data', () => cache.get('assessments_overview_data'));

      if (cachedData) {
        upcomingAssessments = cachedData.assessments;
        activeSubjects = cachedData.subjects;
        allSubjects = cachedData.allSubjects;
        subjectFilters = cachedData.filters;
        availableYears = cachedData.years;
        loadingAssessments = false;
        return;
      }

      const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });

      const colours = await loadLessonColours();

      const classesResJson = JSON.parse(classesRes);
      const folders = classesResJson.payload;
      
      // Get all subjects from all folders
      allSubjects = folders.flatMap((f: any) => f.subjects);
      
      // Remove duplicate subjects by programme+metaclass
      const uniqueSubjectsMap = new Map();
      allSubjects.forEach((s: any) => {
        const key = `${s.programme}-${s.metaclass}`;
        if (!uniqueSubjectsMap.has(key)) uniqueSubjectsMap.set(key, s);
      });
      allSubjects = Array.from(uniqueSubjectsMap.values());

      // Get active subjects for default filters
      const activeFolder = folders.find((c: any) => c.active);
      activeSubjects = activeFolder ? activeFolder.subjects : [];

      // Initialize subject filters on first run - include all subjects
      allSubjects.forEach((s: any) => {
        if (!(s.code in subjectFilters)) {
          // Default to true for active subjects, false for others
          subjectFilters[s.code] = activeSubjects.some((as: any) => as.code === s.code);
        }
      });

      // Fetch upcoming assessments for current active subjects
      const assessmentsRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId },
      });

      // Fetch past assessments for every subject ever
      const pastAssessmentsPromises = allSubjects.map((subject) =>
        seqtaFetch('/seqta/student/assessment/list/past?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {
            programme: subject.programme,
            metaclass: subject.metaclass,
            student: studentId,
          },
        }),
      );

      const pastAssessmentsResponses = await Promise.all(pastAssessmentsPromises);
      const pastAssessments = pastAssessmentsResponses
        .map((res) => JSON.parse(res).payload.tasks || [])
        .flat();

      // Combine and process all assessments
      const allAssessments = [...JSON.parse(assessmentsRes).payload, ...pastAssessments];

      // Remove duplicates by id
      const uniqueAssessmentsMap = new Map();
      allAssessments.forEach((a: any) => {
        if (!uniqueAssessmentsMap.has(a.id)) {
          uniqueAssessmentsMap.set(a.id, a);
        }
      });
      const uniqueAssessments = Array.from(uniqueAssessmentsMap.values());

      // Process assessments and add colors
      upcomingAssessments = uniqueAssessments
        .map((a: any) => {
          const prefName = `timetable.subject.colour.${a.code}`;
          const c = colours.find((p: any) => p.name === prefName);
          a.colour = c ? c.value : '#8e8e8e';
          // Get the metaclass from the subject
          const subject = allSubjects.find((s: any) => s.code === a.code);
          a.metaclass = subject?.metaclass;
          return a;
        })
        .sort((a: any, b: any) => new Date(b.due).getTime() - new Date(a.due).getTime());

      // Extract available years from assessments
      const years = new Set<number>();
      upcomingAssessments.forEach((a: any) => {
        years.add(new Date(a.due).getFullYear());
      });
      availableYears = Array.from(years).sort((a, b) => b - a); // Sort descending

      // Cache all the data for 10 minutes
      cache.set(
        'assessments_overview_data',
        {
          assessments: upcomingAssessments,
          subjects: activeSubjects,
          allSubjects: allSubjects,
          filters: subjectFilters,
          years: availableYears,
        },
        10,
      );
      console.info('[IDB] assessments_overview_data cached (mem+idb)', { assessments: upcomingAssessments.length, subjects: activeSubjects.length });
      await setIdb('assessments_overview_data', {
        assessments: upcomingAssessments,
        subjects: activeSubjects,
        allSubjects: allSubjects,
        filters: subjectFilters,
        years: availableYears,
      });
    } catch (e) {
      console.error('Error loading assessments:', e);
    } finally {
      loadingAssessments = false;
    }
  }

  function scheduleAssessmentReminders(assessments: any[]) {
    if (!remindersEnabled) return;
    const now = Date.now();
    const scheduled = new Set(
      JSON.parse(localStorage.getItem('scheduledAssessmentReminders') || '[]'),
    );

    for (const a of assessments) {
      const due = new Date(a.due).getTime();
      const reminderTime = due - 24 * 60 * 60 * 1000; // 1 day before
      if (reminderTime > now && !scheduled.has(a.id)) {
        const timeout = reminderTime - now;
        setTimeout(() => {
          notify({
            title: 'Assessment Reminder',
            body: `${a.title} is due tomorrow!`,
          });
        }, timeout);
        scheduled.add(a.id);
      }
    }
    localStorage.setItem('scheduledAssessmentReminders', JSON.stringify(Array.from(scheduled)));
  }

  $effect(() => {
    if (upcomingAssessments.length) {
      scheduleAssessmentReminders(upcomingAssessments);
    }
  });

  function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      code: params.get('code'),
      date: params.get('date'),
    };
  }

  function highlightAssessmentFromQuery() {
    const { code, date } = getQueryParams();
    if (!code || !date) return;
    // Find the assessment with the matching code and closest due date
    let closest = null;
    let minDiff = Infinity;
    const targetDate = new Date(date);
    for (const a of upcomingAssessments) {
      if (a.code !== code) continue;
      const dueDate = new Date(a.due);
      const diff = Math.abs(dueDate.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        closest = a;
        minDiff = diff;
      }
    }
    if (closest) {
      // Try to find the DOM element for this assessment and scroll/highlight
      setTimeout(() => {
        const selector = `[data-assessment-id="${closest.id}"]`;
        const el = document.querySelector(selector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-subject');
          setTimeout(() => el.classList.remove('highlight-subject'), 1500);
        }
      }, 300);
    }
  }

  function handleTabChange(tab: 'list' | 'board' | 'calendar') {
    selectedTab = tab;
  }

  function handleYearChange(year: number) {
    selectedYear = year;
  }

  function handleGroupByChange(group: 'subject' | 'month' | 'status') {
    groupBy = group;
  }

  onMount(async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', { keys: ['ai_integrations_enabled','grade_analyser_enabled'] });
      aiIntegrationsEnabled = subset?.ai_integrations_enabled ?? false;
      gradeAnalyserEnabled = subset?.grade_analyser_enabled ?? true;
    } catch (e) {
      aiIntegrationsEnabled = false;
      gradeAnalyserEnabled = true;
    }
    await loadAssessments();
    highlightAssessmentFromQuery();
  });
</script>

<div class="p-4 space-y-6 sm:p-6">
  <div class="flex flex-col gap-4 justify-between items-start sm:flex-row sm:items-center">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Assessments</h1>
    <AssessmentViewTabs 
      selectedTab={selectedTab}
      onTabChange={handleTabChange}
    />
  </div>

  <!-- Year Filter -->
  <YearFilter 
    {availableYears}
    {selectedYear}
    onYearChange={handleYearChange}
  />

  <!-- Grade Predictions Section -->
  <GradePredictions 
    assessments={upcomingAssessments}
    {selectedYear}
    {aiIntegrationsEnabled}
    {gradeAnalyserEnabled}
    showInView="list"
    currentView={selectedTab}
  />

  {#if loadingAssessments}
    <LoadingSpinner message="Loading assessments..." />
  {:else if filteredAssessments.length === 0}
    <EmptyState 
      title="No assessments for {selectedYear}!"
      message="Try selecting a different year."
      icon="🎉"
    />
  {:else if selectedTab === 'board'}
    <AssessmentBoardView 
      assessments={filteredAssessments}
      subjects={allSubjects}
      {activeSubjects}
      {groupBy}
      onGroupByChange={handleGroupByChange}
    />
  {:else if selectedTab === 'calendar'}
    <AssessmentCalendarView 
      assessments={filteredAssessments}
    />
  {:else}
    <AssessmentListView 
      assessments={filteredAssessments}
      subjects={allSubjects}
      {activeSubjects}
    />
  {/if}
</div>


