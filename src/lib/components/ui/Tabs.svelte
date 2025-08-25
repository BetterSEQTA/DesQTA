<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Tab {
    id: string;
    label: string;
    icon?: any;
    disabled?: boolean;
    badge?: string | number;
  }

  interface Props {
    tabs: Tab[];
    activeTab?: string;
    variant?: 'default' | 'pills' | 'underline';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    class?: string;
    onTabChange?: (tabId: string) => void;
    children?: Snippet<[string]>; // activeTab
  }

  let {
    tabs,
    activeTab = $bindable(tabs[0]?.id || ''),
    variant = 'default',
    size = 'md',
    fullWidth = false,
    class: className = '',
    onTabChange,
    children
  }: Props = $props();

  function handleTabClick(tab: Tab) {
    if (tab.disabled) return;
    activeTab = tab.id;
    if (onTabChange) {
      onTabChange(tab.id);
    }
  }

  const variants = {
    default: {
      container: 'border-b border-slate-200 dark:border-slate-700',
      tab: 'border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600',
      active: 'border-accent-500 text-accent-600 dark:text-accent-400',
      inactive: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
    },
    pills: {
      container: 'bg-slate-100 dark:bg-slate-800 rounded-lg p-1',
      tab: 'rounded-md transition-all duration-200',
      active: 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm',
      inactive: 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
    },
    underline: {
      container: '',
      tab: 'border-b-2 border-transparent',
      active: 'border-accent-500 text-accent-600 dark:text-accent-400',
      inactive: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
    }
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  let containerClasses = $derived([
    'flex',
    fullWidth ? 'w-full' : '',
    variants[variant].container,
    className
  ].filter(Boolean).join(' '));

  let tabClasses = $derived((tab: Tab) => [
    'inline-flex items-center gap-2 font-medium cursor-pointer transition-all duration-200',
    fullWidth ? 'flex-1 justify-center' : '',
    sizes[size],
    variants[variant].tab,
    tab.id === activeTab ? variants[variant].active : variants[variant].inactive,
    tab.disabled ? 'opacity-50 cursor-not-allowed' : ''
  ].filter(Boolean).join(' '));
</script>

<div>
  <nav class={containerClasses}>
    {#each tabs as tab}
      <button
        class={tabClasses(tab)}
        onclick={() => handleTabClick(tab)}
        disabled={tab.disabled}
        aria-selected={tab.id === activeTab}
        role="tab"
      >
        {#if tab.icon}
          <Icon src={tab.icon} size="16" />
        {/if}
        
        <span>{tab.label}</span>
        
        {#if tab.badge}
          <span class="ml-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-full px-2 py-0.5 text-xs">
            {tab.badge}
          </span>
        {/if}
      </button>
    {/each}
  </nav>
  
  {#if children}
    <div class="mt-4">
      {@render children(activeTab)}
    </div>
  {/if}
</div>


