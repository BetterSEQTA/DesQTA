<script lang="ts">
  interface Props {
    class?: string;
    variant?: 'default' | 'chart' | 'modal';
    height?: string;
  }

  let { class: className = '', variant = 'default', height = 'auto' }: Props = $props();
</script>

{#if variant === 'chart'}
  <div 
    class="flex flex-col gap-4 p-6 animate-pulse {className}" 
    style="height: {height}"
  >
    <div class="flex justify-between items-start">
      <div class="space-y-2">
        <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-6 w-32"></div>
        <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-4 w-48"></div>
      </div>
      <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-9 w-40"></div>
    </div>
    <div class="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
    <div class="flex justify-between">
      <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-4 w-24"></div>
      <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-4 w-32"></div>
    </div>
  </div>
{:else if variant === 'modal'}
  <div 
    class="flex flex-col gap-6 p-8 animate-pulse {className}" 
    style="height: {height}"
  >
    <div class="flex justify-between items-start">
      <div class="space-y-3">
        <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-8 w-48"></div>
        <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-5 w-72"></div>
      </div>
      <div class="bg-zinc-200 dark:bg-zinc-700 rounded-full h-10 w-10"></div>
    </div>
    <div class="space-y-4 flex-1">
      {#each Array(5) as _}
        <div class="bg-zinc-200 dark:bg-zinc-700 rounded h-16"></div>
      {/each}
    </div>
  </div>
{:else}
  <div 
    class="bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse {className}" 
    style="height: {height}"
  ></div>
{/if}
