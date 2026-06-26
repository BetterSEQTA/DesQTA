import { cache } from '../../utils/cache';
import { seqtaFetch } from '../../utils/netUtil';
import { devTimeAsync } from '$lib/performance/devPerfHelpers';
import { logger } from '../../utils/logger';
import { setIdb } from './idbCache';
import { isOfflineMode } from '../utils/offlineMode';
import { forumPhotoSyncService } from './forumPhotoSyncService';
import { invokeGetProcessedAssessments } from './processedAssessmentsInvoke';
import { getSubjectsForCurrentAcademicYear } from '$lib/utils/subjectFolders';
import { authService } from './authService';

// Centralized background warm-up of frequently used SEQTA endpoints.
// This primes the in-memory cache so pages can render instantly.

const FALLBACK_PREFETCH_STUDENT_ID = 69;

async function getPrefetchStudentId(): Promise<number> {
  try {
    const u = await authService.loadUserInfo();
    if (u?.id != null && Number.isFinite(u.id)) return u.id;
  } catch {
    // ignore — use fallback
  }
  return FALLBACK_PREFETCH_STUDENT_ID;
}

function getMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function prefetchLessonColours(): Promise<any[]> {
  const sid = await getPrefetchStudentId();
  const colourKey = `lesson_colours_${sid}`;
  const cached = cache.get<any[]>(colourKey);
  if (cached) return cached;
  try {
    const res = await seqtaFetch('/seqta/student/load/prefs?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { request: 'userPrefs', asArray: true, user: sid },
    });
    const colours = JSON.parse(res).payload;
    // Align with assessments page which uses 10 minutes for lesson_colours
    cache.set(colourKey, colours, 10);
    await setIdb(colourKey, colours);
    logger.info('warmup', 'prefetchLessonColours', 'Cached lesson_colours (mem+idb)', {
      ttlMin: 10,
      count: colours?.length,
    });
    return colours;
  } catch {
    return [];
  }
}

async function prefetchTimetableWeek(): Promise<void> {
  try {
    const sid = await getPrefetchStudentId();
    const weekStart = getMonday(new Date());
    const from = formatDate(weekStart);
    const until = formatDate(new Date(weekStart.getTime() + 4 * 86400000));
    const cacheKey = `timetable_${sid}_${from}_${until}`;
    if (cache.get(cacheKey)) return;

    const colours = await prefetchLessonColours();
    const res = await seqtaFetch('/seqta/student/load/timetable?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { from, until, student: sid },
    });
    const lessons = JSON.parse(res).payload.items.map((lesson: any) => {
      const colourPrefName = `timetable.subject.colour.${lesson.code}`;
      const subjectColour = colours.find((c: any) => c.name === colourPrefName);
      lesson.colour = subjectColour ? `${subjectColour.value}` : `#232428`;
      lesson.from = lesson.from.substring(0, 5);
      lesson.until = lesson.until.substring(0, 5);
      lesson.dayIdx = (new Date(lesson.date).getDay() + 6) % 7;
      return lesson;
    });
    cache.set(cacheKey, lessons, 30);
    await setIdb(cacheKey, lessons);
    logger.info('warmup', 'prefetchTimetableWeek', 'Cached timetable week (mem+idb)', {
      key: cacheKey,
      ttlMin: 30,
      count: lessons?.length,
    });
  } catch {
    // ignore warmup errors
  }
}

async function prefetchUpcomingAssessments(): Promise<void> {
  try {
    // If already cached, skip
    if (cache.get('upcoming_assessments_data')) return;

    const prefSid = await getPrefetchStudentId();
    const [assessmentsRes, classesRes] = await Promise.all([
      seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: prefSid },
      }),
      seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      }),
    ]);

    const colours = await prefetchLessonColours();
    const classesResJson = JSON.parse(classesRes);
    const activeSubjects = getSubjectsForCurrentAcademicYear(classesResJson.payload);
    const subjectFilters: Record<string, boolean> = {};
    activeSubjects.forEach((s: any) => (subjectFilters[s.code] = true));
    const activeCodes = activeSubjects.map((s: any) => s.code);

    const upcomingAssessments = JSON.parse(assessmentsRes)
      .payload.filter((a: any) => activeCodes.includes(a.code))
      .filter((a: any) => new Date(a.due) >= new Date())
      .map((a: any) => {
        const prefName = `timetable.subject.colour.${a.code}`;
        const c = colours.find((p: any) => p.name === prefName);
        a.colour = c ? c.value : '#8e8e8e';
        return a;
      })
      .sort((a: any, b: any) => (a.due < b.due ? -1 : 1));

    const upcomingData = {
      assessments: upcomingAssessments,
      subjects: activeSubjects,
      filters: subjectFilters,
    };
    cache.set('upcoming_assessments_data', upcomingData, 60);
    await setIdb('upcoming_assessments_data', upcomingData);
    logger.info('warmup', 'prefetchUpcomingAssessments', 'Cached upcoming assessments (mem+idb)', {
      ttlMin: 60,
      assessments: upcomingAssessments?.length,
    });
  } catch {
    // ignore warmup errors
  }
}

/** Fetches timetable across days and updates the Android Next Lesson widget with the absolute next lesson. */
export async function updateNextLessonWidget(): Promise<void> {
  try {
    const widgetSid = await getPrefetchStudentId();
    const today = new Date();
    const from = formatDate(today);
    const untilDate = new Date(today.getTime() + 14 * 86400000);
    const until = formatDate(untilDate);

    const res = await seqtaFetch('/seqta/student/load/timetable?', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { from, until, student: widgetSid },
    });

    const items = JSON.parse(res).payload?.items ?? [];
    const now = new Date();
    const nowMs = now.getTime();

    const lessons = items
      .map((l: any) => ({
        date: l.date,
        from: (l.from || '').substring(0, 5),
        until: (l.until || '').substring(0, 5),
        description: l.description || l.code || '',
        room: l.room || '',
      }))
      .filter((l: any) => l.from && l.date)
      .sort((a: any, b: any) => {
        const da = new Date(`${a.date}T${a.from}`).getTime();
        const db = new Date(`${b.date}T${b.from}`).getTime();
        return da - db;
      });

    const next = lessons.find((l: any) => {
      const start = new Date(`${l.date}T${l.from}`).getTime();
      return start > nowMs;
    });

    if (!next) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_next_lesson_for_widget', { name: null, time: null, room: null });
      return;
    }

    const lessonDate = new Date(next.date);
    const todayStr = today.toDateString();
    const tomorrow = new Date(today.getTime() + 86400000).toDateString();
    let dayLabel: string;
    if (lessonDate.toDateString() === todayStr) {
      dayLabel = 'Today';
    } else if (lessonDate.toDateString() === tomorrow) {
      dayLabel = 'Tomorrow';
    } else {
      dayLabel = lessonDate.toLocaleDateString('en-AU', { weekday: 'short' });
    }
    const timeStr = `${dayLabel}, ${next.from} – ${next.until}`;

    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_next_lesson_for_widget', {
      name: next.description,
      time: timeStr,
      room: next.room || null,
    });
  } catch {
    // ignore - widget is Android-only, invoke may fail on desktop
  }
}

export async function warmUpCommonData(): Promise<void> {
  await devTimeAsync('warmup_common_data', 'startup', 'warmUpCommonData', async () => {
    // Check if offline mode is forced
    const offline = await isOfflineMode();
    if (offline) {
      logger.info('warmup', 'warmUpCommonData', 'Skipping warmup (offline mode)');
      return;
    }

    // Run in parallel, ignore individual failures
    await Promise.allSettled([
      prefetchLessonColours(),
      prefetchTimetableWeek(),
      updateNextLessonWidget(),
      prefetchUpcomingAssessments(),
      prefetchAssessmentsOverview(),
      prefetchNoticesLabels(),
      prefetchTodayNotices(),
      prefetchAnalyticsSync(),
      prefetchFoliosSettings(),
      prefetchGoalsSettings(),
      prefetchForumsSettings(),
      prefetchForumsList(),
    ]);

    // Run forum photo sync in background (non-blocking)
    // This is a longer operation, so we don't wait for it
    forumPhotoSyncService.syncAllPhotos().catch((e) => {
      logger.error('warmup', 'warmUpCommonData', `Forum photo sync failed: ${e}`, { error: e });
    });
  });
}

// Assessments Overview warm-up: uses Rust backend for processing
async function prefetchAssessmentsOverview(): Promise<void> {
  try {
    const cached = cache.get<{ assessments?: unknown[] }>('assessments_overview_data');
    if (cached?.assessments?.length) {
      // Cache exists - still schedule push notifications from cached data
      const { invoke } = await import('@tauri-apps/api/core');
      const remindersEnabled = ((
        await invoke<Record<string, unknown>>('get_settings_subset', {
          keys: ['reminders_enabled'],
        })
      )?.reminders_enabled ?? false) as boolean;
      if (remindersEnabled) {
        const { notificationService } = await import('./notificationService');
        await notificationService.scheduleNotifications(
          cached.assessments as import('$lib/types').Assessment[],
        );
      }
      return;
    }

    // Use Rust backend to process all assessments data (deduped with page/search/notifications)
    const result = await invokeGetProcessedAssessments();

    // Store cache object exactly as page expects (10 minute TTL)
    const overviewData = {
      assessments: result.assessments,
      subjects: result.subjects,
      allSubjects: result.all_subjects,
      filters: result.filters,
      years: result.years,
    };
    cache.set('assessments_overview_data', overviewData, 10);
    await setIdb('assessments_overview_data', overviewData);
    logger.info(
      'warmup',
      'prefetchAssessmentsOverview',
      'Cached assessments_overview_data (mem+idb)',
      {
        ttlMin: 10,
        assessments: result.assessments?.length,
        subjects: result.subjects?.length,
      },
    );

    // Schedule push notifications for assessments (respects reminders_enabled)
    const { invoke } = await import('@tauri-apps/api/core');
    const remindersEnabled =
      (
        await invoke<Record<string, unknown>>('get_settings_subset', {
          keys: ['reminders_enabled'],
        })
      )?.reminders_enabled ?? false;
    if (remindersEnabled && result.assessments?.length) {
      const { notificationService } = await import('./notificationService');
      await notificationService.scheduleNotifications(result.assessments);
    }
  } catch {
    // ignore warmup errors
  }
}

// Notices warm-up
async function prefetchNoticesLabels(): Promise<void> {
  try {
    if (cache.get('notices_labels')) return;
    const res = await seqtaFetch('/seqta/student/load/notices?', {
      method: 'POST',
      body: { mode: 'labels' },
    });
    const data = typeof res === 'string' ? JSON.parse(res) : res;
    if (Array.isArray(data?.payload)) {
      const labels = data.payload.map((l: any) => ({ id: l.id, title: l.title, color: l.colour }));
      cache.set('notices_labels', labels, 60); // 60 min TTL
      await setIdb('notices_labels', labels);
      logger.info('warmup', 'prefetchNoticesLabels', 'Cached notices_labels (mem+idb)', {
        ttlMin: 60,
        count: labels?.length,
      });
    }
  } catch {
    // ignore warmup errors
  }
}

async function prefetchTodayNotices(): Promise<void> {
  try {
    const today = new Date();
    const y = today.getFullYear();
    const m = (today.getMonth() + 1).toString().padStart(2, '0');
    const d = today.getDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const key = `notices_${dateStr}`;
    if (cache.get(key)) return;
    const res = await seqtaFetch('/seqta/student/load/notices?', {
      method: 'POST',
      body: { date: dateStr },
    });
    const data = typeof res === 'string' ? JSON.parse(res) : res;
    if (Array.isArray(data?.payload)) {
      const notices = data.payload.map((n: any, i: number) => ({
        id: i + 1,
        title: n.title.replace(/\[\[theme::[^\]]+\]\]/g, ''),
        subtitle: n.label_title.replace(/\[\[theme::[^\]]+\]\]/g, ''),
        author: n.staff,
        color: n.colour,
        labelId: n.label,
        content: n.contents.replace(/\[\[theme::[^\]]+\]\]/g, ''),
      }));
      cache.set(key, notices, 30); // 30 min TTL
      await setIdb(key, notices);
      logger.info('warmup', 'prefetchTodayNotices', 'Cached notices (today) (mem+idb)', {
        key,
        ttlMin: 30,
        count: notices?.length,
      });
    }
  } catch {
    // ignore warmup errors
  }
}

// Analytics sync warm-up: syncs analytics data in background only if no data exists
async function prefetchAnalyticsSync(): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { authService } = await import('./authService');

    // Check if we have a valid session before attempting sync
    const sessionExists = await authService.checkSession();
    if (!sessionExists) {
      logger.debug('warmup', 'prefetchAnalyticsSync', 'No active session, skipping analytics sync');
      return;
    }

    // Check if analytics data already exists in cache
    try {
      const existingData = await invoke<string>('load_analytics');
      if (existingData && existingData.trim() !== '' && existingData.trim() !== '[]') {
        // Data exists, skip background sync - it will sync when user visits the page
        logger.info(
          'warmup',
          'prefetchAnalyticsSync',
          'Analytics data exists in cache, skipping background sync',
        );
        return;
      }
    } catch (e) {
      // If load fails (file doesn't exist), continue with sync
      logger.debug(
        'warmup',
        'prefetchAnalyticsSync',
        'No existing analytics data found, proceeding with sync',
      );
    }

    // Only sync if no data exists and we have a valid session
    await invoke<string>('sync_analytics_data');
    logger.info('warmup', 'prefetchAnalyticsSync', 'Analytics data synced successfully');

    // Show success toast notification
    const { toastStore } = await import('../stores/toast');
    toastStore.success('Analytics data synced');
  } catch {
    // ignore warmup errors - don't show toast for background warmup failures
  }
}

// Folios settings warm-up
async function prefetchFoliosSettings(): Promise<void> {
  try {
    const cacheKey = 'folios_settings_enabled';
    if (cache.get(cacheKey)) return;

    const response = await seqtaFetch('/seqta/student/load/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    });

    const data = typeof response === 'string' ? JSON.parse(response) : response;
    const enabled = data?.payload?.['coneqt-s.page.folios']?.value === 'enabled';

    cache.set(cacheKey, enabled, 60); // 60 min TTL
    await setIdb(cacheKey, enabled);
    logger.info('warmup', 'prefetchFoliosSettings', 'Cached folios settings (mem+idb)', {
      ttlMin: 60,
      enabled,
    });
  } catch {
    // ignore warmup errors
  }
}

// Goals settings and years warm-up
async function prefetchGoalsSettings(): Promise<void> {
  try {
    const cacheKey = 'goals_settings_enabled';
    if (cache.get(cacheKey)) return;

    const response = await seqtaFetch('/seqta/student/load/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    });

    const data = typeof response === 'string' ? JSON.parse(response) : response;
    const enabled = data?.payload?.['coneqt-s.page.goals']?.value === 'enabled';

    cache.set(cacheKey, enabled, 60); // 60 min TTL
    await setIdb(cacheKey, enabled);
    logger.info('warmup', 'prefetchGoalsSettings', 'Cached goals settings (mem+idb)', {
      ttlMin: 60,
      enabled,
    });

    // If enabled, also prefetch years list
    if (enabled) {
      const yearsResponse = await seqtaFetch('/seqta/student/load/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'years' },
      });

      const yearsData =
        typeof yearsResponse === 'string' ? JSON.parse(yearsResponse) : yearsResponse;
      if (yearsData.status === '200' && Array.isArray(yearsData.payload)) {
        const yearsKey = 'goals_years';
        cache.set(yearsKey, yearsData.payload, 30); // 30 min TTL
        await setIdb(yearsKey, yearsData.payload);
        logger.info('warmup', 'prefetchGoalsSettings', 'Cached goals years (mem+idb)', {
          ttlMin: 30,
          count: yearsData.payload.length,
        });
      }
    }
  } catch {
    // ignore warmup errors
  }
}

// Forums settings warm-up
async function prefetchForumsSettings(): Promise<void> {
  try {
    const cacheKey = 'forums_settings_enabled';
    if (cache.get(cacheKey)) return;

    const response = await seqtaFetch('/seqta/student/load/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    });

    const data = typeof response === 'string' ? JSON.parse(response) : response;
    const forumsPageEnabled = data?.payload?.['coneqt-s.page.forums']?.value === 'enabled';
    const forumsGreetingExists = data?.payload?.['coneqt-s.forum.greeting'] !== undefined;
    const enabled = forumsPageEnabled || forumsGreetingExists;

    cache.set(cacheKey, enabled, 60); // 60 min TTL
    await setIdb(cacheKey, enabled);
    logger.info('warmup', 'prefetchForumsSettings', 'Cached forums settings (mem+idb)', {
      ttlMin: 60,
      enabled,
    });
  } catch {
    // ignore warmup errors
  }
}

// Forums list warm-up
async function prefetchForumsList(): Promise<void> {
  try {
    const cacheKey = 'forums_list';
    if (cache.get(cacheKey)) return;

    const response = await seqtaFetch('/seqta/student/load/forums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { mode: 'list' },
    });

    const data = typeof response === 'string' ? JSON.parse(response) : response;
    if (data?.payload?.forums && Array.isArray(data.payload.forums)) {
      cache.set(cacheKey, data.payload, 15); // 15 min TTL (forums change frequently)
      await setIdb(cacheKey, data.payload);
      logger.info('warmup', 'prefetchForumsList', 'Cached forums list (mem+idb)', {
        ttlMin: 15,
        count: data.payload.forums.length,
      });
    }
  } catch {
    // ignore warmup errors
  }
}
