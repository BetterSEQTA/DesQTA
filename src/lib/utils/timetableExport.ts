import { saveAs } from 'file-saver';
import { createEvents } from 'ics';
import jsPDF from 'jspdf';
import type { TimetableLesson } from '../types/timetable';
import {
  formatDate,
  parseDate,
  timeToMinutes,
  normalizeTimeToHm,
  getPaddedLessonTimeRange,
  getClockHourMarkersInRange,
  calculateLessonPosition,
  layoutDayLessonColumns,
  timetableLessonLayoutKey,
  type TimeRange,
} from './timetableUtils';

export interface TimetableExportOptions {
  timeRange?: TimeRange;
}

function dedupeLessons(lessons: TimetableLesson[]): TimetableLesson[] {
  const seen = new Set<string>();
  const out: TimetableLesson[] = [];
  for (const lesson of lessons) {
    if (seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    out.push(lesson);
  }
  return out;
}

const TIMETABLE_NO_COLOUR_RGB: [number, number, number] = [113, 113, 122];

function parseLessonColour(colour: string): [number, number, number] {
  const trimmed = colour?.trim() ?? '';
  if (!trimmed || trimmed.startsWith('var(')) {
    return TIMETABLE_NO_COLOUR_RGB;
  }
  if (trimmed.startsWith('#') && (trimmed.length === 7 || trimmed.length === 4)) {
    if (trimmed.length === 4) {
      const r = parseInt(trimmed[1] + trimmed[1], 16);
      const g = parseInt(trimmed[2] + trimmed[2], 16);
      const b = parseInt(trimmed[3] + trimmed[3], 16);
      if ([r, g, b].every((n) => !Number.isNaN(n))) return [r, g, b];
    } else {
      const r = parseInt(trimmed.slice(1, 3), 16);
      const g = parseInt(trimmed.slice(3, 5), 16);
      const b = parseInt(trimmed.slice(5, 7), 16);
      if ([r, g, b].every((n) => !Number.isNaN(n))) return [r, g, b];
    }
  }
  return TIMETABLE_NO_COLOUR_RGB;
}

function formatSlotKindLabel(kind: string): string {
  return kind.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Export lessons to CSV format. Returns true if export succeeded.
 */
export function exportToCSV(lessons: TimetableLesson[], weekStart: Date): boolean {
  const headers = ['Date', 'Day', 'Subject', 'Code', 'Time', 'Teacher', 'Room'];
  const rows = lessons.map((lesson) => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayName = dayNames[lesson.dayIdx] || '';

    return [
      lesson.date,
      dayName,
      lesson.description,
      lesson.code,
      `${lesson.from} - ${lesson.until}`,
      lesson.staff || '',
      lesson.room || '',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `timetable_${formatDate(weekStart)}.csv`;
  saveAs(blob, fileName);
  return true;
}

/**
 * Export lessons to PDF format as a landscape week grid. Returns true if export succeeded.
 */
export function exportToPDF(
  lessons: TimetableLesson[],
  weekStart: Date,
  options: TimetableExportOptions = {},
): boolean {
  const weekLessons = dedupeLessons(lessons);
  const timeRange = options.timeRange ?? getPaddedLessonTimeRange(weekLessons);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const timeColW = 14;
  const gridTop = 28;
  const gridBottom = pageH - margin;
  const gridHeightMm = gridBottom - gridTop;
  const gridLeft = margin + timeColW;
  const gridWidth = pageW - gridLeft - margin;
  const dayColW = gridWidth / 5;
  const paintHeightPx = 1000;

  const endDate = new Date(weekStart);
  endDate.setDate(weekStart.getDate() + 4);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Weekly Timetable', margin, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const weekRange = `${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  doc.text(weekRange, margin, 20);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + dayIdx);
    const x = gridLeft + dayIdx * dayColW + dayColW / 2;
    doc.text(dayNames[dayIdx], x, gridTop - 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      dayDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      x,
      gridTop - 1,
      { align: 'center' },
    );
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
  }

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  for (const hour of getClockHourMarkersInRange(timeRange)) {
    const pos = calculateLessonPosition(
      {
        id: '',
        code: '',
        description: '',
        date: formatDate(weekStart),
        from: hour,
        until: hour,
        staff: '',
        room: '',
        colour: '#000',
        dayIdx: 0,
      },
      timeRange,
      paintHeightPx,
    );
    const y = gridTop + (pos.top / paintHeightPx) * gridHeightMm;
    doc.line(gridLeft, y, pageW - margin, y);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(hour, margin + 1, y + 1);
    doc.setTextColor(0, 0, 0);
  }

  doc.setDrawColor(200, 200, 200);
  for (let dayIdx = 0; dayIdx <= 5; dayIdx++) {
    const x = gridLeft + dayIdx * dayColW;
    doc.line(x, gridTop, x, gridBottom);
  }
  doc.line(gridLeft, gridTop, pageW - margin, gridTop);
  doc.line(gridLeft, gridBottom, pageW - margin, gridBottom);

  const weekDateStr = formatDate(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);
  const weekEndStr = formatDate(weekEnd);

  for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
    const dayList = weekLessons.filter((l) => {
      if (l.dayIdx !== dayIdx) return false;
      return l.date >= weekDateStr && l.date <= weekEndStr;
    });
    const overlapLayout = layoutDayLessonColumns(dayList);
    const dayX = gridLeft + dayIdx * dayColW;

    for (const lesson of dayList) {
      const position = calculateLessonPosition(lesson, timeRange, paintHeightPx);
      const ly = overlapLayout.get(timetableLessonLayoutKey(lesson)) ?? {
        columnIndex: 0,
        columnCount: 1,
      };

      const topMm = gridTop + (position.top / paintHeightPx) * gridHeightMm;
      const heightMm = Math.max(4, (position.height / paintHeightPx) * gridHeightMm);
      const pad = 0.4;
      const innerW = dayColW - pad * 2;
      const { columnIndex, columnCount } = ly;
      const gapFrac = columnCount > 1 ? 0.03 : 0;
      const colWidthFrac = (1 - gapFrac * (columnCount - 1)) / columnCount;
      const leftFrac = columnIndex * (colWidthFrac + gapFrac);
      const blockW = innerW * colWidthFrac;
      const blockX = dayX + pad + innerW * leftFrac;

      const [r, g, b] = parseLessonColour(lesson.colour);
      doc.setFillColor(r, g, b);
      doc.setDrawColor(Math.max(0, r - 30), Math.max(0, g - 30), Math.max(0, b - 30));
      doc.setLineWidth(0.25);

      const isNonClass = !!(lesson.slotType && lesson.slotType !== 'class');
      if (isNonClass) {
        doc.setLineDashPattern([1.5, 1.5], 0);
      } else {
        doc.setLineDashPattern([], 0);
      }

      doc.roundedRect(blockX, topMm, blockW, heightMm, 1, 1, 'FD');
      doc.setLineDashPattern([], 0);

      const textPad = 0.8;
      const textW = blockW - textPad * 2;
      let textY = topMm + 2.5;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(heightMm >= 12 ? 7 : heightMm >= 8 ? 6 : 5);
      doc.setFont('helvetica', 'bold');

      if (isNonClass && heightMm >= 7) {
        const kind = formatSlotKindLabel(lesson.slotType!);
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text(kind, blockX + textPad, textY, { maxWidth: textW });
        textY += 2.2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(heightMm >= 12 ? 7 : 6);
      }

      const titleLines = splitLines(doc, lesson.description, textW).slice(0, heightMm >= 14 ? 3 : heightMm >= 9 ? 2 : 1);
      for (const line of titleLines) {
        doc.text(line, blockX + textPad, textY, { maxWidth: textW });
        textY += 2.4;
      }

      if (heightMm >= 10) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text(`${lesson.from}–${lesson.until}`, blockX + textPad, textY, { maxWidth: textW });
        textY += 2;
      }

      if (heightMm >= 14 && lesson.room) {
        doc.text(`Room ${lesson.room.replace(/^room\s/i, '')}`, blockX + textPad, textY, {
          maxWidth: textW,
        });
        textY += 2;
      }

      if (heightMm >= 16 && lesson.staff) {
        doc.text(lesson.staff, blockX + textPad, textY, { maxWidth: textW });
      }

      doc.setTextColor(0, 0, 0);
    }
  }

  const fileName = `timetable_${formatDate(weekStart)}.pdf`;
  doc.save(fileName);
  return true;
}

/**
 * Export lessons to iCal format. Returns true if export succeeded.
 */
export function exportToiCal(lessons: TimetableLesson[], weekStart: Date): boolean {
  const events = lessons.map((lesson) => {
    const date = parseDate(lesson.date);
    const [startHour, startMinute] = lesson.from.split(':').map(Number);
    const [endHour, endMinute] = lesson.until.split(':').map(Number);

    const start = [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      startHour,
      startMinute,
    ] as [number, number, number, number, number];

    const end = [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      endHour,
      endMinute,
    ] as [number, number, number, number, number];

    const description = [
      lesson.staff ? `Teacher: ${lesson.staff}` : '',
      lesson.room ? `Room: ${lesson.room}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      title: lesson.description,
      description: description || undefined,
      location: lesson.room || undefined,
      start,
      end,
      calName: 'DesQTA Timetable',
    };
  });

  const { error, value } = createEvents(events);

  if (error) {
    console.error('Error creating iCal events:', error);
    return false;
  }

  if (value) {
    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8;' });
    const fileName = `timetable_${formatDate(weekStart)}.ics`;
    saveAs(blob, fileName);
    return true;
  }
  return false;
}
