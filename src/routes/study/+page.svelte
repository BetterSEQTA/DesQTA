<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { Icon, Calendar, Clock, MagnifyingGlass } from 'svelte-hero-icons';
  import { fly, fade, scale, slide } from 'svelte/transition';
  import { quintOut, cubicOut } from 'svelte/easing';
  import { studyTips } from './studytips';
  import NotesContainer from '$lib/components/notes/NotesContainer.svelte';
  import { Button, Input, Badge } from '$lib/components/ui';

  interface Subtask {
    id: string;
    title: string;
    completed: boolean;
  }

  interface TodoItem {
    id: string;
    title: string;
    description?: string | null;
    related_subject?: string | null;
    related_assessment?: string | null;
    due_date?: string | null; // YYYY-MM-DD
    due_time?: string | null; // HH:MM
    tags?: string[] | null;
    subtasks?: Subtask[] | null;
    completed: boolean;
    priority?: string | null; // low | medium | high
    created_at?: string | null;
    updated_at?: string | null;
  }

  type FilterKey = 'all' | 'today' | 'week' | 'completed';
  type SortKey = 'due' | 'priority' | 'updated';

  interface AssessmentItem {
    id: string;
    subject: string;
    title: string;
    due_date: string; // ISO date yyyy-mm-dd
    due_time?: string | null;
    status?: 'upcoming' | 'soon' | 'overdue';
    colour?: string;
  }

  // Subjects and assessments data for typeahead
  interface SubjectItem { code: string; title: string; programme: string | number; metaclass: string | number; colour?: string }
  interface FullAssessment { id: string | number; title: string; due: string; code: string; subject?: string; metaclass?: string | number; colour?: string }

  // Helpers to resolve subject code and colour
  function getSubjectCodeFromLabel(label?: string | null): string | null {
    if (!label) return null;
    const code = label.split(' — ')[0]?.trim();
    return code || null;
  }

  function chipStylesForCode(code?: string | null): string {
    if (!code) return '';
    const color = subjectColours[code] || '#8e8e8e';
    // Build rgba-like with hex alpha for bg/border while keeping text as full color
    // Convert #rrggbb to with alpha suffix
    const hex = color.startsWith('#') ? color : `#${color}`;
    const bg = `${hex}1A`;      // ~10% opacity
    const border = `${hex}66`;  // ~40% opacity
    return `background-color:${bg}; border-color:${border}; color:${hex};`;
  }

  let todos: TodoItem[] = [];
  let loading = true;
  let error: string | null = null;

  // UI state
  let filter: FilterKey = 'all';
  let sortBy: SortKey = 'due';
  let query = '';
  let editMode: Record<string, boolean> = {};
  
  // Animation state
  let deletingTasks: Set<string> = new Set();
  let completingTasks: Set<string> = new Set();

  // Tabs
  type TabKey = 'tasks' | 'notes';
  let activeTab: TabKey = 'tasks';

  // Upcoming assessments state (real data)
  let upcomingAssessments: AssessmentItem[] = [];
  let loadingAssessments = true;

  // SEQTA data stores
  let subjects: SubjectItem[] = [];
  let subjectColours: Record<string, string> = {};
  let assessmentsAll: FullAssessment[] = [];

  // Per-task typeahead states
  let subjectQuery: Record<string, string> = {};
  let showSubjectDropdown: Record<string, boolean> = {};
  let assessmentQuery: Record<string, string> = {};
  let showAssessmentDropdown: Record<string, boolean> = {};

  function computeStatusISO(dueISO: string): 'upcoming' | 'soon' | 'overdue' {
    const now = new Date();
    const due = new Date(dueISO);
    const diff = due.getTime() - now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (diff < 0) return 'overdue';
    if (diff <= 3 * dayMs) return 'soon';
    return 'upcoming';
  }

  async function loadSubjectsAndColours() {
    // Cache subjects
    const cachedSubjects = cache.get<SubjectItem[]>('seqta_subjects_all');
    const cachedColours = cache.get<Record<string, string>>('lesson_colours_map');
    if (cachedSubjects) subjects = cachedSubjects;
    if (cachedColours) subjectColours = cachedColours;
    if (cachedSubjects && cachedColours) return;

    const studentId = 69;
    const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: {}
    });
    const prefsRes = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: { request: 'userPrefs', asArray: true, user: studentId }
    });

    const classesJson = JSON.parse(classesRes);
    const folders = classesJson.payload;
    // flatten and dedupe by programme+metaclass
    const all: SubjectItem[] = folders.flatMap((f: any) => f.subjects).map((s: any) => ({ code: s.code, title: s.title, programme: s.programme, metaclass: s.metaclass }));
    const map = new Map<string, SubjectItem>();
    for (const s of all) {
      const key = `${s.programme}-${s.metaclass}`;
      if (!map.has(key)) map.set(key, s);
    }
    subjects = Array.from(map.values());
    cache.set('seqta_subjects_all', subjects, 10 * 60 * 1000);

    // colours
    const colours = JSON.parse(prefsRes).payload as any[];
    subjectColours = {};
    for (const p of colours) {
      if (typeof p.name === 'string' && p.name.startsWith('timetable.subject.colour.')) {
        const code = p.name.split('timetable.subject.colour.')[1];
        subjectColours[code] = p.value;
      }
    }
    cache.set('lesson_colours_map', subjectColours, 10 * 60 * 1000);
  }

  async function loadAllAssessments() {
    // Check cache
    const cached = cache.get<FullAssessment[]>('seqta_all_assessments_flat');
    if (cached) { assessmentsAll = cached; return; }

    const studentId = 69;
    // upcoming for all
    const upcomingRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: { student: studentId }
    });
    const upcoming = JSON.parse(upcomingRes).payload as any[];

    // load subjects list if not loaded for past requests
    if (!subjects.length) await loadSubjectsAndColours();

    // past per subject
    const pastPromises = subjects.map((s) => seqtaFetch('/seqta/student/assessment/list/past?', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { programme: s.programme, metaclass: s.metaclass, student: studentId }
    }));
    const pastResponses = await Promise.all(pastPromises);
    const past = pastResponses.map((res) => JSON.parse(res).payload.tasks || []).flat();

    // combine + dedupe by id, enrich with colours
    const allCombined = [...upcoming, ...past];
    const dedupMap = new Map<string | number, any>();
    for (const a of allCombined) {
      if (!dedupMap.has(a.id)) dedupMap.set(a.id, a);
    }
    const list = Array.from(dedupMap.values()) as any[];
    assessmentsAll = list.map((a: any) => {
      const color = subjectColours[a.code] || '#8e8e8e';
      return { id: a.id, title: a.title, due: a.due, code: a.code, subject: a.subject, metaclass: a.metaclass, colour: color } as FullAssessment;
    }).sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

    cache.set('seqta_all_assessments_flat', assessmentsAll, 10 * 60 * 1000);
  }

  async function loadUpcomingAssessments() {
    loadingAssessments = true;
    try {
      const cacheKey = 'upcoming_assessments_data';
      const cached = cache.get<{ assessments: any[]; subjects: any[]; filters: Record<string, boolean> }>(cacheKey);
      if (cached && Array.isArray(cached.assessments)) {
        upcomingAssessments = cached.assessments
          .filter((a: any) => new Date(a.due) >= new Date())
          .map((a: any) => {
            const d = new Date(a.due);
            const due_date = d.toISOString().split('T')[0];
            const due_time = a.due?.includes('T') ? a.due.split('T')[1]?.substring(0, 5) : null;
            return {
              id: a.id?.toString() ?? crypto.randomUUID(),
              subject: a.subject ?? a.code ?? '—',
              title: a.title ?? 'Assessment',
              due_date,
              due_time,
              status: computeStatusISO(a.due),
              colour: a.colour ?? '#8e8e8e',
            } as AssessmentItem;
          })
          .sort((a: AssessmentItem, b: AssessmentItem) => new Date(`${a.due_date}T${a.due_time ?? '00:00'}:00`).getTime() - new Date(`${b.due_date}T${b.due_time ?? '00:00'}:00`).getTime())
          .slice(0, 5);
      } else {
        // Fallback to live fetch if no cache
        const studentId = 69;
        const [assessmentsRes, classesRes] = await Promise.all([
          seqtaFetch('/seqta/student/assessment/list/upcoming?', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: { student: studentId },
          }),
          seqtaFetch('/seqta/student/load/subjects?', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {},
          }),
        ]);

        const prefsRes = await seqtaFetch('/seqta/student/load/prefs?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: { request: 'userPrefs', asArray: true, user: studentId },
        });
        const colours = JSON.parse(prefsRes).payload;

        const classesJson = JSON.parse(classesRes);
        const activeClass = classesJson.payload.find((c: any) => c.active);
        const activeSubjects = activeClass ? activeClass.subjects : [];
        const activeCodes = activeSubjects.map((s: any) => s.code);

        const rawAssessments = JSON.parse(assessmentsRes).payload as any[];
        const filtered = rawAssessments
          .filter((a: any) => activeCodes.includes(a.code))
          .filter((a: any) => new Date(a.due) >= new Date())
          .map((a: any) => {
            const prefName = `timetable.subject.colour.${a.code}`;
            const c = colours.find((p: any) => p.name === prefName);
            const d = new Date(a.due);
            const due_date = d.toISOString().split('T')[0];
            const due_time = a.due?.includes('T') ? a.due.split('T')[1]?.substring(0, 5) : null;
            return {
              id: a.id?.toString() ?? crypto.randomUUID(),
              subject: a.subject ?? a.code ?? '—',
              title: a.title ?? 'Assessment',
              due_date,
              due_time,
              status: computeStatusISO(a.due),
              colour: c ? c.value : '#8e8e8e',
            } as AssessmentItem;
          })
          .sort((a: AssessmentItem, b: AssessmentItem) => new Date(`${a.due_date}T${a.due_time ?? '00:00'}:00`).getTime() - new Date(`${b.due_date}T${b.due_time ?? '00:00'}:00`).getTime())
          .slice(0, 5);

        upcomingAssessments = filtered;

        cache.set(
          'upcoming_assessments_data',
          {
            assessments: rawAssessments.map((a: any) => {
              const prefName = `timetable.subject.colour.${a.code}`;
              const c = colours.find((p: any) => p.name === prefName);
              return { ...a, colour: c ? c.value : '#8e8e8e' };
            }),
            subjects: activeSubjects,
            filters: activeSubjects.reduce((acc: Record<string, boolean>, s: any) => {
              acc[s.code] = true;
              return acc;
            }, {}),
          },
          60 * 60 * 1000
        );
      }
    } catch (e) {
      console.error('Failed to load upcoming assessments:', e);
    } finally {
      loadingAssessments = false;
    }
  }

  async function loadTodos() {
    try {
      const result = await invoke<TodoItem[]>('load_todos');
      todos = result ?? [];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load todos';
    } finally {
      loading = false;
    }
  }

  async function saveTodos() {
    try {
      await invoke('save_todos', { todos });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save todos';
    }
  }

  function addTodo() {
    const now = new Date().toISOString();
    const newTask: TodoItem = {
      id: crypto.randomUUID(),
      title: 'New task',
      description: '',
      related_subject: '',
      related_assessment: '',
      due_date: '',
      due_time: '',
      tags: [],
      subtasks: [],
      completed: false,
      priority: 'medium',
      created_at: now,
      updated_at: now
    };
    todos = [newTask, ...todos];
    editMode[newTask.id] = true;
    saveTodos();
  }

  function removeTodo(id: string) {
    // Add to deleting set for animation
    deletingTasks.add(id);
    deletingTasks = deletingTasks;
    
    // Delay actual removal to allow animation to play
    setTimeout(() => {
      todos = todos.filter(t => t.id !== id);
      deletingTasks.delete(id);
      deletingTasks = deletingTasks;
      saveTodos();
    }, 300);
  }

  function toggleTodo(id: string) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    // If completing the task, add animation
    if (!todo.completed) {
      completingTasks.add(id);
      completingTasks = completingTasks;
      
      // Brief delay for completion animation
      setTimeout(() => {
        completingTasks.delete(id);
        completingTasks = completingTasks;
      }, 500);
    }
    
    todos = todos.map(t => {
      if (t.id === id) {
        const updated = { ...t, completed: !t.completed, updated_at: new Date().toISOString() } as TodoItem;
        return updated;
      }
      return t;
    });
    saveTodos();
  }

  function markAllSubtasksDone(id: string) {
    todos = todos.map(t => {
      if (t.id === id) {
        const list = (t.subtasks ?? []).map(s => ({ ...s, completed: true }));
        return { ...t, subtasks: list, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function duplicateTodo(id: string) {
    const idx = todos.findIndex(t => t.id === id);
    if (idx === -1) return;
    const src = todos[idx];
    const now = new Date().toISOString();
    const copy: TodoItem = {
      ...src,
      id: crypto.randomUUID(),
      title: src.title ? `Copy of ${src.title}` : 'Copy',
      completed: false,
      created_at: now,
      updated_at: now,
      subtasks: (src.subtasks ?? []).map(s => ({ ...s, id: crypto.randomUUID(), completed: false }))
    };
    todos = [copy, ...todos];
    editMode[copy.id] = true;
    saveTodos();
  }

  function addSubtask(todoId: string) {
    todos = todos.map(t => {
      if (t.id === todoId) {
        const list = t.subtasks ? [...t.subtasks] : [];
        list.push({ id: crypto.randomUUID(), title: 'Subtask', completed: false });
        return { ...t, subtasks: list, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function toggleSubtask(todoId: string, subId: string) {
    todos = todos.map(t => {
      if (t.id === todoId) {
        const list = (t.subtasks ?? []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
        const completed = list.length > 0 && list.every(s => s.completed) ? true : t.completed;
        return { ...t, subtasks: list, completed, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function updateField<T extends keyof TodoItem>(todoId: string, field: T, value: TodoItem[T]) {
    todos = todos.map(t => (t.id === todoId ? { ...t, [field]: value, updated_at: new Date().toISOString() } as TodoItem : t));
    saveTodos();
  }

  function blurSave() { saveTodos(); }

  function isToday(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  function isThisWeek(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const n = new Date();
    const day = n.getDay();
    const monday = new Date(n);
    monday.setDate(n.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return d >= monday && d <= sunday;
  }

  function priorityOrder(p?: string | null) { return p === 'high' ? 0 : p === 'medium' ? 1 : 2; }

  function getPriorityStyles(priority?: string | null): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700';
    }
  }

  // Formatting helpers for due date/time
  function formatDueDate(dateStr?: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  function formatDueTime(timeStr?: string | null): string {
    if (!timeStr) return '';
    // Build a date using today's date with provided time for formatting
    const today = new Date();
    const [hh, mm] = timeStr.split(':');
    if (hh === undefined || mm === undefined) return '';
    today.setHours(Number(hh), Number(mm), 0, 0);
    return today.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  $: filteredSortedTodos = todos
    .filter(t => {
      if (query) {
        const q = query.toLowerCase();
        const tagStr = (t.tags ?? []).join(',').toLowerCase();
        if (!(t.title.toLowerCase().includes(q) || tagStr.includes(q))) return false;
      }
      if (filter === 'completed') return t.completed;
      if (filter === 'today') return !t.completed && isToday(t.due_date ?? undefined);
      if (filter === 'week') return !t.completed && isThisWeek(t.due_date ?? undefined);
      // For 'all' filter, only show non-completed tasks
      return !t.completed;
    })
    .sort((a, b) => {
      if (sortBy === 'due') {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      }
      if (sortBy === 'priority') return priorityOrder(a.priority) - priorityOrder(b.priority);
      const au = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bu = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bu - au;
    });

  // Random study tip selection
  let currentStudyTip = '';
  
  function getRandomStudyTip() {
    const randomIndex = Math.floor(Math.random() * studyTips.length);
    return studyTips[randomIndex];
  }


  onMount(async () => {
    currentStudyTip = getRandomStudyTip();
    await Promise.all([
      loadTodos(),
      loadUpcomingAssessments(),
      loadSubjectsAndColours().then(loadAllAssessments)
    ]);
  });
</script>

<style>
  /* Custom animation for task completion */
  @keyframes completionPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); background-color: rgb(34 197 94 / 0.2); }
    100% { transform: scale(1); }
  }
  
  .completion-animation {
    animation: completionPulse 0.5s ease-out;
  }
  
  /* Smooth transitions for priority colors */
  .priority-indicator {
    transition: all 0.3s ease-in-out;
  }
  
  /* Enhanced hover effects */
  .enhanced-hover {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .enhanced-hover:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
</style>

<div class="h-full flex flex-col" in:fade={{ duration: 400, easing: quintOut }}>
  <!-- Header -->
  <div class="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-6" in:fly={{ y: -30, duration: 500, easing: quintOut }}>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Study</h1>
        <p class="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">Plan, track, and focus on your upcoming work.</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-slate-300 text-slate-900 dark:text-white dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring text-sm sm:text-base"
          on:click={() => { /* timer */ }}
          aria-label="Open Study Timer">
          Open Timer
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mt-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Study sections">
      <button 
        class="px-3 py-2 -mb-px rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 accent-ring {activeTab==='tasks' ? 'accent-bg text-white' : 'bg-transparent text-slate-700 dark:text-slate-300'}" 
        on:click={() => activeTab='tasks'} 
        role="tab" 
        aria-selected={activeTab==='tasks'} 
        aria-controls="tasks-panel"
        id="tasks-tab"
      >
        Tasks
      </button>
      <button 
        class="px-3 py-2 -mb-px rounded-t-lg transition-all duration-200 focus:outline-none focus:ring-2 accent-ring {activeTab==='notes' ? 'accent-bg text-white' : 'bg-transparent text-slate-700 dark:text-slate-300'}" 
        on:click={() => activeTab='notes'} 
        role="tab" 
        aria-selected={activeTab==='notes'} 
        aria-controls="notes-panel"
        id="notes-tab"
      >
        Notes
      </button>
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">

    {#if activeTab === 'tasks'}
      <!-- Tasks Tab: Main Grid with Sidebar -->
      <div 
        class="h-full grid grid-cols-1 gap-6 lg:grid-cols-3"
        role="tabpanel"
        id="tasks-panel"
        aria-labelledby="tasks-tab"
      >
        <!-- Left Column: Tasks content -->
        <div class="lg:col-span-2 flex flex-col min-h-0">
          <div class="flex-1 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md overflow-y-auto" 
               in:fly={{ y: 20, duration: 300, delay: 200, easing: quintOut }} 
               out:fly={{ y: -20, duration: 200, easing: cubicOut }}>
          <!-- Tasks Controls -->
          <div class="mb-4 flex flex-col gap-3">
            <!-- Filter buttons -->
            <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
              <button class="px-2 py-1 sm:px-3 sm:py-1.5 text-sm rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='all' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='all'} in:scale={{ duration: 300, delay: 100, easing: quintOut }}>All</button>
              <button class="px-2 py-1 sm:px-3 sm:py-1.5 text-sm rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='today' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='today'} in:scale={{ duration: 300, delay: 150, easing: quintOut }}>Today</button>
              <button class="px-2 py-1 sm:px-3 sm:py-1.5 text-sm rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='week' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='week'} in:scale={{ duration: 300, delay: 200, easing: quintOut }}>This Week</button>
              <button class="px-2 py-1 sm:px-3 sm:py-1.5 text-sm rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring {filter==='completed' ? 'accent-bg text-white border-transparent' : 'bg-white dark:bg-slate-800'}" on:click={() => filter='completed'} in:scale={{ duration: 300, delay: 250, easing: quintOut }}>Completed</button>
            </div>
            <!-- Controls row -->
            <div class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring text-sm sm:text-base" on:click={addTodo} aria-label="Add new task">+ New Task</button>
              <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div class="relative flex-1 sm:flex-initial">
                  <input class="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring text-sm" placeholder="Search tasks..." bind:value={query} />
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Icon src={MagnifyingGlass} class="w-4 h-4" />
                  </span>
                </div>
                <select class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm" bind:value={sortBy}>
                  <option value="due">Due Date</option>
                  <option value="priority">Priority</option>
                  <option value="updated">Updated</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Tasks List -->
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Tasks</h2>
            <span class="text-sm text-slate-500 dark:text-slate-400">{filteredSortedTodos.length} tasks</span>
          </div>

          <div class="space-y-4">
            {#if filteredSortedTodos.length === 0}
              <div class="text-center py-10 text-slate-500 dark:text-slate-400">No tasks match your filters.</div>
            {/if}

            {#each filteredSortedTodos as todo (todo.id)}
              <div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 enhanced-hover {completingTasks.has(todo.id) ? 'completion-animation' : ''} {deletingTasks.has(todo.id) ? 'opacity-50 scale-95' : ''}"
                   in:fly={{ y: 30, duration: 400, delay: filteredSortedTodos.indexOf(todo) * 50, easing: quintOut }}
                   out:fly={{ y: 30, duration: 300, easing: cubicOut }}>
                {#if !editMode[todo.id]}
                  <!-- Condensed View -->
                  <div class="flex items-start gap-3">
                    <input type="checkbox" checked={todo.completed} on:change={() => toggleTodo(todo.id)} class="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle complete" />
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div class="truncate text-slate-900 dark:text-white font-medium pr-2">{todo.title || 'Untitled task'}</div>
                        <div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <span class="text-xs px-1.5 py-0.5 sm:px-2 rounded-full border priority-indicator {getPriorityStyles(todo.priority)}">{todo.priority ?? 'medium'}</span>
                          <button class="px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring" on:click={() => editMode[todo.id]=true}>Edit</button>
                          <button class="px-1.5 py-0.5 sm:px-2 sm:py-1 text-xs sm:text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500" on:click={() => removeTodo(todo.id)}>Del</button>
                        </div>
                      </div>
                      <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        {#if todo.related_subject}
                          {#key todo.related_subject}
                            <span class="px-2 py-0.5 rounded-lg border text-xs" style={chipStylesForCode(getSubjectCodeFromLabel(todo.related_subject))}>{todo.related_subject}</span>
                          {/key}
                        {/if}
                        {#if todo.related_assessment}
                          {#key todo.related_assessment}
                            <span class="px-2 py-0.5 rounded-lg border text-xs" style={chipStylesForCode(getSubjectCodeFromLabel(todo.related_subject) || null)}>{todo.related_assessment}</span>
                          {/key}
                        {/if}
                        {#if todo.due_date || todo.due_time}
                          <span class="inline-flex items-center gap-3 text-slate-600 dark:text-slate-300">
                            {#if todo.due_date}
                              <span class="inline-flex items-center gap-1">
                                <Icon src={Calendar} class="w-4 h-4" />{formatDueDate(todo.due_date)}
                              </span>
                            {/if}
                            {#if todo.due_time}
                              <span class="inline-flex items-center gap-1">
                                <Icon src={Clock} class="w-4 h-4" />{formatDueTime(todo.due_time)}
                              </span>
                            {/if}
                          </span>
                        {/if}
                        {#if (todo.tags ?? []).length}
                          <span class="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">{(todo.tags ?? []).join(', ')}</span>
                        {/if}
                      </div>
                      <div class="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{todo.description}</div>
                      {#if (todo.subtasks ?? []).length}
                        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">{(todo.subtasks ?? []).filter(s=>s.completed).length}/{todo.subtasks?.length} subtasks done</div>
                      {/if}
                      <div class="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button variant="ghost" size="xs" onclick={() => markAllSubtasksDone(todo.id)}>✓ All subtasks</Button>
                        <Button variant="ghost" size="xs" onclick={() => duplicateTodo(todo.id)}>Duplicate</Button>
                      </div>
                    </div>
                  </div>
                {:else}
                  <!-- Edit Mode -->
                  <div class="flex items-start gap-3">
                    <input type="checkbox" checked={todo.completed} on:change={() => toggleTodo(todo.id)} class="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle complete" />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <input class="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring text-base font-medium" placeholder="Task title" bind:value={todo.title} />
                        <div class="flex flex-col gap-1">
                          <select class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm" bind:value={todo.priority} on:change={() => updateField(todo.id, 'priority', todo.priority)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <span class="text-xs px-2 py-0.5 rounded-full border priority-indicator {getPriorityStyles(todo.priority)} text-center">{todo.priority ?? 'medium'}</span>
                        </div>
                      </div>
                      <div class="mt-2 grid grid-cols-1 gap-2">
                        <div class="relative">
                          <input class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring" placeholder="Related subject" bind:value={todo.related_subject} on:input={(e) => { subjectQuery[todo.id] = (e.target as HTMLInputElement).value; showSubjectDropdown[todo.id] = true; }} on:focus={() => showSubjectDropdown[todo.id]=true} on:blur={() => setTimeout(()=>showSubjectDropdown[todo.id]=false, 150)} />
                          {#if showSubjectDropdown[todo.id]}
                            <div class="absolute z-20 mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md max-h-56 overflow-auto">
                              {#each subjects.filter(s => (subjectQuery[todo.id] ?? todo.related_subject ?? '').toLowerCase().split(' ').every(q => s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))) as s}
                                <button class="flex items-center w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" on:mousedown={() => { todo.related_subject = `${s.code} — ${s.title}`; subjectQuery[todo.id] = s.code; showSubjectDropdown[todo.id] = false; }}>
                                  <span class="mr-2 inline-block w-2 h-2 rounded-full" style="background-color: {subjectColours[s.code] || '#8e8e8e'}"></span>
                                  <span class="flex-1 text-slate-900 dark:text-white">{s.code} — {s.title}</span>
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                        <div class="relative">
                          <input class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring" placeholder="Related assessment" bind:value={todo.related_assessment} on:input={(e) => { assessmentQuery[todo.id] = (e.target as HTMLInputElement).value; showAssessmentDropdown[todo.id] = true; }} on:focus={() => showAssessmentDropdown[todo.id]=true} on:blur={() => setTimeout(()=>showAssessmentDropdown[todo.id]=false, 150)} />
                          {#if showAssessmentDropdown[todo.id]}
                            <div class="absolute z-20 mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md max-h-64 overflow-auto">
                              {#each assessmentsAll.filter(a => {
                                const q = (assessmentQuery[todo.id] ?? todo.related_assessment ?? '').toLowerCase();
                                const subjectCode = (subjectQuery[todo.id] ?? todo.related_subject ?? '').split(' — ')[0]?.toLowerCase();
                                const matchesText = a.title.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
                                const matchesSubject = subjectCode ? a.code.toLowerCase() === subjectCode : true;
                                return matchesText && matchesSubject;
                              }).slice(0, 20) as a}
                                <button class="flex items-center w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" on:mousedown={() => { todo.related_assessment = a.title; if (!todo.related_subject) { const subj = subjects.find(s => s.code === a.code); if (subj) { todo.related_subject = `${subj.code} — ${subj.title}`; } } showAssessmentDropdown[todo.id] = false; }}>
                                  <span class="mr-2 inline-block w-2 h-2 rounded-full" style="background-color: {subjectColours[a.code] || a.colour || '#8e8e8e'}"></span>
                                  <div class="flex-1 overflow-hidden">
                                    <div class="text-slate-900 dark:text-white truncate">{a.title}</div>
                                    <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{a.code} • {new Date(a.due).toLocaleDateString()}</div>
                                  </div>
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input type="date" class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm" bind:value={todo.due_date} />
                          <input type="time" class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm" bind:value={todo.due_time} />
                        </div>
                        <!-- Live preview for due date/time -->
                        {#if todo.due_date || todo.due_time}
                          <div class="text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-3">
                            {#if todo.due_date}
                              <span class="inline-flex items-center gap-1"><Icon src={Calendar} class="w-4 h-4" />{formatDueDate(todo.due_date)}</span>
                            {/if}
                            {#if todo.due_time}
                              <span class="inline-flex items-center gap-1"><Icon src={Clock} class="w-4 h-4" />{formatDueTime(todo.due_time)}</span>
                            {/if}
                          </div>
                        {/if}
                        <input class="px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm" placeholder="Tags (comma separated)" value={(todo.tags ?? []).join(', ')} on:input={(e) => { const val = (e.target as HTMLInputElement).value; updateField(todo.id, 'tags', val ? val.split(',').map(t => t.trim()) : []); }} />
                      </div>

                      <!-- Description and Subtasks -->
                      <div class="mt-3">
                        <textarea rows="3" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring" placeholder="Description" bind:value={todo.description}></textarea>
                        <div class="mt-3 space-y-2">
                          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <h3 class="text-sm font-medium text-slate-900 dark:text-white">Subtasks</h3>
                            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <button class="px-3 py-1.5 text-xs sm:text-sm rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring" on:click={() => addSubtask(todo.id)}>+ Add</button>
                              <button class="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring" on:click={() => markAllSubtasksDone(todo.id)}>✓ All</button>
                            </div>
                          </div>
                          {#if (todo.subtasks ?? []).length === 0}
                            <div class="text-sm text-slate-500 dark:text-slate-400">No subtasks yet.</div>
                          {:else}
                            <div class="space-y-2">
                              {#each todo.subtasks ?? [] as sub (sub.id)}
                                <div class="flex items-center gap-2">
                                  <input type="checkbox" checked={sub.completed} on:change={() => toggleSubtask(todo.id, sub.id)} class="w-4 h-4 flex-shrink-0 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" aria-label="Toggle subtask" />
                                  <input class="flex-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring text-sm" bind:value={sub.title} on:blur={() => { const list = (todo.subtasks ?? []).map(s => s.id === sub.id ? { ...s, title: sub.title } : s); updateField(todo.id, 'subtasks', list); }} placeholder="Subtask title" />
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </div>

                      <div class="mt-4 flex items-center justify-center sm:justify-end gap-2">
                        <button class="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring w-full sm:w-auto" on:click={() => { editMode[todo.id] = false; saveTodos(); }}>Save Task</button>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>

              <!-- Right Column: Upcoming Assessments Widget -->
        <div class="flex flex-col space-y-6 min-h-0" in:fly={{ x: 50, duration: 500, delay: 200, easing: quintOut }}>
          <div class="flex-1 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Upcoming Assessments</h2>
            <span class="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{upcomingAssessments.length}</span>
          </div>
          {#if loadingAssessments}
            <div class="flex items-center justify-center py-6">
              <div class="w-10 h-10 rounded-full border-4 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin"></div>
            </div>
          {:else}
            <div class="space-y-3">
              {#each upcomingAssessments as a (a.id)}
                <div class="relative flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 transition-all duration-200 hover:scale-[1.02]"
                     in:fly={{ x: 30, duration: 400, delay: upcomingAssessments.indexOf(a) * 100, easing: quintOut }}>
                  <!-- Left accent bar -->
                  <span class="absolute left-0 top-0 h-full w-1 rounded-l-lg" style="background-color: {a.colour || subjectColours[a.subject?.split(' — ')[0] || ''] || '#8e8e8e'}"></span>
                  <span class="mt-1 ml-1 inline-block w-2 h-2 rounded-full {a.status==='overdue' ? 'bg-red-500' : a.status==='soon' ? 'bg-yellow-500' : 'bg-emerald-500'}"></span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <div class="truncate text-slate-900 dark:text-white font-medium">{a.title}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{a.due_date}{a.due_time ? ` • ${a.due_time}` : ''}</div>
                    </div>
                    <div class="mt-1 flex items-center gap-2">
                      <!-- Subject tinted chip -->
                      {#if a.subject}
                        <span class="px-2 py-0.5 rounded-lg border text-xs" style={chipStylesForCode(a.subject.split(' — ')[0] || a.subject)}>{a.subject}</span>
                      {/if}
                    </div>
                  </div>
                  <button class="px-2 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring">Open</button>
                </div>
              {/each}
              {#if upcomingAssessments.length === 0}
                <div class="text-center py-6 text-slate-500 dark:text-slate-400">No upcoming assessments.</div>
              {/if}
            </div>
          {/if}
        </div>

                  <!-- Focus Tips / Placeholder Widget -->
          <div class="flex-shrink-0 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md"
               in:fly={{ y: 30, duration: 500, delay: 400, easing: quintOut }}>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Study Tip</h2>
            <button 
              class="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
              on:click={() => currentStudyTip = getRandomStudyTip()}
              aria-label="Get new study tip">
              New Tip
            </button>
          </div>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStudyTip}
          </p>
        </div>
      </div>
    </div>
      {:else}
      <!-- Notes Tab: Full Width Layout -->
      <div 
        class="h-full flex flex-col min-h-0"
        role="tabpanel"
        id="notes-panel"
        aria-labelledby="notes-tab"
        in:fly={{ y: 20, duration: 300, delay: 200, easing: quintOut }} 
        out:fly={{ y: -20, duration: 200, easing: cubicOut }}
      >
        <NotesContainer />
      </div>
    {/if}
  </div>
</div> 
