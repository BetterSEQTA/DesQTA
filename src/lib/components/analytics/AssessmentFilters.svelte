<script lang="ts">
  import type { Assessment } from '$lib/types';
  import { Input, Button } from '$lib/components/ui';

  interface Props {
    data: Assessment[];
    filterSubject: string;
    filterStatus: string;
    filterMinGrade: number | null;
    filterMaxGrade: number | null;
    filterSearch: string;
    onFilter: (filters: {
      subject: string;
      status: string;
      minGrade: number | null;
      maxGrade: number | null;
      search: string;
    }) => void;
  }

  let {
    data,
    filterSubject = $bindable(),
    filterStatus = $bindable(),
    filterMinGrade = $bindable(),
    filterMaxGrade = $bindable(),
    filterSearch = $bindable(),
    onFilter
  }: Props = $props();

  // Convert null values to empty strings for input compatibility
  let minGradeValue = $derived(filterMinGrade?.toString() ?? '');
  let maxGradeValue = $derived(filterMaxGrade?.toString() ?? '');

  const uniqueSubjects = $derived([...new Set(data.map(a => a.subject))]);
  const uniqueStatuses = $derived([...new Set(data.map(a => a.status))]);

  function clearFilters() {
    filterSubject = '';
    filterStatus = '';
    filterMinGrade = null;
    filterMaxGrade = null;
    filterSearch = '';
    onFilter({
      subject: '',
      status: '',
      minGrade: null,
      maxGrade: null,
      search: ''
    });
  }

  function applyFilters() {
    onFilter({
      subject: filterSubject,
      status: filterStatus,
      minGrade: filterMinGrade,
      maxGrade: filterMaxGrade,
      search: filterSearch
    });
  }
</script>

<div class="p-4 mb-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
  <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Filters</h3>
  
  <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
    <!-- Subject Filter -->
    <div>
      <label for="subject-filter" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
      <select
        id="subject-filter"
        bind:value={filterSubject}
        onchange={applyFilters}
        class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
      >
        <option value="">All Subjects</option>
        {#each uniqueSubjects as subject}
          <option value={subject}>{subject}</option>
        {/each}
      </select>
    </div>

    <!-- Status Filter -->
    <div>
      <label for="status-filter" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
      <select
        id="status-filter"
        bind:value={filterStatus}
        onchange={applyFilters}
        class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
      >
        <option value="">All Statuses</option>
        {#each uniqueStatuses as status}
          <option value={status}>{status}</option>
        {/each}
      </select>
    </div>

    <!-- Min Grade -->
    <div>
      <Input
        label="Min Grade"
        type="number"
        min={0}
        max={100}
        value={minGradeValue}
        placeholder="0"
        onchange={(e) => {
          const val = (e.target as HTMLInputElement).value;
          filterMinGrade = val ? parseInt(val) : null;
          applyFilters();
        }}
      />
    </div>

    <!-- Max Grade -->
    <div>
      <Input
        label="Max Grade"
        type="number"
        min={0}
        max={100}
        value={maxGradeValue}
        placeholder="100"
        onchange={(e) => {
          const val = (e.target as HTMLInputElement).value;
          filterMaxGrade = val ? parseInt(val) : null;
          applyFilters();
        }}
      />
    </div>

    <!-- Search -->
    <div>
      <Input
        label="Search"
        type="text"
        bind:value={filterSearch}
        placeholder="Search assessments..."
        oninput={applyFilters}
      />
    </div>
  </div>

  <div class="flex justify-end mt-4">
    <Button variant="ghost" onclick={clearFilters}>
      Clear Filters
    </Button>
  </div>
</div>
