<script lang="ts">
  import type { Friend } from './types.js';
  import { getFullPfpUrl } from './types.js';

  let { 
    open, 
    friends, 
    newGroupName, 
    newGroupMembers, 
    creatingGroup, 
    onCreateGroup, 
    onClose 
  } = $props<{
    open: boolean;
    friends: Friend[];
    newGroupName: string;
    newGroupMembers: string[];
    creatingGroup: boolean;
    onCreateGroup: () => void;
    onClose: () => void;
  }>();
</script>

{#if open}
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" 
    role="dialog" 
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    on:click={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
  >
    <div 
      class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4" 
      role="document"
    >
      <div 
        class="p-6" 
        role="presentation"
        on:click|stopPropagation
        on:keydown|stopPropagation
      >
        <div class="flex items-center justify-between mb-6">
          <h3 id="modal-title" class="text-xl font-semibold text-slate-900 dark:text-white">Create New Group</h3>
          <button 
            type="button"
            class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" 
            on:click={onClose}
            aria-label="Close modal"
          >
            <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form on:submit|preventDefault={onCreateGroup} class="space-y-4">
          <div>
            <label for="group-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Group Name</label>
            <input 
              id="group-name"
              type="text" 
              class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 ring-accent-500 focus:border-transparent transition-all duration-200" 
              placeholder="Enter group name..." 
              bind:value={newGroupName} 
              required 
            />
          </div>
          
          <div>
            <label for="group-members" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Add Members</label>
            <div id="group-members" class="space-y-2 max-h-48 overflow-y-auto border border-slate-300 dark:border-slate-600 rounded-lg p-2 bg-slate-50 dark:bg-slate-700/50">
              {#each friends ?? [] as friend}
                <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer">
                  <input 
                    type="checkbox" 
                    class="w-4 h-4 text-accent-500 bg-white dark:bg-slate-600 border-slate-300 dark:border-slate-500 rounded focus:ring-accent-500 focus:ring-2" 
                    bind:group={newGroupMembers} 
                    value={friend.id} 
                  />
                  {#if friend.pfpUrl}
                    <img src={getFullPfpUrl(friend.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-8 h-8 rounded-full object-cover" />
                  {:else}
                    <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-8 h-8 rounded-full object-cover" />
                  {/if}
                  <div class="flex-1">
                    <div class="text-sm font-medium text-slate-900 dark:text-white">{friend.displayName || friend.username}</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">@{friend.username}</div>
                  </div>
                </label>
              {/each}
            </div>
            {#if newGroupMembers.length > 0}
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">{newGroupMembers.length} member{newGroupMembers.length === 1 ? '' : 's'} selected</p>
            {/if}
          </div>
          
          <div class="flex gap-3 pt-4">
            <button 
              type="button"
              class="flex-1 px-4 py-3 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-500 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 ring-slate-400" 
              on:click={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="flex-1 px-4 py-3 rounded-lg bg-accent-500 text-white font-medium hover:bg-accent-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
              disabled={!newGroupName.trim() || newGroupMembers.length === 0 || creatingGroup}
            >
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if} 