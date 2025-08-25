<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import { Icon, ChevronDown, ChevronRight } from 'svelte-hero-icons';
  import type { Assessment } from '$lib/types';
  import { DataTable, SearchInput, Badge } from '$lib/components/ui';

  export let data: Assessment[] = [];
  export let groupBySubject = true;

  // Filter state
  let filterSubject = '';
  let filterStatus = '';
  let filterMinGrade: number | null = null;
  let filterMaxGrade: number | null = null;
  let filterSearch = '';

  let expandedSubjects: Record<string, boolean> = {};
  let expandedYears: Record<string, boolean> = {};

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

  function toggleSubject(subject: string) {
    expandedSubjects[subject] = !expandedSubjects[subject];
  }

  function toggleYear(year: string) {
    expandedYears[year] = !expandedYears[year];
  }

  // Helper function to get year from due date
  function getYearFromDue(due: string): string {
    return new Date(due).getFullYear().toString();
  }

  // Helper function to group by year and subject
  function groupByYearAndSubject(data: Assessment[]): Record<string, Record<string, Assessment[]>> {
    const grouped: Record<string, Record<string, Assessment[]>> = {};
    if (!data) return grouped;
    
    for (const a of data) {
      const year = getYearFromDue(a.due);
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][a.subject]) grouped[year][a.subject] = [];
      grouped[year][a.subject].push(a);
    }
    
    // Sort years in descending order
    return Object.fromEntries(
      Object.entries(grouped).sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA))
    );
  }

  // Helper function to group by subject (keeping for backward compatibility)
  function groupBySubjectData(data: Assessment[]): Record<string, Assessment[]> {
    const grouped: Record<string, Assessment[]> = {};
    if (!data) return grouped;
    for (const a of data) {
      if (!grouped[a.subject]) grouped[a.subject] = [];
      grouped[a.subject].push(a);
    }
    return grouped;
  }

  function getFilteredAssessments(data: Assessment[]): Assessment[] {
    if (!data) return [];
    return data.filter((a) => {
      if (filterSubject && a.subject !== filterSubject) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterMinGrade !== null && (a.finalGrade ?? -1) < filterMinGrade) return false;
      if (filterMaxGrade !== null && (a.finalGrade ?? 101) > filterMaxGrade) return false;
      if (
        filterSearch &&
        !(
          a.title.toLowerCase().includes(filterSearch.toLowerCase()) ||
          a.subject.toLowerCase().includes(filterSearch.toLowerCase())
        )
      )
        return false;
      return true;
    });
  }

  function hasActiveFilters() {
    return !!(
      filterSubject ||
      filterStatus ||
      filterMinGrade !== null ||
      filterMaxGrade !== null ||
      filterSearch
    );
  }
</script>

<div class="p-8 rounded-2xl border shadow-xl border-slate-200 bg-white/80 dark:bg-slate-900/80 dark:border-slate-700">
  <h2 class="flex gap-2 items-center mb-6 text-2xl font-bold text-slate-900 dark:text-white">
    <span
      class="flex justify-center items-center w-6 h-6 text-white bg-gradient-to-tr from-indigo-500 to-blue-400 rounded-full shadow">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16" /></svg>
    </span>
    Raw Data
  </h2>
  <div class="flex flex-wrap gap-4 items-end mb-6">
    <div>
      <label
        for="filter-subject"
        class="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
        >Subject</label>
      <select
        id="filter-subject"
        class="px-3 py-2 text-sm bg-white rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        bind:value={filterSubject}>
        <option value="">All</option>
        {#each Array.from(new Set(data.map((a) => a.subject))) as subject}
          <option value={subject}>{subject}</option>
        {/each}
      </select>
    </div>
    <div>
      <label
        for="filter-status"
        class="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
        >Status</label>
      <select
        id="filter-status"
        class="px-3 py-2 text-sm bg-white rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        bind:value={filterStatus}>
        <option value="">All</option>
        <option value="MARKS_RELEASED">Marks Released</option>
        <option value="OVERDUE">Overdue</option>
        <option value="PENDING">Pending</option>
        <option value="UPCOMING">Upcoming</option>
      </select>
    </div>
    <div>
      <label
        for="filter-min-grade"
        class="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
        >Min Grade</label>
      <input
        id="filter-min-grade"
        type="number"
        min="0"
        max="100"
        class="px-3 py-2 w-20 text-sm bg-white rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        bind:value={filterMinGrade}
        placeholder="0" />
    </div>
    <div>
      <label
        for="filter-max-grade"
        class="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
        >Max Grade</label>
      <input
        id="filter-max-grade"
        type="number"
        min="0"
        max="100"
        class="px-3 py-2 w-20 text-sm bg-white rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        bind:value={filterMaxGrade}
        placeholder="100" />
    </div>
    <div class="flex-1 min-w-[160px]">
      <label
        for="filter-search"
        class="block mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
        >Search</label>
      <input
        id="filter-search"
        type="text"
        class="px-3 py-2 w-full text-sm bg-white rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
        bind:value={filterSearch}
        placeholder="Title or subject..." />
    </div>
    {#if hasActiveFilters()}
      <button
        class="px-4 py-2 ml-2 text-sm font-semibold rounded-lg transition-all duration-200 transform text-slate-800 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
        on:click={() => {
          filterSubject = '';
          filterStatus = '';
          filterMinGrade = null;
          filterMaxGrade = null;
          filterSearch = '';
        }}>
        Clear Filters
      </button>
    {/if}
  </div>
  <div class="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
    Showing {hasActiveFilters()
      ? getFilteredAssessments(data).length
      : data.length} entr{(hasActiveFilters()
      ? getFilteredAssessments(data).length
      : data.length) === 1
      ? 'y'
      : 'ies'}
  </div>
  <div class="overflow-x-auto">
    {#if hasActiveFilters()}
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead>
          <tr>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Subject</th>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Title</th>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Grade</th>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Due Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
          {#each getFilteredAssessments(data) as assessment}
            <tr>
              <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                >{assessment.subject}</td>
              <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                >{assessment.title}</td>
              <td class="px-6 py-4 text-sm whitespace-nowrap">
                {#if assessment.finalGrade !== undefined}
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {assessment.finalGrade >=
                    80
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : assessment.finalGrade >= 60
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                    {assessment.finalGrade}% {getLetterGrade(assessment.finalGrade)}
                  </span>
                {:else}
                  <span class="text-slate-500">Not graded</span>
                {/if}
              </td>
              <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                >{new Date(assessment.due).toLocaleDateString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else if groupBySubject}
      {#each Object.entries(groupByYearAndSubject(data)) as [year, subjects]}
        <div
          class="overflow-hidden mb-4 rounded-xl border border-slate-200 dark:border-slate-700"
          in:slide={{ duration: 350 }}>
          <button
            class="w-full flex items-center justify-between px-6 py-3 bg-accent-700 text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 accent-ring font-semibold text-left text-lg"
            on:click={() => toggleYear(year)}>
            <span class="flex gap-2 items-center">
              {#if expandedYears[year]}
                <Icon src={ChevronDown} class="w-5 h-5 text-white" />
              {:else}
                <Icon src={ChevronRight} class="w-5 h-5 text-white" />
              {/if}
              <span>{year}</span>
            </span>
          </button>
          {#if expandedYears[year]}
            <div transition:fade={{ duration: 250 }} class="p-4 space-y-4">
              {#each Object.entries(subjects) as [subject, assessments]}
                <div
                  class="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                  in:slide={{ duration: 350 }}>
                  <button
                    class="w-full flex items-center justify-between px-6 py-3 bg-accent-600 text-white transition-all duration-200 transform hover:scale-[1.02] active:scale-95 focus:outline-none focus:ring-2 accent-ring font-semibold text-left text-lg"
                    on:click={() => toggleSubject(subject)}>
                    <span class="flex gap-2 items-center">
                      {#if expandedSubjects[subject]}
                        <Icon src={ChevronDown} class="w-5 h-5 text-white" />
                      {:else}
                        <Icon src={ChevronRight} class="w-5 h-5 text-white" />
                      {/if}
                      <span>{subject}</span>
                    </span>
                  </button>
                  {#if expandedSubjects[subject]}
                    <div transition:fade={{ duration: 250 }}>
                      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead>
                          <tr>
                            <th
                              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
                              >Title</th>
                            <th
                              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
                              >Grade</th>
                            <th
                              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
                              >Due Date</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                          {#each assessments as assessment}
                            <tr>
                              <td
                                class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                                >{assessment.title}</td>
                              <td class="px-6 py-4 text-sm whitespace-nowrap">
                                {#if assessment.finalGrade !== undefined}
                                  <span
                                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {assessment.finalGrade >=
                                    80
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : assessment.finalGrade >= 60
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                                    {assessment.finalGrade}% {getLetterGrade(assessment.finalGrade)}
                                  </span>
                                {:else}
                                  <span class="text-slate-500">Not graded</span>
                                {/if}
                              </td>
                              <td
                                class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                                >{new Date(assessment.due).toLocaleDateString()}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {:else}
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead>
          <tr>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Subject</th>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Title</th>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Grade</th>
            <th
              class="px-6 py-3 text-xs font-medium tracking-wider text-left uppercase text-slate-500 dark:text-slate-400"
              >Due Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
          {#each data as assessment}
            <tr>
              <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                >{assessment.subject}</td>
              <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                >{assessment.title}</td>
              <td class="px-6 py-4 text-sm whitespace-nowrap">
                {#if assessment.finalGrade !== undefined}
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {assessment.finalGrade >=
                    80
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : assessment.finalGrade >= 60
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                    {assessment.finalGrade}% {getLetterGrade(assessment.finalGrade)}
                  </span>
                {:else}
                  <span class="text-slate-500">Not graded</span>
                {/if}
              </td>
              <td class="px-6 py-4 text-sm whitespace-nowrap text-slate-900 dark:text-slate-100"
                >{new Date(assessment.due).toLocaleDateString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div> 