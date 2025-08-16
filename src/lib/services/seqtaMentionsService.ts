import { seqtaFetch } from '../../utils/netUtil';

export interface SeqtaMentionItem {
  id: string;
  type: 'assignment' | 'class' | 'subject' | 'assessment' | 'timetable' | 'notice';
  title: string;
  subtitle: string;
  data: any;
  lastUpdated?: string;
}

export interface SeqtaAssignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'overdue';
  description?: string;
}

export interface SeqtaClass {
  id: string;
  name: string;
  subject: string;
  year: number;
  teacher: string;
  nextClass?: string;
  room?: string;
}

export interface SeqtaSubject {
  id: string;
  name: string;
  code: string;
  teacher: string;
  assignmentCount: number;
  nextClass?: string;
}

export interface SeqtaAssessment {
  id: string;
  title: string;
  subject: string;
  date: string;
  type: 'test' | 'exam' | 'quiz' | 'presentation';
  weight?: number;
}

export interface SeqtaTimetable {
  id: string;
  date: string;
  classes: Array<{
    subject: string;
    time: string;
    room: string;
    teacher: string;
  }>;
}

export class SeqtaMentionsService {
  private static cache = new Map<string, { data: SeqtaMentionItem[], timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static teacherCache = new Map<string, string>(); // key: programme-metaclass or code

  private static async getTeacherFromTimetable(programme: number | string | undefined, metaclass: number | string | undefined, code: string | undefined): Promise<string | null> {
    try {
      const key = `${programme ?? ''}-${metaclass ?? ''}-${code ?? ''}`;
      const cached = this.teacherCache.get(key);
      if (cached) return cached;

      const studentId = 69; // TODO: dynamic in production
      const steps = 6; // go back in ~2-month intervals up to ~1 year
      for (let i = 0; i < steps; i++) {
        const dt = new Date();
        dt.setMonth(dt.getMonth() - i * 2);
        const dayStr = dt.toISOString().split('T')[0];
        const res = await seqtaFetch('/seqta/student/load/timetable?', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { from: dayStr, until: dayStr, student: studentId }
        });
        const payload = typeof res === 'string' ? JSON.parse(res).payload : (res as any).payload;
        const items: any[] = payload?.items || [];
        const match = items.find((l: any) => {
          const metaOk = metaclass != null && Number(l.metaID) === Number(metaclass);
          const progOk = programme != null && Number(l.programmeID) === Number(programme);
          const codeOk = code && (l.code || '').toString().toLowerCase() === code.toString().toLowerCase();
          return (metaOk && progOk) || codeOk;
        });
        if (match) {
          const teacher = match.staff || match.teacher || null;
          if (teacher) {
            this.teacherCache.set(key, teacher);
            return teacher;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Compute a weekly (Mon–Fri) schedule for a class by scanning historical timetables
   * in 2-month intervals and deduping time slots by day. Returns an array of lesson
   * entries with date/from/until/room similar to fetchClassById output, suitable for
   * grouping by weekday in the UI.
   */
  static async getWeeklyScheduleForClass(
    programme: number | string | undefined,
    metaclass: number | string | undefined,
    code: string | undefined
  ): Promise<Array<{ date: string; from: string; until: string; room?: string }>> {
    try {
      const studentId = 69; // TODO: dynamic in production
      const steps = 6; // go back by ~2 months up to ~1 year
      const collected: Array<{ date: string; from: string; until: string; room?: string }> = [];

      for (let i = 0; i < steps; i++) {
        const anchor = new Date();
        anchor.setMonth(anchor.getMonth() - i * 2);

        // Find Monday of the anchor week
        const day = anchor.getDay(); // 0=Sun..6=Sat
        const monday = new Date(anchor);
        const deltaToMonday = (day === 0 ? -6 : 1 - day); // shift to Monday
        monday.setDate(anchor.getDate() + deltaToMonday);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const from = monday.toISOString().split('T')[0];
        const until = friday.toISOString().split('T')[0];

        const res = await seqtaFetch('/seqta/student/load/timetable?', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { from, until, student: studentId }
        });
        const payload = typeof res === 'string' ? JSON.parse(res).payload : (res as any).payload;
        const items: any[] = payload?.items || [];
        const matches = items.filter((l: any) => {
          const metaOk = metaclass != null && Number(l.metaID) === Number(metaclass);
          const progOk = programme != null && Number(l.programmeID) === Number(programme);
          const codeOk = code && (l.code || l.subject || '').toString().toLowerCase() === code.toString().toLowerCase();
          return (metaOk && progOk) || codeOk;
        });

        for (const m of matches) {
          const date = (m.date || (m.from || '').split('T')[0]) as string;
          const fromT = (m.from || '').substring(0, 5) || (m.from || '').substring(11, 16);
          const untilT = (m.until || '').substring(0, 5) || (m.until || '').substring(11, 16);
          collected.push({ date, from: fromT, until: untilT, room: m.room || m.location || undefined });
        }
      }

      // Deduplicate by weekday and time range
      const seen = new Set<string>();
      const deduped: Array<{ date: string; from: string; until: string; room?: string }> = [];
      for (const entry of collected) {
        const d = new Date(entry.date);
        const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
        if (weekday === 'Sat' || weekday === 'Sun') continue; // ignore weekends
        const sig = `${weekday}-${entry.from}-${entry.until}-${entry.room || ''}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        deduped.push(entry);
      }

      return deduped;
    } catch (e) {
      console.warn('getWeeklyScheduleForClass failed:', e);
      return [];
    }
  }

  /**
   * Search for SEQTA elements that can be mentioned
   */
  static async searchMentions(query: string = ''): Promise<SeqtaMentionItem[]> {
    const cacheKey = `search_${query}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Fetch data from multiple SEQTA endpoints in parallel
      const [assignments, classes, subjects, assessments, timetables] = await Promise.all([
        this.fetchAssignments(query),
        this.fetchClasses(query),
        this.fetchSubjects(query),
        this.fetchAssessments(query),
        this.fetchTimetables(query)
      ]);

      const allItems = [
        ...assignments,
        ...classes,
        ...subjects,
        ...assessments,
        ...timetables
      ];

      // Filter by query if provided
      const filteredItems = query.trim()
        ? allItems.filter(item => 
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
            item.type.toLowerCase().includes(query.toLowerCase())
          )
        : allItems;

      // Sort by relevance and limit results
      const sortedItems = filteredItems
        .sort((a, b) => {
          if (query.trim()) {
            const queryLower = query.toLowerCase();
            
            // Prioritize exact matches
            const aExact = a.title.toLowerCase() === queryLower;
            const bExact = b.title.toLowerCase() === queryLower;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            // Then prioritize matches at the beginning of title
            const aStartsWithTitle = a.title.toLowerCase().startsWith(queryLower);
            const bStartsWithTitle = b.title.toLowerCase().startsWith(queryLower);
            if (aStartsWithTitle && !bStartsWithTitle) return -1;
            if (!aStartsWithTitle && bStartsWithTitle) return 1;
            
            // Then prioritize matches at the beginning of words in title
            const aWordStart = new RegExp(`\\b${queryLower}`, 'i').test(a.title);
            const bWordStart = new RegExp(`\\b${queryLower}`, 'i').test(b.title);
            if (aWordStart && !bWordStart) return -1;
            if (!aWordStart && bWordStart) return 1;
          }
          
          // Finally by type priority
          const typePriority = { assignment: 1, assessment: 2, class: 3, subject: 4, timetable: 5, notice: 6 };
          return typePriority[a.type] - typePriority[b.type];
        })
        .slice(0, 6); // Limit to 6 results for better UX

      // Cache the results
      this.cache.set(cacheKey, { data: sortedItems, timestamp: Date.now() });

      return sortedItems;
    } catch (error) {
      console.error('Error fetching SEQTA mentions:', error);
      return this.getMockData(query);
    }
  }

  /**
   * Get updated data for a specific mention
   */
  static async updateMentionData(mentionId: string, mentionType: string, meta?: any): Promise<SeqtaMentionItem | null> {
    // Normalize id for classes (program and metaclass) if save/load removed prefix
    if (mentionType === 'class') {
      mentionId = mentionId.replace(/^class:/, '');
    }
    try {
      switch (mentionType) {
        case 'assignment':
        case 'assessment':
          return await this.fetchAssignmentById((meta?.lookup?.id || mentionId).toString().replace('assessment-', ''));
        case 'class':
          // Prefer precise programme-metaclass from meta.lookup
          const classId = meta?.lookup?.programme && meta?.lookup?.metaclass
            ? `${meta.lookup.programme}-${meta.lookup.metaclass}`
            : mentionId;
          return await this.fetchClassById(classId);
        case 'subject':
          return await this.fetchSubjectById(meta?.lookup?.code || mentionId);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error updating ${mentionType} data:`, error);
      return null;
    }
  }

  private static async fetchAssignments(query: string = ''): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch upcoming assessments (assignments) from SEQTA
      const studentId = 69; // This should be dynamic in production
      const res = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId }
      });
      
      const assignments = JSON.parse(res).payload as any[];
      
      return assignments
        .filter(a => !query || 
          a.title?.toLowerCase().includes(query.toLowerCase()) ||
          a.subject?.toLowerCase().includes(query.toLowerCase())
        )
        .map(assignment => ({
          id: assignment.id?.toString() || crypto.randomUUID(),
          type: 'assignment' as const,
          title: assignment.title || 'Assignment',
          subtitle: `${assignment.subject || assignment.code} • Due: ${this.formatDate(assignment.due)}`,
          data: {
            id: assignment.id,
            title: assignment.title,
            subject: assignment.subject || assignment.code,
            dueDate: assignment.due,
            status: new Date(assignment.due) > new Date() ? 'pending' : 'overdue',
            description: assignment.description
          },
          lastUpdated: new Date().toISOString()
        }));
    } catch (error) {
      console.warn('Failed to fetch assignments, using mock data');
      return [];
    }
  }

  private static async fetchClasses(query: string = ''): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch subjects (classes) from SEQTA
      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {}
      });
      
      const classesData = JSON.parse(res).payload;
      const allSubjects = classesData.flatMap((folder: any) => folder.subjects);
      
      const filtered = allSubjects
        .filter((subject: any) => !query ||
          subject.title?.toLowerCase().includes(query.toLowerCase()) ||
          subject.code?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5);

      const enriched = await Promise.all(filtered.map(async (cls: any) => {
        const fallbackTeacher = cls.teacher || 'Teacher TBA';
        const teacher = await this.getTeacherFromTimetable(cls.programme, cls.metaclass, cls.code) || fallbackTeacher;
        return {
          id: `${cls.programme}-${cls.metaclass}`,
          type: 'class' as const,
          title: cls.title || cls.code,
          subtitle: `${cls.code} • ${teacher}`,
          data: {
            id: `${cls.programme}-${cls.metaclass}`,
            name: cls.title,
            subject: cls.code,
            code: cls.code,
            year: cls.year || 10,
            teacher,
            programme: cls.programme,
            metaclass: cls.metaclass
          },
          lastUpdated: new Date().toISOString()
        } as SeqtaMentionItem;
      }));

      return enriched;
    } catch (error) {
      console.warn('Failed to fetch classes, using mock data');
      return [];
    }
  }

  private static async fetchSubjects(query: string = ''): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch subjects from SEQTA - same as classes but with different presentation
      const res = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {}
      });
      
      const classesData = JSON.parse(res).payload;
      const allSubjects = classesData.flatMap((folder: any) => folder.subjects);
      
      return allSubjects
        .filter((subject: any) => !query || 
          subject.title?.toLowerCase().includes(query.toLowerCase()) ||
          subject.code?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3) // Limit results for subjects
        .map((subject: any) => ({
          id: `subject-${subject.programme}-${subject.metaclass}`,
          type: 'subject' as const,
          title: subject.title || subject.code,
          subtitle: `${subject.code} • ${subject.teacher || 'Teacher TBA'} • Active`,
          data: {
            id: `subject-${subject.programme}-${subject.metaclass}`,
            name: subject.title,
            code: subject.code,
            teacher: subject.teacher || 'Teacher TBA',
            assignmentCount: 0, // Would need additional API call
            programme: subject.programme,
            metaclass: subject.metaclass
          },
          lastUpdated: new Date().toISOString()
        }));
    } catch (error) {
      console.warn('Failed to fetch subjects, using mock data');
      return [];
    }
  }

  private static async fetchAssessments(query: string = ''): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch upcoming assessments from SEQTA
      const studentId = 69; // This should be dynamic in production
      const res = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId }
      });
      
      const assessments = JSON.parse(res).payload as any[];
      
      return assessments
        .filter(a => !query || 
          a.title?.toLowerCase().includes(query.toLowerCase()) ||
          a.subject?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3) // Limit results
        .map(assessment => ({
          id: `assessment-${assessment.id}`,
          type: 'assessment' as const,
          title: assessment.title || 'Assessment',
          subtitle: `${assessment.subject || assessment.code} • ${this.formatDate(assessment.due)} • Test`,
          data: {
            id: assessment.id,
            title: assessment.title,
            subject: assessment.subject || assessment.code,
            date: assessment.due,
            type: 'test' as const,
            weight: assessment.weight
          },
          lastUpdated: new Date().toISOString()
        }));
    } catch (error) {
      console.warn('Failed to fetch assessments, using mock data');
      return [];
    }
  }

  private static async fetchTimetables(query: string = ''): Promise<SeqtaMentionItem[]> {
    try {
      // Fetch today's timetable from SEQTA
      const studentId = 69; // This should be dynamic in production
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      const res = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { from: dateStr, until: dateStr, student: studentId }
      });
      
      const timetableData = JSON.parse(res).payload;
      const lessons = timetableData.items || [];
      
      // Only return if there are lessons and query matches
      if (lessons.length > 0 && (!query || 
        'today'.includes(query.toLowerCase()) || 
        'schedule'.includes(query.toLowerCase()) ||
        'timetable'.includes(query.toLowerCase()))) {
        
        return [{
          id: `timetable-${dateStr}`,
          type: 'timetable' as const,
          title: `Today's Schedule`,
          subtitle: `${lessons.length} classes scheduled`,
          data: {
            id: `timetable-${dateStr}`,
            date: dateStr,
            classes: lessons.map((lesson: any) => ({
              subject: lesson.title || lesson.code,
              time: `${lesson.from.substring(0, 5)} - ${lesson.until.substring(0, 5)}`,
              room: lesson.room || 'TBA',
              teacher: lesson.teacher || 'TBA'
            }))
          },
          lastUpdated: new Date().toISOString()
        }];
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to fetch timetables, using mock data');
      return [];
    }
  }

  // Individual fetch methods for updates - simplified for now
  private static async fetchAssignmentById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      const studentId = 69;
      // Check upcoming first
      const upcomingRes = await seqtaFetch('/seqta/student/assessment/list/upcoming?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { student: studentId }
      });
      const upcoming = JSON.parse(upcomingRes).payload as any[];
      const found = upcoming.find((a: any) => a.id?.toString() === id || `assessment-${a.id}` === id);
      if (found) {
        return {
          id: `assessment-${found.id}`,
          type: 'assessment',
          title: found.title || 'Assessment',
          subtitle: `${found.subject || found.code} • ${this.formatDate(found.due)}`,
          data: {
            id: found.id,
            title: found.title,
            subject: found.subject || found.code,
            code: found.code,
            due: found.due,
            dueDate: found.due,
            status: new Date(found.due) > new Date() ? 'pending' : 'overdue',
          },
          lastUpdated: new Date().toISOString()
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async fetchClassById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // id format: programme-metaclass
      const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: {}
      });
      const folders = JSON.parse(classesRes).payload as any[];
      const all = folders.flatMap((f: any) => f.subjects);
      const match = all.find((s: any) => `${s.programme}-${s.metaclass}` === id);
      if (!match) return null;
      const code = match.code;
      const teacherResolved = await this.getTeacherFromTimetable(match.programme, match.metaclass, code);
      const teacher = teacherResolved || match.teacher || 'Teacher TBA';

      // Pull next 14 days of timetable entries for this code
      const start = new Date();
      const end = new Date();
      end.setDate(start.getDate() + 14);
      const from = start.toISOString().split('T')[0];
      const until = end.toISOString().split('T')[0];
      const ttRes = await seqtaFetch('/seqta/student/load/timetable?', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { from, until, student: 69 }
      });
      const timetable = JSON.parse(ttRes).payload;
      const items = (timetable.items || []).filter((l: any) => {
        const metaOk = Number(l.metaID) === Number(match.metaclass);
        const progOk = Number(l.programmeID) === Number(match.programme);
        const codeOk = (l.code || l.subject || '').toLowerCase() === code.toLowerCase();
        return (metaOk && progOk) || codeOk;
      });
      const lessons = items.map((l: any) => ({
        date: l.date || (l.from || '').split('T')[0],
        from: (l.from || '').substring(0, 5) || (l.from || '').substring(11, 16),
        until: (l.until || '').substring(0, 5) || (l.until || '').substring(11, 16),
        room: l.room || 'TBA',
        teacher: l.staff || l.teacher || teacher,
      }));

      return {
        id,
        type: 'class',
        title: match.title || code,
        subtitle: `${code} • ${teacher}`,
        data: {
          id,
          name: match.title,
          code,
          teacher,
          programme: match.programme,
          metaclass: match.metaclass,
          lessons
        },
        lastUpdated: new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  private static async fetchSubjectById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // id pattern may be subject-<programme>-<metaclass> or plain code; try both
      const classesRes = await seqtaFetch('/seqta/student/load/subjects?', {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: {}
      });
      const folders = JSON.parse(classesRes).payload as any[];
      const all = folders.flatMap((f: any) => f.subjects);
      const match = all.find((s: any) => `subject-${s.programme}-${s.metaclass}` === id || s.code === id);
      if (!match) return null;
      const teacherResolved = await this.getTeacherFromTimetable(match.programme, match.metaclass, match.code);
      const teacher = teacherResolved || match.teacher || 'Teacher TBA';
      return {
        id: `subject-${match.programme}-${match.metaclass}`,
        type: 'subject',
        title: match.title || match.code,
        subtitle: `${match.code} • ${teacher}`,
        data: {
          code: match.code,
          teacher,
          programme: match.programme,
          metaclass: match.metaclass
        },
        lastUpdated: new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  private static async fetchAssessmentById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // For now, return updated mock data - in production this would fetch specific assignment
      const mockData = this.getMockData('').find(item => item.id === id || item.type === 'assessment');
      if (mockData) {
        return {
          ...mockData,
          lastUpdated: new Date().toISOString()
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private static async fetchTimetableById(id: string): Promise<SeqtaMentionItem | null> {
    try {
      // For now, return updated mock data
      const mockData = this.getMockData('').find(item => item.id === id || item.type === 'timetable');
      if (mockData) {
        return {
          ...mockData,
          lastUpdated: new Date().toISOString()
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Mock data for development/fallback
   */
  private static getMockData(query: string = ''): SeqtaMentionItem[] {
    const mockData: SeqtaMentionItem[] = [
      {
        id: 'assignment-1',
        type: 'assignment',
        title: 'Mathematics Assignment 3',
        subtitle: 'Mathematics • Due: Tomorrow, 11:59 PM',
        data: { subject: 'Mathematics', dueDate: '2024-01-15T23:59:00Z', status: 'pending' }
      },
      {
        id: 'class-1',
        type: 'class',
        title: 'Year 10 Mathematics',
        subtitle: 'Mr. Smith • Room 204',
        data: { year: 10, subject: 'Mathematics', teacher: 'Mr. Smith', room: '204' }
      },
      {
        id: 'subject-1',
        type: 'subject',
        title: 'English Literature',
        subtitle: 'ENG10 • Ms. Johnson • 4 assignments',
        data: { code: 'ENG10', teacher: 'Ms. Johnson', assignmentCount: 4 }
      },
      {
        id: 'assessment-1',
        type: 'assessment',
        title: 'Chemistry Test',
        subtitle: 'Chemistry • Next Friday • Test',
        data: { subject: 'Chemistry', date: '2024-01-19T09:00:00Z', type: 'test' }
      },
      {
        id: 'timetable-1',
        type: 'timetable',
        title: 'Schedule for Today',
        subtitle: '6 classes scheduled',
        data: { date: '2024-01-14', classCount: 6 }
      }
    ];

    if (!query) return mockData;
    
    return mockData.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
    );
  }

  private static formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Clear cache (useful for development or when data is stale)
   */
  static clearCache(): void {
    this.cache.clear();
  }
} 