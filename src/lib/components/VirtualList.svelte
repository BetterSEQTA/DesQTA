<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Snippet } from 'svelte';

  type Item = any;

  interface Props {
    items: Item[];
    itemHeight: number;
    containerHeight?: number;
    itemComponent?: Snippet<[{ item: Item; index: number }]>;
    overscan?: number;
    keyFunction?: (item: Item, index: number) => string | number;
    class?: string;
    children?: Snippet<[{ item: Item; index: number }]>;
  }

  let {
    items,
    itemHeight,
    containerHeight = 400,
    itemComponent,
    overscan = 5,
    keyFunction = (item: Item, index: number) => index,
    class: className = "",
    children
  }: Props = $props();

  let scrollTop = $state(0);
  let containerElement: HTMLDivElement;
  let innerElement: HTMLDivElement;

  // Calculate visible range
  const startIndex = $derived(Math.max(0, Math.floor(scrollTop / itemHeight) - overscan));
  const endIndex = $derived(Math.min(items.length - 1, Math.floor((scrollTop + containerHeight) / itemHeight) + overscan));
  const visibleItems = $derived(items.slice(startIndex, endIndex + 1));

  // Calculate total height and offset
  const totalHeight = $derived(items.length * itemHeight);
  const offsetY = $derived(startIndex * itemHeight);

  function handleScroll() {
    if (containerElement) {
      scrollTop = containerElement.scrollTop;
    }
  }

  onMount(() => {
    if (containerElement) {
      containerElement.addEventListener('scroll', handleScroll);
    }
  });

  onDestroy(() => {
    if (containerElement) {
      containerElement.removeEventListener('scroll', handleScroll);
    }
  });
</script>

<div
  bind:this={containerElement}
  class="overflow-auto {className}"
  style="height: {containerHeight}px;">
  <div
    bind:this={innerElement}
    style="height: {totalHeight}px; position: relative;">
    <div
      style="transform: translateY({offsetY}px);">
      {#each visibleItems as item, index (keyFunction(item, startIndex + index))}
        <div
          style="height: {itemHeight}px;"
          class="virtual-item">
          {#if itemComponent}
            {@render itemComponent({ item, index: startIndex + index })}
          {:else if children}
            {@render children({ item, index: startIndex + index })}
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-item {
    display: flex;
    align-items: stretch;
  }
  
  .virtual-item > :global(*) {
    flex: 1;
  }
</style> 