<script lang="ts">
  import { Icon } from 'svelte-hero-icons';
  import { Plus, ExclamationTriangle, XMark } from 'svelte-hero-icons';
  import { open } from '@tauri-apps/plugin-dialog';
  import { uploadSeqtaFile, seqtaFetch } from '../../utils/netUtil';

  interface Props {
    assessmentId: number;
    metaclassId: number;
    onUploadComplete?: () => void;
  }

  let { assessmentId, metaclassId, onUploadComplete }: Props = $props();

  let uploading = $state(false);
  let uploadError = $state('');
  let uploadSuccess = $state(false);

  function clearError() {
    uploadError = '';
  }

  function clearSuccess() {
    uploadSuccess = false;
  }

  async function handleFileUpload() {
    uploading = true;
    uploadError = '';
    uploadSuccess = false;

    try {
      // Open file dialog to select files
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'All Files',
          extensions: ['*']
        }]
      });

      if (!selected) {
        uploading = false;
        return;
      }

      const files = Array.isArray(selected) ? selected : [selected];

      for (const filePath of files) {
        // Extract filename from path
        const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
        
        // First, upload the file
        const uploadResponse = await uploadSeqtaFile(fileName, filePath);
        const uploadResult = JSON.parse(uploadResponse);
        
        if (uploadResult.status === '200' && uploadResult.payload) {
          // Then link the file to the assessment
          const linkResponse = await seqtaFetch('/seqta/student/assessment/submissions/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {
              action: 'link',
              assID: assessmentId,
              metaclass: metaclassId,
              files: [uploadResult.payload.id]
            },
          });
          
          const linkResult = JSON.parse(linkResponse);
          if (linkResult.status === '200') {
            // Call the callback to reload submissions
            if (onUploadComplete) {
              onUploadComplete();
            }
            uploadSuccess = true;
          } else {
            throw new Error('Failed to link file to assessment');
          }
        } else {
          throw new Error('Failed to upload file');
        }
      }
    } catch (e) {
      console.error('File upload error:', e);
      uploadError = e instanceof Error ? e.message : 'Upload failed';
    } finally {
      uploading = false;
    }
  }
</script>

<div>
  <button
    type="button"
    class="flex gap-2 items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 text-white bg-accent-bg hover:bg-accent-ring disabled:opacity-50 disabled:cursor-not-allowed"
    onclick={handleFileUpload}
    disabled={uploading}>
    {#if uploading}
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      Uploading...
    {:else}
      <Icon src={Plus} class="w-4 h-4" />
      Upload Files
    {/if}
  </button>
  
  {#if uploadError}
    <div class="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <Icon src={ExclamationTriangle} class="w-5 h-5 text-red-500 dark:text-red-400" />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
            Upload Failed
          </h3>
          <p class="text-sm text-red-700 dark:text-red-400 leading-relaxed">
            {uploadError}
          </p>
          {#if uploadError.includes('exceeds the limit')}
            <div class="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-600">
              <p class="text-xs text-red-600 dark:text-red-300">
                <strong>Tip:</strong> Try compressing your file or splitting it into smaller parts before uploading.
              </p>
            </div>
          {/if}
        </div>
        <button
          type="button"
          class="flex-shrink-0 p-1 rounded-md text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors duration-200"
          onclick={clearError}
          aria-label="Dismiss error">
          <Icon src={XMark} class="w-4 h-4" />
        </button>
      </div>
    </div>
  {/if}

  {#if uploadSuccess}
    <div class="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <div class="w-5 h-5 rounded-full bg-green-500 dark:bg-green-400 flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
            Upload Successful
          </h3>
          <p class="text-sm text-green-700 dark:text-green-400 leading-relaxed">
            Your files have been uploaded and linked to the assessment successfully.
          </p>
        </div>
        <button
          type="button"
          class="flex-shrink-0 p-1 rounded-md text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors duration-200"
          onclick={clearSuccess}
          aria-label="Dismiss success message">
          <Icon src={XMark} class="w-4 h-4" />
        </button>
      </div>
    </div>
  {/if}
</div> 