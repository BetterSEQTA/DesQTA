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
  }

  let { assessments, subjects, activeSubjects }: Props = $props();
  
  // Assessment card height for virtual scrolling (estimated)
  const ASSESSMENT_CARD_HEIGHT = 120;

  function scrollToSubject(event: MouseEvent, subjectCode: string) {
    event.preventDefault();
    const element = document.getElementById(`subject-${subjectCode}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Add highlight class
      element.classList.add('highlight-subject');
      // Remove highlight class after animation
      setTimeout(() => {
        element.classList.remove('highlight-subject');
      }, 1500);
    }
  }
</script>

<div class="flex flex-col gap-6 lg:flex-row">
  <!-- Quick Navigation Sidebar -->
  <div class="flex-shrink-0 lg:w-48">
    <div
      class="sticky top-6 p-4 rounded-xl border backdrop-blur-sm bg-slate-100/80 dark:bg-slate-800/50 border-slate-300/50 dark:border-slate-700/50">
      <h3 class="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-400">Quick Jump</h3>
      <div class="space-y-2">
        {#each subjects.filter(subject => assessments.some(a => a.code === subject.code)) as subject}
          <a
            href="#subject-{subject.code}"
            class="flex gap-2 items-center px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            onclick={(e) => scrollToSubject(e, subject.code)}>
            <div
              class="w-2 h-2 rounded-full"
              style="background-color: {subject.colour || '#8e8e8e'}">
            </div>
            <span class="text-sm truncate">{subject.code}</span>
            {#if activeSubjects && activeSubjects.some((as: any) => as.code === subject.code)}
              <span class="text-xs opacity-75">(Active)</span>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 space-y-6">
    {#each subjects.filter(subject => assessments.some(a => a.code === subject.code)) as subject}
      <div
        id="subject-{subject.code}"
        class="overflow-hidden rounded-xl border backdrop-blur-sm bg-slate-100/80 dark:bg-slate-800/50 border-slate-300/50 dark:border-slate-700/50">
        <div class="px-4 py-4 border-b sm:px-6 border-slate-300/50 dark:border-slate-700/50">
          <div class="flex gap-3 items-center justify-between">
            <div class="flex gap-3 items-center">
              <div
                class="w-3 h-3 rounded-full"
                style="background-color: {subject.colour || '#8e8e8e'}">
              </div>
              <h3 class="text-base font-bold sm:text-lg text-slate-900 dark:text-white">
                {subject.title}
              </h3>
              <span class="text-sm text-slate-600 dark:text-slate-400">({subject.code})</span>
              {#if activeSubjects && activeSubjects.some((as: any) => as.code === subject.code)}
                <span class="text-xs bg-green-500 text-white px-2 py-0.5 rounded">Active</span>
              {/if}
            </div>

          </div>
        </div>
        <div class="p-4 space-y-4">
          {#if assessments.filter((a) => a.code === subject.code).length > 20}
            <VirtualList
              items={assessments.filter((a) => a.code === subject.code)}
              itemHeight={ASSESSMENT_CARD_HEIGHT}
              containerHeight={600}
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
  </div>
</div>

<style>
  @keyframes highlight {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 10px rgba(99, 102, 241, 0.2);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
  }

  .highlight-subject {
    animation: highlight 1.5s ease-out;
  }
</style> 