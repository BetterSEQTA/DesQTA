

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
    
    // Generate 1000 mock messages
    const messageCount = 1000;
    const subjects = [
      'Welcome to DesQTA',
      'Assignment Reminder',
      'Important Notice',
      'Class Schedule Update',
      'Exam Information',
      'Project Guidelines',
      'Parent Meeting',
      'Field Trip Permission',
      'Library Resources',
      'Course Materials',
      'Homework Help',
      'Study Group',
      'Academic Progress',
      'Event Invitation',
      'System Maintenance',
      'New Resources Available',
      'Grade Update',
      'Attendance Notice',
      'Calendar Change',
      'Support Request'
    ];
    
    const senders = [
      'Mr. Johnson',
      'Ms. Smith',
      'Dr. Williams',
      'Mrs. Brown',
      'Prof. Davis',
      'Mr. Wilson',
      'Ms. Taylor',
      'Dr. Anderson',
      'Mrs. Martin',
      'Mr. Thompson',
      'Ms. Garcia',
      'Dr. Rodriguez',
      'Mrs. Lewis',
      'Mr. Walker',
      'Ms. Hall',
      'School Admin',
      'IT Support',
      'Library Staff',
      'Counselor',
      'Principal'
    ];
    
    const participants = [
      'Student Portal',
      'Class Group',
      'Study Team',
      'Project Team',
      'All Students',
      'Year 10 Students',
      'Year 11 Students',
      'Year 12 Students'
    ];
    
    const messages = Array.from({ length: messageCount }, (_, i) => {
      const baseDate = new Date('2025-12-31T12:00:00Z');
      const randomDaysBack = Math.floor(Math.random() * 365); // Random date within the past year
      const randomHoursOffset = Math.floor(Math.random() * 24);
      const randomMinutesOffset = Math.floor(Math.random() * 60);
      
      const messageDate = new Date(baseDate);
      messageDate.setDate(messageDate.getDate() - randomDaysBack);
      messageDate.setHours(randomHoursOffset, randomMinutesOffset);
      
      const subject = subjects[i % subjects.length] + (i > subjects.length ? ` ${Math.floor(i / subjects.length) + 1}` : '');
      const sender = senders[i % senders.length];
      const participant = participants[i % participants.length];
      
      return {
        id: 1000 + i,
        subject: subject,
        sender: sender,
        date: messageDate.toISOString(),
        participants: [{ name: participant }],
        attachments: Math.random() > 0.8, // 20% chance of attachment
        read: Math.random() > 0.3, // 70% chance of being read
        starred: Math.random() > 0.9, // 10% chance of being starred
        lastMessageAt: messageDate.toISOString()
      };
    });
    
    // Sort by date descending (newest first)
    const sortedMessages = messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return JSON.stringify({ payload: { messages: sortedMessages } });
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
      return JSON.stringify({ payload: [ 
        { id: 1, title: 'General', colour: '#910048' }, 
        { id: 2, title: 'Urgent', colour: '#ff0000' },
        { id: 3, title: 'Academic', colour: '#2563eb' },
        { id: 4, title: 'Events', colour: '#059669' },
        { id: 5, title: 'Sports', colour: '#dc2626' },
        { id: 6, title: 'Administrative', colour: '#7c3aed' }
      ] });
    }
    
    // Generate 500 mock notices
    const noticeCount = 500;
    const noticeTitles = [
      'Welcome Back to School',
      'Parent-Teacher Conference Schedule',
      'School Sports Day Event',
      'Library Hours Extended',
      'New Course Registration Open',
      'Exam Schedule Released',
      'Student Council Elections',
      'Science Fair Announcement',
      'Art Exhibition Opening',
      'Drama Club Auditions',
      'Field Trip Permission Required',
      'Uniform Policy Update',
      'Cafeteria Menu Changes',
      'Technology Lab Maintenance',
      'Music Concert Tickets Available',
      'Career Fair Next Week',
      'Scholarship Opportunities',
      'Health & Safety Guidelines',
      'Lost & Found Items',
      'Transportation Schedule Change',
      'Academic Excellence Awards',
      'Club Meeting Schedule',
      'PTA Meeting Announcement',
      'School Closure Notice',
      'Emergency Contact Update',
      'Fundraising Event Details',
      'Workshop Registration',
      'Guest Speaker Visit',
      'Academic Support Available',
      'Student Survey Request'
    ];
    
    const staffMembers = [
      'Principal Johnson',
      'Vice Principal Smith',
      'Academic Director Brown',
      'Student Services Wilson',
      'Ms. Anderson',
      'Mr. Thompson',
      'Dr. Martinez',
      'Mrs. Davis',
      'Coach Roberts',
      'Librarian Lee',
      'IT Administrator',
      'School Secretary',
      'Counselor Taylor',
      'Nurse Williams',
      'Facilities Manager'
    ];
    
    const labels = [
      { id: 1, title: 'General', colour: '#910048' },
      { id: 2, title: 'Urgent', colour: '#ff0000' },
      { id: 3, title: 'Academic', colour: '#2563eb' },
      { id: 4, title: 'Events', colour: '#059669' },
      { id: 5, title: 'Sports', colour: '#dc2626' },
      { id: 6, title: 'Administrative', colour: '#7c3aed' }
    ];
    
    const noticeContents = [
      'Please read this important information carefully and take appropriate action.',
      'We are pleased to announce this exciting opportunity for all students.',
      'Your participation is highly encouraged. Please see details below.',
      'This notice contains important updates to school policies and procedures.',
      'Registration is now open. Limited spaces available - first come, first served.',
      'All students and parents are invited to attend this important event.',
      'Please ensure you have all required documentation before the deadline.',
      'Contact the main office if you have any questions or concerns.',
      'This is a mandatory requirement for all students in affected programs.',
      'We appreciate your cooperation and understanding in this matter.'
    ];
    
    const notices = Array.from({ length: noticeCount }, (_, i) => {
      const baseDate = new Date('2025-12-31T12:00:00Z');
      const randomDaysBack = Math.floor(Math.random() * 180); // Random date within the past 6 months
      const randomHoursOffset = Math.floor(Math.random() * 24);
      const randomMinutesOffset = Math.floor(Math.random() * 60);
      
      const noticeDate = new Date(baseDate);
      noticeDate.setDate(noticeDate.getDate() - randomDaysBack);
      noticeDate.setHours(randomHoursOffset, randomMinutesOffset);
      
      const label = labels[i % labels.length];
      const title = noticeTitles[i % noticeTitles.length] + (i >= noticeTitles.length ? ` ${Math.floor(i / noticeTitles.length) + 1}` : '');
      const staff = staffMembers[i % staffMembers.length];
      const content = noticeContents[i % noticeContents.length];
      
      return {
        id: i + 1,
        title: title,
        label_title: label.title,
        staff: staff,
        colour: label.colour,
        label: label.id,
        contents: `<p>${content}</p><p>Notice ID: ${i + 1} | Date: ${noticeDate.toLocaleDateString()}</p>`,
        date: toISODate(noticeDate)
      };
    });
    
    // Sort by date descending (newest first)
    const sortedNotices = notices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return JSON.stringify({ payload: sortedNotices });
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