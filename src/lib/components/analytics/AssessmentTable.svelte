<script lang="ts">
  import type { Assessment } from '$lib/types';
  import { Icon, ChevronDown, ChevronRight } from 'svelte-hero-icons';
  import { slide } from 'svelte/transition';

  interface Props {
    data: Assessment[];
  }

  let { data }: Props = $props();

  let expandedSubjects: Record<string, boolean> = $state({});

  function toggleSubject(subject: string) {
    expandedSubjects[subject] = !expandedSubjects[subject];
  }

  function getLetterGrade(percentage: number | undefined): string {
    if (percentage === undefined) return '';
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 40) return 'D';
    return 'E';
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'MARKS_RELEASED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }

  // Group assessments by subject
  const groupedAssessments = $derived(() => {
    const grouped: Record<string, Assessment[]> = {};
    data.forEach(assessment => {
      if (!grouped[assessment.subject]) {
        grouped[assessment.subject] = [];
      }
      grouped[assessment.subject].push(assessment);
    });
    return grouped;
  });
</script>

<div class="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
  <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
    <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Assessment Details</h3>
  </div>

  <div class="max-h-96 overflow-y-auto">
    {#each Object.entries(groupedAssessments) as [subject, assessments]}
      <div class="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
        <!-- Subject Header -->
        <button
          onclick={() => toggleSubject(subject)}
          class="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <Icon 
              src={expandedSubjects[subject] ? ChevronDown : ChevronRight} 
              class="w-5 h-5 text-slate-600 dark:text-slate-400" 
            />
            <span class="font-semibold text-slate-900 dark:text-white">{subject}</span>
            <span class="text-sm text-slate-500 dark:text-slate-400">
              ({assessments.length} assessment{assessments.length !== 1 ? 's' : ''})
            </span>
          </div>
        </button>

        <!-- Assessment List -->
        {#if expandedSubjects[subject]}
          <div transition:slide={{ duration: 300 }} class="bg-slate-50 dark:bg-slate-700/30">
            {#each assessments as assessment}
              <div class="px-6 py-3 border-t border-slate-200 dark:border-slate-600 flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-1">
                    <h4 class="font-medium text-slate-900 dark:text-white truncate">
                      {assessment.title}
                    </h4>
                    <span class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(assessment.status)}">
                      {assessment.status}
                    </span>
                  </div>
                  <div class="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <span>Due: {formatDate(assessment.due)}</span>
                    {#if assessment.code}
                      <span>Code: {assessment.code}</span>
                    {/if}
                  </div>
                </div>
                
                {#if assessment.finalGrade !== undefined}
                  <div class="text-right">
                    <div class="text-lg font-bold text-slate-900 dark:text-white">
                      {assessment.finalGrade}%
                    </div>
                    <div class="text-sm text-slate-600 dark:text-slate-400">
                      {getLetterGrade(assessment.finalGrade)}
                    </div>
                  </div>
                {:else}
                  <div class="text-sm text-slate-500 dark:text-slate-400">
                    No grade
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if Object.keys(groupedAssessments).length === 0}
    <div class="px-6 py-12 text-center">
      <p class="text-slate-500 dark:text-slate-400">No assessments match the current filters.</p>
    </div>
  {/if}
</div>
