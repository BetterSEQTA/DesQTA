<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { EditorCore } from './utils/editorCore';
  import EditorToolbar from './EditorToolbar.svelte';
  import EditorStatusBar from './EditorStatusBar.svelte';
  import ImageControlModal from './ImageControlModal.svelte';
  

  // Props
  export let content: string = '<p><br></p>';
  export let placeholder: string = 'Start writing your note...';
  export let readonly: boolean = false;
  export let autofocus: boolean = false;
  export let noteId: string | undefined = undefined; // Add noteId to track note changes

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    change: { content: string };
    save: { content: string };
    focus: void;
    blur: void;
  }>();

  // Editor elements
  let editorContainer: HTMLElement;
  let contentElement: HTMLElement;
  let editorCore: EditorCore;

  // Editor state
  let isFocused = false;
  let wordCount = 0;
  let characterCount = 0;
  let lastNoteId: string | undefined = undefined;
  
  // Image control modal state
  let showImageModal = false;
  let currentImageData: { element: HTMLElement; img: HTMLImageElement } | null = null;

  onMount(() => {
    // Initialize the editor core
    editorCore = new EditorCore(contentElement, {
      placeholder,
      readonly,
      onChange: handleContentChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onImageClick: showImageControlModal,
      noteId: noteId,
    });

    // Load initial content
    if (content && content.trim().length > 0) {
      editorCore.setContent(content);
      // Calculate word count from content
      const textContent = content.replace(/<[^>]*>/g, '').trim();
      wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
      characterCount = textContent.length;
      lastNoteId = noteId;
    }

    // Auto focus if requested
    if (autofocus && !readonly) {
      setTimeout(() => editorCore.focus(), 100);
    }

    return () => {
      editorCore?.destroy();
    };
  });

  // React to content changes from parent component (when switching notes)
  $: if (editorCore && content && noteId !== lastNoteId) {
    // Update editor content when switching to a different note
    editorCore.setContent(content);
    // Calculate word count from content
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    characterCount = textContent.length;
    lastNoteId = noteId;
  }

  function handleContentChange(newContent: string) {
    content = newContent;
    // Calculate word count from content
    const textContent = newContent.replace(/<[^>]*>/g, '').trim();
    wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    characterCount = textContent.length;
    dispatch('change', { content: newContent });
  }

  function handleFocus() {
    isFocused = true;
    dispatch('focus');
  }

  function handleBlur() {
    isFocused = false;
    dispatch('blur');
  }

  function handleSave() {
    dispatch('save', { content });
  }

  // Expose methods for parent components
  export function focus() {
    editorCore?.focus();
  }

  export function blur() {
    editorCore?.blur();
  }

  export function getContent(): string {
    return editorCore?.getContent() || content;
  }

  export function setContent(newContent: string) {
    editorCore?.setContent(newContent);
  }

  export function insertText(text: string) {
    editorCore?.insertText(text);
  }

  export function executeCommand(command: string, value?: any) {
    editorCore?.executeCommand(command, value);
  }

  // Image modal handlers
  function showImageControlModal(element: HTMLElement, img: HTMLImageElement) {
    currentImageData = { element, img };
    showImageModal = true;
  }

  function handleCopyAlt() {
    if (currentImageData?.img) {
      navigator.clipboard.writeText(currentImageData.img.alt || 'Image');
    }
  }

  function handleRemoveImage() {
    if (currentImageData?.element) {
      currentImageData.element.parentNode?.removeChild(currentImageData.element);
      editorCore?.triggerChange();
    }
    currentImageData = null;
  }

  function handleReplaceImage() {
    if (currentImageData?.element && editorCore) {
      // Trigger new image selection
      editorCore.insertImage();
      // Remove old image after new one is selected
      setTimeout(() => {
        if (currentImageData?.element?.parentNode) {
          currentImageData.element.parentNode.removeChild(currentImageData.element);
          editorCore?.triggerChange();
        }
      }, 100);
    }
    currentImageData = null;
  }

  function closeImageModal() {
    showImageModal = false;
    currentImageData = null;
  }
</script>

<div 
  class="notes-editor h-full flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-md transition-all duration-200 {isFocused ? 'accent-ring' : ''}"
  bind:this={editorContainer}
>
  <!-- Editor Toolbar -->
  <div class="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
    <EditorToolbar 
      bind:editor={editorCore}
      {readonly}
      on:save={handleSave}
    />
  </div>

  <!-- Main Editor Content -->
  <div class="flex-1 relative min-h-0">
    <div
      class="editor-content h-full p-4 prose prose-slate dark:prose-invert max-w-none focus:outline-none overflow-y-auto"
      contenteditable={!readonly}
      bind:this={contentElement}
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline="true"
      aria-label="Rich text editor"
      tabindex={readonly ? -1 : 0}
    ></div>
  </div>

  <!-- Editor Status Bar -->
  <div class="flex-shrink-0 border-t border-slate-200 dark:border-slate-700">
    <EditorStatusBar 
      {wordCount}
      {characterCount}
      {isFocused}
    />
  </div>
</div>

<!-- Image Control Modal -->
<ImageControlModal
  bind:isOpen={showImageModal}
  imageAlt={currentImageData?.img?.alt || ''}
  imageSrc={currentImageData?.img?.src || ''}
  on:copyAlt={handleCopyAlt}
  on:removeImage={handleRemoveImage}
  on:replaceImage={handleReplaceImage}
  on:close={closeImageModal}
/>

<style>
  .notes-editor {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .editor-content {
    line-height: 1.6;
    color: inherit;
  }

  .editor-content:empty::before {
    content: attr(data-placeholder);
    color: rgb(148 163 184); /* slate-400 */
    font-style: italic;
    pointer-events: none;
  }

  .editor-content:focus::before {
    display: none;
  }

  /* Custom prose styling for dark mode - using :global() to match Tailwind's dark: classes */
  :global(.dark) .editor-content {
    color: rgb(241 245 249); /* slate-100 */
  }

  :global(.dark) .editor-content :global(strong) {
    color: rgb(241 245 249);
  }

  :global(.dark) .editor-content :global(em) {
    color: rgb(241 245 249);
  }

  :global(.dark) .editor-content :global(h1),
  :global(.dark) .editor-content :global(h2),
  :global(.dark) .editor-content :global(h3),
  :global(.dark) .editor-content :global(h4),
  :global(.dark) .editor-content :global(h5),
  :global(.dark) .editor-content :global(h6) {
    color: rgb(241 245 249);
  }

  /* Focus ring using accent color */
  .notes-editor.accent-ring {
    box-shadow: 0 0 0 2px var(--accent-color-value);
  }

  /* Ensure proper spacing and styling for dynamic content */
  .editor-content :global(p) {
    margin: 0.75rem 0;
  }

  .editor-content :global(p:first-child) {
    margin-top: 0;
  }

  .editor-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .editor-content :global(h1),
  .editor-content :global(h2),
  .editor-content :global(h3),
  .editor-content :global(h4),
  .editor-content :global(h5),
  .editor-content :global(h6) {
    margin: 1.5rem 0 0.75rem 0;
    font-weight: 600;
  }

  .editor-content :global(h1:first-child),
  .editor-content :global(h2:first-child),
  .editor-content :global(h3:first-child),
  .editor-content :global(h4:first-child),
  .editor-content :global(h5:first-child),
  .editor-content :global(h6:first-child) {
    margin-top: 0;
  }

  /* Resizable image styles */
  .editor-content :global(.editor-image-container) {
    user-select: none;
  }

  .editor-content :global(.resizable-image-wrapper) {
    transition: all 0.2s ease;
  }

  .editor-content :global(.resizable-image-wrapper:hover) {
    transform: scale(1.01);
  }

  .editor-content :global(.resize-handle) {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.9));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .editor-content :global(.resize-handle:hover) {
    background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(37, 99, 235, 1));
    transform: scale(1.1);
  }

  .editor-content :global(.resize-handle:active) {
    background: linear-gradient(135deg, rgba(37, 99, 235, 1), rgba(29, 78, 216, 1));
    transform: scale(0.95);
  }

  /* Enhanced formatting styles */
  .editor-content :global(span[style*="font-size"]) {
    /* Custom font size styling */
    display: inline;
  }

  /* Format markers - invisible but functional */
  .editor-content :global(.format-end-marker) {
    display: inline;
    font-size: 0;
    line-height: 0;
    color: transparent;
    user-select: none;
    pointer-events: none;
  }
</style> 