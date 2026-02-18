import { saveAs } from 'file-saver';
import { createEvents } from 'ics';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TimetableLesson } from '../types/timetable';
import { formatDate, parseDate, timeToMinutes } from './timetableUtils';

/**
 * Export lessons to CSV format. Returns true if export succeeded.
 */
export function exportToCSV(lessons: TimetableLesson[], weekStart: Date): boolean {
  const headers = ['Date', 'Day', 'Subject', 'Code', 'Time', 'Teacher', 'Room'];
  const rows = lessons.map((lesson) => {
    const date = parseDate(lesson.date);
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
 * Export lessons to PDF format. Returns true if export succeeded.
 */
export function exportToPDF(lessons: TimetableLesson[], weekStart: Date): boolean {
  const doc = new jsPDF();
  const endDate = new Date(weekStart);
  endDate.setDate(weekStart.getDate() + 4);

  // Title
  doc.setFontSize(18);
  doc.text('Weekly Timetable', 14, 20);
  
  doc.setFontSize(12);
  const weekRange = `${weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  doc.text(weekRange, 14, 28);

  // Prepare data for table
  const tableData = lessons.map((lesson) => {
    const date = parseDate(lesson.date);
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

  // Create table
  autoTable(doc, {
    head: [['Date', 'Day', 'Subject', 'Code', 'Time', 'Teacher', 'Room']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] }, // Blue header
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

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
