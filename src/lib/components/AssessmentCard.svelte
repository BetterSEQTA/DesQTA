<script lang="ts">
  import { Badge } from '$lib/components/ui';

  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    colour: string;
    metaclass: number;
  }

  interface Props {
    assessment: Assessment;
    showSubject?: boolean;
  }

  let { assessment, showSubject = false }: Props = $props();

  function getStatusBadge(status: string, due: string) {
    const dueDate = new Date(due);
    const now = new Date();

    if (status === 'MARKS_RELEASED') {
      return { text: 'Marked', variant: 'success' as const };
    } else if (dueDate < now) {
      return { text: 'Overdue', variant: 'danger' as const };
    } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      // Within 7 days
      return { text: 'Due Soon', variant: 'warning' as const };
    } else {
      return { text: 'Upcoming', variant: 'info' as const };
    }
  }

  const isMarked = $derived(assessment.status === 'MARKS_RELEASED');
  const detailsTab = $derived(isMarked ? 'details' : 'overview');
</script>

<a
  href="/assessments/{assessment.id}/{assessment.metaclass}?tab={detailsTab}#top"
  class="block bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border-l-8 border border-slate-300/50 dark:border-slate-700/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
  style="border-color: {assessment.colour};">
  <div class="flex gap-2 items-center">
    <div class="text-sm font-semibold text-slate-600 dark:text-slate-400">
      {new Date(assessment.due).toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}
    </div>
    <Badge 
      variant={getStatusBadge(assessment.status, assessment.due).variant}
      size="xs"
    >
      {getStatusBadge(assessment.status, assessment.due).text}
    </Badge>
  </div>
  <h4 class="mt-1 font-bold truncate text-slate-900 dark:text-white">
    {assessment.title}
  </h4>
  {#if showSubject}
    <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
      {assessment.code}
    </p>
  {/if}
</a> 