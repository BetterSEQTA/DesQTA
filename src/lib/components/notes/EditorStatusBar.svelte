<script lang="ts">
  // Props
  export let wordCount: number = 0;
  export let characterCount: number = 0;
  export let isFocused: boolean = false;

  // Computed values
  $: readingTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute reading speed
</script>

<div class="editor-status-bar flex items-center justify-between px-4 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30">
  <!-- Left side: Document stats -->
  <div class="flex items-center space-x-4">
    <span class="flex items-center space-x-1">
      <span class="font-medium">{wordCount}</span>
      <span>{wordCount === 1 ? 'word' : 'words'}</span>
    </span>
    
    <span class="flex items-center space-x-1">
      <span class="font-medium">{characterCount}</span>
      <span>{characterCount === 1 ? 'character' : 'characters'}</span>
    </span>

    {#if wordCount > 0}
      <span class="flex items-center space-x-1">
        <span class="font-medium">{readingTime}</span>
        <span>min read</span>
      </span>
    {/if}
  </div>

  <!-- Right side: Editor status -->
  <div class="flex items-center space-x-4">
    <!-- Focus indicator -->
    <div class="flex items-center space-x-1">
      <div class="w-2 h-2 rounded-full {isFocused ? 'bg-green-500' : 'bg-slate-400 dark:bg-slate-600'}"></div>
      <span>{isFocused ? 'Focused' : 'Not focused'}</span>
    </div>

    <!-- Save status placeholder -->
    <span class="text-slate-400 dark:text-slate-500">
      Auto-save enabled
    </span>
  </div>
</div>

<style>
  .editor-status-bar {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style> 