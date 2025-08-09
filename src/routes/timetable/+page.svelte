<script lang="ts">
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../utils/netUtil';
  import { cache } from '../../utils/cache';
  import { saveAs } from 'file-saver';
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';
  import * as pdfjsLib from 'pdfjs-dist';
  import TimetableHeader from '$lib/components/TimetableHeader.svelte';
  import TimetableGrid from '$lib/components/TimetableGrid.svelte';
  import TimetablePdfViewer from '$lib/components/TimetablePdfViewer.svelte';
  import { createEvents, type EventStatus } from 'ics';

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const studentId = 69;

  let weekStart = $state(getMonday(new Date()));
  let lessons = $state<any[]>([]);
  let lessonColours = $state<any[]>([]);
  let loadingLessons = $state<boolean>(true);
  let error = $state<string | null>(null);
  let selectedDay = $state<number>(
    Math.min(5, Math.max(1, new Date().getDay() === 0 ? 1 : new Date().getDay())),
  );
  let showPdfViewer = $state(false);
  let pdfUrl = $state<string | null>(null);
  let pdfLoading = $state(false);

  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  function getMonday(d: Date) {
    d = new Date(d);
    const day = d.getDay(),
      diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function loadLessonColours() {
    const cachedColours = cache.get<any[]>('lesson_colours');
    if (cachedColours) {
      lessonColours = cachedColours;
      return lessonColours;
    }

    const res = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { request: 'userPrefs', asArray: true, user: studentId },
    });
    lessonColours = JSON.parse(res).payload;

    cache.set('lesson_colours', lessonColours, 30);
    return lessonColours;
  }

  async function loadLessons() {
    loadingLessons = true;
    error = null;
    const from = formatDate(weekStart);
    const until = formatDate(new Date(weekStart.getTime() + 4 * 86400000));

    try {
      const cacheKey = `timetable_${from}_${until}`;
      const cachedLessons = cache.get<any[]>(cacheKey);
      if (cachedLessons) {
        lessons = cachedLessons;
        loadingLessons = false;
        return;
      }

      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from, until, student: studentId },
      });
      const colours = await loadLessonColours();
      lessons = JSON.parse(res).payload.items.map((lesson: any) => {
        const colourPrefName = `timetable.subject.colour.${lesson.code}`;
        const subjectColour = colours.find((c: any) => c.name === colourPrefName);
        lesson.colour = subjectColour ? `${subjectColour.value}` : `#232428`;
        lesson.from = lesson.from.substring(0, 5);
        lesson.until = lesson.until.substring(0, 5);
        lesson.dayIdx = (new Date(lesson.date).getDay() + 6) % 7;
        return lesson;
      });

      cache.set(cacheKey, lessons, 30);
    } catch (e) {
      error = 'Failed to load timetable. Please try again.';
      console.error('Error loading timetable:', e);
    } finally {
      loadingLessons = false;
    }
  }

  function prevWeek() {
    weekStart = new Date(weekStart.valueOf() - 7 * 86400000);
    loadLessons();
  }
  
  function nextWeek() {
    weekStart = new Date(weekStart.valueOf() + 7 * 86400000);
    loadLessons();
  }

  function getLessonsFor(dayIdx: number) {
    return lessons.filter((l) => l.dayIdx === dayIdx).sort((a, b) => a.from.localeCompare(b.from));
  }

  function weekRangeLabel() {
    const end = new Date(weekStart.valueOf() + 4 * 86400000);
    return `${weekStart.getDate()} ${weekStart.toLocaleString('default', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('default', { month: 'short' })} ${weekStart.getFullYear()}`;
  }

  function hexToRgb(hex: string) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((x) => x + x)
        .join('');
    }
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function isColorLight(hex: string) {
    const [r, g, b] = hexToRgb(hex);

    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  function getUniqueTimes() {
    const times = Array.from(new Set(lessons.map((l) => l.from)));
    return times.sort((a, b) => a.localeCompare(b));
  }

  function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function getTimeBounds() {
    if (!lessons.length) return { min: 8 * 60, max: 16 * 60 };
    const allTimes = lessons.flatMap((l) => [timeToMinutes(l.from), timeToMinutes(l.until)]);
    return {
      min: Math.min(...allTimes),
      max: Math.max(...allTimes),
    };
  }

  const GRID_HEIGHT = 800;
  function timeToY(time: number, min: number, max: number): number {
    return ((time - min) / (max - min)) * GRID_HEIGHT;
  }

  const timeBounds = $derived(getTimeBounds);

  function exportTimetableCSV() {
    const header = ['Day', 'Subject', 'Code', 'From', 'Until', 'Room', 'Teacher'];
    const sortedLessons = [...lessons].sort(
      (a, b) => a.dayIdx - b.dayIdx || a.from.localeCompare(b.from),
    );
    const rows = sortedLessons.map((l) => [
      new Date(l.date).toLocaleDateString('en-AU', { weekday: 'long' }),
      l.description || '',
      l.code || '',
      l.from,
      l.until,
      l.room || '',
      l.staff || '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'timetable.csv');
  }

  async function exportTimetablePDF() {
    console.log('Starting PDF export...');
    pdfLoading = true;
    
    try {
    const doc = new jsPDF();
    const header = ['Day', 'Subject', 'Code', 'From', 'Until', 'Room', 'Teacher'];
    const sortedLessons = [...lessons].sort(
      (a, b) => a.dayIdx - b.dayIdx || a.from.localeCompare(b.from),
    );
    const rows = sortedLessons.map((l) => [
      new Date(l.date).toLocaleDateString('en-AU', { weekday: 'long' }),
      l.description || '',
      l.code || '',
      l.from,
      l.until,
      l.room || '',
      l.staff || '',
    ]);
      
      console.log('Creating PDF with', rows.length, 'rows');
      
    doc.text('Weekly Timetable', 14, 16);
    autoTable(doc, {
      head: [header],
      body: rows,
      startY: 22,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
    });

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
      
      console.log('PDF created, setting URL and showing viewer');
    pdfUrl = url;
    showPdfViewer = true;
    pdfLoading = false;
      
      console.log('PDF export completed');
    } catch (error) {
      console.error('Error creating PDF:', error);
      pdfLoading = false;
    }
  }

  function handlePdfViewerClose() {
    showPdfViewer = false;
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      pdfUrl = null;
    }
  }

  function exportTimetableIcal() {
    if (!lessons.length) return;
    const events = lessons.map((l) => {
      // Parse start and end times
      const [startHour, startMinute] = l.from.split(':').map(Number);
      const [endHour, endMinute] = l.until.split(':').map(Number);
      const date = new Date(l.date);
      // Always provide 5 elements for start/end
      const start: [number, number, number, number, number] = [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        startHour,
        startMinute
      ];
      const end: [number, number, number, number, number] = [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        endHour,
        endMinute
      ];
      return {
        title: l.description || l.code || 'Lesson',
        description: `Room: ${l.room || ''}\nTeacher: ${l.staff || ''}`,
        start,
        end,
        location: l.room || '',
        productId: 'DesQTA',
      };
    });
    createEvents(events, (error, value) => {
      if (error) {
        console.error('iCal export error:', error);
        return;
      }
      const blob = new Blob([value], { type: 'text/calendar;charset=utf-8;' });
      saveAs(blob, 'timetable.ics');
    });
  }

  onMount(() => {
    loadLessons();
  });
</script>

<div class="flex flex-col w-full h-full text-slate-900 dark:text-slate-50 min-h-screen" style="background: var(--background-color);">
  <TimetableHeader
    {weekStart}
    {loadingLessons}
    onPrevWeek={prevWeek}
    onNextWeek={nextWeek}
    onExportCsv={exportTimetableCSV}
    onExportPdf={exportTimetablePDF}
    onExportIcal={exportTimetableIcal}
  />

  <TimetableGrid
    {lessons}
    {selectedDay}
    {loadingLessons}
    {error}
    onRetry={loadLessons}
  />

  <TimetablePdfViewer
    {showPdfViewer}
    {pdfUrl}
    {pdfLoading}
    onClose={handlePdfViewerClose}
  />
</div>
