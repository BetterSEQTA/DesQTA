<script lang="ts">
  import type { Assessment } from '$lib/types';

  interface Props {
    data: Assessment[];
    width?: number;
    height?: number;
  }

  let { data, width = 800, height = 300 }: Props = $props();

  const padding = 50;
  const yTicks = [0, 20, 40, 60, 80, 100];

  // Process monthly data
  const monthlyPoints = $derived(() => {
    if (!data?.length) return [];
    
    const monthlyData: Record<string, number[]> = {};
    
    data.forEach((assessment) => {
      if (assessment.finalGrade !== undefined) {
        const date = new Date(assessment.due);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
        monthlyData[monthKey].push(assessment.finalGrade);
      }
    });

    return Object.entries(monthlyData)
      .map(([month, grades]) => ({
        month,
        avg: grades.reduce((sum, grade) => sum + grade, 0) / grades.length
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });

  const showMonthEvery = $derived(Math.max(1, Math.floor(monthlyPoints().length / 8)));

  let tooltip = $state({ show: false, x: 0, y: 0, month: '', avg: 0 });

  function showTooltip(event: MouseEvent, point: { month: string; avg: number }) {
    tooltip = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      month: point.month,
      avg: point.avg
    };
  }

  function hideTooltip() {
    tooltip.show = false;
  }
</script>

<div class="flex-1 min-w-[400px] flex flex-col">
  <h3 class="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Average Grade by Month</h3>
  <div class="w-full overflow-x-auto">
    {#if monthlyPoints().length > 0}
      <div class="w-full min-w-[600px] line-graph-container" style="position:relative;">
        <svg 
          class="w-full h-auto max-w-full" 
          {height} 
          viewBox="0 0 {width} {height}" 
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet">
          <!-- Y-axis -->
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="currentColor"
            stroke-width="2" />
          <!-- X-axis -->
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="currentColor"
            stroke-width="2" />
          
          <!-- Y-axis ticks and labels -->
          {#each yTicks as tick}
            <line
              x1={padding - 5}
              y1={height - padding - (tick / 100) * (height - 2 * padding)}
              x2={padding}
              y2={height - padding - (tick / 100) * (height - 2 * padding)}
              stroke="currentColor"
              stroke-width="2" />
            <text
              x={padding - 10}
              y={height - padding - (tick / 100) * (height - 2 * padding) + 4}
              text-anchor="end"
              font-size="14"
              fill="currentColor">{tick}</text>
          {/each}
          
          <!-- X-axis month labels -->
          {#each monthlyPoints() as point, i}
            {#if i % showMonthEvery === 0 || i === monthlyPoints().length - 1}
              <text
                x={padding + (i / Math.max(monthlyPoints().length - 1, 1)) * (width - 2 * padding)}
                y={height - padding + 24}
                text-anchor="middle"
                font-size="14"
                fill="currentColor"
                transform={`rotate(-35,${padding + (i / Math.max(monthlyPoints().length - 1, 1)) * (width - 2 * padding)},${height - padding + 24})`}
                >{point.month}</text>
            {/if}
          {/each}
          
          <!-- Line path -->
          {#if monthlyPoints().length > 1}
            <polyline
              fill="none"
              stroke="var(--accent-color-value)"
              stroke-width="2.5"
              points={monthlyPoints()
                .map(
                  (p: {month: string; avg: number}, i: number) =>
                    `${padding + (i / Math.max(monthlyPoints().length - 1, 1)) * (width - 2 * padding)},${height - padding - (p.avg / 100) * (height - 2 * padding)}`,
                )
                .join(' ')} />
          {/if}
          
          <!-- Points -->
          {#each monthlyPoints() as point, i}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              cx={padding + (i / Math.max(monthlyPoints().length - 1, 1)) * (width - 2 * padding)}
              cy={height - padding - (point.avg / 100) * (height - 2 * padding)}
              r="6"
              fill="var(--accent-color-value)"
              stroke="white"
              stroke-width="2"
              class="cursor-pointer hover:r-8 transition-all duration-200"
              onmouseenter={(e) => showTooltip(e, point)}
              onmouseleave={hideTooltip} />
          {/each}
        </svg>
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-32 text-slate-500 dark:text-slate-400">
        <p class="text-lg">No graded assessments found</p>
        <p class="text-sm">Complete some assessments to see your progress!</p>
      </div>
    {/if}
  </div>
</div>

{#if tooltip.show}
  <div
    class="fixed z-50 px-3 py-2 text-sm bg-slate-800 text-white rounded-lg shadow-lg pointer-events-none"
    style="left: {tooltip.x + 10}px; top: {tooltip.y - 10}px;">
    <div class="font-medium">{tooltip.month}</div>
    <div>Average: {tooltip.avg.toFixed(1)}%</div>
  </div>
{/if}

<style>
  .line-graph-container {
    color: var(--text-color, #ffffff);
  }
</style>
