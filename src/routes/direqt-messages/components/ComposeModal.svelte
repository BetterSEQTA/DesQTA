<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { XMark } from 'svelte-hero-icons';
  import Editor from '../../../components/Editor/Editor.svelte';
  import { onMount } from 'svelte';
  import { seqtaFetch } from '../../../utils/netUtil';
  import Modal from '$lib/components/Modal.svelte';

  type Student = {
    campus: string;
    firstname: string;
    house: string;
    house_colour: string;
    id: number;
    rollgroup: string;
    'sub-school': string;
    surname: string;
    xx_display: string;
    year: string;
  };

  type Teacher = {
    id: number;
    firstname: string;
    surname: string;
    xx_display: string;
  };

  type Participant = {
    staff: boolean;
    id: number;
    name: string;
  };

  let { showComposeModal, composeSubject, composeBody, closeModal } = $props<{
    showComposeModal: boolean;
    composeSubject: string;
    composeBody: string;
    closeModal: () => void;
  }>();

  let students = $state<Student[]>([]);
  let staff = $state<Teacher[]>([]);
  let loadingStudents = $state(false);
  let loadingStaff = $state(false);
  let errorMessage = $state('');

  let selectedRecipients = $state<Participant[]>([]);
  let useBCC = $state(false);

  let studentSearchQuery = $state('');
  let staffSearchQuery = $state('');
  let showStudentDropdown = $state(false);
  let showStaffDropdown = $state(false);
  let isSubmitting = $state(false);
  let studentsEnabled = $state(true);

  const filteredStudents = $derived(
    students
      .filter(
        (s) =>
          s.xx_display.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          `${s.firstname} ${s.surname}`.toLowerCase().includes(studentSearchQuery.toLowerCase()),
      )
      .slice(0, 20),
  );

  const filteredStaff = $derived(
    staff
      .filter(
        (s) =>
          s.xx_display.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
          `${s.firstname} ${s.surname}`.toLowerCase().includes(staffSearchQuery.toLowerCase()),
      )
      .slice(0, 20),
  );

  async function loadRecipients() {
    try {
      loadingStudents = true;
      loadingStaff = true;

      const studentsRes = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'student' },
      });

      const staffRes = await seqtaFetch('/seqta/student/load/message/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'staff' },
      });

      const studentsData = typeof studentsRes === 'string' ? JSON.parse(studentsRes) : studentsRes;
      const staffData = typeof staffRes === 'string' ? JSON.parse(staffRes) : staffRes;

      students = studentsData.payload || [];
      staff = staffData.payload || [];

      console.log('Loaded students:', students.length);
      console.log('Loaded staff:', staff.length);
    } catch (err) {
      console.error('Failed to load recipients:', err);
      errorMessage = 'Failed to load recipients. Please try again.';
    } finally {
      loadingStudents = false;
      loadingStaff = false;
    }
  }

  function addRecipient(id: number, name: string, isStaff: boolean) {
    if (!selectedRecipients.some((r) => r.id === id && r.staff === isStaff)) {
      selectedRecipients = [...selectedRecipients, { id, staff: isStaff, name }];
    }

    if (isStaff) {
      staffSearchQuery = '';
      showStaffDropdown = false;
    } else {
      studentSearchQuery = '';
      showStudentDropdown = false;
    }
  }

  function removeRecipient(index: number) {
    selectedRecipients = selectedRecipients.filter((_, i) => i !== index);
  }

  async function sendMessage() {
    if (!composeSubject.trim() || !composeBody.trim() || selectedRecipients.length === 0) {
      return;
    }

    try {
      isSubmitting = true;
      const participants = selectedRecipients.map(({ staff, id }) =>
        staff ? { staff: true, id } : { student: true, id },
      );

      const response = await seqtaFetch('/seqta/student/save/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          subject: composeSubject,
          contents: composeBody,
          participants: participants,
          blind: useBCC,
          files: [],
        },
      });

      const responseData = typeof response === 'string' ? JSON.parse(response) : response;

      if (responseData && responseData.status === '200') {
        selectedRecipients = [];
        composeSubject = '';
        composeBody = '';
        closeModal();
      } else {
        errorMessage = 'Failed to send message. Please try again.';
      }
    } catch (err) {
      console.error('Error sending message:', err);
      errorMessage = 'An error occurred while sending the message.';
    } finally {
      isSubmitting = false;
    }
  }

  function handleClickOutside(event: MouseEvent, type: 'student' | 'staff') {
    const target = event.target as HTMLElement;
    const dropdown = document.getElementById(
      type === 'student' ? 'student-dropdown' : 'staff-dropdown',
    );
    const input = document.getElementById(type === 'student' ? 'student-search' : 'staff-search');

    if (dropdown && input && !dropdown.contains(target) && !input.contains(target)) {
      if (type === 'student') {
        showStudentDropdown = false;
      } else {
        showStaffDropdown = false;
      }
    }
  }

  onMount(() => {
    loadRecipients();

    // Fetch settings to determine if student messaging is enabled
    seqtaFetch('/seqta/student/load/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    }).then((res) => {
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      if (
        data?.payload?.['coneqt-s.messages.students.enabled']?.value === 'disabled'
      ) {
        studentsEnabled = false;
      } else {
        studentsEnabled = true;
      }
    }).catch(() => {
      studentsEnabled = true; // fallback to enabled if error
    });

    document.addEventListener('click', (e) => handleClickOutside(e, 'student'));
    document.addEventListener('click', (e) => handleClickOutside(e, 'staff'));

    return () => {
      document.removeEventListener('click', (e) => handleClickOutside(e, 'student'));
      document.removeEventListener('click', (e) => handleClickOutside(e, 'staff'));
    };
  });
</script>

<Modal
  bind:open={showComposeModal}
  onclose={closeModal}
  maxWidth="w-full sm:w-[80%]"
  maxHeight="h-full sm:h-[85vh]"
  customClasses="bg-white dark:bg-slate-900 rounded-none sm:rounded-xl max-w-none sm:max-w-6xl shadow-2xl flex flex-col border border-slate-300 dark:border-slate-800 overflow-y-auto h-full sm:h-auto p-0"
  showCloseButton={false}
  ariaLabel="Compose message">
  <!-- Header -->
  <div
    class="flex justify-between items-center p-4 bg-white sm:rounded-t-xl border-b border-slate-300 dark:border-slate-800 dark:bg-slate-900">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Compose message</h2>
    <button
      class="p-2 rounded-lg transition-all duration-200 text-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-white"
      onclick={closeModal}
      aria-label="Close">
      <Icon src={XMark} class="w-6 h-6" />
    </button>
  </div>

  <!-- Main content: two columns -->
  <div class="flex flex-col sm:flex-row overflow-hidden flex-1">
    <!-- Main (left) column -->
    <div class="flex flex-col flex-1 min-w-0">
      {#if errorMessage}
        <div class="p-3 m-4 text-white bg-red-500 rounded-lg">
          {errorMessage}
          <button
            class="float-right font-bold"
            onclick={() => (errorMessage = '')}
            aria-label="Dismiss error">×</button>
        </div>
      {/if}

      <!-- Subject -->
      <div class="p-4 bg-white border-b border-slate-300 dark:border-slate-800 dark:bg-slate-900">
        <label for="subject" class="block mb-1 text-sm">Subject</label>
        <input
          id="subject"
          type="text"
          placeholder="Subject..."
          bind:value={composeSubject}
          class="px-4 py-3 w-full rounded-lg border bg-slate-100/20 border-slate-300/50 dark:border-slate-700 placeholder-slate-500 text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <!-- Editor -->
      <div class="overflow-y-auto flex-1 p-4 bg-white dark:bg-slate-900">
        <Editor bind:content={composeBody} />
      </div>
    </div>

    <!-- Sidebar (right) column -->
    <div class="flex flex-col w-full sm:w-[320px] min-w-0 sm:min-w-[260px] sm:max-w-[360px] border-t sm:border-t-0 sm:border-l border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 gap-4">
      <!-- Student selector (conditionally rendered) -->
      {#if studentsEnabled}
        <div class="relative mb-2">
          <label for="student-search" class="block mb-1 text-sm">Select student</label>
          <input
            id="student-search"
            type="text"
            placeholder="Search students..."
            bind:value={studentSearchQuery}
            onfocus={() => (showStudentDropdown = true)}
            class="px-4 py-2 w-full bg-white rounded-lg placeholder-slate-500 text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {#if showStudentDropdown}
            <div
              id="student-dropdown"
              class="overflow-y-auto absolute z-10 mt-1 w-full max-h-60 bg-white rounded-lg border shadow-lg border-slate-300 dark:bg-slate-800 dark:border-slate-700">
              {#if loadingStudents}
                <div class="p-3 text-center text-slate-600 dark:text-slate-400">
                  Loading students...
                </div>
              {:else if filteredStudents.length === 0}
                <div class="p-3 text-center text-slate-600 dark:text-slate-400">
                  {studentSearchQuery ? 'No matching students' : 'Type to search students'}
                </div>
              {:else}
                {#each filteredStudents as student}
                  <button
                    class="flex justify-between items-center px-4 py-2 w-full text-left text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
                    onclick={() => addRecipient(student.id, student.xx_display, false)}>
                    <span>{student.xx_display}</span>
                    <span class="text-xs text-slate-600 dark:text-slate-400">
                      Year {student.year} · {student['sub-school']}
                    </span>
                  </button>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Staff selector -->
      <div class="relative mb-2">
        <label for="staff-search" class="block mb-1 text-sm">Select staff</label>
        <input
          id="staff-search"
          type="text"
          placeholder="Search staff..."
          bind:value={staffSearchQuery}
          onfocus={() => (showStaffDropdown = true)}
          class="px-4 py-2 w-full bg-white rounded-lg placeholder-slate-500 text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {#if showStaffDropdown}
          <div
            id="staff-dropdown"
            class="overflow-y-auto absolute z-10 mt-1 w-full max-h-60 bg-white rounded-lg border shadow-lg border-slate-300 dark:bg-slate-800 dark:border-slate-700">
            {#if loadingStaff}
              <div class="p-3 text-center text-slate-600 dark:text-slate-400">Loading staff...</div>
            {:else if filteredStaff.length === 0}
              <div class="p-3 text-center text-slate-600 dark:text-slate-400">
                {staffSearchQuery ? 'No matching staff' : 'Type to search staff'}
              </div>
            {:else}
              {#each filteredStaff as teacher}
                <button
                  class="px-4 py-2 w-full text-left text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
                  onclick={() => addRecipient(teacher.id, teacher.xx_display, true)}>
                  {teacher.xx_display}
                </button>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- BCC Option -->
      <div class="flex items-center mb-2">
        <label class="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            bind:checked={useBCC}
            class="text-blue-500 bg-white rounded border-slate-300 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700" />
          <span>Keep recipient list private (BCC)</span>
        </label>
      </div>

      <!-- Selected recipients -->
      <div>
        <div class="flex flex-wrap gap-2 p-3 rounded-lg bg-slate-100 min-h-12 dark:bg-slate-800">
          {#each selectedRecipients as recipient, i}
            <div
              class="flex gap-1 items-center px-2 py-1 text-sm rounded-md text-slate-900 bg-slate-200 dark:bg-slate-700 dark:text-white">
              <span>{recipient.name}</span>
              <span class="text-xs text-slate-600 dark:text-slate-400"
                >{recipient.staff ? '(Staff)' : '(Student)'}</span>
              <button
                onclick={() => removeRecipient(i)}
                class="ml-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Remove recipient">×</button>
            </div>
          {/each}

          {#if selectedRecipients.length === 0}
            <span class="px-2 py-1 text-sm text-slate-600 dark:text-slate-500"
              >No recipients selected</span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Footer with actions -->
  <div
    class="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 bg-white border-t border-slate-300 dark:border-slate-800 dark:bg-slate-900">
    <div>
      <button
        class="flex gap-2 items-center px-4 py-2 text-sm rounded-lg text-slate-900 bg-slate-200 dark:text-white dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700">
        <span>Add files</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          viewBox="0 0 20 20"
          fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
            clip-rule="evenodd" />
        </svg>
      </button>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
      <button
        class="w-full sm:w-auto mb-2 sm:mb-0 px-4 py-3 rounded-lg transition-colors text-slate-900 bg-slate-200 dark:text-white dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
        onclick={closeModal}>
        Cancel
      </button>
      <button
        class="w-full sm:w-auto px-6 py-3 text-white bg-blue-500 rounded-lg transition-all duration-200 hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!composeSubject.trim() ||
          !composeBody.trim() ||
          selectedRecipients.length === 0 ||
          isSubmitting}
        onclick={sendMessage}>
        {isSubmitting ? 'Sending...' : 'Send'}
      </button>
    </div>
  </div>
</Modal>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>
