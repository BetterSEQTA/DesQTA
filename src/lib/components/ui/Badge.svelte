<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { XMark } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: any;
    dot?: boolean;
    removable?: boolean;
    class?: string;
    onremove?: () => void;
    children?: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    icon,
    dot = false,
    removable = false,
    class: className = '',
    onremove,
    children
  }: Props = $props();

  const variants = {
    default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    primary: 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
    secondary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  };

  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-sm'
  };

  const iconSizes = {
    xs: '10',
    sm: '12',
    md: '14',
    lg: '16'
  };

  const dotColors = {
    default: 'bg-slate-400',
    primary: 'bg-accent-500',
    secondary: 'bg-purple-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500'
  };

  let baseClasses = $derived([
    'inline-flex items-center gap-1 font-medium rounded-full transition-all duration-200',
    variants[variant],
    sizes[size],
    className
  ].filter(Boolean).join(' '));
</script>

<span class={baseClasses}>
  {#if dot}
    <span class="w-2 h-2 rounded-full {dotColors[variant]}"></span>
  {:else if icon}
    <Icon src={icon} size={iconSizes[size]} />
  {/if}
  
  {#if children}
    {@render children()}
  {/if}
  
  {#if removable}
    <button
      onclick={onremove}
      class="ml-1 rounded-full hover:bg-current hover:bg-opacity-20 p-0.5 transition-colors"
      aria-label="Remove badge"
    >
      <Icon src={XMark} size="12" />
    </button>
  {/if}
</span>


