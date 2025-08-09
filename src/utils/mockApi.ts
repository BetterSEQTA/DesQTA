

// Helpers mirrored from netUtil but scoped here
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const now = new Date('2025-12-31T12:00:00Z');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const genDates2025 = (intervalDays = 7) => {
  const result: string[] = [];
  const start = new Date('2025-01-01T00:00:00Z');
  const end = new Date('2025-12-31T00:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + intervalDays)) {
    result.push(toISODate(d));
  }
  return result;
};
const sortByDateDesc = <T>(arr: T[], getDate: (x: T) => string | Date) => {
  return arr.sort((a, b) => new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime());
};

export function mockApiResponse(url: string): any {
  // Helper: extract query params from URL
  const qsParams = (() => {
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return {} as Record<string, string>;
    const query = url.substring(qIndex + 1);
    const out: Record<string, string> = {};
    query.split('&').filter(Boolean).forEach(p => {
      const [k, v] = p.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return out;
  })();

  // LOGIN
  if (url.includes('/seqta/student/login')) {
    return JSON.stringify({
      payload: {
        clientIP: '127.0.0.1',
        email: getRandomItem(['student2025@example.com', 'user2025@school.edu']),
        id: 999,
        lastAccessedTime: now.getTime(),
        meta: { code: 'STU', governmentID: 'GOV2025' },
        personUUID: 'uuid-2025-' + Math.random().toString(36).substring(2, 10),
        saml: [
          { autologin: false, label: 'SEQTA', method: 'POST', request: '', sigalg: '', signature: '', slo: false, url: '' },
        ],
        status: 'active',
        type: 'student',
        userCode: 'U2025',
        userDesc: 'Student',
        userName: 'student2025',
        displayName: 'Student Two Zero Two Five',
      },
    });
  }

  // HEARTBEAT
  if (url.includes('/seqta/student/heartbeat')) {
    return JSON.stringify({ ok: true, timestamp: now.toISOString() });
  }

  // LOAD SETTINGS
  if (url.includes('/seqta/student/load/settings')) {
    return JSON.stringify({
      payload: {
        theme: 'default',
        messaging: { signaturesEnabled: true },
        timetable: { weekStartsOn: 'Monday' },
        updatedAt: now.toISOString(),
      },
    });
  }

  // PROFILE
  if (url.includes('/seqta/student/load/profile')) {
    return JSON.stringify({
      payload: {
        firstname: 'Alex',
        surname: 'Taylor',
        displayName: 'Alex Taylor',
        year: '12',
        house: 'Gryphon',
        email: 'alex.taylor@school.edu',
        lastUpdated: now.toISOString(),
      },
    });
  }

  // PHOTO GET (simulate return URL)
  if (url.includes('/seqta/student/photo/get')) {
    return JSON.stringify('https://picsum.photos/seed/seqta-2025/128');
  }

  // SUBJECTS (Folders with subjects)
  if (url.includes('/seqta/student/load/subjects')) {
    return JSON.stringify({
      payload: [
        {
          code: 'FOLDER1',
          description: 'Core Subjects',
          id: 1,
          active: 1,
          subjects: [
            { code: 'MATH', classunit: 101, description: 'Mathematics', metaclass: 1, title: 'Mathematics', programme: 1, marksbook_type: 'A' },
            { code: 'SCI', classunit: 102, description: 'Science', metaclass: 2, title: 'Science', programme: 1, marksbook_type: 'A' },
          ],
        },
        {
          code: 'FOLDER2',
          description: 'Languages',
          id: 2,
          active: 1,
          subjects: [
            { code: 'ENG', classunit: 201, description: 'English', metaclass: 3, title: 'English', programme: 2, marksbook_type: 'B' },
          ],
        },
      ],
    });
  }

  // COURSES (list of course cards)
  if (url.includes('/seqta/student/load/courses')) {
    return JSON.stringify({
      payload: [
        { id: 'C101', title: 'Algebra II', subject: 'MATH', teacher: 'Ms. Smith', updated: now.toISOString() },
        { id: 'C102', title: 'Chemistry', subject: 'SCI', teacher: 'Mr. Jones', updated: now.toISOString() },
        { id: 'C201', title: 'English Lit', subject: 'ENG', teacher: 'Mrs. Brown', updated: now.toISOString() },
      ],
    });
  }

  // PREFS
  if (url.includes('/seqta/student/load/prefs')) {
    return JSON.stringify({
      payload: [
        { name: 'timetable.subject.colour.MATH', value: '#ff0000' },
        { name: 'timetable.subject.colour.SCI', value: '#00ff00' },
        { name: 'timetable.subject.colour.ENG', value: '#0000ff' },
      ],
    });
  }

  // TIMETABLE
  if (url.includes('/seqta/student/load/timetable')) {
    const lessons: any[] = [];
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-12-31T00:00:00Z');
    const slots = [
      { from: '08:30', until: '09:20' },
      { from: '09:30', until: '10:20' },
      { from: '10:30', until: '11:20' },
      { from: '11:30', until: '12:20' },
      { from: '13:10', until: '14:00' },
      { from: '14:10', until: '15:00' },
    ];
    const subjects = [
      { code: 'MATH', description: 'Mathematics', staff: 'Ms. Smith', room: 'A1', classunit: 101 },
      { code: 'SCI', description: 'Science', staff: 'Mr. Jones', room: 'B2', classunit: 102 },
      { code: 'ENG', description: 'English', staff: 'Mrs. Brown', room: 'C3', classunit: 201 },
    ];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.getUTCDay();
      if (day === 0 || day === 6) continue;
      slots.forEach((slot, idx) => {
        const subj = subjects[(d.getUTCDate() + idx) % subjects.length];
        lessons.push({
          date: toISODate(d),
          from: slot.from,
          until: slot.until,
          description: subj.description,
          staff: subj.staff,
          room: subj.room,
          code: subj.code,
          classunit: subj.classunit,
        });
      });
    }
    const qFrom = qsParams['from'];
    const qUntil = qsParams['until'];
    let items = lessons;
    if (qFrom || qUntil) {
      items = lessons.filter(l => (!qFrom || l.date >= qFrom) && (!qUntil || l.date <= qUntil));
    }
    if (!qFrom && !qUntil) {
      const latestDate = items.length ? items[items.length - 1].date : toISODate(now);
      const startLatest = new Date(latestDate);
      startLatest.setUTCDate(startLatest.getUTCDate() - 7);
      const startStr = toISODate(startLatest);
      items = items.filter(l => l.date >= startStr);
    }
    return JSON.stringify({ payload: { items } });
  }

  // COURSE CONTENT FOR LESSONS
  if (url.includes('/seqta/student/load/course/content')) {
    const classunit = qsParams['classunit'] || '101';
    const date = qsParams['date'] || toISODate(now);
    const seed = (classunit + '-' + date).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const topicsByClass: Record<string, string[]> = {
      '101': ['Quadratic Equations', 'Trigonometric Identities', 'Sequences and Series', 'Probability'],
      '102': ['Atomic Structure', 'Chemical Reactions', 'Acids and Bases', 'Stoichiometry'],
      '201': ['Poetry Analysis', 'Persuasive Writing', 'Novel Study', 'Comparative Essays'],
    };
    const resourcesByClass: Record<string, { label: string; url: string }[]> = {
      '101': [
        { label: 'Worksheet: Quadratics', url: 'https://example.com/math/quadratics.pdf' },
        { label: 'Desmos Activity', url: 'https://www.desmos.com/' },
      ],
      '102': [
        { label: 'Lab Sheet: Reactions', url: 'https://example.com/sci/reactions.pdf' },
        { label: 'PhET Simulations', url: 'https://phet.colorado.edu/' },
      ],
      '201': [
        { label: 'Poetry Anthology', url: 'https://example.com/eng/poetry.pdf' },
        { label: 'Essay Planner', url: 'https://example.com/eng/planner.docx' },
      ],
    };
    const classKey = ['101', '102', '201'].includes(classunit) ? classunit : '101';
    const topics = topicsByClass[classKey];
    const topic = topics[seed % topics.length];
    const resources = resourcesByClass[classKey];
    const homework = {
      description: `Complete exercises related to: ${topic}`,
      due: toISODate(new Date(Date.UTC(
        Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)) + 2
      ))),
    };
    const content = {
      overview: `Lesson focus: ${topic}`,
      objectives: [
        `Understand key concepts of ${topic}`,
        `Apply ${topic} to problem-solving`,
        `Review prior knowledge relevant to ${topic}`,
      ],
      activities: [
        `Warm-up: Quick recap on last lesson (5 min)`,
        `Main activity: Guided practice on ${topic} (30 min)`,
        `Independent work: Exercises on ${topic} (15 min)`,
      ],
      resources,
      homework,
      lastUpdated: new Date(date + 'T15:00:00Z').toISOString(),
    };
    return JSON.stringify({ payload: { classunit: Number(classunit), date, content } });
  }

  // ASSESSMENTS - UPCOMING
  if (url.includes('/seqta/student/assessment/list/upcoming')) {
    const dates = genDates2025(14);
    const subjectMap = [
      { code: 'MATH', subject: 'Math' },
      { code: 'SCI', subject: 'Science' },
      { code: 'ENG', subject: 'English' },
    ];
    let payload = dates.map((d, i) => {
      const m = subjectMap[i % subjectMap.length];
      return { id: 200 + i, code: m.code, subject: m.subject, due: d, title: 'Assessment ' + (i + 1), status: 'UPCOMING' };
    });
    payload = sortByDateDesc(payload, x => x.due);
    const today = new Date();
    const future = payload.filter(a => new Date(a.due) >= today);
    if (future.length < 3) {
      payload = payload.slice(0, 5);
    } else {
      payload = future.slice(0, 5);
    }
    return JSON.stringify({ payload });
  }

  // ASSESSMENTS - PAST
  if (url.includes('/seqta/student/assessment/list/past')) {
    const dates = genDates2025(14);
    let tasks = dates.map((d, i) => ({ id: 300 + i, code: getRandomItem(['MATH', 'SCI', 'ENG']), due: d, title: 'Past Task ' + (i + 1), status: 'MARKS_RELEASED' }));
    tasks = sortByDateDesc(tasks, x => x.due);
    return JSON.stringify({ payload: { tasks } });
  }

  // ASSESSMENT DETAIL
  if (url.includes('/seqta/student/assessment/get')) {
    const id = qsParams['id'] || '9999';
    return JSON.stringify({
      payload: { id: Number(id), title: 'Assessment Detail ' + id, description: 'This is a mock assessment for 2025.', due: '2025-11-15', subject: 'Math', resources: [{ name: 'Rubric.pdf', uuid: 'file-uuid-' + id }] },
    });
  }

  // ASSESSMENT SUBMISSIONS GET
  if (url.includes('/seqta/student/assessment/submissions/get')) {
    const id = qsParams['id'] || '9999';
    return JSON.stringify({ payload: [ { id: 1, assessmentId: Number(id), submitted: true, submittedAt: '2025-11-10T10:00:00Z', grade: 'A' }, { id: 2, assessmentId: Number(id), submitted: false, submittedAt: null, grade: null } ] });
  }

  // ASSESSMENT SUBMISSIONS SAVE
  if (url.includes('/seqta/student/assessment/submissions/save')) {
    return JSON.stringify({ status: 'ok', payload: { linkId: 'link-2025-' + Math.random().toString(36).slice(2, 6) } });
  }

  // MESSAGING - LIST/THREAD
  if (url.includes('/seqta/student/load/message')) {
    if (url.includes('/people')) {
      return JSON.stringify({ payload: [ { id: 1, firstname: 'Alice', surname: 'Smith', xx_display: 'Alice Smith', year: '10', sub_school: 'Middle', house: 'Red', house_colour: '#ff0000', campus: 'Main', rollgroup: '10A' }, { id: 2, firstname: 'Bob', surname: 'Jones', xx_display: 'Bob Jones', year: '11', sub_school: 'Senior', house: 'Blue', house_colour: '#0000ff', campus: 'North', rollgroup: '11B' }, { id: 3, firstname: 'Charlie', surname: 'Brown', xx_display: 'Charlie Brown', year: '12', sub_school: 'Senior', house: 'Green', campus: 'Main', rollgroup: '12C', house_colour: '#00ff00' } ] });
    }
    const months = Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(2025, m, 15)));
    const threads = months.map((d, i) => ({ id: 1000 + i, subject: 'Thread ' + (i + 1), lastMessageAt: d.toISOString(), participants: ['Alex Taylor', 'Staff ' + (i + 1)], preview: 'This is a preview for thread ' + (i + 1) }));
    return JSON.stringify({ payload: sortByDateDesc(threads, x => x.lastMessageAt) });
  }

  // MESSAGING - SAVE/SEND
  if (url.includes('/seqta/student/save/message')) {
    return JSON.stringify({ status: 'ok', payload: { messageId: 'msg-2025-' + Math.random().toString(36).slice(2, 6), savedAt: now.toISOString() } });
  }

  // PORTALS LIST
  if (url.includes('/seqta/student/load/portals') && !url.includes('/portal')) {
    const portals = [
      { id: 'p1', title: 'Library', updated: '2025-12-20T12:00:00Z' },
      { id: 'p2', title: 'Careers', updated: '2025-11-05T09:00:00Z' },
      { id: 'p3', title: 'Wellbeing', updated: '2025-10-01T15:30:00Z' },
    ];
    return JSON.stringify({ payload: sortByDateDesc(portals, x => x.updated) });
  }

  // PORTAL DETAIL
  if (url.includes('/seqta/student/load/portal')) {
    const id = qsParams['id'] || 'p1';
    return JSON.stringify({ payload: { id, title: id === 'p2' ? 'Careers' : id === 'p3' ? 'Wellbeing' : 'Library', links: [ { label: 'External Link 1', url: 'https://example.com/1' }, { label: 'External Link 2', url: 'https://example.com/2' } ], updated: now.toISOString() } });
  }

  // NOTICES
  if (url.includes('/seqta/student/load/notices')) {
    if (typeof arguments[1] === 'object' && (arguments as any)[1]?.body?.mode === 'labels') {
      return JSON.stringify({ payload: [ { id: 1, title: 'General', colour: '#910048' }, { id: 2, title: 'Urgent', colour: '#ff0000' } ] });
    }
    const dates = genDates2025(10);
    let notices = dates.map((d, i) => ({ id: i + 1, title: 'Notice ' + (i + 1), label_title: i % 3 === 0 ? 'Urgent' : 'General', staff: i % 2 ? 'Vice Principal' : 'Principal', colour: i % 3 === 0 ? '#ff0000' : '#910048', label: i % 3 === 0 ? 2 : 1, contents: `This is notice ${i + 1} for ${d}.`, date: d }));
    notices = sortByDateDesc(notices, x => x.date);
    return JSON.stringify({ payload: notices });
  }

  // REPORTS
  if (url.includes('/seqta/student/load/reports')) {
    const payload = [
      { year: '2025', terms: 'Term 1', types: 'Semester Report', created_date: '2025-03-31 12:00', uuid: 'report-uuid-t1' },
      { year: '2025', terms: 'Term 2', types: 'Progress Report', created_date: '2025-06-30 12:00', uuid: 'report-uuid-t2' },
      { year: '2025', terms: 'Term 3', types: 'Progress Report', created_date: '2025-09-30 12:00', uuid: 'report-uuid-t3' },
      { year: '2025', terms: 'Term 4', types: 'Final Report', created_date: '2025-12-15 12:00', uuid: 'report-uuid-t4' },
    ];
    return JSON.stringify({ status: '200', payload });
  }

  // HOMEWORK SUMMARY
  if (url.includes('/seqta/student/dashlet/summary/homework')) {
    const dates = genDates2025(7);
    let payload = dates.map((d, i) => ({ id: i + 1, subject: getRandomItem(['Math', 'Science', 'English']), due: d, title: 'Homework ' + (i + 1), completed: i % 4 === 0 }));
    payload = sortByDateDesc(payload, x => x.due).slice(0, 4);
    return JSON.stringify({ payload });
  }

  // DIRECTORY PEOPLE
  if (url.includes('/seqta/student/load/message/people')) {
    return JSON.stringify({ payload: [ { id: 1, firstname: 'Alice', surname: 'Smith', xx_display: 'Alice Smith', year: '10', sub_school: 'Middle', house: 'Red', house_colour: '#ff0000', campus: 'Main', rollgroup: '10A' }, { id: 2, firstname: 'Bob', surname: 'Jones', xx_display: 'Bob Jones', year: '11', sub_school: 'Senior', house: 'Blue', house_colour: '#0000ff', campus: 'North', rollgroup: '11B' }, { id: 3, firstname: 'Charlie', surname: 'Brown', xx_display: 'Charlie Brown', year: '12', sub_school: 'Senior', house: 'Green', house_colour: '#00ff00', campus: 'Main', rollgroup: '12C' } ] });
  }

  // Default
  return JSON.stringify({ message: 'Mocked by Sensitive Info Hider', random: Math.random(), now: now.toISOString() });
} 