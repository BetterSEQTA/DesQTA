import { cache } from '../../utils/cache';
import { seqtaFetch } from '../../utils/netUtil';
import { logger } from '../../utils/logger';
import { setIdb } from './idbCache';

// Centralized background warm-up of frequently used SEQTA endpoints.
// This primes the in-memory cache so pages can render instantly.

const STUDENT_ID = 69; // Matches existing page usage

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
	const cached = cache.get<any[]>('lesson_colours');
	if (cached) return cached;
	try {
		const res = await seqtaFetch('/seqta/student/load/prefs?', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: { request: 'userPrefs', asArray: true, user: STUDENT_ID },
		});
		const colours = JSON.parse(res).payload;
		// Align with assessments page which uses 10 minutes for lesson_colours
		cache.set('lesson_colours', colours, 10);
		await setIdb('lesson_colours', colours);
		logger.info('warmup', 'prefetchLessonColours', 'Cached lesson_colours (mem+idb)', { ttlMin: 10, count: colours?.length });
		return colours;
	} catch {
		return [];
	}
}

async function prefetchTimetableWeek(): Promise<void> {
	try {
		const weekStart = getMonday(new Date());
		const from = formatDate(weekStart);
		const until = formatDate(new Date(weekStart.getTime() + 4 * 86400000));
		const cacheKey = `timetable_${from}_${until}`;
		if (cache.get(cacheKey)) return;

		const colours = await prefetchLessonColours();
		const res = await seqtaFetch('/seqta/student/load/timetable?', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: { from, until, student: STUDENT_ID },
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
		logger.info('warmup', 'prefetchTimetableWeek', 'Cached timetable week (mem+idb)', { key: cacheKey, ttlMin: 30, count: lessons?.length });
	} catch {
		// ignore warmup errors
	}
}

async function prefetchUpcomingAssessments(): Promise<void> {
	try {
		// If already cached, skip
		if (cache.get('upcoming_assessments_data')) return;

		const [assessmentsRes, classesRes] = await Promise.all([
			seqtaFetch('/seqta/student/assessment/list/upcoming?', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: { student: STUDENT_ID },
			}),
			seqtaFetch('/seqta/student/load/subjects?', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: {},
			}),
		]);

		const colours = await prefetchLessonColours();
		const classesResJson = JSON.parse(classesRes);
		const activeClass = classesResJson.payload.find((c: any) => c.active);
		const activeSubjects = activeClass ? activeClass.subjects : [];
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

		const upcomingData = { assessments: upcomingAssessments, subjects: activeSubjects, filters: subjectFilters };
		cache.set('upcoming_assessments_data', upcomingData, 60);
		await setIdb('upcoming_assessments_data', upcomingData);
		logger.info('warmup', 'prefetchUpcomingAssessments', 'Cached upcoming assessments (mem+idb)', { ttlMin: 60, assessments: upcomingAssessments?.length });
	} catch {
		// ignore warmup errors
	}
}

export async function warmUpCommonData(): Promise<void> {
	// Run in parallel, ignore individual failures
	await Promise.allSettled([
		prefetchLessonColours(),
		prefetchTimetableWeek(),
		prefetchUpcomingAssessments(),
		prefetchAssessmentsOverview(),
		prefetchNoticesLabels(),
		prefetchTodayNotices(),
	]);
}

// Assessments Overview warm-up: builds the exact cache object used by assessments/+page.svelte
async function prefetchAssessmentsOverview(): Promise<void> {
	try {
		if (cache.get('assessments_overview_data')) return;

		// 1) Load folders/subjects
		const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: {},
		});
		const classesResJson = JSON.parse(classesRes);
		const folders = classesResJson.payload;

		// 2) Build allSubjects and activeSubjects
		let allSubjects: any[] = folders.flatMap((f: any) => f.subjects);
		const uniqueSubjectsMap = new Map<string, any>();
		allSubjects.forEach((s: any) => {
			const key = `${s.programme}-${s.metaclass}`;
			if (!uniqueSubjectsMap.has(key)) uniqueSubjectsMap.set(key, s);
		});
		allSubjects = Array.from(uniqueSubjectsMap.values());
		const activeFolder = folders.find((c: any) => c.active);
		const activeSubjects = activeFolder ? activeFolder.subjects : [];

		// 3) Initialize subject filters (active ones enabled by default)
		const subjectFilters: Record<string, boolean> = {};
		allSubjects.forEach((s: any) => {
			subjectFilters[s.code] = activeSubjects.some((as: any) => as.code === s.code);
		});

		// 4) Colours (used to annotate assessments)
		const colours = await prefetchLessonColours();

		// 5) Upcoming assessments (global)
		const assessmentsRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: { student: STUDENT_ID },
		});

		// 6) Past assessments for every subject (can be many calls; run in parallel and ignore failures)
		const pastPromises = allSubjects.map((subject: any) =>
			seqtaFetch('/seqta/student/assessment/list/past?', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: { programme: subject.programme, metaclass: subject.metaclass, student: STUDENT_ID },
			})
		);
		const pastResults = await Promise.allSettled(pastPromises);
		const pastAssessments = pastResults
			.map((r) => (r.status === 'fulfilled' ? JSON.parse(r.value).payload.tasks || [] : []))
			.flat();

		// 7) Combine and process
		const combined = [...JSON.parse(assessmentsRes).payload, ...pastAssessments];
		const uniqueAssessmentsMap = new Map<number, any>();
		combined.forEach((a: any) => {
			if (!uniqueAssessmentsMap.has(a.id)) uniqueAssessmentsMap.set(a.id, a);
		});
		const uniqueAssessments = Array.from(uniqueAssessmentsMap.values());
		const upcomingAssessments = uniqueAssessments
			.map((a: any) => {
				const prefName = `timetable.subject.colour.${a.code}`;
				const c = colours.find((p: any) => p.name === prefName);
				a.colour = c ? c.value : '#8e8e8e';
				const subject = allSubjects.find((s: any) => s.code === a.code);
				a.metaclass = subject?.metaclass;
				return a;
			})
			.sort((a: any, b: any) => new Date(b.due).getTime() - new Date(a.due).getTime());

		// 8) Years list
		const yearsSet = new Set<number>();
		upcomingAssessments.forEach((a: any) => yearsSet.add(new Date(a.due).getFullYear()));
		const years = Array.from(yearsSet).sort((a, b) => b - a);

		// 9) Store cache object exactly as page expects (10 minute TTL)
		const overviewData = {
			assessments: upcomingAssessments,
			subjects: activeSubjects,
			allSubjects: allSubjects,
			filters: subjectFilters,
			years: years,
		};
		cache.set('assessments_overview_data', overviewData, 10);
		await setIdb('assessments_overview_data', overviewData);
		logger.info('warmup', 'prefetchAssessmentsOverview', 'Cached assessments_overview_data (mem+idb)', { ttlMin: 10, assessments: upcomingAssessments?.length, subjects: activeSubjects?.length });
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
            logger.info('warmup', 'prefetchNoticesLabels', 'Cached notices_labels (mem+idb)', { ttlMin: 60, count: labels?.length });
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
                title: n.title,
                subtitle: n.label_title,
                author: n.staff,
                color: n.colour,
                labelId: n.label,
                content: n.contents,
            }));
            cache.set(key, notices, 30); // 30 min TTL
            await setIdb(key, notices);
            logger.info('warmup', 'prefetchTodayNotices', 'Cached notices (today) (mem+idb)', { key, ttlMin: 30, count: notices?.length });
        }
    } catch {
        // ignore warmup errors
    }
}


