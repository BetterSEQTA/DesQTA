<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'elevated' | 'outlined' | 'ghost';
    padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    interactive?: boolean;
    class?: string;
    onclick?: () => void;
    children?: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    variant = 'default',
    padding = 'md',
    interactive = false,
    class: className = '',
    onclick,
    children,
    header,
    footer
  }: Props = $props();

  const variants = {
    default: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
    elevated: 'bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700',
    outlined: 'bg-transparent border-2 border-slate-200 dark:border-slate-700',
    ghost: 'bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50'
  };

  const paddings = {
    none: '',
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  let baseClasses = $derived([
    'rounded-lg transition-all duration-200',
    variants[variant],
    interactive ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02] transform' : '',
    className
  ].filter(Boolean).join(' '));

  let contentClasses = $derived([
    paddings[padding]
  ].join(' '));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div 
  class={baseClasses}
  onclick={onclick}
  role={interactive ? 'button' : undefined}
  tabindex={interactive ? 0 : undefined}
>
  {#if header}
    <div class="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
      {@render header()}
    </div>
  {/if}
  
  {#if children}
    <div class={contentClasses}>
      {@render children()}
    </div>
  {/if}
  
  {#if footer}
    <div class="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
      {@render footer()}
    </div>
  {/if}
</div>
