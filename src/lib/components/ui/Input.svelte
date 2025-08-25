<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    error?: string;
    label?: string;
    hint?: string;
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    leftIcon?: any;
    rightIcon?: any;
    class?: string;
    inputClass?: string;
    id?: string;
    name?: string;
    autocomplete?: string;
    min?: number;
    max?: number;
    step?: number;
    maxlength?: number;
    pattern?: string;
    onchange?: (e: Event) => void;
    oninput?: (e: Event) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    onfocus?: (e: FocusEvent) => void;
    onblur?: (e: FocusEvent) => void;
    rightAction?: Snippet;
  }

  let {
    type = 'text',
    value = $bindable(''),
    placeholder,
    disabled = false,
    readonly = false,
    required = false,
    error,
    label,
    hint,
    size = 'md',
    fullWidth = false,
    leftIcon,
    rightIcon,
    class: className = '',
    inputClass = '',
    id,
    name,
    autocomplete,
    min,
    max,
    step,
    maxlength,
    pattern,
    onchange,
    oninput,
    onkeydown,
    onfocus,
    onblur,
    rightAction
  }: Props = $props();

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const iconSizes = {
    sm: '16',
    md: '18',
    lg: '20'
  };

  let hasError = $derived(!!error);
  let hasLeftIcon = $derived(!!leftIcon);
  let hasRightIcon = $derived(!!rightIcon || !!rightAction);

  let containerClasses = $derived([
    fullWidth ? 'w-full' : '',
    className
  ].filter(Boolean).join(' '));

  let inputClasses = $derived([
    'w-full border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1',
    hasError 
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
      : 'border-slate-300 dark:border-slate-600 focus:border-accent-500 focus:ring-accent-500',
    'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100',
    'placeholder-slate-400 dark:placeholder-slate-500',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    readonly ? 'bg-slate-50 dark:bg-slate-700' : '',
    hasLeftIcon ? 'pl-10' : '',
    hasRightIcon ? 'pr-10' : '',
    sizes[size],
    inputClass
  ].filter(Boolean).join(' '));

  let labelClasses = $derived([
    'block text-sm font-medium mb-1',
    hasError ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300',
    required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ''
  ].filter(Boolean).join(' '));
</script>

<div class={containerClasses}>
  {#if label}
    <label for={id} class={labelClasses}>
      {label}
    </label>
  {/if}
  
  <div class="relative">
    {#if hasLeftIcon}
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon 
          src={leftIcon} 
          size={iconSizes[size]} 
          class="text-slate-400 dark:text-slate-500" 
        />
      </div>
    {/if}
    
    <input
      {type}
      {id}
      {name}
      {placeholder}
      {disabled}
      {readonly}
      {required}
      autocomplete={autocomplete as any}
      {min}
      {max}
      {step}
      {maxlength}
      {pattern}
      bind:value
      class={inputClasses}
      onchange={onchange}
      oninput={oninput}
      onkeydown={onkeydown}
      onfocus={onfocus}
      onblur={onblur}
    />
    
    {#if hasRightIcon || rightAction}
      <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
        {#if rightAction}
          {@render rightAction()}
        {:else if rightIcon}
          <Icon 
            src={rightIcon} 
            size={iconSizes[size]} 
            class="text-slate-400 dark:text-slate-500" 
          />
        {/if}
      </div>
    {/if}
  </div>
  
  {#if error}
    <p class="mt-1 text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  {:else if hint}
    <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
      {hint}
    </p>
  {/if}
</div>
