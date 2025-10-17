<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { AnalyticsData, Assessment } from '$lib/types';
  import { seqtaFetch } from '../../utils/netUtil';
  import { fade } from 'svelte/transition';
  import { Button } from '$lib/components/ui';
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import RawDataTable from '$lib/components/RawDataTable.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import { Icon, MagnifyingGlass, Trash } from 'svelte-hero-icons';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';

  let analyticsData: AnalyticsData | null = $state(null);
  let loading = $state(true);
  let error: string | null = $state(null);
  let showGrabData = $state(false);
  let showDeleteModal = $state(false);
  let deleteLoading = $state(false);
  let deleteError: string | null = $state(null);

  type AreaChartComponent = typeof import('$lib/components/analytics/AnalyticsAreaChart.svelte').default;
  type BarChartComponent = typeof import('$lib/components/analytics/AnalyticsBarChart.svelte').default;

  let areaChartComponent = $state<AreaChartComponent | null>(null);
  let barChartComponent = $state<BarChartComponent | null>(null);
  let chartsLoading = $state(false);

  const loadChartComponents = async () => {
    if (chartsLoading || (areaChartComponent && barChartComponent)) return;
    chartsLoading = true;
    try {
      const [areaModule, barModule] = await Promise.all([
        import('$lib/components/analytics/AnalyticsAreaChart.svelte'),
        import('$lib/components/analytics/AnalyticsBarChart.svelte')
      ]);
      areaChartComponent = areaModule.default;
      barChartComponent = barModule.default;
    } finally {
      chartsLoading = false;
    }
  };

  const studentId = 69;

  // Filter state
  let filterSubjects: string[] = $state([]);
  let filterMinGrade: number | null = $state(null);
  let filterMaxGrade: number | null = $state(null);
  let filterSearch = $state('');
  let gradeRange = $state([0, 100]);

  function isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  }

  function parseAssessment(data: any): Assessment | null {
    try {
      if (!data || typeof data !== 'object') return null;

      const assessment: Assessment = {
        id: Number(data.id),
        title: String(data.title || ''),
        subject: String(data.subject || ''),
        status: String(data.status || 'PENDING') as 'OVERDUE' | 'MARKS_RELEASED' | 'PENDING',
        due: String(data.due || ''),
        code: String(data.code || ''),
        metaclassID: Number(data.metaclassID),
        programmeID: Number(data.programmeID),
        graded: Boolean(data.graded),
        overdue: Boolean(data.overdue),
        hasFeedback: Boolean(data.hasFeedback),
        expectationsEnabled: Boolean(data.expectationsEnabled),
        expectationsCompleted: Boolean(data.expectationsCompleted),
        reflectionsEnabled: Boolean(data.reflectionsEnabled),
        reflectionsCompleted: Boolean(data.reflectionsCompleted),
        availability: String(data.availability || ''),
        finalGrade: data.finalGrade ? Number(data.finalGrade) : undefined,
      };

      if (!assessment.id || !assessment.title || !assessment.subject || !isValidDate(assessment.due)) {
        return null;
      }

      return assessment;
    } catch (e) {
      console.error('Error parsing assessment:', e);
      return null;
    }
  }

  async function grabData() {
    loading = true;
    error = null;
    try {
      // Fetch all folders and all subjects (not just active)
      const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });
      const data = JSON.parse(classesRes);
      const folders = data.payload;
      const allSubjects = folders.flatMap((f: any) => f.subjects);

      // Remove duplicate subjects by programme+metaclass
      const uniqueSubjectsMap = new Map();
      allSubjects.forEach((s: any) => {
        const key = `${s.programme}-${s.metaclass}`;
        if (!uniqueSubjectsMap.has(key)) uniqueSubjectsMap.set(key, s);
      });
      const uniqueSubjects = Array.from(uniqueSubjectsMap.values());

      // Fetch upcoming assessments for current active subjects (optional, can be skipped if you want only past)
      const activeFolder = folders.find((f: any) => f.active === 1);
      const activeSubjects = activeFolder ? activeFolder.subjects : [];
      const assessmentsRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId },
      });
      const upcomingAssessments = JSON.parse(assessmentsRes).payload;

      // Fetch past assessments for every subject ever
      const pastAssessmentsPromises = uniqueSubjects.map((subject: any) =>
        seqtaFetch('/seqta/student/assessment/list/past?', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: {
            programme: subject.programme,
            metaclass: subject.metaclass,
            student: studentId,
          },
        }),
      );
      const pastAssessmentsResponses = await Promise.all(pastAssessmentsPromises);
      const pastAssessments = pastAssessmentsResponses
        .map((res) => JSON.parse(res).payload.tasks || [])
        .flat();

      // Combine and process all assessments
      const allAssessments = [...upcomingAssessments, ...pastAssessments];

      // Remove duplicates by id
      const uniqueAssessmentsMap = new Map();
      allAssessments.forEach((a: any) => {
        if (!uniqueAssessmentsMap.has(a.id)) {
          uniqueAssessmentsMap.set(a.id, a);
        }
      });
      const uniqueAssessments = Array.from(uniqueAssessmentsMap.values());

      // Add finalGrade if marks are released
      const processedAssessments = uniqueAssessments.map((a: any) => {
        let finalGrade = undefined;
        if (a.status === 'MARKS_RELEASED') {
          if (a.criteria && a.criteria[0]?.results?.percentage !== undefined) {
            finalGrade = a.criteria[0].results.percentage;
          } else if (a.results && a.results.percentage !== undefined) {
            finalGrade = a.results.percentage;
          }
        }
        return { ...a, finalGrade };
      });

      // Save to analytics.json via Tauri
      await invoke('save_analytics', {
        data: JSON.stringify(processedAssessments),
      });
      window.location.reload();
    } catch (e) {
      error = $_('analytics.failed_to_grab_data') || 'Failed to grab and save analytics data.';
      loading = false;
    }
  }

  onMount(async () => {
    try {
      console.log('Fetching analytics data...');
      const response = await invoke<string>('load_analytics');
      console.log('Received raw data:', response);
      const parsedData = JSON.parse(response);
      const rawAssessments = Array.isArray(parsedData) ? parsedData : Object.values(parsedData);
      const validAssessments = rawAssessments
        .map(parseAssessment)
        .filter((assessment): assessment is Assessment => assessment !== null);
      console.log('Valid assessments:', validAssessments);
      analyticsData = validAssessments;
      showGrabData = false;

      // Lazy-load chart components after data is loaded
      if (validAssessments.length > 0) {
        loadChartComponents();
      }

    } catch (e) {
      // Do not use console.error here to avoid global error page; show local recovery UI instead
      console.warn('Analytics: no local analytics file found or failed to parse. Prompting user to rebuild.');
      error = '';
      showGrabData = true;
    } finally {
      loading = false;
    }
  });

  $effect(() => {
    if (analyticsData && analyticsData.length > 0) {
      loadChartComponents();
    }
  });

  function openDeleteModal() {
    showDeleteModal = true;
    deleteError = null;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    deleteError = null;
  }

  async function confirmDeleteAnalytics() {
    deleteLoading = true;
    deleteError = null;
    try {
      await invoke('delete_analytics');
      analyticsData = null;
      showGrabData = true;
      showDeleteModal = false;
    } catch (e) {
      deleteError = $_('analytics.failed_to_delete_data') || 'Failed to delete analytics data';
    } finally {
      deleteLoading = false;
    }
  }



  // Derived unique values for filter options
  const uniqueSubjects = $derived(() => {
    if (!analyticsData) return [];
    return [...new Set(analyticsData.map(a => a.subject))].sort();
  });

  function clearFilters() {
    filterSubjects = [];
    filterMinGrade = null;
    filterMaxGrade = null;
    filterSearch = '';
    gradeRange = [0, 100];
  }

  // Sync slider with individual grade filters
  $effect(() => {
    filterMinGrade = gradeRange[0] === 0 ? null : gradeRange[0];
    filterMaxGrade = gradeRange[1] === 100 ? null : gradeRange[1];
  });

  // Derived filtered data
  const filteredData = $derived(() => {
    if (!analyticsData) return [];
    return analyticsData.filter((a) => {
      if (filterSubjects.length && !filterSubjects.includes(a.subject)) return false;
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
  });



  function hasActiveFilters() {
    return !!(
      filterSubjects.length ||
      filterMinGrade !== null ||
      filterMaxGrade !== null ||
      filterSearch
    );
  }

  function calculateMonthlyAverages(data: any[]): Record<string, number> {
    const monthlyGrades: Record<string, { sum: number; count: number }> = {};
    data.forEach((assessment: any) => {
      const date = new Date(assessment.due);
      const monthKey = date.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });
      if (!monthlyGrades[monthKey]) {
        monthlyGrades[monthKey] = { sum: 0, count: 0 };
      }
      monthlyGrades[monthKey].sum += assessment.finalGrade;
      monthlyGrades[monthKey].count += 1;
    });
    const averages: Record<string, number> = {};
    Object.entries(monthlyGrades).forEach(([month, { sum, count }]) => {
      averages[month] = count > 0 ? sum / count : 0;
    });
    // Fill in missing months with the previous month's average
    const monthMap: Record<string, number> = {
      January: 0,
      February: 1,
      March: 2,
      April: 3,
      May: 4,
      June: 5,
      July: 6,
      August: 7,
      September: 8,
      October: 9,
      November: 10,
      December: 11,
    };
    const months = Object.keys(averages).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(Number(yearA), monthMap[monthA], 1);
      const dateB = new Date(Number(yearB), monthMap[monthB], 1);
      return dateA.getTime() - dateB.getTime();
    });
    let lastAvg = 0;
    for (let i = 0; i < months.length; i++) {
      if (averages[months[i]] === undefined || isNaN(averages[months[i]])) {
        averages[months[i]] = lastAvg;
      } else {
        lastAvg = averages[months[i]];
      }
    }
    return averages;
  }
</script>

<div class="container px-6 py-7 mx-auto flex flex-col h-full gap-8">
  <div class="flex justify-between items-start">
    <div>
      <h1 class="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
        <T key="navigation.analytics" fallback="Analytics" />
      </h1>
      <p class="text-zinc-600 dark:text-zinc-400">
        <T key="analytics.description" fallback="Track your academic performance and progress over time" />
      </p>
    </div>

    {#if analyticsData}
    <div>
      <Button class="flex items-center gap-2" variant="ghost" onclick={openDeleteModal}>
        <Icon size="20" src={Trash} />
          <T key="analytics.delete_data" fallback="Delete Data" />
        </Button>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="w-12 h-12 rounded-full border-b-2 border-accent-600 animate-spin"></div>
    </div>
  {:else if showGrabData}
    <div class="flex flex-col gap-6 justify-center items-center flex-1">
      <div
        class="flex flex-col items-center p-8 w-full max-w-lg rounded-2xl border shadow-xl border-zinc-200 bg-white/90 dark:bg-zinc-900/90 dark:border-zinc-700 animate-fade-in-up">
        <svg
          class="mb-4 w-12 h-12 text-accent-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <h2 class="mb-2 text-2xl font-bold text-zinc-900 dark:text-white">
          <T key="analytics.no_data_title" fallback="No Analytics Data" />
        </h2>
        <p class="mb-4 text-center text-zinc-600 dark:text-zinc-300">
          <T key="analytics.no_data_description" fallback="To get started, click Grab Data below. This will securely fetch and save your assessment data locally on your device. Your data never leaves your computer—everything is processed and stored privately for your own analytics." />
        </p>
        <button
          class="px-6 py-3 mt-2 text-lg font-semibold text-white bg-accent-600 rounded-lg transition-all duration-200 transform shadow-xs hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 accent-ring hover:bg-accent-700"
          onclick={grabData}>
          <T key="analytics.grab_data" fallback="Grab Data" />
        </button>
        {#if error}
          <div
            class="px-4 py-3 mt-4 w-full text-center text-red-700 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        {/if}
      </div>
    </div>
  {:else if analyticsData}
    <!-- Compact filters near heading -->
    <div class="flex flex-wrap items-center gap-4 -mb-4" in:fade={{ duration: 400 }}>
      <Select.Root type="multiple" bind:value={filterSubjects}>
        <Select.Trigger class="w-44">
          <span class="truncate">
            {#if filterSubjects.length === 0}
              <T key="analytics.all_subjects" fallback="All Subjects" />
            {:else if filterSubjects.length === 1}
              {filterSubjects[0]}
            {:else}
              <T key="analytics.subjects_selected" fallback="subjects selected" values={{ count: filterSubjects.length }} />
            {/if}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each uniqueSubjects() as subject}
            <Select.Item value={subject} label={subject}>{subject}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>

      <div class="flex items-center gap-2 pl-2">
        <span class="text-xs text-zinc-500 dark:text-zinc-400">
          <T key="analytics.grade_range" fallback="Grade Range" />
        </span>
        <div class="flex items-center gap-2 w-48">
          <Slider type="multiple" bind:value={gradeRange} min={0} max={100} step={1} class="flex-1" />
        </div>
        <div class="text-xs text-zinc-500 dark:text-zinc-400 min-w-fit">
          {gradeRange[0]}%-{gradeRange[1]}%
        </div>
      </div>

      <div class="relative ml-auto">
        <Icon src={MagnifyingGlass} class="absolute left-2 top-1/2 size-4 transform -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        <input
          type="text"
          placeholder={$_('analytics.search_placeholder') || 'Search assessments...'}
          bind:value={filterSearch}
          class="flex pl-7 h-9 w-56 rounded-md border border-zinc-200 bg-white dark:bg-zinc-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-700 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
        />
      </div>
    </div>

    <!-- Main Analytics Charts -->
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2" in:fade={{ duration: 400, delay: 100 }}>
      {#if areaChartComponent && barChartComponent}
        <svelte:component this={areaChartComponent} data={filteredData()} />
        <svelte:component this={barChartComponent} data={filteredData()} />
      {:else}
        <Skeleton variant="chart" height="340px" />
        <Skeleton variant="chart" height="340px" />
      {/if}
    </div>

    <!-- Assessment Data Table -->
    <div in:fade={{ duration: 400, delay: 200 }}>
      <RawDataTable data={filteredData()} />
    </div>

    <div class="flex items-center gap-3 ml-auto pb-4">
      <div class="text-sm text-zinc-600 dark:text-zinc-400">
        <T key="analytics.assessments_count" fallback="assessments shown" values={{ filtered: filteredData().length, total: analyticsData.length }} />
      </div>
      {#if hasActiveFilters()}
        <Button variant="ghost" size="sm" onclick={clearFilters}>
          <T key="analytics.clear_filters" fallback="Clear Filters" />
        </Button>
      {/if}
    </div>
  {:else}
    <div class="text-center text-zinc-500 dark:text-zinc-400">
      <T key="analytics.no_data_available" fallback="No analytics data available" />
    </div>
  {/if}

  <AlertDialog.Root bind:open={showDeleteModal}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>
          <T key="analytics.delete_confirmation_title" fallback="Delete Analytics Data?" />
        </AlertDialog.Title>
        <AlertDialog.Description>
          <T key="analytics.delete_confirmation_description" fallback="Are you sure you want to delete all analytics data? This action cannot be undone." />
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if deleteError}
        <div class="mb-4 text-red-600 dark:text-red-400">{deleteError}</div>
      {/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel onclick={closeDeleteModal} disabled={deleteLoading}>
          <T key="common.cancel" fallback="Cancel" />
        </AlertDialog.Cancel>
        <AlertDialog.Action onclick={confirmDeleteAnalytics} disabled={deleteLoading}>
          {#if deleteLoading}
            <span
              class="inline-block w-5 h-5 mr-2 align-middle rounded-full border-2 border-white animate-spin border-t-transparent"
            ></span>
          {/if}
          <T key="common.delete" fallback="Delete" />
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</div>
