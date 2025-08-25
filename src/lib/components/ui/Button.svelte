<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning' | 'info';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    disabled?: boolean;
    loading?: boolean;
    icon?: any;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
    class?: string;
    ariaLabel?: string;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    type = 'button',
    onclick = () => {},
    class: className = '',
    ariaLabel,
    children
  }: Props = $props();

  const variants = {
    primary: 'bg-accent-500 text-white hover:bg-accent-600 focus:ring-accent-500 border-transparent',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 focus:ring-slate-500 border-transparent',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 focus:ring-slate-500 border-transparent',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 border-transparent',
    success: 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500 border-transparent',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 border-transparent',
    info: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 border-transparent'
  };

  const sizes = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg'
  };

  const iconSizes = {
    xs: '12',
    sm: '14',
    md: '16',
    lg: '18',
    xl: '20'
  };

  let baseClasses = $derived([
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-all duration-200 transform',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    fullWidth ? 'w-full' : '',
    !disabled && !loading ? 'hover:scale-105 active:scale-95' : '',
    variants[variant],
    sizes[size],
    className
  ].filter(Boolean).join(' '));
</script>

<button
  {type}
  class={baseClasses}
  {disabled}
  onclick={onclick}
  aria-label={ariaLabel}
  aria-busy={loading}
>
  {#if loading}
    <div class="animate-spin rounded-full border-2 border-transparent border-t-current w-4 h-4"></div>
  {:else if icon && iconPosition === 'left'}
    <Icon src={icon} size={iconSizes[size]} />
  {/if}
  
  {#if children}
    {@render children()}
  {/if}
  
  {#if !loading && icon && iconPosition === 'right'}
    <Icon src={icon} size={iconSizes[size]} />
  {/if}
</button>
