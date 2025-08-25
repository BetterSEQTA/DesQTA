<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { MagnifyingGlass, XMark } from 'svelte-hero-icons';
  import Input from './Input.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    value?: string;
    placeholder?: string;
    debounceMs?: number;
    clearable?: boolean;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    class?: string;
    onSearch?: (query: string) => void;
    onClear?: () => void;
    searchIcon?: any;
    rightAction?: Snippet;
  }

  let {
    value = $bindable(''),
    placeholder = 'Search...',
    debounceMs = 300,
    clearable = true,
    size = 'md',
    disabled = false,
    class: className = '',
    onSearch,
    onClear,
    searchIcon = MagnifyingGlass,
    rightAction
  }: Props = $props();

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (onSearch) {
      timeoutId = setTimeout(() => {
        onSearch(value);
      }, debounceMs);
    }
  }

  function handleClear() {
    value = '';
    if (onClear) {
      onClear();
    } else if (onSearch) {
      onSearch('');
    }
  }

  let showClearButton = $derived(clearable && value.length > 0);
</script>

<Input
  type="search"
  bind:value
  {placeholder}
  {size}
  {disabled}
  class={className}
  leftIcon={searchIcon}
  oninput={handleInput}
>
  {#snippet rightAction()}
    {#if showClearButton}
      <button
        onclick={handleClear}
        class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        aria-label="Clear search"
      >
        <Icon src={XMark} size="16" class="text-slate-400 dark:text-slate-500" />
      </button>
    {:else if rightAction}
      {@render rightAction()}
    {/if}
  {/snippet}
</Input>
