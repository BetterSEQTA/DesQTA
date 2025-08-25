<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { ChevronDown, Check } from 'svelte-hero-icons';
  import { clickOutside } from '$lib/actions/clickOutside.js';
  import type { Snippet } from 'svelte';

  interface DropdownItem {
    id: string;
    label: string;
    icon?: any;
    disabled?: boolean;
    separator?: boolean;
    danger?: boolean;
    onClick?: () => void;
  }

  interface Props {
    items: DropdownItem[];
    trigger?: Snippet;
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
    disabled?: boolean;
    class?: string;
    menuClass?: string;
    buttonText?: string;
    buttonIcon?: any;
    showChevron?: boolean;
    closeOnClick?: boolean;
  }

  let {
    items,
    trigger,
    placement = 'bottom-start',
    disabled = false,
    class: className = '',
    menuClass = '',
    buttonText = 'Menu',
    buttonIcon,
    showChevron = true,
    closeOnClick = true
  }: Props = $props();

  let open = $state(false);
  let dropdownElement: HTMLElement;

  function toggleDropdown() {
    if (disabled) return;
    open = !open;
  }

  function closeDropdown() {
    open = false;
  }

  function handleItemClick(item: DropdownItem) {
    if (item.disabled) return;
    
    if (item.onClick) {
      item.onClick();
    }
    
    if (closeOnClick) {
      closeDropdown();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  }

  let placementClasses = {
    'bottom-start': 'top-full left-0 mt-1',
    'bottom-end': 'top-full right-0 mt-1',
    'top-start': 'bottom-full left-0 mb-1',
    'top-end': 'bottom-full right-0 mb-1'
  };

  let buttonClasses = $derived([
    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300',
    'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg',
    'hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1',
    'transition-all duration-200',
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    className
  ].filter(Boolean).join(' '));

  let menuClasses = $derived([
    'absolute z-50 min-w-48 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
    'rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 dark:divide-slate-700',
    placementClasses[placement],
    menuClass
  ].filter(Boolean).join(' '));
</script>

<div class="relative inline-block text-left" bind:this={dropdownElement}>
  <button
    class={buttonClasses}
    onclick={toggleDropdown}
    onkeydown={handleKeydown}
    {disabled}
    aria-expanded={open}
    aria-haspopup="true"
  >
    {#if trigger}
      {@render trigger()}
    {:else}
      {#if buttonIcon}
        <Icon src={buttonIcon} size="16" />
      {/if}
      
      <span>{buttonText}</span>
      
      {#if showChevron}
        <Icon 
          src={ChevronDown} 
          size="16" 
          class="transition-transform duration-200 {open ? 'rotate-180' : ''}" 
        />
      {/if}
    {/if}
  </button>

  {#if open}
    <div 
      class={menuClasses}
      use:clickOutside={() => closeDropdown()}
      role="menu"
      aria-orientation="vertical"
    >
      {#each items as item}
        {#if item.separator}
          <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
        {:else}
          <button
            class="group flex items-center w-full px-4 py-2 text-sm transition-colors duration-200 {item.disabled ? 'opacity-50 cursor-not-allowed text-slate-400 dark:text-slate-500' : item.danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}"
            onclick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
          >
            {#if item.icon}
              <Icon src={item.icon} size="16" class="mr-3" />
            {/if}
            
            <span class="flex-1 text-left">{item.label}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>
