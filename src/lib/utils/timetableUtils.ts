import type { TimetableLesson } from '../types/timetable';

export interface TimeRange {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface LessonPosition {
  top: number;
  height: number;
  left?: number;
  width?: number;
}

/**
 * Get time range from seqtaConfig (attendance.defaults.time_from / time_to)
 * with optional padding (minutes before start, minutes after end).
 * Returns { start, end } in HH:mm format. Defaults to 08:00-16:00 if config missing.
 */
export function getTimeRangeFromSeqtaConfig(
  seqtaConfig: { payload?: Record<string, { value?: string }> } | null,
  paddingMinutes = 30,
): TimeRange {
  const defaultRange: TimeRange = { start: '08:00', end: '16:00' };
  if (!seqtaConfig?.payload) return defaultRange;

  const timeFrom = seqtaConfig.payload['attendance.defaults.time_from']?.value;
  const timeTo = seqtaConfig.payload['attendance.defaults.time_to']?.value;

  if (!timeFrom || !timeTo) return defaultRange;

  const fromMins = timeToMinutes(timeFrom.substring(0, 5));
  const toMins = timeToMinutes(timeTo.substring(0, 5));

  const startMins = Math.max(0, fromMins - paddingMinutes);
  const endMins = Math.min(24 * 60 - 1, toMins + paddingMinutes);

  return {
    start: minutesToTime(startMins),
    end: minutesToTime(endMins),
  };
}

/**
 * Normalize API times ("8:05", "08:40:00") to HH:mm for display and maths.
 */
export function normalizeTimeToHm(time: string): string {
  const parts = time.trim().split(':').map(Number);
  const h = parts[0] ?? 0;
  const mi = parts[1] ?? 0;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:mm)
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Calculate lesson position in grid based on time range
 */
export function calculateLessonPosition(
  lesson: TimetableLesson,
  timeRange: TimeRange,
  gridHeight: number,
): LessonPosition {
  const startMinutes = timeToMinutes(normalizeTimeToHm(timeRange.start));
  const endMinutes = timeToMinutes(normalizeTimeToHm(timeRange.end));
  const rangeMinutes = Math.max(1, endMinutes - startMinutes);

  const lessonStart = timeToMinutes(normalizeTimeToHm(lesson.from));
  const lessonEnd = timeToMinutes(normalizeTimeToHm(lesson.until));

  const top = ((lessonStart - startMinutes) / rangeMinutes) * gridHeight;
  const height = ((lessonEnd - lessonStart) / rangeMinutes) * gridHeight;

  return {
    top: Math.max(0, top),
    height: Math.max(20, height), // Minimum height of 20px
  };
}

/**
 * Get current time indicator position
 */
export function getCurrentTimeIndicator(
  timeRange: TimeRange,
  gridHeight: number,
): number | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(normalizeTimeToHm(timeRange.start));
  const endMinutes = timeToMinutes(normalizeTimeToHm(timeRange.end));

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return null;
  }

  const rangeMinutes = Math.max(1, endMinutes - startMinutes);
  return ((currentMinutes - startMinutes) / rangeMinutes) * gridHeight;
}

/**
 * Format time for display (HH:mm)
 */
export function formatTime(time: string): string {
  return time.substring(0, 5); // Ensure HH:mm format
}

/**
 * Format time for display with AM/PM
 */
export function formatTime12Hour(time: string): string {
  const hm = normalizeTimeToHm(time);
  const [hour, minute] = hm.split(':').map(Number);
  const hour12 = hour % 12 || 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

/**
 * Get day index from date (0 = Monday, 4 = Friday)
 */
export function getDayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1; // Convert Sunday (0) to 6, Monday (1) to 0, etc.
}

/**
 * Get Monday of the week containing the given date
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date from YYYY-MM-DD string
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Check if lesson is currently active
 */
export function isLessonActive(lesson: TimetableLesson): boolean {
  const now = new Date();
  const lessonDate = parseDate(lesson.date);
  
  // Check if same day
  if (
    now.getFullYear() !== lessonDate.getFullYear() ||
    now.getMonth() !== lessonDate.getMonth() ||
    now.getDate() !== lessonDate.getDate()
  ) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const lessonStart = timeToMinutes(normalizeTimeToHm(lesson.from));
  const lessonEnd = timeToMinutes(normalizeTimeToHm(lesson.until));

  return currentMinutes >= lessonStart && currentMinutes <= lessonEnd;
}

/**
 * Group lessons by time slot for overlapping display
 */
export function groupLessonsByTime(lessons: TimetableLesson[]): Map<string, TimetableLesson[]> {
  const groups = new Map<string, TimetableLesson[]>();

  for (const lesson of lessons) {
    const key = `${lesson.from}-${lesson.until}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(lesson);
  }

  return groups;
}

/**
 * Sort lessons by time
 */
export function sortLessonsByTime(lessons: TimetableLesson[]): TimetableLesson[] {
  return [...lessons].sort((a, b) => {
    const timeA = timeToMinutes(a.from);
    const timeB = timeToMinutes(b.from);
    return timeA - timeB;
  });
}

/**
 * Get unique time slots from lessons
 */
export function getUniqueTimeSlots(lessons: TimetableLesson[]): string[] {
  const slots = new Set<string>();
  for (const lesson of lessons) {
    slots.add(lesson.from);
    slots.add(lesson.until);
  }
  return Array.from(slots).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/** SEQTA-style left axis: one label each whole hour overlapping the displayed range */
export function getClockHourMarkersInRange(range: TimeRange): string[] {
  const startM = timeToMinutes(normalizeTimeToHm(range.start));
  const endM = timeToMinutes(normalizeTimeToHm(range.end));
  const slots: string[] = [];
  const first = Math.floor(startM / 60) * 60;
  const last = Math.ceil(endM / 60) * 60;
  for (let m = first; m <= last && m < 24 * 60; m += 60) {
    slots.push(minutesToTime(m));
  }
  return slots.length > 0 ? slots : [normalizeTimeToHm(range.start)];
}

/**
 * Calculate time bounds from lessons
 */
export function calculateTimeBounds(lessons: TimetableLesson[]): TimeRange {
  if (lessons.length === 0) {
    return { start: '08:00', end: '16:00' };
  }

  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const lesson of lessons) {
    const start = timeToMinutes(normalizeTimeToHm(lesson.from));
    const end = timeToMinutes(normalizeTimeToHm(lesson.until));
    minTime = Math.min(minTime, start);
    maxTime = Math.max(maxTime, end);
  }

  // Round to nearest hour for cleaner display
  const startHour = Math.floor(minTime / 60);
  const endHour = Math.ceil(maxTime / 60);

  return {
    start: `${String(startHour).padStart(2, '0')}:00`,
    end: `${String(endHour).padStart(2, '0')}:00`,
  };
}

export const TIMETABLE_DEFAULT_TIME_RANGE: TimeRange = { start: '08:00', end: '16:00' };

/** Neutral gray for lessons/events without a configured subject colour (zinc-500). */
export const TIMETABLE_DEFAULT_LESSON_COLOUR = '#71717a';

/**
 * Week grid bounds (SEQTA-style hourly axis + lesson-relative scale):
 * Earliest→latest lesson, 5% padding, then snap only to enclosing whole hours — no extra ±1h bleed,
 * so lesson blocks stretch to fill the viewport instead of a huge blank band after school ends.
 */
export function getPaddedLessonTimeRange(
  lessons: TimetableLesson[],
  paddingFraction = 0.05,
  fallback: TimeRange = TIMETABLE_DEFAULT_TIME_RANGE,
): TimeRange {
  if (lessons.length === 0) {
    return fallback;
  }

  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const lesson of lessons) {
    const start = timeToMinutes(normalizeTimeToHm(lesson.from));
    const end = timeToMinutes(normalizeTimeToHm(lesson.until));
    minTime = Math.min(minTime, start);
    maxTime = Math.max(maxTime, end);
  }

  let span = maxTime - minTime;
  if (span <= 0) {
    const mid = minTime === Infinity ? timeToMinutes('09:00') : minTime;
    const padMins = 30;
    const looseS = Math.max(0, mid - padMins);
    const looseE = Math.min(24 * 60 - 1, mid + padMins);
    const startM = Math.max(0, Math.floor(looseS / 60) * 60);
    let endM = Math.min(24 * 60 - 1, Math.ceil(looseE / 60) * 60);
    if (endM <= startM) endM = Math.min(24 * 60 - 1, startM + 60);
    return { start: minutesToTime(startM), end: minutesToTime(endM) };
  }

  const pad = span * paddingFraction;
  const looseStart = Math.max(0, minTime - pad);
  const looseEnd = Math.min(24 * 60 - 1, maxTime + pad);

  let startM = Math.max(0, Math.floor(looseStart / 60) * 60);
  let endM = Math.min(24 * 60 - 1, Math.ceil(looseEnd / 60) * 60);

  if (endM <= startM) {
    endM = Math.min(24 * 60 - 1, startM + 60);
  }

  return {
    start: minutesToTime(startM),
    end: minutesToTime(endM),
  };
}

/**
 * Extra payload arrays some SEQTA builds return alongside `items` (e.g. support sessions).
 * Unknown keys are ignored; only known array keys are merged after `items`.
 */
const SEQTA_TIMETABLE_EXTRA_ITEM_KEYS = [
  'support',
  'supportLessons',
  'supportSessions',
  'supports',
  'alternates',
  'additionalItems',
  'extra',
] as const;

/**
 * Flatten all timetable lesson-like rows from a `student/load/timetable` JSON payload.
 * Order: `items` first, then each known extra array in declaration order.
 */
export function collectSeqtaLoadTimetableRows(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  const out: unknown[] = [];
  if (Array.isArray(p.items)) {
    out.push(...p.items);
  }
  for (const key of SEQTA_TIMETABLE_EXTRA_ITEM_KEYS) {
    const block = p[key];
    if (Array.isArray(block)) {
      out.push(...block);
    }
  }
  return out;
}

export type LessonColourLite = { name: string; value: string };

function pickSeqtaString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickNestedSeqtaString(
  obj: Record<string, unknown>,
  pathGroups: string[][],
): string | undefined {
  for (const path of pathGroups) {
    let cur: unknown = obj;
    for (const segment of path) {
      if (!cur || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[segment];
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim();
    if (typeof cur === 'number' && Number.isFinite(cur)) return String(cur);
  }
  return undefined;
}

function isoOrDateTimeToLocalDateHm(value: string): { date: string; hm: string } | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: formatDate(d),
    hm: normalizeTimeToHm(`${d.getHours()}:${d.getMinutes()}:00`),
  };
}

/**
 * Normalise `student/events/load` payload to a list of raw event rows (schools vary).
 */
export function normalizeSeqtaEventsPayloadRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    for (const key of ['items', 'events', 'data', 'rows']) {
      const v = p[key];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

/**
 * Map SEQTA events/calendar rows into {@link TimetableLesson} for week/day views.
 * Handles timetable-like rows (`date` + `from` + `until`) and common ISO / split date+time shapes.
 * Skips all-day or multi-day spans (no reliable slot) to avoid breaking the grid.
 */
export function timetableLessonsFromSeqtaEventsRows(
  rows: unknown[],
  colours: LessonColourLite[],
): TimetableLesson[] {
  const out: TimetableLesson[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;

    if (r.allDay === true || r.allday === true || r.all_day === true) {
      continue;
    }

    let dateStr: string | undefined;
    let fromHm: string | undefined;
    let untilHm: string | undefined;

    if (typeof r.from === 'string' && typeof r.until === 'string') {
      const fromDateHm = isoOrDateTimeToLocalDateHm(r.from);
      const untilDateHm = isoOrDateTimeToLocalDateHm(r.until);
      if (fromDateHm && untilDateHm && fromDateHm.date === untilDateHm.date) {
        dateStr = fromDateHm.date;
        fromHm = fromDateHm.hm;
        untilHm = untilDateHm.hm;
      } else if (typeof r.date === 'string') {
        dateStr = r.date;
        fromHm = normalizeTimeToHm(r.from);
        untilHm = normalizeTimeToHm(r.until);
      } else {
        continue;
      }
    } else {
      const startIso = pickSeqtaString(r, [
        'start',
        'startTime',
        'startsAt',
        'startDateTime',
        'fromDateTime',
        'datetimeStart',
      ]);
      const endIso = pickSeqtaString(r, [
        'end',
        'endTime',
        'endsAt',
        'endDateTime',
        'untilDateTime',
        'datetimeEnd',
      ]);
      if (startIso && endIso) {
        const a = isoOrDateTimeToLocalDateHm(startIso);
        const b = isoOrDateTimeToLocalDateHm(endIso);
        if (a && b && a.date === b.date) {
          dateStr = a.date;
          fromHm = a.hm;
          untilHm = b.hm;
        } else {
          continue;
        }
      } else {
        const dOnly = pickSeqtaString(r, ['date', 'day', 'eventDate', 'on']);
        const tFrom = pickSeqtaString(r, [
          'from',
          'timeFrom',
          'startTimeOnly',
          'time_start',
          'timeStart',
        ]);
        const tUntil = pickSeqtaString(r, [
          'until',
          'timeTo',
          'endTimeOnly',
          'time_end',
          'timeEnd',
        ]);
        if (dOnly && tFrom && tUntil) {
          dateStr = dOnly.length >= 10 ? dOnly.slice(0, 10) : dOnly;
          fromHm = normalizeTimeToHm(tFrom);
          untilHm = normalizeTimeToHm(tUntil);
        } else {
          continue;
        }
      }
    }

    if (!dateStr || !fromHm || !untilHm) continue;

    const desc =
      pickNestedSeqtaString(r, [['event', 'title']]) ||
      pickSeqtaString(r, ['title', 'description', 'name', 'summary', 'label']) ||
      'Event';
    const code = pickSeqtaString(r, ['code']) || desc.slice(0, 32) || 'EVENT';
    const colourPrefName = `timetable.subject.colour.${code}`;
    const subjectColour = colours.find((c) => c.name === colourPrefName);
    const color = subjectColour ? subjectColour.value : TIMETABLE_DEFAULT_LESSON_COLOUR;

    const dateObj = parseDate(dateStr);
    const dayIdx = getDayIndex(dateObj);

    const extId =
      pickSeqtaString(r, ['id', 'eventId', 'uid', 'event_id']) ||
      pickNestedSeqtaString(r, [['event', 'id']]);
    const lessonId = extId ? `event:${extId}` : `event:${dateStr}-${fromHm}-${untilHm}-${code}`;

    const existingType =
      pickNestedSeqtaString(r, [['event', 'event_type']]) ||
      pickSeqtaString(r, ['type', 'eventType', 'category']);
    const slotType = existingType && existingType !== 'class' ? existingType : 'event';

    out.push({
      id: lessonId,
      code,
      description: desc,
      date: dateStr,
      from: fromHm,
      until: untilHm,
      staff:
        pickNestedSeqtaString(r, [['event', 'owner_salutation']]) ||
        pickSeqtaString(r, ['staff', 'teacher', 'organiser', 'organizer', 'host']) ||
        '',
      room: pickSeqtaString(r, ['room_code', 'room', 'location', 'venue', 'place']) || '',
      colour: color,
      programmeID: 0,
      dayIdx,
      uid: extId,
      slotType,
    });
  }

  return out;
}

/** Stable map key when the same upstream id might appear across dates (unlikely but safe). */
export function timetableLessonLayoutKey(l: Pick<TimetableLesson, 'date' | 'id'>): string {
  return `${l.date}:${l.id}`;
}

/**
 * Strict overlap excluding boundary touches: open intervals [from, until) in minute space.
 */
export function timetableLessonsOverlapOpen(a: TimetableLesson, b: TimetableLesson): boolean {
  if (a.date !== b.date) return false;
  const as = timeToMinutes(normalizeTimeToHm(a.from));
  const au = timeToMinutes(normalizeTimeToHm(a.until));
  const bs = timeToMinutes(normalizeTimeToHm(b.from));
  const bu = timeToMinutes(normalizeTimeToHm(b.until));
  return as < bu && bs < au;
}

function timetableMergeSubjectKey(lesson: TimetableLesson): string {
  const c = lesson.code.trim().toLowerCase();
  if (c && c !== '—') {
    return `c:${c}`;
  }
  return `d:${lesson.description.trim().toLowerCase()}`;
}

/** Merge consecutive periods on the same day with touching times and identical subject identity. */
export function mergeAdjacentTimetableLessons(lessons: TimetableLesson[]): TimetableLesson[] {
  if (lessons.length === 0) return [];

  const byDate = new Map<string, TimetableLesson[]>();
  for (const l of lessons) {
    let arr = byDate.get(l.date);
    if (!arr) {
      arr = [];
      byDate.set(l.date, arr);
    }
    arr.push(l);
  }

  const out: TimetableLesson[] = [];

  const dates = [...byDate.keys()].sort();
  for (const date of dates) {
    const day = byDate.get(date)!;
    day.sort(
      (a, b) =>
        timeToMinutes(normalizeTimeToHm(a.from)) - timeToMinutes(normalizeTimeToHm(b.from)),
    );

    const merged: TimetableLesson[] = [];
    for (const lesson of day) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        prev.date === lesson.date &&
        normalizeTimeToHm(prev.until) === normalizeTimeToHm(lesson.from) &&
        timetableMergeSubjectKey(prev) === timetableMergeSubjectKey(lesson)
      ) {
        merged[merged.length - 1] = {
          ...prev,
          until: lesson.until,
          id: `${prev.id}+${lesson.id}`,
          uid: prev.uid ?? lesson.uid,
        };
      } else {
        merged.push({ ...lesson });
      }
    }
    out.push(...merged);
  }

  return out.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return (
      timeToMinutes(normalizeTimeToHm(a.from)) - timeToMinutes(normalizeTimeToHm(b.from))
    );
  });
}

export interface LessonColumnLayout {
  columnIndex: number;
  columnCount: number;
}

const TIMETABLE_COL_GAP_PX = 4;

/** Absolute positions for overlapping lesson strips inside a day column (percent widths + gaps). */
export function timetableLessonColumnStyles(layout: LessonColumnLayout): { left: string; width: string } {
  const { columnIndex: i, columnCount: n } = layout;
  if (n <= 1) {
    return { left: '0', width: '100%' };
  }
  const g = TIMETABLE_COL_GAP_PX;
  const piece = `(100% - ${(n - 1) * g}px) / ${n}`;
  const left =
    i === 0 ? '0' : `calc(${i} * (${piece} + ${g}px))`;
  return {
    left,
    width: `calc(${piece})`,
  };
}

/**
 * SEQTA-style column assignment for overlapping lessons on one calendar day:
 * overlap graph connected components, then greedy column colouring by start time within each component.
 */
export function layoutDayLessonColumns(dayLessons: TimetableLesson[]): Map<string, LessonColumnLayout> {
  const result = new Map<string, LessonColumnLayout>();
  if (dayLessons.length === 0) return result;

  const sortedIdx = [...dayLessons.keys()].sort((i, j) => {
    const a = dayLessons[i];
    const b = dayLessons[j];
    const sf =
      timeToMinutes(normalizeTimeToHm(a.from)) - timeToMinutes(normalizeTimeToHm(b.from));
    if (sf !== 0) return sf;
    return timeToMinutes(normalizeTimeToHm(a.until)) - timeToMinutes(normalizeTimeToHm(b.until));
  });

  const n = sortedIdx.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let ii = 0; ii < n; ii++) {
    for (let jj = ii + 1; jj < n; jj++) {
      const a = dayLessons[sortedIdx[ii]];
      const b = dayLessons[sortedIdx[jj]];
      if (timetableLessonsOverlapOpen(a, b)) {
        adj[ii].push(jj);
        adj[jj].push(ii);
      }
    }
  }

  const visited = new Set<number>();
  for (let s = 0; s < n; s++) {
    if (visited.has(s)) continue;
    const compIdx: number[] = [];
    const stack = [s];
    visited.add(s);
    while (stack.length) {
      const u = stack.pop()!;
      compIdx.push(u);
      for (const v of adj[u]) {
        if (!visited.has(v)) {
          visited.add(v);
          stack.push(v);
        }
      }
    }

    const compLessons = compIdx
      .map((i) => dayLessons[sortedIdx[i]])
      .sort((a, b) => {
        const sf =
          timeToMinutes(normalizeTimeToHm(a.from)) -
          timeToMinutes(normalizeTimeToHm(b.from));
        if (sf !== 0) return sf;
        return (
          timeToMinutes(normalizeTimeToHm(a.until)) -
          timeToMinutes(normalizeTimeToHm(b.until))
        );
      });

    interface ActiveSlot {
      untilMin: number;
      col: number;
    }

    let maxCols = 1;
    const active: ActiveSlot[] = [];
    const colByKey = new Map<string, number>();

    for (const lesson of compLessons) {
      const fromMin = timeToMinutes(normalizeTimeToHm(lesson.from));
      const untilMin = timeToMinutes(normalizeTimeToHm(lesson.until));

      const nextActive: ActiveSlot[] = [];
      for (const a of active) {
        if (a.untilMin > fromMin) {
          nextActive.push(a);
        }
      }
      active.length = 0;
      active.push(...nextActive);

      const usedCols = new Set(active.map((a) => a.col));
      let c = 0;
      while (usedCols.has(c)) {
        c++;
      }
      active.push({ untilMin, col: c });
      maxCols = Math.max(maxCols, c + 1);
      colByKey.set(timetableLessonLayoutKey(lesson), c);
    }

    for (const lesson of compLessons) {
      const key = timetableLessonLayoutKey(lesson);
      result.set(key, {
        columnIndex: colByKey.get(key)!,
        columnCount: maxCols,
      });
    }
  }

  return result;
}
