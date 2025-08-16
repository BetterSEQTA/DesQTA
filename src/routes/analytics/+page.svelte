<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import type { AnalyticsData, Assessment } from '$lib/types';
  import { seqtaFetch } from '../../utils/netUtil';
  import { Icon, ChevronDown, ChevronRight } from 'svelte-hero-icons';
  import { fade, slide, scale } from 'svelte/transition';
  import Modal from '$lib/components/Modal.svelte';
  import RawDataTable from '$lib/components/RawDataTable.svelte';
  import GradeDistribution from '$lib/components/GradeDistribution.svelte';

  let analyticsData: AnalyticsData | null = null;
  let loading = true;
  let error: string | null = null;
  let showGrabData = false;
  let showDeleteModal = false;
  let deleteLoading = false;
  let deleteError: string | null = null;

  // Graph dimensions
  const width = 800;
  const height = 400;
  const padding = 40;
  const barWidth = 60;
  const barSpacing = 20;

  let barPaths: { path: string; count: number; status: string }[] = [];
  let yLabels: string[] = [];

  const studentId = 69;

  let expandedSubjects: Record<string, boolean> = {};

  // Filter state
  let filterSubject = '';
  let filterStatus = '';
  let filterMinGrade: number | null = null;
  let filterMaxGrade: number | null = null;
  let filterSearch = '';

  // For the line graph
  const graphWidth = 800;
  const graphHeight = 200;
  const graphPadding = 50;
  const yTicks = [0, 20, 40, 60, 80, 100];

  // Tooltip state for the line graph
  let tooltip = { show: false, x: 0, y: 0, month: '', avg: 0 };

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

      // Validate required fields
      if (
        !assessment.id ||
        !assessment.title ||
        !assessment.subject ||
        !isValidDate(assessment.due)
      ) {
        return null;
      }

      return assessment;
    } catch (e) {
      console.error('Error parsing assessment:', e);
      return null;
    }
  }

  async function deleteAnalytics() {
    const confirmed = window.confirm('Are you sure you want to delete all analytics data?');
    if (!confirmed) return;
    try {
      await invoke('delete_analytics');
      analyticsData = null;
      showGrabData = true;
    } catch (e) {
      error = 'Failed to delete analytics data';
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
      error = 'Failed to grab and save analytics data.';
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
      processData();
    } catch (e) {
      // Do not use console.error here to avoid global error page; show local recovery UI instead
      console.warn('Analytics: no local analytics file found or failed to parse. Prompting user to rebuild.');
      error = 'No analytics data found. Click the button below to download and build your assessment analytics.';
      showGrabData = true;
    } finally {
      loading = false;
    }
  });

  function processData() {
    console.log('Processing data:', analyticsData);
    if (!analyticsData || !Array.isArray(analyticsData) || analyticsData.length === 0) {
      console.log('No assessments data available');
      return;
    }

    // Filter for assessments with grades and group them into ranges
    const gradedAssessments = analyticsData.filter((a) => a.finalGrade !== undefined);
    const gradeRanges = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      '50-59': 0,
      '0-49': 0,
    };

    gradedAssessments.forEach((assessment) => {
      const grade = assessment.finalGrade!;
      if (grade >= 90) gradeRanges['90-100']++;
      else if (grade >= 80) gradeRanges['80-89']++;
      else if (grade >= 70) gradeRanges['70-79']++;
      else if (grade >= 60) gradeRanges['60-69']++;
      else if (grade >= 50) gradeRanges['50-59']++;
      else gradeRanges['0-49']++;
    });

    const maxCount = Math.max(...Object.values(gradeRanges), 1);
    const yScale = (height - padding * 2) / maxCount;

    // Generate y-axis labels at intervals of 10
    const yStep = Math.max(10, (Math.ceil(maxCount / 10) * 10) / 10); // At least 10, or enough to keep ~10 labels
    yLabels = [];
    for (let i = 0; i <= maxCount; i += yStep) {
      yLabels.push(i.toString());
    }
    if (yLabels[yLabels.length - 1] !== maxCount.toString()) {
      yLabels.push(maxCount.toString());
    }

    // Generate bar paths
    barPaths = Object.entries(gradeRanges).map(([range, count], index) => {
      const x = padding + index * (barWidth + barSpacing);
      const barHeight = count * yScale;
      const path = `M ${x} ${height - padding} h ${barWidth} v -${barHeight} h -${barWidth} Z`;
      return { path, count, status: range };
    });
  }

  function getStatusColor(status: string): string {
    const grade = parseInt(status.split('-')[0]);
    if (grade >= 90) return 'rgb(34, 197, 94)'; // green
    if (grade >= 80) return 'rgb(34, 197, 94)'; // green
    if (grade >= 70) return 'rgb(234, 179, 8)'; // yellow
    if (grade >= 60) return 'rgb(234, 179, 8)'; // yellow
    if (grade >= 50) return 'rgb(239, 68, 68)'; // red
    return 'rgb(239, 68, 68)'; // red
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

  function toggleSubject(subject: string) {
    expandedSubjects[subject] = !expandedSubjects[subject];
  }

  // Helper function to group by subject
  function groupBySubject(data: AnalyticsData | null): Record<string, Assessment[]> {
    const grouped: Record<string, Assessment[]> = {};
    if (!data) return grouped;
    for (const a of data) {
      if (!grouped[a.subject]) grouped[a.subject] = [];
      grouped[a.subject].push(a);
    }
    return grouped;
  }

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
      deleteError = 'Failed to delete analytics data';
    } finally {
      deleteLoading = false;
    }
  }

  function getFilteredAssessments(data: AnalyticsData | null): Assessment[] {
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

  $: monthlyAverages =
    analyticsData && analyticsData.length > 0 ? calculateMonthlyAverages(analyticsData) : {};
  $: monthlyPoints = (() => {
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
    const monthsSorted = Object.keys(monthlyAverages).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(Number(yearA), monthMap[monthA], 1);
      const dateB = new Date(Number(yearB), monthMap[monthB], 1);
      return dateA.getTime() - dateB.getTime();
    });
    return monthsSorted.map((month, i, array) => {
      const avg = monthlyAverages[month];
      const x =
        graphPadding + (i / Math.max(array.length - 1, 1)) * (graphWidth - 2 * graphPadding);
      const y = graphHeight - graphPadding - (avg / 100) * (graphHeight - 2 * graphPadding);
      return { month, avg, x, y };
    });
  })();
  $: showMonthEvery = Math.ceil(monthlyPoints.length / 10);

  function showTooltip(
    event: MouseEvent,
    point: { x: number; y: number; month: string; avg: number },
  ) {
    const svgRect = (event.target as SVGCircleElement).ownerSVGElement?.getBoundingClientRect();
    if (svgRect) {
      tooltip = {
        show: true,
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top - 10,
        month: point.month,
        avg: point.avg,
      };
    }
  }

  function hideTooltip() {
    tooltip.show = false;
  }
</script>

<div class="container px-6 py-7 mx-auto">
  <h1 class="mb-8 text-2xl font-bold">Analytics Dashboard</h1>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="w-12 h-12 rounded-full border-b-2 border-indigo-600 animate-spin"></div>
    </div>
  {:else if showGrabData}
    <div class="flex flex-col gap-6 justify-center items-center h-96">
      <div
        class="flex flex-col items-center p-8 w-full max-w-lg rounded-2xl border shadow-xl border-slate-200 bg-white/90 dark:bg-slate-900/90 dark:border-slate-700 animate-fade-in-up">
        <svg
          class="mb-4 w-12 h-12 text-indigo-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <h2 class="mb-2 text-2xl font-bold text-slate-900 dark:text-white">No Analytics Data</h2>
        <p class="mb-4 text-center text-slate-600 dark:text-slate-300">
          To get started, click <span class="font-semibold text-indigo-600 dark:text-indigo-400"
            >Grab Data</span>
          below.<br />
          This will securely fetch and save your assessment data
          <span class="font-semibold">locally</span>
          on your device.<br />
          <strong>Your data never leaves your computer</strong>—everything is processed and stored
          privately for your own analytics.
        </p>
        <button
          class="px-6 py-3 mt-2 text-lg font-semibold text-white bg-indigo-600 rounded-lg shadow transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring hover:bg-indigo-700"
          on:click={grabData}>
          Grab Data
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
    <div class="flex justify-end mb-4">
      <button
        class="px-4 py-2 text-white bg-red-600 rounded transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring hover:bg-red-700"
        on:click={openDeleteModal}>
        Delete Data
      </button>
    </div>
    <div
      class="flex flex-col gap-8 p-8 mb-8 rounded-2xl border shadow-xl border-slate-200 bg-white/80 dark:bg-slate-900/80 dark:border-slate-700 lg:flex-row"
      in:fade={{ duration: 400 }}>
      <GradeDistribution data={analyticsData || []} />
      <div class="flex-1 min-w-[400px] max-w-[800px] flex flex-col">
        <h3 class="mb-2 text-lg font-semibold">Average Grade by Month</h3>
        <div class="flex justify-center items-center h-full">
          {#if analyticsData && analyticsData.length > 0}
            <div class="flex justify-center line-graph-container" style="position:relative;">
              <svg
                width={1000}
                height={300}
                viewBox="0 0 1000 300"
                xmlns="http://www.w3.org/2000/svg">
                <!-- Y-axis -->
                <line
                  x1={graphPadding}
                  y1={graphPadding}
                  x2={graphPadding}
                  y2={300 - graphPadding}
                  stroke="#fff"
                  stroke-width="2" />
                <!-- X-axis -->
                <line
                  x1={graphPadding}
                  y1={300 - graphPadding}
                  x2={1000 - graphPadding}
                  y2={300 - graphPadding}
                  stroke="#fff"
                  stroke-width="2" />
                <!-- Y-axis ticks and labels -->
                {#each yTicks as tick}
                  <line
                    x1={graphPadding - 5}
                    y1={300 - graphPadding - (tick / 100) * (300 - 2 * graphPadding)}
                    x2={graphPadding}
                    y2={300 - graphPadding - (tick / 100) * (300 - 2 * graphPadding)}
                    stroke="#fff"
                    stroke-width="2" />
                  <text
                    x={graphPadding - 10}
                    y={300 - graphPadding - (tick / 100) * (300 - 2 * graphPadding) + 4}
                    text-anchor="end"
                    font-size="14"
                    fill="#fff">{tick}</text>
                {/each}
                <!-- X-axis month labels -->
                {#each monthlyPoints as point, i}
                  {#if i % showMonthEvery === 0 || i === monthlyPoints.length - 1}
                    <text
                      x={graphPadding +
                        (i / Math.max(monthlyPoints.length - 1, 1)) * (1000 - 2 * graphPadding)}
                      y={300 - graphPadding + 24}
                      text-anchor="middle"
                      font-size="14"
                      fill="#fff"
                      transform={`rotate(-35,${graphPadding + (i / Math.max(monthlyPoints.length - 1, 1)) * (1000 - 2 * graphPadding)},${300 - graphPadding + 24})`}
                      >{point.month}</text>
                  {/if}
                {/each}
                <!-- Line path -->
                {#if monthlyPoints.length > 1}
                  <polyline
                    fill="none"
                    stroke="var(--accent-color-value)"
                    stroke-width="2.5"
                    points={monthlyPoints
                      .map(
                        (p, i) =>
                          `${graphPadding + (i / Math.max(monthlyPoints.length - 1, 1)) * (1000 - 2 * graphPadding)},${300 - graphPadding - (p.avg / 100) * (300 - 2 * graphPadding)}`,
                      )
                      .join(' ')} />
                {/if}
                <!-- Points -->
                {#each monthlyPoints as point, i}
                  <circle
                    cx={graphPadding +
                      (i / Math.max(monthlyPoints.length - 1, 1)) * (1000 - 2 * graphPadding)}
                    cy={300 - graphPadding - (point.avg / 100) * (300 - 2 * graphPadding)}
                    r="5"
                    fill="var(--accent-color-value)"
                    class="transition-all duration-200 hover:fill-accent-300"
                    on:mouseover={(e) =>
                      showTooltip(e, {
                        ...point,
                        x:
                          graphPadding +
                          (i / Math.max(monthlyPoints.length - 1, 1)) * (1000 - 2 * graphPadding),
                        y: 300 - graphPadding - (point.avg / 100) * (300 - 2 * graphPadding),
                      })}
                    on:mouseout={hideTooltip}
                    style="cursor:pointer" />
                {/each}
              </svg>
              <!-- Tooltip overlay is rendered here -->
              {#if tooltip.show}
                <div
                  style="position:absolute; left:0; top:0; pointer-events:none; z-index:10; width:1000px; height:300px;">
                  <div
                    style="position:absolute; left:{tooltip.x}px; top:{tooltip.y}px; background:rgba(30,41,59,0.95); color:white; padding:8px 12px; border-radius:8px; font-size:16px; box-shadow:0 2px 8px rgba(0,0,0,0.2); white-space:nowrap; transform:translate(-50%,-100%);">
                    <div><strong>{tooltip.month}</strong></div>
                    <div>Avg: {tooltip.avg.toFixed(1)}%</div>
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <p class="text-slate-500 dark:text-slate-400">No data available</p>
          {/if}
        </div>
      </div>
    </div>

    <div
      class="p-8 rounded-2xl border shadow-xl border-slate-200 bg-white/80 dark:bg-slate-900/80 dark:border-slate-700"
      in:fade={{ duration: 400, delay: 100 }}>
      <RawDataTable data={analyticsData || []} />
    </div>
  {:else}
    <div class="text-center text-slate-500 dark:text-slate-400">No analytics data available</div>
  {/if}

  <Modal
    bind:open={showDeleteModal}
    onclose={closeDeleteModal}
    maxWidth="max-w-md"
    customClasses="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl"
    showCloseButton={false}
    ariaLabel="Delete Analytics Data">
    <div class="p-8">
      <h3 class="mb-4 text-xl font-bold text-slate-900 dark:text-white">Delete Analytics Data?</h3>
      <p class="mb-6 text-slate-600 dark:text-slate-300">
        Are you sure you want to delete all analytics data?
      </p>
      {#if deleteError}
        <div class="mb-4 text-red-600 dark:text-red-400">{deleteError}</div>
      {/if}
      <div class="flex gap-3 justify-end">
        <button
          class="px-4 py-2 rounded-lg transition-all duration-200 transform text-slate-800 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
          on:click={closeDeleteModal}
          disabled={deleteLoading}>Cancel</button>
        <button
          class="px-4 py-2 text-white bg-red-600 rounded-lg transition-all duration-200 transform hover:bg-red-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 accent-ring"
          on:click={confirmDeleteAnalytics}
          disabled={deleteLoading}>
          {#if deleteLoading}
            <span
              class="inline-block w-5 h-5 align-middle rounded-full border-2 border-white animate-spin border-t-transparent"
            ></span>
          {/if}
          Delete
        </button>
      </div>
    </div>
  </Modal>
</div>

<style>
  /* Ensure the tooltip overlay is positioned relative to the graph container */
  .line-graph-container {
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }
</style>
