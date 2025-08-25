<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { Icon, DocumentText } from 'svelte-hero-icons';
  import { Badge } from '$lib/components/ui';

  const studentId = 69; //! literally changes nothing but was used in the original seqta code.

  let upcomingAssessments = $state<any[]>([]);
  let activeSubjects = $state<any[]>([]);
  let subjectFilters = $state<Record<string, boolean>>({});
  let loadingAssessments = $state<boolean>(true);

  const filteredAssessments = $derived(
    upcomingAssessments.filter((a: any) => subjectFilters[a.code]),
  );

  async function loadLessonColours() {
    const res = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { request: 'userPrefs', asArray: true, user: studentId },
    });
    return JSON.parse(res).payload;
  }

  async function loadAssessments() {
    loadingAssessments = true;

    try {
      // Check cache first
      const cachedData = cache.get<{
        assessments: any[];
        subjects: any[];
        filters: Record<string, boolean>;
      }>('upcoming_assessments_data');

      if (cachedData) {
        upcomingAssessments = cachedData.assessments;
        activeSubjects = cachedData.subjects;
        subjectFilters = cachedData.filters;
        loadingAssessments = false;
        return;
      }

      const [assessmentsRes, classesRes] = await Promise.all([
        seqtaFetch('/seqta/student/assessment/list/upcoming?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: { student: studentId },
        }),
        seqtaFetch('/seqta/student/load/subjects?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {},
        }),
      ]);

      const colours = await loadLessonColours();

      const classesResJson = JSON.parse(classesRes);
      const activeClass = classesResJson.payload.find((c: any) => c.active);
      activeSubjects = activeClass ? activeClass.subjects : [];

      activeSubjects.forEach((s: any) => {
        if (!(s.code in subjectFilters)) subjectFilters[s.code] = true;
      });

      const activeCodes = activeSubjects.map((s: any) => s.code);

      upcomingAssessments = JSON.parse(assessmentsRes)
        .payload.filter((a: any) => activeCodes.includes(a.code))
        .filter((a: any) => new Date(a.due) >= new Date())
        .map((a: any) => {
          const prefName = `timetable.subject.colour.${a.code}`;
          const c = colours.find((p: any) => p.name === prefName);
          a.colour = c ? c.value : '#8e8e8e';
          return a;
        })
        .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));

      // Cache all the data for 1 hour
      cache.set(
        'upcoming_assessments_data',
        {
          assessments: upcomingAssessments,
          subjects: activeSubjects,
          filters: subjectFilters,
        },
        60,
      );
    } catch (e) {
      console.error('Error loading assessments:', e);
    } finally {
      loadingAssessments = false;
    }
  }

  function getStatusBadge(status: string, due: string) {
    const dueDate = new Date(due);
    const now = new Date();

    if (status === 'MARKS_RELEASED') {
      return { text: 'Marked', variant: 'success' as const };
    } else if (dueDate < now) {
      return { text: 'Overdue', variant: 'danger' as const };
    } else if (dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return { text: 'Due Soon', variant: 'warning' as const };
    } else {
      return { text: 'Upcoming', variant: 'info' as const };
    }
  }

  onMount(async () => {
    await loadAssessments();
  });
</script>

<div
  class="overflow-hidden relative rounded-2xl border shadow-xl backdrop-blur-sm bg-white/80 dark:bg-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
  <div
    class="flex justify-between items-center px-4 py-3 bg-gradient-to-br border-b from-slate-100/70 dark:from-slate-800/70 to-slate-100/30 dark:to-slate-800/30 border-slate-300/50 dark:border-slate-700/50">
    <span class="pr-4 text-xl font-semibold text-slate-900 dark:text-white text-nowrap"
      >Upcoming Assessments</span>
    <div class="flex overflow-x-scroll gap-2" id="upcoming-filters">
      {#each activeSubjects as subj}
        <label
          class="flex items-center px-2.5 py-1.5 text-xs rounded-lg border transition-all duration-200 cursor-pointer sm:px-3 sm:text-sm bg-white/60 dark:bg-slate-800/60 border-slate-200/40 dark:border-slate-700/40 hover:accent-bg hover:text-white">
          <input
            type="checkbox"
            bind:checked={subjectFilters[subj.code]}
            class="mr-2 w-3.5 h-3.5 text-slate-600 dark:text-slate-400 rounded border-slate-300 sm:w-4 sm:h-4 form-checkbox dark:border-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900" />
          <span class="transition-colors duration-200" style="color: {subj.colour}">{subj.code}</span>
        </label>
      {/each}
    </div>
  </div>

  {#if loadingAssessments}
    <div class="flex flex-col justify-center items-center py-12 sm:py-16">
      <div
        class="w-12 h-12 rounded-full border-4 animate-spin sm:w-16 sm:h-16 border-accent/30 border-t-accent">
      </div>
      <p class="mt-4 text-sm text-slate-600 sm:text-base dark:text-slate-400">
        Loading assessments...
      </p>
    </div>
  {:else if filteredAssessments.length === 0}
    <div class="flex flex-col justify-center items-center py-12 sm:py-16">
      <div
        class="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-600 text-2xl sm:text-3xl shadow-[0_0_20px_rgba(var(--accent-color-value),0.3)] animate-gradient">
        🎉
      </div>
      <p class="mt-4 text-lg text-slate-700 sm:text-xl dark:text-slate-300">
        Nothing coming up!
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
      {#each filteredAssessments as a}
        <div
          class="flex flex-col gap-4 p-4 sm:p-5 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(var(--accent-color-value),0.2)] relative group">
          <div
            class="absolute inset-0 bg-gradient-to-br rounded-xl opacity-30 animate-gradient"
            style="background: linear-gradient(135deg, {a.colour}20, {a.colour}05);">
          </div>
          <div
            class="absolute inset-0 rounded-xl border"
            style="border: 1px solid {a.colour}30;">
          </div>

          <div class="flex relative z-10 gap-4 items-center">
            <div
              class="flex justify-center items-center w-12 h-12 bg-gradient-to-br rounded-xl shadow-lg sm:h-14 sm:w-14 animate-gradient transition-all duration-200 hover:scale-105"
              style="background: linear-gradient(135deg, {a.colour}, {a.colour}dd);">
              <Icon src={DocumentText} class="w-6 h-6 text-white" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap gap-2 items-center">
                <div class="text-sm font-bold dark:text-white sm:text-base">
                  {new Date(a.due).toLocaleDateString('en-AU', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <Badge
                  variant={getStatusBadge(a.status, a.due).variant}
                  size="xs"
                >
                  {getStatusBadge(a.status, a.due).text}
                </Badge>
              </div>
              <div class="mt-1">
                <span
                  class="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400"
                  >{a.subject}</span>
                <span
                  class="block text-sm font-semibold truncate text-slate-900 dark:text-white sm:text-base"
                  >{a.title}</span>
              </div>
            </div>
          </div>

          {#if a.description}
            <div class="relative z-10 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
              {a.description}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div> 