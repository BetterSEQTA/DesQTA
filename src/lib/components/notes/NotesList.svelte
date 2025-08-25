<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { Icon, MagnifyingGlass, Plus, FolderOpen, Calendar, Clock, Tag, FolderPlus, Trash, PencilSquare, EllipsisVertical, XMark } from 'svelte-hero-icons';
  import { fly, scale, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { NotesService } from '../../services/notesService';
  import NotesSearch from './NotesSearch.svelte';
  import type { Note, NoteFolder } from './types/editor';
  import { Button } from '$lib/components/ui';

  // Events
  const dispatch = createEventDispatcher<{
    selectNote: { note: Note };
    createNote: void;
    deleteNote: { noteId: string };
  }>();

  // Props
  export let selectedNoteId: string | null = null;

  // State
  let notes: Note[] = [];
  let folders: NoteFolder[] = [];
  let loading = true;
  let error: string | null = null;
  let searchQuery = '';
  let selectedFolder = 'all';
  
  // Folder management state
  let showFolderManagement = false;
  let showCreateFolder = false;
  let newFolderName = '';
  let editingFolder: NoteFolder | null = null;
  let folderMenuOpen: string | null = null;
  let noteMenuOpen: string | null = null;
  let showMoveNoteModal: Note | null = null;
  let showSearchModal = false;
  
  // References for programmatic focus (instead of autofocus)
  let createFolderInput: HTMLInputElement | null = null;
  let editFolderInput: HTMLInputElement | null = null;

  // Reactive filtered notes
  $: filteredNotes = notes
    .filter(note => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(query);
        const matchesTags = note.tags.some(tag => tag.toLowerCase().includes(query));
        const textContent = note.content.replace(/<[^>]*>/g, '').toLowerCase();
        const matchesContent = textContent.includes(query);
        if (!matchesTitle && !matchesTags && !matchesContent) return false;
      }

      // Folder filter
      if (selectedFolder !== 'all') {
        if (!note.folder_path.includes(selectedFolder)) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Load data
  async function loadNotes() {
    try {
      loading = true;
      error = null;
      
      const [notesData, foldersData] = await Promise.all([
        NotesService.loadNotes(),
        NotesService.loadFolders()
      ]);
      
      notes = notesData;
      folders = foldersData;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load notes';
      console.error('Failed to load notes:', e);
    } finally {
      loading = false;
    }
  }

  // Refresh notes list
  export async function refreshNotes() {
    await loadNotes();
  }

  // Handle note selection
  function selectNote(note: Note) {
    dispatch('selectNote', { note });
  }

  // Handle note creation
  function createNewNote() {
    dispatch('createNote');
  }

  // Handle note deletion
  async function deleteNote(noteId: string, event: Event) {
    event.stopPropagation();
    
    try {
      await NotesService.deleteNote(noteId);
      await loadNotes(); // Refresh the list
      dispatch('deleteNote', { noteId });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete note';
    }
  }

  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  // Get preview text from note content
  function getPreviewText(note: Note): string {
    // Extract text content from HTML, removing all tags
    const textContent = note.content.replace(/<[^>]*>/g, '').trim();
    
    return textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
  }

  // Get folder name by ID
  function getFolderName(folderId: string): string {
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : 'Unknown Folder';
  }

  // Folder management functions
  async function createFolder() {
    if (!newFolderName.trim()) return;
    
    try {
      await NotesService.createFolder(newFolderName.trim());
      await loadNotes(); // Refresh to get updated folders
      newFolderName = '';
      showCreateFolder = false;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create folder';
    }
  }

  function startCreateFolder() {
    showCreateFolder = true;
    // Focus the input after it's rendered
    setTimeout(() => {
      if (createFolderInput) {
        createFolderInput.focus();
      }
    }, 0);
  }

  function startEditFolder(folder: NoteFolder) {
    editingFolder = folder;
    // Focus the input after it's rendered
    setTimeout(() => {
      if (editFolderInput) {
        editFolderInput.focus();
        editFolderInput.select();
      }
    }, 0);
  }

  async function deleteFolder(folderId: string) {
    if (folderId === 'default') {
      error = 'Cannot delete the default folder';
      return;
    }

    if (confirm('Are you sure you want to delete this folder? Notes in this folder will be moved to the default folder.')) {
      try {
        await NotesService.deleteFolder(folderId);
        await loadNotes(); // Refresh to get updated folders
        if (selectedFolder === folderId) {
          selectedFolder = 'all';
        }
        folderMenuOpen = null;
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to delete folder';
      }
    }
  }

  async function renameFolder(folder: NoteFolder, newName: string) {
    if (!newName.trim() || newName === folder.name) {
      editingFolder = null;
      return;
    }

    try {
      // Note: We'd need to add a rename_folder command to the backend
      // For now, we'll create a new folder and move notes
      const newFolderId = await NotesService.createFolder(newName.trim());
      
      // Move all notes from old folder to new folder
      const folderNotes = notes.filter(note => note.folder_path.includes(folder.id));
      await Promise.all(
        folderNotes.map(note => NotesService.moveNoteToFolder(note.id, newFolderId))
      );
      
      // Delete old folder
      await NotesService.deleteFolder(folder.id);
      await loadNotes(); // Refresh
      
      editingFolder = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to rename folder';
      editingFolder = null;
    }
  }

  function toggleFolderMenu(folderId: string) {
    folderMenuOpen = folderMenuOpen === folderId ? null : folderId;
  }

  async function moveNoteToFolder(note: Note, folderId: string) {
    try {
      await NotesService.moveNoteToFolder(note.id, folderId);
      await loadNotes(); // Refresh to see changes
      showMoveNoteModal = null;
      noteMenuOpen = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to move note';
    }
  }

  function toggleNoteMenu(noteId: string) {
    noteMenuOpen = noteMenuOpen === noteId ? null : noteId;
  }

  function handleSearchNoteSelect(event: CustomEvent<{ note: Note }>) {
    const note = event.detail.note;
    dispatch('selectNote', { note });
    showSearchModal = false;
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.folder-menu-container') && !target.closest('.note-menu-container')) {
      folderMenuOpen = null;
      noteMenuOpen = null;
    }
  }

  onMount(() => {
    loadNotes();
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="notes-list h-full flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-h-0">
  <!-- Header -->
  <div class="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Notes</h2>
      <div class="flex items-center space-x-2">
        <button
          class="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 accent-ring hover:shadow-sm"
          on:click={() => showSearchModal = true}
          title="Search notes"
          aria-label="Search notes"
        >
          <Icon src={MagnifyingGlass} class="w-4 h-4" />
        </button>
        <button
          class="p-2 rounded-lg accent-bg text-white transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 accent-ring hover:shadow-md"
          on:click={createNewNote}
          title="Create new note"
          aria-label="Create new note"
        >
          <Icon src={Plus} class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="relative">
      <input
        type="text"
        placeholder="Search notes..."
        class="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 accent-ring transition-all duration-300 ease-out focus:scale-[1.01] focus:shadow-sm"
        bind:value={searchQuery}
      />
      <Icon src={MagnifyingGlass} class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    </div>

    <!-- Folders Section -->
    <div class="mt-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Folders</h3>
        <button
          class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
          on:click={() => showCreateFolder ? (showCreateFolder = false) : startCreateFolder()}
          title="Create new folder"
        >
          <Icon src={FolderPlus} class="w-4 h-4" />
        </button>
      </div>

      <!-- Create Folder Input -->
      {#if showCreateFolder}
        <div class="mb-2" transition:slide={{ duration: 200 }}>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Folder name"
              class="flex-1 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
              bind:value={newFolderName}
              bind:this={createFolderInput}
              on:keydown={(e) => {
                if (e.key === 'Enter') createFolder();
                if (e.key === 'Escape') { showCreateFolder = false; newFolderName = ''; }
              }}
            />
            <button
              class="px-2 py-1 text-xs rounded accent-bg text-white hover:opacity-90 transition-opacity"
              on:click={createFolder}
              disabled={!newFolderName.trim()}
            >
              Add
            </button>
          </div>
        </div>
      {/if}

      <!-- Folders List -->
      <div class="space-y-1">
        <!-- All Notes -->
        <button
          class="w-full flex items-center px-2 py-1.5 text-sm rounded-lg transition-all duration-300 ease-out hover:scale-[1.01] {selectedFolder === 'all' ? 'bg-accent-100 dark:bg-accent-900 text-accent-800 dark:text-accent-200 border border-accent-200 dark:border-accent-800 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'}"
          on:click={() => selectedFolder = 'all'}
        >
          <Icon src={FolderOpen} class="w-4 h-4 mr-2 opacity-60" />
          <span class="flex-1 text-left">All Notes</span>
          <span class="text-xs opacity-60">{notes.length}</span>
        </button>

                 <!-- Individual Folders -->
         {#each folders as folder, index (folder.id)}
           <div 
             class="folder-menu-container relative"
             in:fly={{ y: 10, duration: 200, delay: index * 20, easing: quintOut }}
           >
             {#if editingFolder?.id === folder.id}
               <!-- Editing Mode -->
               <input
                 type="text"
                 value={folder.name}
                 class="w-full px-2 py-1 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 accent-ring"
                 on:keydown={(e) => {
                   if (e.key === 'Enter') renameFolder(folder, e.currentTarget.value);
                   if (e.key === 'Escape') editingFolder = null;
                 }}
                 on:blur={(e) => renameFolder(folder, e.currentTarget.value)}
                 bind:this={editFolderInput}
               />
             {:else}
               <!-- Normal Mode -->
               <div class="group">
                 <button
                   class="w-full flex items-center px-2 py-1.5 text-sm rounded-lg transition-all duration-300 ease-out hover:scale-[1.01] {selectedFolder === folder.id ? 'bg-accent-100 dark:bg-accent-900 text-accent-800 dark:text-accent-200 border border-accent-200 dark:border-accent-800 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'}"
                   on:click={() => selectedFolder = folder.id}
                 >
                   <span class="text-lg mr-2">{folder.icon || '📁'}</span>
                   <span class="flex-1 text-left truncate">{folder.name}</span>
                   <span class="text-xs opacity-60 mr-2">
                     {notes.filter(note => note.folder_path.includes(folder.id)).length}
                   </span>
                   
                   <!-- Folder Menu Button (inside the button) -->
                   {#if folder.id !== 'default'}
                     <span
                       class="opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-slate-100/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white transition-all duration-200 hover:scale-110"
                       on:click|stopPropagation={() => toggleFolderMenu(folder.id)}
                       on:keydown|stopPropagation={(e) => {
                         if (e.key === 'Enter' || e.key === ' ') {
                           e.preventDefault();
                           toggleFolderMenu(folder.id);
                         }
                       }}
                       role="button"
                       tabindex="0"
                       title="Folder options"
                     >
                       <Icon src={EllipsisVertical} class="w-4 h-4" />
                     </span>
                   {/if}
                 </button>
               </div>
             {/if}

            <!-- Folder Menu Dropdown -->
            {#if folderMenuOpen === folder.id && folder.id !== 'default'}
              <div
                class="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10"
                transition:scale={{ duration: 150, start: 0.95 }}
              >
                <button
                  class="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  on:click={() => { startEditFolder(folder); folderMenuOpen = null; }}
                >
                  <Icon src={PencilSquare} class="w-4 h-4 mr-2" />
                  Rename
                </button>
                <button
                  class="w-full flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  on:click={() => deleteFolder(folder.id)}
                >
                  <Icon src={Trash} class="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Notes List -->
  <div class="flex-1 min-h-0 overflow-y-auto">
    {#if loading}
      <div class="flex items-center justify-center p-8">
        <div class="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-transparent animate-spin"></div>
        <span class="ml-2 text-sm text-slate-500 dark:text-slate-400">Loading...</span>
      </div>
    {:else if error}
      <div class="p-4 text-center">
        <p class="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button
          class="mt-2 px-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 accent-ring"
          on:click={loadNotes}
        >
          Retry
        </button>
      </div>
    {:else if filteredNotes.length === 0}
      <div class="p-4 text-center">
        {#if searchQuery || selectedFolder !== 'all'}
          <p class="text-sm text-slate-500 dark:text-slate-400">No notes match your filters.</p>
          <button
            class="mt-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            on:click={() => { searchQuery = ''; selectedFolder = 'all'; }}
          >
            Clear filters
          </button>
        {:else}
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">No notes yet.</p>
          <button
            class="px-4 py-2 text-sm rounded-lg accent-bg text-white transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
            on:click={createNewNote}
          >
            Create your first note
          </button>
        {/if}
      </div>
    {:else}
      <div class="space-y-1 p-2">
        {#each filteredNotes as note (note.id)}
          <div class="note-menu-container relative">
            <div
              class="note-item p-3 rounded-lg cursor-pointer transition-all duration-300 ease-out hover:bg-slate-50 dark:hover:bg-slate-700 hover:scale-[1.01] hover:shadow-sm group {selectedNoteId === note.id ? 'bg-accent-100 dark:bg-accent-900 border border-accent-200 dark:border-accent-800 shadow-sm' : 'text-slate-900 dark:text-white border border-transparent'}"
              on:click={() => selectNote(note)}
              on:keydown={(e) => e.key === 'Enter' && selectNote(note)}
              role="button"
              tabindex="0"
              in:fly={{ y: 20, duration: 300, delay: 30, easing: quintOut }}
            >
              <!-- Note Header -->
              <div class="flex items-start justify-between mb-2">
                <h3 class="font-medium text-sm line-clamp-1 flex-1 pr-2 {selectedNoteId === note.id ? 'text-accent-800 dark:text-accent-200' : 'text-slate-900 dark:text-white'}">
                  {note.title || 'Untitled Note'}
                </h3>
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    class="p-2 rounded-md bg-slate-100/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white transition-all duration-200 hover:scale-110"
                    on:click={(e) => { e.stopPropagation(); toggleNoteMenu(note.id); }}
                    title="Note options"
                  >
                    <Icon src={EllipsisVertical} class="w-4 h-4" />
                  </button>
                </div>
              </div>

            <!-- Note Preview -->
            <p class="text-xs {selectedNoteId === note.id ? 'text-accent-700 dark:text-accent-300' : 'text-slate-500 dark:text-slate-400'} line-clamp-2 mb-2">
              {getPreviewText(note)}
            </p>

            <!-- Note Meta -->
            <div class="flex items-center justify-between text-xs {selectedNoteId === note.id ? 'text-accent-600 dark:text-accent-400' : 'text-slate-400 dark:text-slate-500'}">
              <div class="flex items-center space-x-2">
                {#if note.folder_path.length > 0 && note.folder_path[0] !== 'default'}
                  <span class="inline-flex items-center">
                    <Icon src={FolderOpen} class="w-3 h-3 mr-1" />
                    {getFolderName(note.folder_path[0])}
                  </span>
                {/if}
                
                {#if note.tags.length > 0}
                  <span class="inline-flex items-center">
                    <Icon src={Tag} class="w-3 h-3 mr-1" />
                    {note.tags.length}
                  </span>
                {/if}
              </div>
              
              <div class="flex items-center space-x-2">
                <span>{note.metadata.word_count} words</span>
                <span>•</span>
                <span>{formatDate(note.updated_at)}</span>
              </div>
            </div>
          </div>

          <!-- Note Menu Dropdown -->
          {#if noteMenuOpen === note.id}
            <div
              class="absolute right-0 top-0 mt-8 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10"
              transition:scale={{ duration: 150, start: 0.95 }}
            >
              <button
                class="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                on:click={() => { showMoveNoteModal = note; noteMenuOpen = null; }}
              >
                <Icon src={FolderOpen} class="w-4 h-4 mr-2" />
                Move to folder
              </button>
              <button
                class="w-full flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                on:click={() => { deleteNote(note.id, new Event('click')); noteMenuOpen = null; }}
              >
                <Icon src={Trash} class="w-4 h-4 mr-2" />
                Delete note
              </button>
            </div>
          {/if}
        </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Footer Stats -->
  <div class="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
    <div class="text-xs text-slate-500 dark:text-slate-400 text-center">
      {filteredNotes.length} of {notes.length} notes
      {#if notes.length > 0}
        • {notes.reduce((sum, note) => sum + note.metadata.word_count, 0)} total words
      {/if}
    </div>
  </div>
</div>

<!-- Move Note Modal -->
{#if showMoveNoteModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    transition:fly={{ y: 50, duration: 200 }}
  >
    <div
      class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Move Note</h3>
        <button
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          on:click={() => showMoveNoteModal = null}
        >
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6">
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Move "{showMoveNoteModal.title || 'Untitled Note'}" to:
        </p>
        
        <div class="space-y-2">
          {#each folders as folder (folder.id)}
            <button
              class="w-full flex items-center px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 {showMoveNoteModal.folder_path.includes(folder.id) ? 'accent-bg text-white border-transparent' : ''}"
                             on:click={() => showMoveNoteModal && moveNoteToFolder(showMoveNoteModal, folder.id)}
              disabled={showMoveNoteModal.folder_path.includes(folder.id)}
            >
              <span class="text-lg mr-3">{folder.icon || '📁'}</span>
              <span class="flex-1 text-left">{folder.name}</span>
              {#if showMoveNoteModal.folder_path.includes(folder.id)}
                <span class="text-xs opacity-60">Current</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex justify-end p-6 border-t border-slate-200 dark:border-slate-700">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => showMoveNoteModal = null}
        >
          Cancel
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Search Modal -->
<NotesSearch
  bind:isOpen={showSearchModal}
  {folders}
  on:selectNote={handleSearchNoteSelect}
  on:close={() => showSearchModal = false}
/>

<style>
  .note-item:hover .opacity-0 {
    opacity: 1;
  }

  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style> 