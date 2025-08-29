<script lang="ts">
  interface Props {
    value: number;
    max?: number;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    showLabel?: boolean;
    label?: string;
    animated?: boolean;
    striped?: boolean;
    class?: string;
  }

  let {
    value,
    max = 100,
    size = 'md',
    variant = 'default',
    showLabel = false,
    label,
    animated = false,
    striped = false,
    class: className = ''
  }: Props = $props();

  let percentage = $derived(Math.max(0, Math.min(100, (value / max) * 100)));
  let displayLabel = $derived(label || `${Math.round(percentage)}%`);

  const sizes = {
    xs: 'h-1',
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const variants = {
    default: 'bg-accent-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500'
  };

  let containerClasses = $derived([
    'w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden',
    sizes[size],
    className
  ].filter(Boolean).join(' '));

  let barClasses = $derived([
    'h-full transition-all duration-300 ease-out rounded-full',
    variants[variant],
    striped ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:1rem_1rem]' : '',
    animated && striped ? 'animate-pulse' : '',
    animated ? 'transition-all duration-500' : ''
  ].filter(Boolean).join(' '));
</script>

<div class="space-y-1">
  {#if showLabel}
    <div class="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
      <span>{displayLabel}</span>
      <span>{value} / {max}</span>
    </div>
  {/if}
  
  <div class={containerClasses} role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax={max}>
    <div 
      class={barClasses}
      style="width: {percentage}%"
    ></div>
  </div>
</div>
