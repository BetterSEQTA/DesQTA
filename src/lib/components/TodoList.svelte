<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { fly, fade, scale } from 'svelte/transition';
  import { quintOut, cubicOut } from 'svelte/easing';

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

  let todos = $state<TodoItem[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  
  // Animation state
  let deletingTasks = $state<Set<string>>(new Set());
  let completingTasks = $state<Set<string>>(new Set());

  // New task form state
  let newTodoText = $state('');
  let newTodoDueDate = $state('');
  let newTodoPriority = $state<'low' | 'medium' | 'high'>('medium');
  let newTodoTags = $state(''); // comma-separated

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
    if (newTodoText.trim()) {
      const now = new Date().toISOString();
      const newTask: TodoItem = {
        id: crypto.randomUUID(),
        title: newTodoText.trim(),
        description: null,
        related_subject: null,
        related_assessment: null,
        due_date: newTodoDueDate || null,
        due_time: null,
        tags: newTodoTags ? newTodoTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        subtasks: [],
        completed: false,
        priority: newTodoPriority,
        created_at: now,
        updated_at: now
      };
      todos = [newTask, ...todos];
      newTodoText = '';
      newTodoDueDate = '';
      newTodoPriority = 'medium';
      newTodoTags = '';
      saveTodos();
    }
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
        return { ...t, completed: !t.completed, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function toggleSubtask(todoId: string, subtaskId: string) {
    todos = todos.map(t => {
      if (t.id === todoId) {
        const list = (t.subtasks ?? []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
        const completed = list.length > 0 && list.every(s => s.completed) ? true : t.completed;
        return { ...t, subtasks: list, completed, updated_at: new Date().toISOString() } as TodoItem;
      }
      return t;
    });
    saveTodos();
  }

  function deleteTodo(id: string) {
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

  onMount(async () => {
    await loadTodos();
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

<div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md" 
     in:fade={{ duration: 400, easing: quintOut }}>
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700"
       in:fly={{ y: -20, duration: 300, easing: quintOut }}>
    <div>
      <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Quick Tasks</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{todos.filter(t => !t.completed).length} active tasks</p>
    </div>
  </div>

  <div class="p-4 space-y-4">
    <!-- Add New Task Form -->
    <form
      onsubmit={(e) => {
        e.preventDefault();
        addTodo();
      }}
      class="space-y-3"
      in:fly={{ y: 20, duration: 300, delay: 100, easing: quintOut }}>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newTodoText}
          placeholder="Add a quick task..."
          class="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring text-sm" />
        <button
          type="submit"
          class="px-4 py-2 rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring text-sm font-medium">
          Add
        </button>
      </div>
      <div class="flex gap-2">
        <input
          type="date"
          bind:value={newTodoDueDate}
          class="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm" />
        <select
          bind:value={newTodoPriority}
          class="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 accent-ring text-sm">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <input
        type="text"
        bind:value={newTodoTags}
        placeholder="Tags (comma separated)"
        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring text-sm" />
    </form>

    <!-- Tasks List -->
    {#if loading}
      <div class="flex items-center justify-center py-8">
        <div class="w-8 h-8 rounded-full border-4 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin"></div>
      </div>
    {:else if error}
      <div class="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
    {:else}
      <div class="space-y-3">
        {#if todos.length === 0}
          <div class="text-center py-8 text-slate-500 dark:text-slate-400">
            No tasks yet. Add one above to get started!
          </div>
        {/if}
        
        {#each todos.filter(t => !t.completed).slice(0, 5) as todo (todo.id)}
          <div class="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 enhanced-hover {completingTasks.has(todo.id) ? 'completion-animation' : ''} {deletingTasks.has(todo.id) ? 'opacity-50 scale-95' : ''}"
               in:fly={{ y: 20, duration: 300, delay: todos.indexOf(todo) * 50, easing: quintOut }}
               out:fly={{ y: -20, duration: 200, easing: cubicOut }}>
            <div class="flex items-start gap-3">
              <input 
                type="checkbox" 
                checked={todo.completed} 
                onchange={() => toggleTodo(todo.id)} 
                class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 focus:ring-2 accent-ring" 
                aria-label="Toggle complete" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <div class="truncate text-slate-900 dark:text-white font-medium text-sm">{todo.title || 'Untitled task'}</div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <span class="text-xs px-1.5 py-0.5 rounded-full border priority-indicator {getPriorityStyles(todo.priority)}">{todo.priority ?? 'medium'}</span>
                    <button 
                      class="p-1 text-slate-400 hover:text-red-600 transition-colors" 
                      onclick={() => deleteTodo(todo.id)}
                      aria-label="Delete task">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                        <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {#if todo.due_date || (todo.tags ?? []).length}
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {#if todo.due_date}
                      <span class="text-slate-600 dark:text-slate-300">
                        Due: {new Date(todo.due_date).toLocaleDateString()}
                      </span>
                    {/if}
                    {#if (todo.tags ?? []).length}
                      <span class="px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                        {(todo.tags ?? []).join(', ')}
                      </span>
                    {/if}
                  </div>
                {/if}
                
                {#if (todo.subtasks ?? []).length}
                  <div class="mt-2 space-y-1">
                    {#each todo.subtasks ?? [] as sub (sub.id)}
                      <div class="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={sub.completed} 
                          onchange={() => toggleSubtask(todo.id, sub.id)} 
                          class="w-3 h-3 rounded border-slate-300 dark:border-slate-700 focus:ring-1 accent-ring" 
                          aria-label="Toggle subtask" />
                        <span class="text-xs text-slate-600 dark:text-slate-300 {sub.completed ? 'line-through' : ''}">{sub.title}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
        
        {#if todos.filter(t => !t.completed).length > 5}
          <div class="text-center py-2">
            <span class="text-sm text-slate-500 dark:text-slate-400">
              Showing 5 of {todos.filter(t => !t.completed).length} active tasks
            </span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div> 