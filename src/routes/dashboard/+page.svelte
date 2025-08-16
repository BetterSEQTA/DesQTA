<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { getWithIdbFallback, setIdb } from '$lib/services/idbCache';
  import { writable } from 'svelte/store';

  interface HomeworkItem {
    meta: number;
    id: number;
    title: string;
    items: string[];
  }

  interface HomeworkResponse {
    payload: HomeworkItem[];
    status: string;
  }

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

  let homeworkData = $state<HomeworkResponse | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  // Todo list state
  let todos = $state<TodoItem[]>([]);
  let newTodoText = $state('');
  let newTodoDueDate = $state('');
  let newTodoPriority = $state<'low' | 'medium' | 'high'>('medium');
  let newTodoTags = $state(''); // comma-separated
  let newTodoRecurring = $state<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  let newSubtasks = $state<{ id: number; text: string }[]>([]);
  let newSubtaskText = $state('');

  // Timer state
  let timerMinutes = $state(25);
  let timerSeconds = $state(0);
  let isTimerRunning = $state(false);
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let customMinutes = $state('');
  let customSeconds = $state('');

  async function fetchHomeworkData() {
    try {
      loading = true;
      error = null;
      const cacheKey = 'dashboard_homework';
      const cached = cache.get<any>(cacheKey) || await getWithIdbFallback<any>(cacheKey, cacheKey, () => cache.get<any>(cacheKey));
      if (cached) {
        homeworkData = cached;
        loading = false;
        return;
      }

      const response = await seqtaFetch('/seqta/student/dashlet/summary/homework', {
        method: 'POST',
        body: {},
        params: { majhvjju: '' },
      });
      homeworkData = JSON.parse(response);
      cache.set(cacheKey, homeworkData, 15);
      console.info('[IDB] dashboard homework cached (mem+idb)');
      await setIdb(cacheKey, homeworkData);
    } catch (e: any) {
      console.error('Error details:', e);
      error = e.toString();
    } finally {
      loading = false;
    }
  }

  function addSubtask() {
    if (newSubtaskText.trim()) {
      newSubtasks = [...newSubtasks, { id: Date.now(), text: newSubtaskText.trim() }];
      newSubtaskText = '';
    }
  }

  function removeSubtask(id: number) {
    newSubtasks = newSubtasks.filter((st) => st.id !== id);
  }

  function addTodo() {
    if (newTodoText.trim()) {
      todos = [
        ...todos,
        {
          id: Date.now(),
          text: newTodoText.trim(),
          completed: false,
          dueDate: newTodoDueDate || undefined,
          subtasks: newSubtasks.map((st) => ({ ...st, completed: false })),
          priority: newTodoPriority,
          tags: newTodoTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          recurring: newTodoRecurring,
        },
      ];
      newTodoText = '';
      newTodoDueDate = '';
      newTodoPriority = 'medium';
      newTodoTags = '';
      newTodoRecurring = 'none';
      newSubtasks = [];
      saveTodos();
    }
  }

  function toggleTodo(id: number) {
    todos = todos.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo));
    saveTodos();
  }

  function toggleSubtask(todoId: number, subtaskId: number) {
    todos = todos.map((todo) =>
      todo.id === todoId
        ? {
            ...todo,
            subtasks: todo.subtasks?.map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st,
            ),
          }
        : todo,
    );
    saveTodos();
  }

  function deleteTodo(id: number) {
    todos = todos.filter((todo) => todo.id !== id);
    saveTodos();
  }

  function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
  }

  function loadTodos() {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      todos = JSON.parse(savedTodos);
    }
  }

  function startTimer() {
    if (!isTimerRunning) {
      isTimerRunning = true;
      timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
          timerSeconds--;
        } else if (timerMinutes > 0) {
          timerMinutes--;
          timerSeconds = 59;
        } else {
          stopTimer();
          // Play notification sound
          new Audio('/timer.mp3').play().catch(() => {});
        }
      }, 1000);
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isTimerRunning = false;
  }

  function resetTimer() {
    stopTimer();
    timerMinutes = 25;
    timerSeconds = 0;
  }

  function setCustomTime() {
    const minutes = parseInt(customMinutes) || 0;
    const seconds = parseInt(customSeconds) || 0;
    if (minutes >= 0 && seconds >= 0 && seconds < 60) {
      timerMinutes = minutes;
      timerSeconds = seconds;
      customMinutes = '';
      customSeconds = '';
    }
  }

  onMount(() => {
    console.log('Dashboard component mounted');
    fetchHomeworkData();
    loadTodos();
  });
</script>

<div class="min-h-screen bg-slate-50 dark:bg-slate-950">
  <div class="max-w-[2000px] mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <!-- Left Column: Homework and Todo List -->
      <div class="space-y-8">
        <!-- Homework Section -->
        <div
          class="rounded-xl border shadow-lg backdrop-blur-sm bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Homework</h2>
          </div>
          <div class="p-6">
            {#if loading}
              <div class="flex justify-center items-center py-12">
                <p class="text-slate-600 dark:text-slate-400">Loading homework data…</p>
              </div>
            {:else if error}
              <div class="px-6 py-4 mb-4 text-red-700 bg-red-100 rounded-lg border border-red-200">
                <p>Error: {error}</p>
              </div>
            {:else if homeworkData}
              <div class="flex flex-col gap-6">
                {#each homeworkData.payload as homework}
                  <div
                    class="rounded-xl border-l-8 shadow-lg backdrop-blur-sm bg-slate-100/80 dark:bg-slate-800/50"
                    style="border-color: var(--accent);">
                    <div class="px-6 pt-5 pb-3">
                      <h3 class="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                        {homework.title}
                      </h3>
                      <div class="flex flex-col gap-3">
                        {#each homework.items as item}
                          <div
                            class="flex gap-2 items-start px-4 py-3 rounded-lg border backdrop-blur-sm bg-slate-200/80 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600">
                            <span class="mt-1 text-xl accent-text">•</span>
                            <span class="text-slate-800 dark:text-slate-50">{item}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-center text-slate-600 dark:text-slate-400">
                No homework data available
              </p>
            {/if}
          </div>
        </div>

        <!-- Todo List Section -->
        <div
          class="rounded-xl border shadow-lg backdrop-blur-sm bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Todo List</h2>
          </div>
          <div class="p-6">
            <form
              onsubmit={(e) => {
                e.preventDefault();
                addTodo();
              }}
              class="mb-6">
              <div
                class="flex flex-col gap-6 p-4 rounded-lg border bg-slate-100/60 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700">
                <!-- Main Task -->
                <div class="flex flex-col gap-4 items-stretch sm:flex-row">
                  <input
                    type="text"
                    bind:value={newTodoText}
                    placeholder="Add a new task..."
                    class="flex-1 px-4 py-2 bg-white rounded-lg border shadow-sm dark:bg-slate-900/60 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent" />
                  <input
                    type="date"
                    bind:value={newTodoDueDate}
                    class="px-4 py-2 bg-white rounded-lg border shadow-sm dark:bg-slate-900/60 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <!-- Details -->
                <div class="flex flex-col gap-4 items-stretch sm:flex-row">
                  <div class="flex relative flex-1 items-center">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2">
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        viewBox="0 0 24 24"
                        class={newTodoPriority === 'high'
                          ? 'text-red-500'
                          : newTodoPriority === 'medium'
                            ? 'text-yellow-400'
                            : 'text-green-500'}
                        ><circle cx="12" cy="12" r="10" fill="currentColor" /></svg>
                    </span>
                    <select
                      bind:value={newTodoPriority}
                      class="py-2 pr-4 pl-8 w-full bg-white rounded-lg border dark:bg-slate-900/60 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700">
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                  <div class="flex relative flex-1 items-center">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2">
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        viewBox="0 0 24 24"
                        class="text-blue-400"
                        ><rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" /><rect
                          x="11"
                          y="4"
                          width="2"
                          height="16"
                          rx="1"
                          fill="currentColor" /></svg>
                    </span>
                    <input
                      type="text"
                      bind:value={newTodoTags}
                      placeholder="Tags (comma separated, e.g. school,math)"
                      class="py-2 pr-4 pl-8 w-full bg-white rounded-lg border dark:bg-slate-900/60 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" />
                  </div>
                  <div class="flex relative flex-1 items-center">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2">
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        viewBox="0 0 24 24"
                        class="text-purple-400"
                        ><circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="2" /><path
                          d="M12 6v6l4 2"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round" /></svg>
                    </span>
                    <select
                      bind:value={newTodoRecurring}
                      class="py-2 pr-4 pl-8 w-full bg-white rounded-lg border dark:bg-slate-900/60 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700">
                      <option value="none">No Repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <!-- Subtasks -->
                <div class="p-3 rounded-lg bg-slate-200/60 dark:bg-slate-900/40">
                  <div class="flex gap-2 items-center mb-2">
                    <svg
                      width="18"
                      height="18"
                      fill="none"
                      viewBox="0 0 24 24"
                      class="text-slate-600 dark:text-slate-400"
                      ><rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor" /></svg>
                    <input
                      type="text"
                      bind:value={newSubtaskText}
                      placeholder="Add subtask (e.g. Read chapter 1)"
                      class="flex-1 px-4 py-2 bg-white rounded-lg border dark:bg-slate-900/60 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700" />
                    <button
                      type="button"
                      onclick={addSubtask}
                      class="px-4 py-2 text-white rounded-lg shadow transition-colors bg-accent hover:bg-accent/90"
                      >Add Subtask</button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {#each newSubtasks as st (st.id)}
                      <span
                        class="flex gap-2 items-center px-3 py-1 rounded-lg shadow-sm bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white">
                        {st.text}
                        <button
                          type="button"
                          onclick={() => removeSubtask(st.id)}
                          class="ml-2 text-red-400 hover:text-red-600">×</button>
                      </span>
                    {/each}
                  </div>
                </div>
                <div class="flex justify-end">
                  <button
                    type="submit"
                    class="px-8 py-2 font-semibold text-white rounded-lg shadow-lg transition-colors bg-accent hover:bg-accent/90">
                    Add Task
                  </button>
                </div>
              </div>
            </form>

            <div class="space-y-4">
              {#each todos as todo (todo.id)}
                <div
                  class="flex flex-col gap-2 p-4 rounded-xl border backdrop-blur-sm transition-shadow bg-white/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:shadow-lg group">
                  <div class="flex gap-3 items-center">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onchange={() => toggleTodo(todo.id)}
                      class="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent accent-bg" />
                    <div class="flex-1">
                      <div class="flex gap-2 items-center">
                        <p
                          class="text-slate-900 dark:text-white {todo.completed
                            ? 'line-through text-slate-500 dark:text-slate-400'
                            : ''} font-semibold">
                          {todo.text}
                        </p>
                        {#if todo.priority}
                          <span
                            class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold {todo.priority ===
                            'high'
                              ? 'bg-red-600'
                              : todo.priority === 'medium'
                                ? 'bg-yellow-500'
                                : 'bg-green-600'} text-white">
                            {todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}
                          </span>
                        {/if}
                        {#if todo.tags && todo.tags.length}
                          <span class="flex gap-1 ml-2">
                            {#each todo.tags as tag}
                              <span
                                class="px-2 py-0.5 text-xs text-blue-100 rounded-full bg-blue-700/80"
                                >#{tag}</span>
                            {/each}
                          </span>
                        {/if}
                        {#if todo.recurring && todo.recurring !== 'none'}
                          <span class="inline-block ml-2 text-xs text-purple-300">
                            {todo.recurring.charAt(0).toUpperCase() + todo.recurring.slice(1)}
                          </span>
                        {/if}
                      </div>
                      {#if todo.dueDate}
                        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          Due: {new Date(todo.dueDate).toLocaleDateString()}
                        </p>
                      {/if}
                    </div>
                    <button
                      onclick={() => deleteTodo(todo.id)}
                      class="p-2 transition-colors text-slate-600 dark:text-slate-400 hover:text-red-500 hover:scale-125 focus:outline-none"
                      title="Delete task">
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
                        ><path
                          d="M6 6l12 12M6 18L18 6"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round" /></svg>
                    </button>
                  </div>
                  {#if todo.subtasks && todo.subtasks.length}
                    <div
                      class="flex flex-col gap-1 p-2 mt-2 ml-8 rounded-lg bg-slate-200/60 dark:bg-slate-900/40">
                      {#each todo.subtasks as st (st.id)}
                        <div class="flex gap-2 items-center">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onchange={() => toggleSubtask(todo.id, st.id)}
                            class="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-accent accent-bg" />
                          <span
                            class="text-sm text-slate-900 dark:text-white {st.completed
                              ? 'line-through text-slate-500 dark:text-slate-400'
                              : ''}">{st.text}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Timer -->
      <div
        class="rounded-xl border shadow-lg backdrop-blur-sm bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Focus Timer</h2>
        </div>
        <div class="p-6">
          <div class="flex flex-col items-center">
            <div class="mb-8 font-mono text-7xl font-bold text-slate-900 dark:text-white">
              {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
            </div>
            <div class="flex gap-4 justify-center mt-6">
              <button
                onclick={startTimer}
                class="px-6 py-3 font-semibold text-white rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg accent-bg">
                Start Timer
              </button>
              <button
                onclick={stopTimer}
                disabled={!isTimerRunning}
                class="px-8 py-3 text-white bg-red-600 rounded-lg transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Stop
              </button>
              <button
                onclick={resetTimer}
                class="px-8 py-3 rounded-lg transition-colors bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-400 dark:hover:bg-slate-600">
                > Reset
              </button>
            </div>
            <div class="grid grid-cols-3 gap-4 mt-8">
              <button
                onclick={() => {
                  timerMinutes = 25;
                  timerSeconds = 0;
                }}
                class="px-6 py-3 rounded-lg backdrop-blur-sm transition-colors bg-slate-200/80 dark:bg-slate-800/50 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700">
                25m
              </button>
              <button
                onclick={() => {
                  timerMinutes = 45;
                  timerSeconds = 0;
                }}
                class="px-6 py-3 rounded-lg backdrop-blur-sm transition-colors bg-slate-200/80 dark:bg-slate-800/50 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700">
                45m
              </button>
              <button
                onclick={() => {
                  timerMinutes = 60;
                  timerSeconds = 0;
                }}
                class="px-6 py-3 rounded-lg backdrop-blur-sm transition-colors bg-slate-200/80 dark:bg-slate-800/50 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700">
                60m
              </button>
            </div>
            <div class="flex flex-col gap-4 items-center mt-8">
              <div class="flex gap-4 items-center">
                <input
                  type="number"
                  bind:value={customMinutes}
                  placeholder="Minutes"
                  min="0"
                  class="px-4 py-3 w-28 bg-white rounded-lg border backdrop-blur-sm dark:bg-slate-800/50 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent" />
                <span class="text-2xl text-slate-900 dark:text-white">:</span>
                <input
                  type="number"
                  bind:value={customSeconds}
                  placeholder="Seconds"
                  min="0"
                  max="59"
                  class="px-4 py-3 w-28 bg-white rounded-lg border backdrop-blur-sm dark:bg-slate-800/50 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-accent" />
              </div>
              <button
                onclick={setCustomTime}
                class="px-8 py-3 rounded-lg backdrop-blur-sm transition-colors bg-slate-200/80 dark:bg-slate-800/50 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700">
                Set Custom Time
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background: var(--background);
  }
  .accent-bg {
    background: var(--accent, #3b82f6);
  }
</style>
