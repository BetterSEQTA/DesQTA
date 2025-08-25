<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { Icon, DocumentDuplicate, Trash, ArrowPath, XMark } from 'svelte-hero-icons';

  // Events
  const dispatch = createEventDispatcher<{
    copyAlt: void;
    removeImage: void;
    replaceImage: void;
    close: void;
  }>();

  // Props
  export let isOpen = false;
  export let imageAlt = '';
  export let imageSrc = '';

  function handleCopyAlt() {
    dispatch('copyAlt');
    dispatch('close');
  }

  function handleRemoveImage() {
    dispatch('removeImage');
    dispatch('close');
  }

  function handleReplaceImage() {
    dispatch('replaceImage');
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    transition:fly={{ y: -50, duration: 200 }}
    onclick={() => dispatch('close')}
    onkeydown={(e) => e.key === 'Escape' && dispatch('close')}
    role="dialog"
    aria-modal="true"
    aria-labelledby="image-modal-title"
    tabindex="0"
  >
    <div
      class="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      transition:scale={{ duration: 200, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 id="image-modal-title" class="text-lg font-semibold text-slate-900 dark:text-white">
          Image Options
        </h2>
        <button
          class="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200"
          onclick={() => dispatch('close')}
          title="Close"
        >
          <Icon src={XMark} class="w-5 h-5" />
        </button>
      </div>

      <!-- Image Preview -->
      <div class="p-6 border-b border-slate-200 dark:border-slate-700">
        <div class="flex items-center space-x-4">
          <div class="flex-shrink-0">
            <img
              src={imageSrc}
              alt={imageAlt}
              class="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
              {imageAlt || 'Image'}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Click an action below to manage this image
            </p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="p-6 space-y-2">
        <!-- Copy Alt Text -->
        <button
          class="w-full flex items-center px-4 py-3 text-left rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-[1.01] focus:outline-none focus:ring-2 accent-ring"
          onclick={handleCopyAlt}
        >
          <Icon src={DocumentDuplicate} class="w-5 h-5 mr-3 text-slate-400" />
          <div>
            <div class="font-medium">Copy Alt Text</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Copy "{imageAlt || 'Image'}" to clipboard
            </div>
          </div>
        </button>

        <!-- Replace Image -->
        <button
          class="w-full flex items-center px-4 py-3 text-left rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 hover:scale-[1.01] focus:outline-none focus:ring-2 accent-ring"
          onclick={handleReplaceImage}
        >
          <Icon src={ArrowPath} class="w-5 h-5 mr-3 text-slate-400" />
          <div>
            <div class="font-medium">Replace Image</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Choose a different image file
            </div>
          </div>
        </button>

        <!-- Remove Image -->
        <button
          class="w-full flex items-center px-4 py-3 text-left rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-red-500"
          onclick={handleRemoveImage}
        >
          <Icon src={Trash} class="w-5 h-5 mr-3" />
          <div>
            <div class="font-medium">Remove Image</div>
            <div class="text-xs text-red-500 dark:text-red-400">
              Permanently delete this image
            </div>
          </div>
        </button>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div class="flex justify-end">
          <button
            class="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all duration-200"
            onclick={() => dispatch('close')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
{/if} 