<script lang="ts">
  import AssessmentCard from './AssessmentCard.svelte';
  import VirtualList from './VirtualList.svelte';
  import VirtualAssessmentCard from './VirtualAssessmentCard.svelte';

  interface Assessment {
    id: number;
    title: string;
    code: string;
    due: string;
    status: string;
    colour: string;
    metaclass: number;
  }

  interface Subject {
    title: string;
    code: string;
    colour: string;
    metaclass: number;
  }

  interface Props {
    assessments: Assessment[];
    subjects: Subject[];
    activeSubjects: Subject[];
    groupBy: 'subject' | 'month' | 'status';
    onGroupByChange: (group: 'subject' | 'month' | 'status') => void;
  }

  let { assessments, subjects, activeSubjects, groupBy, onGroupByChange }: Props = $props();
  
  // Assessment card height for virtual scrolling (estimated)
  const ASSESSMENT_CARD_HEIGHT = 120;

  function getStatusBadge(status: string, due: string) {
    const dueDate = new Date(due);
    const now = new Date();

    if (status === 'MARKS_RELEASED') {
      return { text: 'Marked', color: 'bg-green-500' };
    } else if (dueDate < now) {
      return { text: 'Overdue', color: 'bg-red-500' };
    } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return { text: 'Due Soon', color: 'bg-yellow-500' };
    } else {
      return { text: 'Upcoming', color: 'bg-blue-500' };
    }
  }

  function getMonthName(date: Date) {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  function getAssessmentsByMonth() {
    const grouped = new Map<string, Assessment[]>();
    assessments.forEach((assessment) => {
      const date = new Date(assessment.due);
      const monthKey = getMonthName(date);
      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, []);
      }
      grouped.get(monthKey)?.push(assessment);
    });
    return Array.from(grouped.entries()).sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    });
  }

  function getAssessmentsByStatus() {
    const grouped = new Map<string, Assessment[]>();
    assessments.forEach((assessment) => {
      const status = getStatusBadge(assessment.status, assessment.due).text;
      if (!grouped.has(status)) {
        grouped.set(status, []);
      }
      grouped.get(status)?.push(assessment);
    });
    return Array.from(grouped.entries()).sort((a, b) => {
      const order = ['Overdue', 'Due Soon', 'Upcoming', 'Marked'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
  }
</script>

<div class="space-y-6">
  <div class="flex gap-2 justify-end">
    <button
      class="px-4 py-2 rounded-lg transition-all duration-300 text-sm {groupBy === 'subject'
        ? 'accent-bg text-white shadow-lg accent-shadow'
        : 'bg-slate-200/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-700/50'}"
      onclick={() => onGroupByChange('subject')}>
      Group by Subject
    </button>
    <button
      class="px-4 py-2 rounded-lg transition-all duration-300 text-sm {groupBy === 'month'
        ? 'accent-bg text-white shadow-lg accent-shadow'
        : 'bg-slate-200/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-700/50'}"
      onclick={() => onGroupByChange('month')}>
      Group by Month
    </button>
    <button
      class="px-4 py-2 rounded-lg transition-all duration-300 text-sm {groupBy === 'status'
        ? 'accent-bg text-white shadow-lg accent-shadow'
        : 'bg-slate-200/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-slate-700/50'}"
      onclick={() => onGroupByChange('status')}>
      Group by Status
    </button>
  </div>

  <div
    class="flex overflow-x-auto gap-4 pb-4 scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-slate-300/20 dark:scrollbar-track-slate-800/10">
    {#if groupBy === 'subject'}
      {#each subjects.filter(subject => assessments.some(a => a.code === subject.code)) as subject}
        <div class="flex-shrink-0 w-72 sm:w-80">
          <div
            class="p-4 mb-4 rounded-xl border border-l-8 backdrop-blur-sm bg-slate-100/80 dark:bg-slate-800/50 border-slate-300/50 dark:border-slate-700/50"
            style="border-color: {subject.colour || '#8e8e8e'};">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
                  {subject.title}
                </h3>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  {subject.code}
                  {#if activeSubjects && activeSubjects.some((as: any) => as.code === subject.code)}
                    <span class="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded">Active</span>
                  {/if}
                </p>
              </div>

            </div>
          </div>
          <div class="space-y-4">
            {#if assessments.filter((a) => a.code === subject.code).length > 10}
              <VirtualList
                items={assessments.filter((a) => a.code === subject.code)}
                itemHeight={ASSESSMENT_CARD_HEIGHT}
                containerHeight={400}
                keyFunction={(item) => item.id}
                let:item>
                <VirtualAssessmentCard {item} index={0} />
              </VirtualList>
            {:else}
              {#each assessments.filter((a) => a.code === subject.code) as assessment}
                <AssessmentCard {assessment} />
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {:else if groupBy === 'month'}
      {#each getAssessmentsByMonth() as [month, monthAssessments]}
        <div class="flex-shrink-0 w-72 sm:w-80">
          <div
            class="p-4 mb-4 rounded-xl border border-l-8 backdrop-blur-sm bg-slate-800/50 border-slate-700/50">
            <h3 class="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
              {month}
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {monthAssessments.length} assessment{monthAssessments.length === 1 ? '' : 's'}
            </p>
          </div>
          <div class="space-y-4">
            {#if monthAssessments.length > 10}
              <VirtualList
                items={monthAssessments}
                itemHeight={ASSESSMENT_CARD_HEIGHT}
                containerHeight={400}
                keyFunction={(item) => item.id}
                let:item>
                <VirtualAssessmentCard {item} index={0} showSubject={true} />
              </VirtualList>
            {:else}
              {#each monthAssessments as assessment}
                <AssessmentCard {assessment} showSubject={true} />
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {:else if groupBy === 'status'}
      {#each getAssessmentsByStatus() as [status, statusAssessments]}
        <div class="flex-shrink-0 w-72 sm:w-80">
          <div
            class="p-4 mb-4 rounded-xl border border-l-8 backdrop-blur-sm bg-slate-800/50 border-slate-700/50"
            style="border-color: {getStatusBadge(statusAssessments[0].status, statusAssessments[0].due)
              .color};">
            <h3 class="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
              {status}
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {statusAssessments.length} assessment{statusAssessments.length === 1 ? '' : 's'}
            </p>
          </div>
          <div class="space-y-4">
            {#if statusAssessments.length > 10}
              <VirtualList
                items={statusAssessments}
                itemHeight={ASSESSMENT_CARD_HEIGHT}
                containerHeight={400}
                keyFunction={(item) => item.id}
                let:item>
                <VirtualAssessmentCard {item} index={0} showSubject={true} />
              </VirtualList>
            {:else}
              {#each statusAssessments as assessment}
                <AssessmentCard {assessment} showSubject={true} />
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .scrollbar-thin::-webkit-scrollbar {
    height: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(99, 102, 241, 0.3);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(99, 102, 241, 0.5);
  }
</style> 