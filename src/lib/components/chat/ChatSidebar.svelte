<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ChatBubbleLeftRight } from 'svelte-hero-icons';
  import type { Friend, Group } from './types.js';
  import { getFullPfpUrl } from './types.js';

  let { 
    cloudUser, 
    friends, 
    friendsLoading, 
    friendsError, 
    groups, 
    groupsLoading, 
    groupsError, 
    selectedFriend, 
    selectedGroup, 
    creatingGroup, 
    onSelectFriend, 
    onSelectGroup, 
    onCreateGroup 
  } = $props<{
    cloudUser: any;
    friends: Friend[];
    friendsLoading: boolean;
    friendsError: string | null;
    groups: Group[];
    groupsLoading: boolean;
    groupsError: string | null;
    selectedFriend: Friend | null;
    selectedGroup: Group | null;
    creatingGroup: boolean;
    onSelectFriend: (friend: Friend) => void;
    onSelectGroup: (group: Group) => void;
    onCreateGroup: () => void;
  }>();
</script>

<aside class="w-64 min-w-[200px] max-w-xs bg-white/10 dark:bg-slate-900/60 border-r border-slate-300/50 dark:border-slate-800/50 shadow-md rounded-xl m-2 p-4 flex flex-col gap-4 backdrop-blur-sm">
  {#if cloudUser}
    <div class="flex items-center gap-3 mb-4">
      {#if cloudUser.pfpUrl}
        <img src={getFullPfpUrl(cloudUser.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${cloudUser.id}`} alt={cloudUser.displayName || cloudUser.username} class="w-10 h-10 rounded-full object-cover" />
      {:else}
        <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${cloudUser.id}`} alt={cloudUser.displayName || cloudUser.username} class="w-10 h-10 rounded-full object-cover" />
      {/if}
      <div>
        <div class="font-semibold text-base text-slate-900 dark:text-white">{cloudUser.displayName || cloudUser.username}</div>
        <div class="text-xs text-slate-500 dark:text-slate-300">{cloudUser.email}</div>
      </div>
    </div>
  {/if}
  
  <div class="flex items-center justify-between mb-2">
    <h2 class="font-semibold text-lg text-slate-900 dark:text-white">Conversations</h2>
    <button 
      class="px-3 py-1 rounded-lg bg-orange-500 text-white text-xs hover:bg-orange-600 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 ring-orange-500" 
      on:click={onCreateGroup}
    >
      + New Group
    </button>
  </div>

  <div class="flex-1 overflow-y-auto">
    <!-- Groups Section -->
    {#if groupsLoading}
      <div class="text-slate-500 dark:text-slate-300 text-sm mb-4">Loading groups...</div>
    {:else if groupsError}
      <div class="text-red-500 dark:text-red-400 text-sm mb-4">{groupsError}</div>
    {:else if groups.length > 0}
      <div class="mb-6">
        <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 px-2">Groups</h3>
        <div class="space-y-1">
          {#each groups as group}
            <button 
              class="flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-all duration-200 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedGroup?.id === group.id ? 'bg-accent-500/20 text-accent-500' : 'text-slate-900 dark:text-white'}" 
              on:click={() => onSelectGroup(group)}
            >
              {#if group.iconUrl}
                <img src={getFullPfpUrl(group.iconUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`} alt={group.name} class="w-10 h-10 rounded-full object-cover" />
              {:else}
                <div class="w-10 h-10 rounded-full bg-accent-500 flex items-center justify-center">
                  <Icon src={ChatBubbleLeftRight} class="w-5 h-5 text-white" />
                </div>
              {/if}
              <div class="flex-1 text-left">
                <div class="font-medium text-sm">{group.name}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">Group</div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Direct Messages Section -->
    {#if friendsLoading}
      <div class="text-slate-500 dark:text-slate-300 text-sm">Loading friends...</div>
    {:else if friendsError}
      <div class="text-red-500 dark:text-red-400 text-sm">{friendsError}</div>
    {:else if friends.length === 0}
      <div class="text-slate-500 dark:text-slate-300 text-sm">No friends found.</div>
    {:else}
      <div>
        <h3 class="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3 px-2">Direct Messages</h3>
        <div class="space-y-1">
          {#each friends as friend}
            <button 
              class="flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-all duration-200 hover:bg-accent-100/30 dark:hover:bg-accent-700/30 hover:scale-[1.02] focus:outline-none focus:ring-2 ring-accent-500 {selectedFriend?.id === friend.id ? 'bg-accent-500/20 text-accent-500' : 'text-slate-900 dark:text-white'}" 
              on:click={() => onSelectFriend(friend)}
            >
              {#if friend.pfpUrl}
                <img src={getFullPfpUrl(friend.pfpUrl) || `https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-10 h-10 rounded-full object-cover" />
              {:else}
                <img src={`https://api.dicebear.com/7.x/thumbs/svg?seed=${friend.id}`} alt={friend.displayName || friend.username} class="w-10 h-10 rounded-full object-cover" />
              {/if}
              <div class="flex-1 text-left">
                <div class="font-medium text-sm">{friend.displayName || friend.username}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">@{friend.username}</div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</aside> 