<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    disabled?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    content,
    placement = 'top',
    delay = 300,
    disabled = false,
    class: className = '',
    children
  }: Props = $props();

  let showTooltip = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let tooltipElement = $state<HTMLElement>();

  function handleMouseEnter() {
    if (disabled) return;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      showTooltip = true;
    }, delay);
  }

  function handleMouseLeave() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    showTooltip = false;
  }

  function handleFocus() {
    if (disabled) return;
    showTooltip = true;
  }

  function handleBlur() {
    showTooltip = false;
  }

  let placementClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  let arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800'
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="relative inline-block {className}"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onfocus={handleFocus}
  onblur={handleBlur}
  role="tooltip"
>
  {@render children()}
  
  {#if showTooltip && content}
    <div
      bind:this={tooltipElement}
      class="absolute z-50 px-2 py-1 text-xs text-white bg-slate-800 rounded shadow-lg whitespace-nowrap pointer-events-none {placementClasses[placement]}"
      role="tooltip"
    >
      {content}
      <div class="absolute w-0 h-0 border-4 {arrowClasses[placement]}"></div>
    </div>
  {/if}
</div>
