<script lang="ts">
  import Modal from './Modal.svelte';
  import { Icon, ArrowDownTray, XMark } from 'svelte-hero-icons';
  import { saveAs } from 'file-saver';

  const {
    showPdfViewer,
    pdfUrl,
    pdfLoading,
    onClose
  } = $props<{
    showPdfViewer: boolean;
    pdfUrl: string | null;
    pdfLoading: boolean;
    onClose: () => void;
  }>();

  let showPdfViewerState = $state(showPdfViewer);

  $effect(() => {
    showPdfViewerState = showPdfViewer;
  });

  $effect(() => {
    if (!showPdfViewerState) {
      onClose();
    }
  });
</script>

<Modal
  bind:open={showPdfViewerState}
  onclose={onClose}
  maxWidth="max-w-4xl"
  customClasses="min-h-[80vh]"
  title="Timetable PDF"
  ariaLabel="Timetable PDF Viewer"
  showCloseButton={false}
>
  <div class="absolute top-6 right-6 z-10 flex gap-2 pointer-events-none">
    <button
      class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 pointer-events-auto bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-md hover:shadow-lg"
      onclick={() => {
        if (pdfUrl) {
          saveAs(pdfUrl, 'timetable.pdf');
        }
      }}
      aria-label="Download PDF">
      <Icon src={ArrowDownTray} class="w-5 h-5 text-slate-700 dark:text-slate-300" />
    </button>
    <button
      class="flex justify-center items-center w-10 h-10 rounded-xl transition-all duration-200 pointer-events-auto bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 shadow-md hover:shadow-lg"
      onclick={onClose}
      aria-label="Close PDF viewer">
      <Icon src={XMark} class="w-5 h-5 text-red-600 dark:text-red-300" />
    </button>
  </div>

  <div class="overflow-hidden h-full rounded-xl bg-white dark:bg-slate-900 shadow-inner p-2">
    {#if pdfLoading}
      <div class="flex justify-center items-center h-full min-h-[60vh]">
        <div
          class="w-20 h-20 rounded-full border-4 animate-spin border-blue-500/30 border-t-blue-500">
        </div>
      </div>
    {:else if pdfUrl}
      <iframe src={pdfUrl} class="w-full min-h-[70vh] rounded-lg border border-slate-200 dark:border-slate-700 shadow" title="Timetable PDF"></iframe>
    {/if}
  </div>
</Modal> 