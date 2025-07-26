import { invoke } from '@tauri-apps/api/core';

export type SeqtaRequestInit = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  params?: Record<string, string>;
  is_image?: boolean;
  return_url?: boolean;
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a random Dicebear avatar URL for sensitive content hider mode
export function getRandomDicebearAvatar(): string {
  const styles = ['adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles', 'fun-emoji', 'micah', 'miniavs', 'personas'];
  const style = getRandomItem(styles);
  const seed = Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

function mockApiResponse(url: string): any {
  // Add more endpoints and shapes as needed
  if (url.includes('/seqta/student/login?')) {
    // Return a JSON string with a payload field matching UserInfo
    return JSON.stringify({
      payload: {
        clientIP: '127.0.0.1',
        email: getRandomItem(['test@example.com', 'user@school.edu']),
        id: getRandomItem([1, 2, 3]),
        lastAccessedTime: Date.now(),
        meta: {
          code: 'STU',
          governmentID: 'GOV123456',
        },
        personUUID: 'uuid-' + Math.random().toString(36).substring(2, 10),
        saml: [
          {
            autologin: false,
            label: 'SEQTA',
            method: 'POST',
            request: '',
            sigalg: '',
            signature: '',
            slo: false,
            url: '',
          },
        ],
        status: 'active',
        type: 'student',
        userCode: 'U' + getRandomItem(['123', '456', '789']),
        userDesc: 'Student',
        userName: getRandomItem(['jdoe', 'asmith', 'bwayne']),
        displayName: getRandomItem(['John Doe', 'Alice Smith', 'Bruce Wayne']),
      },
    });
  }
  if (url.includes('/seqta/student/dashlet/summary/homework')) {
    return JSON.stringify({
      payload: [
        { id: 1, subject: 'Math', due: '2024-06-10', title: 'Homework 1', completed: false },
        { id: 2, subject: 'Science', due: '2024-06-12', title: 'Lab Report', completed: true },
      ],
    });
  }
  if (url.includes('/seqta/student/load/prefs')) {
    // Always return an array for payload (for .find to work)
    return JSON.stringify({
      payload: [
        { name: 'timetable.subject.colour.MATH', value: '#ff0000' },
        { name: 'timetable.subject.colour.SCI', value: '#00ff00' },
        { name: 'timetable.subject.colour.ENG', value: '#0000ff' },
      ],
    });
  }
  if (url.includes('/seqta/student/load/timetable')) {
    // Return a JSON string with a payload.items array of lessons with 'from' and 'until' fields as strings
    return JSON.stringify({
      payload: {
        items: [
          {
            from: '08:30',
            until: '09:20',
            description: 'Mathematics',
            staff: 'Ms. Smith',
            room: 'A1',
            code: 'MATH',
          },
          {
            from: '09:30',
            until: '10:20',
            description: 'Science',
            staff: 'Mr. Jones',
            room: 'B2',
            code: 'SCI',
          },
          {
            from: '10:30',
            until: '11:20',
            description: 'English',
            staff: 'Mrs. Brown',
            room: 'C3',
            code: 'ENG',
          },
        ],
      },
    });
  }
  if (url.includes('/seqta/student/assessment/list/upcoming')) {
    return JSON.stringify({
      payload: [
        { id: 201, subject: 'Math', due: '2024-06-10', title: 'Test' },
        { id: 202, subject: 'Science', due: '2024-06-12', title: 'Assignment' },
      ],
    });
  }
  if (url.includes('/seqta/student/load/subjects')) {
    // Return a JSON string with a payload array of Folder objects for SubjectSidebar
    return JSON.stringify({
      payload: [
        {
          code: 'FOLDER1',
          description: 'Main Folder',
          id: 1,
          active: 1,
          subjects: [
            {
              code: 'MATH',
              classunit: 101,
              description: 'Mathematics',
              metaclass: 1,
              title: 'Mathematics',
              programme: 1,
              marksbook_type: 'A',
            },
            {
              code: 'SCI',
              classunit: 102,
              description: 'Science',
              metaclass: 2,
              title: 'Science',
              programme: 1,
              marksbook_type: 'A',
            },
          ],
        },
        {
          code: 'FOLDER2',
          description: 'Other Folder',
          id: 2,
          active: 0,
          subjects: [
            {
              code: 'ENG',
              classunit: 201,
              description: 'English',
              metaclass: 3,
              title: 'English',
              programme: 2,
              marksbook_type: 'B',
            },
          ],
        },
      ],
    });
  }
  if (url.includes('/seqta/student/load/notices')) {
    // If the request is for labels (mode: 'labels'), return label data
    if (typeof arguments[1] === 'object' && arguments[1]?.body?.mode === 'labels') {
      return JSON.stringify({
        payload: [
          { id: 1, title: 'General', colour: '#910048' },
          { id: 2, title: 'Urgent', colour: '#ff0000' },
        ],
      });
    }
    // Otherwise, return notices data
    return JSON.stringify({
      payload: [
        {
          id: 1,
          title: 'Fire Drill',
          label_title: 'Urgent',
          staff: 'Principal',
          colour: '#ff0000',
          label: 2,
          contents: 'There will be a fire drill at 10am.',
        },
        {
          id: 2,
          title: 'Assembly',
          label_title: 'General',
          staff: 'Vice Principal',
          colour: '#910048',
          label: 1,
          contents: 'School assembly in the main hall.',
        },
      ],
    });
  }
  if (url.includes('/seqta/student/assessment/list/past?')) {
    return JSON.stringify({
      payload: {
        tasks: [
          { id: 301, code: 'MATH', due: '2024-05-10', title: 'Past Test', status: 'MARKS_RELEASED' },
          { id: 302, code: 'SCI', due: '2024-05-12', title: 'Past Assignment', status: 'MARKS_RELEASED' },
        ],
      },
    });
  }
  if (url.includes('/seqta/student/load/message/people')) {
    return JSON.stringify({
      payload: [
        {
          id: 1,
          firstname: 'Alice',
          surname: 'Smith',
          xx_display: 'Alice Smith',
          year: '10',
          sub_school: 'Middle',
          house: 'Red',
          house_colour: '#ff0000',
          campus: 'Main',
          rollgroup: '10A',
        },
        {
          id: 2,
          firstname: 'Bob',
          surname: 'Jones',
          xx_display: 'Bob Jones',
          year: '11',
          sub_school: 'Senior',
          house: 'Blue',
          house_colour: '#0000ff',
          campus: 'North',
          rollgroup: '11B',
        },
        {
          id: 3,
          firstname: 'Charlie',
          surname: 'Brown',
          xx_display: 'Charlie Brown',
          year: '12',
          sub_school: 'Senior',
          house: 'Green',
          house_colour: '#00ff00',
          campus: 'Main',
          rollgroup: '12C',
        },
      ],
    });
  }
  if (url.includes('/seqta/student/load/reports')) {
    return JSON.stringify({
      status: '200',
      payload: [
        {
          year: '2023',
          terms: 'Term 1',
          types: 'Semester Report',
          created_date: '2023-04-15 10:00',
          uuid: 'report-uuid-1',
        },
        {
          year: '2023',
          terms: 'Term 2',
          types: 'Progress Report',
          created_date: '2023-07-10 09:30',
          uuid: 'report-uuid-2',
        },
        {
          year: '2022',
          terms: 'Term 4',
          types: 'Final Report',
          created_date: '2022-12-01 14:20',
          uuid: 'report-uuid-3',
        },
      ],
    });
  }
  // Default: generic mock object
  return JSON.stringify({ message: 'Mocked by Sensitive Info Hider', random: Math.random() });
}

export async function seqtaFetch(input: string, init?: SeqtaRequestInit): Promise<any> {
  // Fetch the dev_sensitive_info_hider value from settings
  let useMock = false;
  try {
    const settings = await invoke<{ dev_sensitive_info_hider?: boolean }>('get_settings');
    useMock = settings.dev_sensitive_info_hider ?? false;
  } catch (e) {
    useMock = false;
  }
  
  if (useMock) {
    return mockApiResponse(input);
  }
  
  try {
    const response = await invoke('fetch_api_data', {
      url: input,
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body || {},
      parameters: init?.params || {},
      isImage: init?.is_image || false,
      returnUrl: init?.return_url || false,
    });
    
    return response;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}

export async function getRSS(url: string): Promise<any> {
  try {
    const response = await invoke('get_rss_feed', {
      feed: url,
    });
    return response;
  } catch (error) {
    console.error('getRSS error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}

export async function openURL(url: string): Promise<any> {
  try {
    const response = await invoke('open_url', {
      url: url,
    });
  } catch (error) {
    console.error('openURL error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}

export async function uploadSeqtaFile(fileName: string, filePath: string): Promise<string> {
  try {
    const response = await invoke<string>('upload_seqta_file', {
      fileName: fileName,
      filePath: filePath,
    });
    return response;
  } catch (error) {
    console.error('uploadSeqtaFile error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown upload error');
  }
}