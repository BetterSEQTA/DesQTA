import type { 
  EditorOptions, 
  EditorSelection,
  EditorRange,
  FormatType,
  BlockType 
} from '../types/editor';
import { SeqtaMentionsService, type SeqtaMentionItem } from '../../../services/seqtaMentionsService';

export class EditorCore {
  private element: HTMLElement;
  private options: EditorOptions;
  private isInitialized = false;
  private currentSelection: EditorSelection | null = null;
  private history: string[] = [];
  private historyIndex = -1;
  private maxHistorySize = 100;

  constructor(element: HTMLElement, options: EditorOptions = {}) {
    this.element = element;
    this.options = {
      placeholder: 'Start writing...',
      readonly: false,
      ...options
    };

    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;

    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize with empty content if no content exists
    if (this.element.innerHTML.trim() === '') {
      this.element.innerHTML = '<p><br></p>';
    }

    // Save initial state to history
    this.saveToHistory();

    this.isInitialized = true;
  }

  private setupEventListeners() {
    // Input events
    this.element.addEventListener('input', this.handleInput.bind(this));
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.element.addEventListener('keyup', this.handleKeyUp.bind(this));
    this.element.addEventListener('paste', this.handlePaste.bind(this));

    // Focus events
    this.element.addEventListener('focus', this.handleFocus.bind(this));
    this.element.addEventListener('blur', this.handleBlur.bind(this));

    // Selection events
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
  }

  private handleInput(event: Event) {
    // Prevent default behavior for readonly mode
    if (this.options.readonly) {
      event.preventDefault();
      return;
    }

    // Ensure we always have at least one paragraph
    if (this.element.innerHTML.trim() === '' || this.element.innerHTML === '<br>') {
      this.element.innerHTML = '<p><br></p>';
      this.setCursorToStart();
    }

    // Trigger change event
    this.triggerChange();
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (this.options.readonly) {
      event.preventDefault();
      return;
    }

    // Check if we're in a code block
    const selection = window.getSelection();
    const isInCodeBlock = selection && selection.rangeCount > 0 && 
      this.getCurrentBlockType() === 'code-block';

    // Handle Enter key
    if (event.key === 'Enter') {
      // If a stale mention key handler is attached without an open dropdown, detach it
      if (!this.currentMentionDropdown && this.currentMentionKeyHandler) {
        document.removeEventListener('keydown', this.currentMentionKeyHandler);
        this.currentMentionKeyHandler = null;
      }

      if (event.shiftKey || isInCodeBlock) {
        // Shift+Enter or code block: Insert line break
        this.insertLineBreak();
        event.preventDefault();
      } else {
        // Enter: Create new paragraph
        this.handleEnterKey(event);
      }
    }

    // Handle Tab key in code blocks
    if (event.key === 'Tab' && isInCodeBlock) {
      event.preventDefault();
      this.insertText('  '); // Insert 2 spaces for indentation
      return;
    }

    // Handle Tab key in tables
    if (event.key === 'Tab' && this.isInTable()) {
      event.preventDefault();
      this.navigateTable(event.shiftKey ? 'previous' : 'next');
      return;
    }

    // Handle Backspace
    if (event.key === 'Backspace' || event.key === 'Delete') {
      this.handleBackspaceKey(event);
      // Also check for mention search after deletion
      if (!isInCodeBlock) {
        setTimeout(() => {
          this.checkForMentionSearch();
        }, 0);
      }
    }

    // Handle @ key for mentions
    if (event.key === '@' && !isInCodeBlock) {
      // Let the character be inserted first, then handle mention
      setTimeout(() => {
        this.handleMentionTrigger();
      }, 0);
    }
    
    // Handle typing after @ for real-time search
    if (!isInCodeBlock && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Check if we're typing after an @ symbol
      setTimeout(() => {
        this.checkForMentionSearch();
      }, 0);
    }

    // Handle keyboard shortcuts (disabled in code blocks for some)
    if (event.ctrlKey || event.metaKey) {
      // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z in code blocks
      if (isInCodeBlock && !['a', 'c', 'v', 'z'].includes(event.key.toLowerCase())) {
        return; // Don't handle other shortcuts in code blocks
      }
      this.handleShortcut(event);
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    // Update selection after key operations
    this.updateCurrentSelection();
  }

  private handlePaste(event: ClipboardEvent) {
    if (this.options.readonly) {
      event.preventDefault();
      return;
    }

    // Get plain text from clipboard
    const text = event.clipboardData?.getData('text/plain');
    if (text) {
      // Prevent default paste behavior
      event.preventDefault();
      
      // Insert plain text
      this.insertText(text);
    }
  }

  private handleFocus() {
    if (this.options.onFocus) {
      this.options.onFocus();
    }
  }

  private handleBlur() {
    if (this.options.onBlur) {
      this.options.onBlur();
    }
    // Clean up mention dropdown when editor loses focus
    setTimeout(() => {
      this.removeMentionDropdown();
    }, 200); // Small delay to allow for mention selection
  }

  private handleSelectionChange() {
    // Only handle if this editor is focused
    if (document.activeElement === this.element) {
      this.updateCurrentSelection();
      
      if (this.options.onSelectionChange && this.currentSelection) {
        this.options.onSelectionChange(this.currentSelection);
      }
    }
  }

  private handleEnterKey(event: KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Clone range to avoid mutations causing stale containers
    let range = selection.getRangeAt(0).cloneRange();

    // If startContainer is a text node without a parent (detached), move caret to a safe place
    if (range.startContainer.nodeType === Node.TEXT_NODE && !range.startContainer.parentNode) {
      this.element.focus();
      range = document.createRange();
      if (this.element.lastChild) {
        range.setStartAfter(this.element.lastChild);
      } else {
        range.setStart(this.element, 0);
      }
      range.collapse(true);
    }

    const currentElement = this.getBlockElement(range.startContainer);

    if (!currentElement) return;

    // Check if we're in a list item
    if (currentElement.tagName === 'LI') {
      event.preventDefault();
      this.handleListEnter(currentElement, range);
      return;
    }

    // If we're in a heading, create a new paragraph
    if (this.isHeading(currentElement)) {
      event.preventDefault();
      this.insertParagraphAfter(currentElement);
    }
    // Otherwise, let the browser handle it naturally
  }

  private handleListEnter(listItem: HTMLElement, range: Range) {
    // If the list item is empty, exit the list
    if (!listItem.textContent?.trim()) {
      const list = listItem.parentElement;
      if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
        // Remove empty list item
        list.removeChild(listItem);
        
        // Create a new paragraph after the list
        const paragraph = document.createElement('p');
        paragraph.innerHTML = '<br>';
        list.parentNode?.insertBefore(paragraph, list.nextSibling);
        
        // Move cursor to new paragraph
        this.restoreSelectionInElement(paragraph);
      }
    } else {
      // Create a new list item
      const newListItem = document.createElement('li');
      newListItem.innerHTML = '<br>';
      
      // Insert after current list item
      listItem.parentNode?.insertBefore(newListItem, listItem.nextSibling);
      
      // Move cursor to new list item
      this.restoreSelectionInElement(newListItem);
    }
  }

  private handleBackspaceKey(event: KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // If we're at the start of a block element and it's empty, convert to paragraph
    if (range.collapsed && range.startOffset === 0) {
      const currentElement = this.getBlockElement(range.startContainer);
      if (currentElement && this.isHeading(currentElement) && currentElement.textContent?.trim() === '') {
        event.preventDefault();
        this.convertToParagraph(currentElement);
      }
    }
  }

  private handleShortcut(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    
    switch (key) {
      case 'b':
        event.preventDefault();
        this.toggleFormat('bold');
        break;
      case 'i':
        event.preventDefault();
        this.toggleFormat('italic');
        break;
      case 'u':
        event.preventDefault();
        this.toggleFormat('underline');
        break;
      case 'z':
        if (event.shiftKey) {
          event.preventDefault();
          this.redo();
        } else {
          event.preventDefault();
          this.undo();
        }
        break;
      case 'a':
        event.preventDefault();
        this.selectAll();
        break;
    }
  }

  // Public methods
  public focus() {
    this.element.focus();
  }

  public blur() {
    this.element.blur();
  }

  public getContent(): string {
    // Clone content to avoid mutating the live editor DOM
    const clone = this.element.cloneNode(true) as HTMLElement;
    // Convert visual mentions to structured text embeds in the clone
    this.convertVisualMentionsToText(clone);
    // Convert HTML formatting to custom tags for saving (non-mention formatting)
    return this.convertHTMLToCustomTags(clone.innerHTML);
  }

  public setContent(content: string) {
    // Convert custom tags to HTML and set content
    const html = this.convertCustomTagsToHTML(content);
    this.element.innerHTML = html;
    this.reinitializeMentions();
    this.makeExistingImagesResizable();
    this.triggerChange();
  }

  public insertText(text: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Delete existing selection if any
    if (!range.collapsed) {
      range.deleteContents();
    }
    
    // Handle multi-line text insertion
    const lines = text.split('\n');
    
    if (lines.length === 1) {
      // Single line - simple text insertion
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
    } else {
      // Multi-line - create paragraphs for each line
      const currentBlock = this.getBlockElement(range.startContainer);
      
      for (let i = 0; i < lines.length; i++) {
        if (i === 0) {
          // First line goes in current position
          if (lines[i]) {
            const textNode = document.createTextNode(lines[i]);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
          }
        } else {
          // Subsequent lines create new paragraphs
          const newParagraph = document.createElement('p');
          newParagraph.textContent = lines[i] || '';
          if (!lines[i]) {
            newParagraph.innerHTML = '<br>';
          }
          
          // Insert after current block
          const insertPoint = currentBlock?.parentNode;
          if (insertPoint) {
            insertPoint.insertBefore(newParagraph, currentBlock.nextSibling);
            
            // Move cursor to end of new paragraph
            const newRange = document.createRange();
            newRange.setStart(newParagraph, newParagraph.childNodes.length);
            newRange.setEnd(newParagraph, newParagraph.childNodes.length);
            range.setStart(newRange.startContainer, newRange.startOffset);
            range.setEnd(newRange.endContainer, newRange.endOffset);
          }
        }
      }
    }
    
    // Update selection
    selection.removeAllRanges();
    selection.addRange(range);
    
    this.triggerChange();
  }

  public executeCommand(command: string, value?: any): boolean {
    switch (command) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
      case 'code':
        return this.toggleFormat(command as FormatType);
      case 'heading-1':
      case 'heading-2':
      case 'heading-3':
      case 'heading-4':
      case 'heading-5':
      case 'heading-6':
        return this.setBlockType(command as BlockType);
      case 'paragraph':
        return this.setBlockType('paragraph');
      case 'blockquote':
        return this.setBlockType('blockquote');
      case 'code-block':
        return this.setBlockType('code-block');
      case 'bullet-list':
        return this.toggleList('ul');
      case 'numbered-list':
        return this.toggleList('ol');
      case 'insert-table':
        return this.insertTable(2, 2); // Default 2x2 table
      case 'insert-image':
        return this.insertImage();
      case 'insert-link':
        return this.insertLink();
      case 'font-size':
        return this.setFontSize(value);
      default:
        return false;
    }
  }

  public toggleFormat(format: FormatType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    // Use document.execCommand for reliable formatting
    const commandMap: { [key in FormatType]?: string } = {
      'bold': 'bold',
      'italic': 'italic', 
      'underline': 'underline',
      'strikethrough': 'strikeThrough'
    };

    const command = commandMap[format];
    if (command) {
      // Use browser's built-in formatting
      document.execCommand(command, false);
    } else if (format === 'code') {
      // Handle code formatting manually since there's no execCommand for it
      this.toggleCodeFormat();
    }

    this.triggerChange();
    return true;
  }

  public setBlockType(blockType: BlockType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return false;

    let newElement: HTMLElement;

    switch (blockType) {
      case 'paragraph':
        newElement = document.createElement('p');
        break;
      case 'heading-1':
        newElement = document.createElement('h1');
        break;
      case 'heading-2':
        newElement = document.createElement('h2');
        break;
      case 'heading-3':
        newElement = document.createElement('h3');
        break;
      case 'heading-4':
        newElement = document.createElement('h4');
        break;
      case 'heading-5':
        newElement = document.createElement('h5');
        break;
      case 'heading-6':
        newElement = document.createElement('h6');
        break;
      case 'blockquote':
        newElement = document.createElement('blockquote');
        break;
      case 'code-block':
        newElement = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.innerHTML = currentElement.innerHTML;
        newElement.appendChild(codeElement);
        break;
      default:
        return false;
    }

    // Copy content and replace element
    if (blockType === 'code-block') {
      // Code blocks already have their content set above
      currentElement.parentNode?.replaceChild(newElement, currentElement);
      // Restore selection in the code element
      const codeElement = newElement.querySelector('code');
      if (codeElement) {
        this.restoreSelectionInElement(codeElement);
      }
    } else {
      newElement.innerHTML = currentElement.innerHTML;
      currentElement.parentNode?.replaceChild(newElement, currentElement);
      // Restore selection
      this.restoreSelectionInElement(newElement);
    }
    
    this.triggerChange();
    return true;
  }

  public toggleList(listType: 'ul' | 'ol'): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return false;

    // Check if we're already in a list
    const existingList = this.findParentList(currentElement);
    
    if (existingList) {
      // If we're in a list, convert back to paragraphs
      this.convertListToParagraphs(existingList);
    } else {
      // Convert current paragraph(s) to list
      this.convertToList(currentElement, listType);
    }
    
    this.triggerChange();
    return true;
  }

  private findParentList(element: HTMLElement): HTMLElement | null {
    let current = element;
    
    while (current && current !== this.element) {
      if (current.tagName === 'UL' || current.tagName === 'OL') {
        return current;
      }
      if (current.tagName === 'LI' && current.parentElement) {
        const parent = current.parentElement;
        if (parent.tagName === 'UL' || parent.tagName === 'OL') {
          return parent;
        }
      }
      const parentElement = current.parentElement;
      if (!parentElement) break;
      current = parentElement;
    }
    
    return null;
  }

  private convertListToParagraphs(listElement: HTMLElement) {
    const listItems = Array.from(listElement.querySelectorAll('li'));
    
    listItems.forEach(li => {
      const paragraph = document.createElement('p');
      paragraph.innerHTML = li.innerHTML || '<br>';
      listElement.parentNode?.insertBefore(paragraph, listElement);
    });
    
    // Remove the list
    listElement.parentNode?.removeChild(listElement);
  }

  private convertToList(element: HTMLElement, listType: 'ul' | 'ol') {
    const list = document.createElement(listType);
    const listItem = document.createElement('li');
    
    // Move content to list item
    listItem.innerHTML = element.innerHTML || '<br>';
    list.appendChild(listItem);
    
    // Replace element with list
    element.parentNode?.replaceChild(list, element);
    
    // Restore selection in list item
    this.restoreSelectionInElement(listItem);
  }

  public insertTable(rows: number, cols: number): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return false;

    // Create table structure
    const table = document.createElement('table');
    table.className = 'editor-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = '1px solid #e2e8f0';
    table.style.marginTop = '1rem';
    table.style.marginBottom = '1rem';

    const tbody = document.createElement('tbody');
    
    for (let i = 0; i < rows; i++) {
      const row = document.createElement('tr');
      
      for (let j = 0; j < cols; j++) {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        cell.style.border = '1px solid #e2e8f0';
        cell.style.padding = '0.5rem';
        cell.style.textAlign = 'left';
        cell.contentEditable = 'true';
        cell.innerHTML = i === 0 ? `Header ${j + 1}` : '<br>';
        
        row.appendChild(cell);
      }
      
      tbody.appendChild(row);
    }
    
    table.appendChild(tbody);

    // Insert table after current element
    currentElement.parentNode?.insertBefore(table, currentElement.nextSibling);

    // Create a new paragraph after the table
    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    table.parentNode?.insertBefore(paragraph, table.nextSibling);

    // Focus the first cell
    const firstCell = table.querySelector('th, td');
    if (firstCell) {
      this.restoreSelectionInElement(firstCell as HTMLElement);
    }

    this.triggerChange();
    return true;
  }

  private isInTable(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    while (node && node !== this.element) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'TD' || element.tagName === 'TH') {
          return true;
        }
      }
      const parentNode = node.parentNode;
      if (!parentNode) break;
      node = parentNode;
    }

    return false;
  }

  private navigateTable(direction: 'next' | 'previous') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let currentCell = range.startContainer;

    // Find the current table cell
    while (currentCell && currentCell !== this.element) {
      if (currentCell.nodeType === Node.ELEMENT_NODE) {
        const element = currentCell as HTMLElement;
        if (element.tagName === 'TD' || element.tagName === 'TH') {
          break;
        }
      }
      const parentNode = currentCell.parentNode;
      if (!parentNode) return;
      currentCell = parentNode;
    }

    if (!currentCell || currentCell === this.element) return;

    const cell = currentCell as HTMLElement;
    const table = cell.closest('table');
    if (!table) return;

    // Get all cells in the table
    const cells = Array.from(table.querySelectorAll('td, th'));
    const currentIndex = cells.indexOf(cell);

    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex + 1;
      if (nextIndex >= cells.length) {
        // Add new row if we're at the end
        this.addTableRow(table);
        nextIndex = currentIndex + 1;
      }
    } else {
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = 0;
      }
    }

    const nextCell = cells[nextIndex] as HTMLElement;
    if (nextCell) {
      this.restoreSelectionInElement(nextCell);
    }
  }

  private addTableRow(table: HTMLElement) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const lastRow = tbody.querySelector('tr:last-child');
    if (!lastRow) return;

    const newRow = document.createElement('tr');
    const cellCount = lastRow.children.length;

    for (let i = 0; i < cellCount; i++) {
      const cell = document.createElement('td');
      cell.style.border = '1px solid #e2e8f0';
      cell.style.padding = '0.5rem';
      cell.style.textAlign = 'left';
      cell.contentEditable = 'true';
      cell.innerHTML = '<br>';
      newRow.appendChild(cell);
    }

    tbody.appendChild(newRow);
  }

  public insertImage(): boolean {
    // Create a file input to select image
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleImageFile(file);
      }
      // Clean up
      document.body.removeChild(input);
    };
    
    // Trigger file selection
    document.body.appendChild(input);
    input.click();
    
    return true;
  }

  private async handleImageFile(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.showNotification('Selected file is not an image', 'error');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      this.showNotification('Image file is too large (max 5MB)', 'error');
      return;
    }

    try {
      // Show loading state
      this.showNotification('Saving image...', 'info');
      
      // Create FileReader to convert to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          try {
            // Get current note ID from options or generate one
            const noteId = this.getCurrentNoteId();
            if (!noteId) {
              this.showNotification('Unable to determine note ID for image storage', 'error');
              return;
            }
            
            // Save image to filesystem and get relative path
            const { invoke } = await import('@tauri-apps/api/core');
            const relativePath = await invoke<string>('save_image_from_base64', {
              noteId,
              imageData: dataUrl,
              filename: file.name
            });
            
            // Insert image element with file path instead of base64
            this.insertImageElement(relativePath, file.name, true);
            this.showNotification('Image saved successfully', 'success');
            
          } catch (error) {
            console.error('Failed to save image:', error);
            this.showNotification('Failed to save image', 'error');
            // Fallback to base64 storage
            this.insertImageElement(dataUrl, file.name, false);
          }
        }
      };
      reader.onerror = () => {
        this.showNotification('Error reading image file', 'error');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Error processing image file:', error);
      this.showNotification('Error processing image file', 'error');
    }
  }

  private insertImageElement(src: string, alt: string = '', isFilePath: boolean = false) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return;

    // Create image container with resizable wrapper
    const imageContainer = document.createElement('div');
    imageContainer.className = 'editor-image-container';
    imageContainer.style.margin = '1rem 0';
    imageContainer.style.textAlign = 'center';
    imageContainer.style.position = 'relative';
    imageContainer.style.display = 'inline-block';
    imageContainer.style.maxWidth = '100%';
    
    // Create resizable wrapper
    const resizableWrapper = document.createElement('div');
    resizableWrapper.className = 'resizable-image-wrapper';
    resizableWrapper.style.position = 'relative';
    resizableWrapper.style.display = 'inline-block';
    resizableWrapper.style.width = 'auto';
    resizableWrapper.style.minWidth = '100px';
    resizableWrapper.style.maxWidth = '100%';
    resizableWrapper.style.boxSizing = 'border-box';
    resizableWrapper.style.overflow = 'hidden';
    
    // Create image element
    const img = document.createElement('img');
    
    // Handle file path vs base64 data
    if (isFilePath) {
      // Store relative path in data attribute and show loading placeholder
      img.dataset.imagePath = src;
      // Show loading placeholder immediately
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjUwIiByPSIxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOUNBM0FGIiBzdHJva2Utd2lkdGg9IjIiPjxhbmltYXRlVHJhbnNmb3JtIGF0dHJpYnV0ZU5hbWU9InRyYW5zZm9ybSIgdHlwZT0icm90YXRlIiB2YWx1ZXM9IjAgMTAwIDUwOzM2MCAxMDAgNTAiIGR1cj0iMXMiIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIi8+PC9jaXJjbGU+PHRleHQgeD0iMTAwIiB5PSI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzZCNzI4MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIj5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
      // Load actual image asynchronously
      this.loadImageFromPath(img, src);
    } else {
      img.src = src;
    }
    
    img.alt = alt;
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '0.5rem';
    img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    img.style.cursor = 'pointer';
    img.style.display = 'block';
    img.style.transition = 'box-shadow 0.2s ease';
    
    // Add click handler for image actions
    img.onclick = (e) => {
      e.stopPropagation();
      this.handleImageClick(imageContainer, img);
    };

    // Create resize handles
    this.createResizeHandles(resizableWrapper, img);

    resizableWrapper.appendChild(img);
    imageContainer.appendChild(resizableWrapper);

    // Insert after current element
    currentElement.parentNode?.insertBefore(imageContainer, currentElement.nextSibling);

    // Create a new paragraph after the image
    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    imageContainer.parentNode?.insertBefore(paragraph, imageContainer.nextSibling);

    // Focus the new paragraph
    this.restoreSelectionInElement(paragraph);

    this.triggerChange();
  }

  private getCurrentNoteId(): string | null {
    return this.options.noteId || null;
  }

  private async loadImageFromPath(img: HTMLImageElement, relativePath: string) {
    try {
      console.log('Loading image from path:', relativePath);
      
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Get the image as base64 data URL
      const dataUrl = await invoke<string>('get_image_as_base64', { relativePath });
      console.log('Got image as data URL (length):', dataUrl.length);
      
      // Set the image source
      img.src = dataUrl;
      
      // Add error handler for the image element itself
      img.onerror = () => {
        console.error('Image failed to load from data URL');
        this.showImageError(img);
      };
      
      img.onload = () => {
        console.log('Image loaded successfully');
      };
      
    } catch (error) {
      console.error('Failed to load image from path:', relativePath, error);
      this.showImageError(img);
    }
  }

  private showImageError(img: HTMLImageElement) {
    // Show error placeholder
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRkVGMkYyIiBzdHJva2U9IiNGRUNCQ0IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWRhc2hhcnJheT0iNSw1Ii8+PHBhdGggZD0iTTcwIDM1TDg1IDUwTDEwMCAzNUwxMTUgNTBMMTMwIDM1VjY1SDcwVjM1WiIgZmlsbD0iI0ZFQ0JDQiIvPjxjaXJjbGUgY3g9Ijg1IiBjeT0iNDUiIHI9IjMiIGZpbGw9IiNEQzI2MjYiLz48dGV4dCB4PSIxMDAiIHk9IjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjREM0NDQ0IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4K';
    img.alt = 'Image not found';
  }

  private createResizeHandles(wrapper: HTMLElement, img: HTMLImageElement) {
    // Create resize handle (bottom-right corner)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.style.position = 'absolute';
    resizeHandle.style.bottom = '4px';
    resizeHandle.style.right = '4px';
    resizeHandle.style.width = '12px';
    resizeHandle.style.height = '12px';
    resizeHandle.style.backgroundColor = 'rgba(59, 130, 246, 0.8)'; // Blue
    resizeHandle.style.borderRadius = '2px';
    resizeHandle.style.cursor = 'nw-resize';
    resizeHandle.style.opacity = '0';
    resizeHandle.style.transition = 'opacity 0.2s ease';
    resizeHandle.style.zIndex = '10';
    
    // Show/hide handles on hover
    wrapper.addEventListener('mouseenter', () => {
      resizeHandle.style.opacity = '1';
      img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(59, 130, 246, 0.3)';
    });
    
    wrapper.addEventListener('mouseleave', () => {
      resizeHandle.style.opacity = '0';
      img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    });

    // Resize functionality
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let originalWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startWidth = wrapper.offsetWidth;
      originalWidth = img.naturalWidth || startWidth;
      
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
      document.body.style.cursor = 'nw-resize';
      document.body.style.userSelect = 'none';
    });

    const handleResize = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      let newWidth = startWidth + deltaX;
      
      // Apply constraints
      const minWidth = 100;
      const maxWidth = Math.min(originalWidth, this.element.offsetWidth - 40); // Leave some margin
      
      newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      
      wrapper.style.width = `${newWidth}px`;
      
      // Update wrapper to maintain aspect ratio
      wrapper.style.height = 'auto';
    };

    const stopResize = () => {
      if (!isResizing) return;
      isResizing = false;
      
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Trigger change to save the new size
      this.triggerChange();
    };

    wrapper.appendChild(resizeHandle);
  }

  private makeExistingImagesResizable() {
    // Find all existing images that aren't already wrapped
    const images = this.element.querySelectorAll('img');
    
    images.forEach((img) => {
      const htmlImg = img as HTMLImageElement;
      const parent = img.parentElement;
      
      if (!parent) return;
      
      let resizableWrapper: HTMLElement;
      if (parent.classList.contains('resizable-image-wrapper')) {
        // Already wrapped: ensure resize handle and listeners exist
        resizableWrapper = parent as HTMLElement;
        const existingHandle = resizableWrapper.querySelector('.resize-handle') as HTMLElement | null;
        if (existingHandle) {
          existingHandle.remove();
        }
        // Ensure image styles and click handler are set
        htmlImg.style.width = '100%';
        htmlImg.style.height = 'auto';
        htmlImg.style.display = 'block';
        htmlImg.style.transition = 'box-shadow 0.2s ease';
        if (!htmlImg.onclick) {
          htmlImg.onclick = (e) => {
            e.stopPropagation();
            const container = resizableWrapper.parentElement;
            if (container) {
              this.handleImageClick(container, htmlImg);
            }
          };
        }
        this.createResizeHandles(resizableWrapper, htmlImg);
      } else {
        // Check if this image has a file path that needs loading
        if (htmlImg.dataset.imagePath && !htmlImg.src.startsWith('data:') && !htmlImg.src.startsWith('http') && !htmlImg.src.startsWith('file:')) {
          this.loadImageFromPath(htmlImg, htmlImg.dataset.imagePath);
        }
        
        // Create resizable wrapper
      const resizableWrapper = document.createElement('div');
      resizableWrapper.className = 'resizable-image-wrapper';
      resizableWrapper.style.position = 'relative';
      resizableWrapper.style.display = 'inline-block';
      resizableWrapper.style.width = 'auto';
      resizableWrapper.style.minWidth = '100px';
      resizableWrapper.style.maxWidth = '100%';
      
      // Update image styles
      htmlImg.style.width = '100%';
      htmlImg.style.height = 'auto';
      htmlImg.style.display = 'block';
      htmlImg.style.transition = 'box-shadow 0.2s ease';
      
      // Wrap the image
      parent.insertBefore(resizableWrapper, img);
      resizableWrapper.appendChild(img);
      
      // Add click handler if not present
      if (!htmlImg.onclick) {
        htmlImg.onclick = (e) => {
          e.stopPropagation();
          // Find the image container (should be parent of resizable wrapper)
          const container = resizableWrapper.parentElement;
          if (container) {
            this.handleImageClick(container, htmlImg);
          }
        };
      }
      
            // Create resize handles
      this.createResizeHandles(resizableWrapper, htmlImg);
      }
     });
  }

  private handleImageClick(container: HTMLElement, img: HTMLImageElement) {
    // Use custom modal instead of browser prompts
    if (this.options.onImageClick) {
      this.options.onImageClick(container, img);
    } else {
      // Fallback to browser prompts if no custom handler provided
      const actions = ['Copy Alt Text', 'Remove Image', 'Replace Image'];
      const action = prompt(`Image Actions:\n1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}\n\nEnter number (1-3):`);
      
      switch (action) {
        case '1':
          navigator.clipboard.writeText(img.alt || 'Image');
          break;
        case '2':
          if (confirm('Remove this image?')) {
            container.parentNode?.removeChild(container);
            this.triggerChange();
          }
          break;
        case '3':
          // Trigger new image selection
          this.insertImage();
          // Remove old image after new one is selected
          setTimeout(() => {
            if (container.parentNode) {
              container.parentNode.removeChild(container);
              this.triggerChange();
            }
          }, 100);
          break;
      }
    }
  }

   public insertLink(): boolean {
     const selection = window.getSelection();
     if (!selection || selection.rangeCount === 0) return false;

     const range = selection.getRangeAt(0);
     const selectedText = range.toString().trim();
     
     // Check if we're already in a link
     const existingLink = this.findParentLink(range.startContainer);
     
     if (existingLink) {
       // Edit existing link
       this.editLink(existingLink);
     } else {
       // Create new link
       this.createLink(selectedText, range);
     }
     
     return true;
   }

   private findParentLink(node: Node): HTMLAnchorElement | null {
     let current = node;
     
     while (current && current !== this.element) {
       if (current.nodeType === Node.ELEMENT_NODE) {
         const element = current as HTMLElement;
         if (element.tagName === 'A') {
           return element as HTMLAnchorElement;
         }
       }
       const parentNode = current.parentNode;
       if (!parentNode) break;
       current = parentNode;
     }
     
     return null;
   }

   private createLink(selectedText: string, range: Range) {
     // Prompt for URL
     const url = prompt('Enter the URL:', selectedText.startsWith('http') ? selectedText : 'https://');
     if (!url) return;

     // Prompt for link text if no text is selected
     let linkText = selectedText;
     if (!linkText) {
       linkText = prompt('Enter the link text:', url) || url;
     }

     // Validate URL
     if (!this.isValidUrl(url)) {
       alert('Please enter a valid URL');
       return;
     }

     // Create link element
     const link = document.createElement('a');
     link.href = url;
     link.textContent = linkText;
     link.style.color = 'var(--accent-color, #3b82f6)';
     link.style.textDecoration = 'underline';
     link.style.cursor = 'pointer';
     link.target = '_blank';
     link.rel = 'noopener noreferrer';
     
     // Add click handler for link editing
     link.onclick = (e) => {
       e.preventDefault();
       this.editLink(link);
     };

     if (range.collapsed) {
       // No selection, insert link at cursor
       range.insertNode(link);
       range.setStartAfter(link);
       range.setEndAfter(link);
     } else {
       // Replace selection with link
       range.deleteContents();
       range.insertNode(link);
       range.setStartAfter(link);
       range.setEndAfter(link);
     }

     // Update selection
     const newSelection = window.getSelection();
     if (newSelection) {
       newSelection.removeAllRanges();
       newSelection.addRange(range);
     }

     this.triggerChange();
   }

   private editLink(link: HTMLAnchorElement) {
     const currentUrl = link.href;
     const currentText = link.textContent || '';
     
     const newUrl = prompt('Edit URL:', currentUrl);
     if (newUrl === null) return; // User cancelled
     
     const newText = prompt('Edit link text:', currentText);
     if (newText === null) return; // User cancelled

     if (newUrl && this.isValidUrl(newUrl)) {
       link.href = newUrl;
       link.textContent = newText || newUrl;
       this.triggerChange();
     } else if (newUrl) {
       alert('Please enter a valid URL');
     }
   }

   private isValidUrl(url: string): boolean {
     try {
       new URL(url);
       return true;
     } catch {
       // Try with https:// prefix
       try {
         new URL('https://' + url);
         return true;
       } catch {
         return false;
       }
     }
   }

   private handleMentionTrigger() {
     const selection = window.getSelection();
     if (!selection || selection.rangeCount === 0) return;

     const range = selection.getRangeAt(0);
     const textNode = range.startContainer;
     
     if (textNode.nodeType !== Node.TEXT_NODE) return;
     
     const text = textNode.textContent || '';
     const cursorPos = range.startOffset;
     
     // Find the @ symbol before cursor
     const beforeCursor = text.substring(0, cursorPos);
     const atIndex = beforeCursor.lastIndexOf('@');
     
     if (atIndex === -1) return;
     
     // Get the query after @
     const query = beforeCursor.substring(atIndex + 1);
     
     // Only trigger if @ is at word boundary or start
     if (atIndex > 0 && /\w/.test(beforeCursor[atIndex - 1])) return;
     
     this.showMentionAutocomplete(textNode, atIndex, query);
   }

   private checkForMentionSearch() {
     const selection = window.getSelection();
     if (!selection || selection.rangeCount === 0) return;

     const range = selection.getRangeAt(0);
     const textNode = range.startContainer;
     
     if (textNode.nodeType !== Node.TEXT_NODE) return;
     
     const text = textNode.textContent || '';
     const cursorPos = range.startOffset;
     
     // Find the @ symbol before cursor
     const beforeCursor = text.substring(0, cursorPos);
     const atIndex = beforeCursor.lastIndexOf('@');
     
     // Check if we're currently in a mention context
     if (atIndex === -1) {
       // No @ found, close any open dropdown
       this.removeMentionDropdown();
       return;
     }
     
     // Get the query after @
     const query = beforeCursor.substring(atIndex + 1);
     
     // Check if @ is at word boundary or start
     if (atIndex > 0 && /\w/.test(beforeCursor[atIndex - 1])) {
       this.removeMentionDropdown();
       return;
     }
     
     // Check if query contains spaces or newlines (end of mention)
     if (query.includes(' ') || query.includes('\n')) {
       this.removeMentionDropdown();
       return;
     }
     
     // Check if cursor is too far from @ (more than 50 characters)
     if (query.length > 50) {
       this.removeMentionDropdown();
       return;
     }
     
     // Debounce the search to avoid too many API calls
     if (this.mentionSearchTimeout) {
       clearTimeout(this.mentionSearchTimeout);
     }
     
     this.mentionSearchTimeout = window.setTimeout(() => {
       // If we already have a dropdown open, update it with new query
       if (this.currentMentionDropdown) {
         this.updateMentionDropdown(textNode, atIndex, query);
       } else {
         // Show new dropdown if query is reasonable
         this.showMentionAutocomplete(textNode, atIndex, query);
       }
     }, 200); // 200ms debounce
   }

     private async updateMentionDropdown(textNode: Node, atIndex: number, query: string) {
    if (!this.currentMentionDropdown) return;
    
    // Store reference to current dropdown to check if it's still valid after async operation
    const dropdownRef = this.currentMentionDropdown;
    
    // Clear current dropdown content
    this.currentMentionDropdown.innerHTML = '';
    
    // Remove existing event listeners to prevent memory leaks
    if (this.currentMentionKeyHandler) {
      document.removeEventListener('keydown', this.currentMentionKeyHandler);
      this.currentMentionKeyHandler = null;
    }
    
    // Get new suggestions
    const suggestions = await this.getMentionSuggestions(query);
    
    // Check if dropdown is still the same after async operation
    if (!this.currentMentionDropdown || this.currentMentionDropdown !== dropdownRef) {
      return; // Dropdown was removed or replaced during async operation
    }
    
          // Debug logging
     // console.log('Updated mention suggestions for query "' + query + '":', suggestions);
    
    if (suggestions.length === 0) {
      // Show "no results" message
      const noResults = document.createElement('div');
      noResults.className = 'p-3 text-center text-slate-500 dark:text-slate-400';
      noResults.textContent = query ? `No results for "${query}"` : 'No SEQTA elements found';
      this.currentMentionDropdown!.appendChild(noResults);
      return;
    }
    
    // Add new suggestions
    suggestions.forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'mention-item p-3 cursor-pointer border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';
      
      if (index === 0) {
        item.classList.add('selected', 'bg-slate-50', 'dark:bg-slate-700');
      }

      // Add icon based on type
      const icon = this.getMentionIcon(suggestion.type);
      item.innerHTML = `
        <span class="text-lg">${icon}</span>
        <div class="flex-1">
          <div class="font-medium text-slate-900 dark:text-slate-100">${suggestion.title}</div>
          <div class="text-sm text-slate-600 dark:text-slate-400">${suggestion.subtitle}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        this.insertMention(textNode, atIndex, suggestion);
      });

      this.currentMentionDropdown!.appendChild(item);
    });

    // Update keyboard navigation
    this.setupMentionKeyboardHandling(this.currentMentionDropdown, textNode, atIndex);
  }

       private async showMentionAutocomplete(textNode: Node, atIndex: number, query: string) {
      // Create or update autocomplete dropdown
      await this.createMentionDropdown(textNode, atIndex, query);
    }

    private async createMentionDropdown(textNode: Node, atIndex: number, query: string) {
      // Remove existing dropdown
      this.removeMentionDropdown();

      const dropdown = document.createElement('div');
      dropdown.className = 'mention-autocomplete';
      // Use Tailwind-style classes for better theme integration
      dropdown.className = 'mention-autocomplete fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[250px]';
      dropdown.style.cssText = `
        position: absolute;
        z-index: 1000;
      `;

      // Store reference for cleanup before async operation
      this.currentMentionDropdown = dropdown;

      // Get mention suggestions
      const suggestions = await this.getMentionSuggestions(query);
      
      // Check if dropdown is still valid after async operation
      if (this.currentMentionDropdown !== dropdown) {
        return; // Dropdown was removed or replaced during async operation
      }
      
      // Debug logging
      // console.log('Mention suggestions:', suggestions);
      
      if (suggestions.length === 0) {
        // Show "no results" message
        const noResults = document.createElement('div');
        noResults.className = 'p-3 text-center text-slate-500 dark:text-slate-400';
        noResults.textContent = 'No SEQTA elements found';
        dropdown.appendChild(noResults);
      }
      
      suggestions.forEach((suggestion, index) => {
               const item = document.createElement('div');
        item.className = 'mention-item p-3 cursor-pointer border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';
        
        if (index === 0) {
          item.classList.add('selected', 'bg-slate-50', 'dark:bg-slate-700');
        }

               // Add icon based on type
        const icon = this.getMentionIcon(suggestion.type);
        item.innerHTML = `
          <span class="text-lg">${icon}</span>
          <div class="flex-1">
            <div class="font-medium text-slate-900 dark:text-slate-100">${suggestion.title}</div>
            <div class="text-sm text-slate-600 dark:text-slate-400">${suggestion.subtitle}</div>
          </div>
        `;

       item.addEventListener('click', () => {
         this.insertMention(textNode, atIndex, suggestion);
       });

       dropdown.appendChild(item);
     });

     // Position dropdown
     this.positionMentionDropdown(dropdown, textNode, atIndex);
     
     // Add to DOM
     document.body.appendChild(dropdown);

     // Handle keyboard navigation
     this.setupMentionKeyboardHandling(dropdown, textNode, atIndex);
   }

       private async getMentionSuggestions(query: string): Promise<SeqtaMentionItem[]> {
      try {
        return await SeqtaMentionsService.searchMentions(query);
      } catch (error) {
        console.error('Error fetching mention suggestions:', error);
        // Fallback to mock data
        return this.getMockMentionSuggestions(query);
      }
    }

    private getMockMentionSuggestions(query: string): SeqtaMentionItem[] {
      const mockSuggestions: SeqtaMentionItem[] = [
        {
          id: 'assignment-1',
          type: 'assignment',
          title: 'Mathematics Assignment 3',
          subtitle: 'Mathematics • Due: Tomorrow, 11:59 PM',
          data: { subject: 'Mathematics', dueDate: '2024-01-15T23:59:00Z' }
        },
        {
          id: 'class-1',
          type: 'class',
          title: 'Year 10 Mathematics',
          subtitle: 'Mr. Smith • Room 204',
          data: { year: 10, subject: 'Mathematics', nextClass: '2024-01-14T14:00:00Z' }
        },
        {
          id: 'subject-1',
          type: 'subject',
          title: 'English Literature',
          subtitle: 'ENG10 • Ms. Johnson • 4 assignments',
          data: { code: 'ENG10', assignments: 4 }
        },
        {
          id: 'assessment-1',
          type: 'assessment',
          title: 'Chemistry Test',
          subtitle: 'Chemistry • Next Friday • Test',
          data: { subject: 'Chemistry', date: '2024-01-19T09:00:00Z' }
        },
        {
          id: 'timetable-1',
          type: 'timetable',
          title: 'Schedule for Today',
          subtitle: '6 classes scheduled',
          data: { date: '2024-01-14', classCount: 6 }
        }
      ];

      // Filter by query
      if (!query) return mockSuggestions.slice(0, 5);
      
      return mockSuggestions.filter(s => 
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
    }

   private getMentionIcon(type: string): string {
      const icons = {
        assignment: '📝',
        class: '🎓',
        subject: '📚',
        assessment: '📊',
        timetable: '📅',
        notice: '📢',
        default: '🔗'
      };
     return icons[type as keyof typeof icons] || icons.default;
   }

   private positionMentionDropdown(dropdown: HTMLElement, textNode: Node, atIndex: number) {
     // Create a temporary range to get cursor position
     const range = document.createRange();
     range.setStart(textNode, atIndex);
     range.setEnd(textNode, atIndex + 1);
     
     const rect = range.getBoundingClientRect();
     const editorRect = this.element.getBoundingClientRect();
     
     // Position below cursor
     dropdown.style.left = `${rect.left}px`;
     dropdown.style.top = `${rect.bottom + 5}px`;
     
     // Adjust if dropdown would go off-screen
     const dropdownRect = dropdown.getBoundingClientRect();
     if (dropdownRect.right > window.innerWidth) {
       dropdown.style.left = `${window.innerWidth - dropdownRect.width - 10}px`;
     }
     if (dropdownRect.bottom > window.innerHeight) {
       dropdown.style.top = `${rect.top - dropdownRect.height - 5}px`;
     }
   }

   private setupMentionKeyboardHandling(dropdown: HTMLElement, textNode: Node, atIndex: number) {
     const items = dropdown.querySelectorAll('.mention-item');
     let selectedIndex = 0;

     const keyHandler = (e: KeyboardEvent) => {
       switch (e.key) {
         case 'ArrowDown':
           e.preventDefault();
           selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
           this.updateMentionSelection(items, selectedIndex);
           break;
         case 'ArrowUp':
           e.preventDefault();
           selectedIndex = Math.max(selectedIndex - 1, 0);
           this.updateMentionSelection(items, selectedIndex);
           break;
         case 'Enter':
         case 'Tab':
           e.preventDefault();
           const selectedItem = items[selectedIndex] as HTMLElement;
           if (selectedItem) selectedItem.click();
           break;
         case 'Escape':
           e.preventDefault();
           this.removeMentionDropdown();
           break;
       }
     };

     document.addEventListener('keydown', keyHandler);
     
     // Store handler for cleanup
     this.currentMentionKeyHandler = keyHandler;
   }

       private updateMentionSelection(items: NodeListOf<Element>, selectedIndex: number) {
      items.forEach((item, index) => {
        const htmlItem = item as HTMLElement;
        if (index === selectedIndex) {
          htmlItem.classList.add('selected', 'bg-slate-50', 'dark:bg-slate-700');
        } else {
          htmlItem.classList.remove('selected', 'bg-slate-50', 'dark:bg-slate-700');
        }
      });
    }

   private insertMention(textNode: Node, atIndex: number, suggestion: any) {
     // Remove the @ and query text
     const text = textNode.textContent || '';
     const afterAt = text.substring(atIndex);
     const spaceIndex = afterAt.indexOf(' ');
     const endIndex = spaceIndex === -1 ? text.length : atIndex + spaceIndex;
     
           // Build structured embed token @[[base64url(JSON)]] for robust saving
      const safe = (s: string) => {
        // remove unpaired surrogate halves
        return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '').replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
      };
      const toBase64Url = (obj: any) => {
        const json = JSON.stringify(obj);
        const utf8 = new TextEncoder().encode(json);
        let binary = '';
        utf8.forEach((b) => (binary += String.fromCharCode(b)));
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
      };
      const extractLookup = (s: any) => {
        const d = s?.data || {};
        switch (s.type) {
          case 'class':
            return { programme: d.programme, metaclass: d.metaclass, code: d.code };
          case 'assignment':
          case 'assessment':
            return { id: d.id ?? s.id, subject: d.subject ?? d.code };
          case 'subject':
            return { programme: d.programme, metaclass: d.metaclass, code: d.code };
          default:
            return {};
        }
      };
      const pruneSnapshot = (s: any) => {
        const d = s?.data || {};
        const base: any = {};
        ['id','title','subject','code','due','dueDate','teacher','programme','metaclass','lessons','room'].forEach(k=>{
          if (d[k] !== undefined) base[k] = d[k];
        });
        return JSON.parse(safe(JSON.stringify(base)));
      };
      const embed = {
        v: 1,
        type: suggestion.type,
        id: suggestion.id,
        title: safe(suggestion.title || ''),
        subtitle: this.formatMentionSubtitle(suggestion.type, suggestion.data || {}),
        lookup: extractLookup(suggestion),
        snapshot: pruneSnapshot(suggestion),
        ts: new Date().toISOString()
      };
      const mentionText = `@[[${toBase64Url(embed)}]]`;

      // Store the full suggestion data in a global mention registry
      this.storeMentionData(suggestion.id, suggestion);
      
          // Replace the @ and query with the mention text
    const range = document.createRange();
    // Guard against detached text nodes
    const parentForText = textNode.parentNode;
    if (!parentForText) {
      // Fallback: append at end of current block
      const block = this.getBlockElement(this.element) || this.element;
      const safeTextNode = document.createTextNode('');
      block.appendChild(safeTextNode);
      range.setStart(safeTextNode, 0);
      range.setEnd(safeTextNode, 0);
    } else {
      range.setStart(textNode, atIndex);
      range.setEnd(textNode, endIndex);
      range.deleteContents();
    }
    
    const mentionTextNode = document.createTextNode(mentionText + ' ');
    range.insertNode(mentionTextNode);
     
     // Position cursor after the mention
     range.setStartAfter(mentionTextNode);
     range.collapse(true);
     
     // Update selection
     const selection = window.getSelection();
     if (selection) {
       selection.removeAllRanges();
       selection.addRange(range);
     }

     this.removeMentionDropdown();
     
     // Convert the text mention to visual mention immediately
     setTimeout(() => {
       this.convertTextMentionsToVisual();
     }, 0);
     
     this.triggerChange();
   }

   private handleMentionClick(mention: HTMLElement, suggestion: any) {
     // Show mention details or update data
     const actions = ['View Details', 'Update Data', 'Remove Mention'];
     const action = prompt(`${suggestion.title}\n\n1. ${actions[0]}\n2. ${actions[1]}\n3. ${actions[2]}\n\nEnter number (1-3):`);
     
     switch (action) {
       case '1':
         this.showMentionDetails(suggestion);
         break;
       case '2':
         this.updateMentionData(mention, suggestion);
         break;
       case '3':
         if (confirm('Remove this mention?')) {
           mention.parentNode?.removeChild(mention);
           this.triggerChange();
         }
         break;
     }
   }

     private async handlePersistedMentionClick(mention: HTMLElement, suggestion: SeqtaMentionItem) {
      // If we don't have enriched data (e.g., after reload), fetch it first
      const lacksData = !suggestion?.data || Object.keys(suggestion.data).length === 0 ||
                        (suggestion.type === 'class' && !suggestion.data.code) ||
                        (suggestion.type === 'assessment' && !suggestion.data.due && !suggestion.data.dueDate);
      if (lacksData) {
        // Try to pass along embed meta if present in legacy text nearby (not needed for visual)
        await this.refreshMentionData(mention, suggestion.id, suggestion.type);
        const updated = this.mentionRegistry.get(suggestion.id) || suggestion;
        suggestion = updated;
      }
      this.showMentionModal(mention, suggestion);
    }

      private showMentionModal(mention: HTMLElement, suggestion: SeqtaMentionItem) {
     // Remove any existing modal
     this.removeMentionModal();

     // Create modal backdrop with proper Tailwind classes
     const backdrop = document.createElement('div');
     backdrop.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';

     // Create modal content following project patterns
     const modal = document.createElement('div');
     modal.className = 'relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden';

     // Create modal header
     const header = document.createElement('div');
     header.className = 'flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';

     const headerContent = document.createElement('div');
     headerContent.className = 'flex items-center gap-3';

     const icon = document.createElement('span');
     icon.className = 'text-2xl';
     icon.textContent = this.getMentionIcon(suggestion.type);

     const titleContainer = document.createElement('div');
     
     const title = document.createElement('h2');
     title.className = 'text-xl font-semibold text-slate-900 dark:text-white';
     title.textContent = suggestion.title;

     const subtitle = document.createElement('p');
     subtitle.className = 'text-sm text-slate-600 dark:text-slate-400 mt-1';
     subtitle.textContent = suggestion.subtitle;

     titleContainer.appendChild(title);
     titleContainer.appendChild(subtitle);

     const closeBtn = document.createElement('button');
     closeBtn.className = 'p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700';
     closeBtn.innerHTML = `
       <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
       </svg>
     `;
     closeBtn.onclick = () => this.removeMentionModal();

     headerContent.appendChild(icon);
     headerContent.appendChild(titleContainer);
     header.appendChild(headerContent);
     header.appendChild(closeBtn);

     // Create modal body
     const body = document.createElement('div');
     body.className = 'p-6';

     const detailsLabel = document.createElement('h3');
      detailsLabel.className = 'text-sm font-medium text-slate-900 dark:text-white mb-3';
      detailsLabel.textContent = 'Details';

      // Build rich details by type
      const buildDetails = (): HTMLElement => {
        const container = document.createElement('div');
        container.className = 'space-y-2 text-sm text-slate-700 dark:text-slate-300';
        if (suggestion.type === 'assessment' || suggestion.type === 'assignment') {
          const due = suggestion.data?.due || suggestion.data?.dueDate;
          const d = due ? new Date(due) : null;
          const row = document.createElement('div');
          row.innerHTML = `<div><span class="font-medium">Subject:</span> ${suggestion.data?.subject || suggestion.data?.code || '—'}</div>
                           <div><span class="font-medium">Due:</span> ${d ? d.toLocaleDateString() : '—'} ${d && due?.includes('T') ? d.toTimeString().substring(0,5) : ''}</div>`;
          container.appendChild(row);
        } else if (suggestion.type === 'class') {
          const info = document.createElement('div');
          info.innerHTML = `<div><span class="font-medium">Code:</span> ${suggestion.data?.code || '—'}</div>
                            <div><span class="font-medium">Teacher:</span> ${suggestion.data?.teacher || '—'}</div>`;
          container.appendChild(info);

          const lessons: any[] = suggestion.data?.lessons || [];

          // Weekly schedule defaults to known lessons; may be updated asynchronously below if empty
          let weeklyLessons = lessons;
          let needsAsync = !weeklyLessons || weeklyLessons.length === 0;

            const header = document.createElement('div');
           header.className = 'mt-3 font-medium';
           header.textContent = 'Weekly Schedule (Mon–Fri)';
            container.appendChild(header);

           const daysOrder = ['Mon','Tue','Wed','Thu','Fri'];
           const dayIndexMap: Record<string, number> = { 'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4 };
           const bucket: Record<string, Array<{ date: string; from: string; until: string; room?: string }>> = {
             Mon: [], Tue: [], Wed: [], Thu: [], Fri: []
           };

           // Group lessons by weekday label
           for (const l of weeklyLessons) {
             const dateStr: string = l.date || (l.from || '').split('T')[0] || '';
             const date = dateStr ? new Date(dateStr) : null;
             const day = date ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()] : null;
             if (!day) continue;
             if (day in bucket) {
               const key = day as keyof typeof bucket;
               bucket[key].push({ date: dateStr, from: (l.from || '').substring(0,5), until: (l.until || '').substring(0,5), room: l.room });
             }
           }

           // Dedupe time slots per day (by from-until-room)
           const deduped: Record<string, Array<{ label: string; room?: string }>> = {};
           for (const day of Object.keys(bucket)) {
             const seen = new Set<string>();
             deduped[day] = [];
             for (const item of bucket[day]) {
               const sig = `${item.from}-${item.until}-${item.room || ''}`;
               if (seen.has(sig)) continue;
               seen.add(sig);
               deduped[day].push({ label: `${item.from}–${item.until}`, room: item.room });
             }
           }

                      const grid = document.createElement('div');
           const daysWithItems = daysOrder.filter((d) => (deduped[d] || []).length > 0);
           const colsClass = daysWithItems.length <= 1
             ? 'grid-cols-1'
             : daysWithItems.length === 2
               ? 'grid-cols-1 sm:grid-cols-2'
               : daysWithItems.length === 3
                 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                 : daysWithItems.length === 4
                   ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                   : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';
           grid.className = `mt-2 grid ${colsClass} gap-3`;
 
            // Build day cards only for days with items
            for (const d of daysWithItems) {
             const card = document.createElement('div');
             card.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md p-3 h-32 flex flex-col';

             const title = document.createElement('div');
             title.className = 'text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide';
             title.textContent = d;
             card.appendChild(title);

             const list = document.createElement('div');
             list.className = 'mt-2 flex-1 overflow-hidden';

                           const items = (deduped[d] || []).slice().sort((a,b)=>a.label.localeCompare(b.label));
              for (const it of items) {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1 last:mb-0';

                const time = document.createElement('span');
                time.className = 'inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700';
                time.textContent = it.label;
                row.appendChild(time);

                if (it.room) {
                  const room = document.createElement('span');
                  room.className = 'ml-2 text-[11px] text-slate-500 dark:text-slate-400 truncate';
                  room.textContent = it.room;
                  row.appendChild(room);
                }

                list.appendChild(row);
              }

             card.appendChild(list);
             grid.appendChild(card);
           }

           container.appendChild(grid);

           // If we need to compute weekly data from historical timetable, do it asynchronously and re-render this block
           if (needsAsync) {
             (async () => {
               try {
                 const { SeqtaMentionsService } = await import('../../../services/seqtaMentionsService');
                 const computed = await SeqtaMentionsService.getWeeklyScheduleForClass(
                   suggestion.data?.programme,
                   suggestion.data?.metaclass,
                   suggestion.data?.code
                 );
                 if (computed && computed.length) {
                   // Remove old grid and rebuild with computed data
                   try {
                     grid.remove();
                   } catch {}

                   // Rebuild buckets with computed
                   const bucket2: Record<string, Array<{ date: string; from: string; until: string; room?: string }>> = {
                     Mon: [], Tue: [], Wed: [], Thu: [], Fri: []
                   };
                   for (const l of computed) {
                     const dateStr: string = l.date || (l.from || '').split('T')[0] || '';
                     const date = dateStr ? new Date(dateStr) : null;
                     const day = date ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()] : null;
                     if (!day || !(day in bucket2)) continue;
                     const key = day as keyof typeof bucket2;
                     bucket2[key].push({ date: dateStr, from: (l.from || '').substring(0,5), until: (l.until || '').substring(0,5), room: l.room });
                   }
                   // Dedup
                   const deduped2: Record<string, Array<{ label: string; room?: string }>> = {};
                   for (const day of Object.keys(bucket2)) {
                     const seen = new Set<string>();
                     deduped2[day] = [];
                     for (const item of bucket2[day]) {
                       const sig = `${item.from}-${item.until}-${item.room || ''}`;
                       if (seen.has(sig)) continue;
                       seen.add(sig);
                       deduped2[day].push({ label: `${item.from}–${item.until}`, room: item.room });
                     }
                   }

                  const daysWithItems2 = daysOrder.filter((d) => (deduped2[d] || []).length > 0);
                  const colsClass2 = daysWithItems2.length <= 1
                    ? 'grid-cols-1'
                    : daysWithItems2.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : daysWithItems2.length === 3
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        : daysWithItems2.length === 4
                          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';
                  const grid2 = document.createElement('div');
                  grid2.className = `mt-2 grid ${colsClass2} gap-3`;
                  for (const d of daysWithItems2) {
                     const card = document.createElement('div');
                     card.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md p-3 h-32 flex flex-col';
                     const title = document.createElement('div');
                     title.className = 'text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide';
                     title.textContent = d;
                     card.appendChild(title);
                     const list = document.createElement('div');
                     list.className = 'mt-2 flex-1 overflow-hidden';
                                           const items = (deduped2[d] || []).slice().sort((a,b)=>a.label.localeCompare(b.label));
                      for (const it of items) {
                        const row = document.createElement('div');
                        row.className = 'flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1 last:mb-0';
                        const time = document.createElement('span');
                        time.className = 'inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700';
                        time.textContent = it.label;
                        row.appendChild(time);
                        if (it.room) {
                          const room = document.createElement('span');
                          room.className = 'ml-2 text-[11px] text-slate-500 dark:text-slate-400 truncate';
                          room.textContent = it.room;
                          row.appendChild(room);
                        }
                        list.appendChild(row);
                      }
                     card.appendChild(list);
                     grid2.appendChild(card);
                   }
                   container.appendChild(grid2);
                 }
               } catch (err) {
                 console.warn('Async weekly schedule refresh failed:', err);
               }
             })();
          }
        } else if (suggestion.type === 'subject') {
          const info = document.createElement('div');
          info.innerHTML = `<div><span class="font-medium">Code:</span> ${suggestion.data?.code || '—'}</div>
                            <div><span class="font-medium">Teacher:</span> ${suggestion.data?.teacher || '—'}</div>`;
          container.appendChild(info);
        } else {
          const pre = document.createElement('pre');
          pre.className = 'bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-sm font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700';
          pre.textContent = JSON.stringify(suggestion.data, null, 2);
          container.appendChild(pre);
        }
        return container;
      };

      body.appendChild(detailsLabel);
      body.appendChild(buildDetails());

     // Create modal footer with proper button styling
     const footer = document.createElement('div');
     footer.className = 'flex gap-3 p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 justify-end';

     const closeButton = this.createThemedButton('Close', 'secondary', () => {
       this.removeMentionModal();
     });

     const updateButton = this.createThemedButton('Update Data', 'primary', async () => {
       this.removeMentionModal();
       await this.refreshMentionData(mention, suggestion.id, suggestion.type);
     });

     const removeButton = this.createThemedButton('Remove', 'danger', () => {
       this.removeMentionModal();
       this.showConfirmModal('Remove Mention', 'Are you sure you want to remove this mention?', () => {
         mention.parentNode?.removeChild(mention);
         this.triggerChange();
       });
     });

     footer.appendChild(closeButton);
     footer.appendChild(updateButton);
     footer.appendChild(removeButton);

     // Assemble modal
     modal.appendChild(header);
     modal.appendChild(body);
     modal.appendChild(footer);
     backdrop.appendChild(modal);

     // Add to document
     document.body.appendChild(backdrop);

     // Store reference for cleanup
     this.currentMentionModal = backdrop;

     // Handle backdrop click to close
     backdrop.addEventListener('click', (e) => {
       if (e.target === backdrop) {
         this.removeMentionModal();
       }
     });

     // Handle escape key
     const escapeHandler = (e: KeyboardEvent) => {
       if (e.key === 'Escape') {
         this.removeMentionModal();
         document.removeEventListener('keydown', escapeHandler);
       }
     };
     document.addEventListener('keydown', escapeHandler);

     // Add modal animation
     modal.style.transform = 'scale(0.9)';
     modal.style.opacity = '0';
     modal.style.transition = 'all 0.2s ease-out';
     
     requestAnimationFrame(() => {
       modal.style.transform = 'scale(1)';
       modal.style.opacity = '1';
     });
   }

   private createThemedButton(text: string, variant: 'primary' | 'secondary' | 'danger', onClick: () => void): HTMLButtonElement {
     const button = document.createElement('button');
     button.textContent = text;
     button.onclick = onClick;

     // Apply button styling based on variant following user guidelines
     switch (variant) {
       case 'primary':
         button.className = 'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 accent-bg text-white hover:accent-bg-hover focus:accent-ring';
         break;
       case 'secondary':
         button.className = 'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600';
         break;
       case 'danger':
         button.className = 'px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-red-500 text-white hover:bg-red-600 focus:ring-red-500';
         break;
     }

     return button;
   }

   private showConfirmModal(title: string, message: string, onConfirm: () => void) {
     // Create confirmation modal with proper Tailwind classes
     const backdrop = document.createElement('div');
     backdrop.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';

     const modal = document.createElement('div');
     modal.className = 'relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden';

     const header = document.createElement('div');
     header.className = 'p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800';
     
     const headerTitle = document.createElement('h2');
     headerTitle.className = 'text-lg font-semibold text-slate-900 dark:text-white';
     headerTitle.textContent = title;
     header.appendChild(headerTitle);

     const body = document.createElement('div');
     body.className = 'p-6';
     
     const bodyText = document.createElement('p');
     bodyText.className = 'text-slate-600 dark:text-slate-400';
     bodyText.textContent = message;
     body.appendChild(bodyText);

     const footer = document.createElement('div');
     footer.className = 'flex gap-3 p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 justify-end';

     const cancelBtn = this.createThemedButton('Cancel', 'secondary', () => {
       document.body.removeChild(backdrop);
     });

     const confirmBtn = this.createThemedButton('Confirm', 'danger', () => {
       document.body.removeChild(backdrop);
       onConfirm();
     });

     footer.appendChild(cancelBtn);
     footer.appendChild(confirmBtn);

     modal.appendChild(header);
     modal.appendChild(body);
     modal.appendChild(footer);
     backdrop.appendChild(modal);

     document.body.appendChild(backdrop);

     // Handle backdrop click to close
     backdrop.addEventListener('click', (e) => {
       if (e.target === backdrop) {
         document.body.removeChild(backdrop);
       }
     });

     // Add modal animation
     modal.style.transform = 'scale(0.9)';
     modal.style.opacity = '0';
     modal.style.transition = 'all 0.2s ease-out';
     
     requestAnimationFrame(() => {
       modal.style.transform = 'scale(1)';
       modal.style.opacity = '1';
     });
   }

   private removeMentionModal() {
     if (this.currentMentionModal) {
       document.body.removeChild(this.currentMentionModal);
       this.currentMentionModal = null;
     }
   }

   private formatMentionSubtitle(mentionType: string, data: any): string {
      switch (mentionType) {
        case 'assignment':
        case 'assessment':
          if (data?.due || data?.dueDate) {
            const d = new Date(data.due || data.dueDate);
            const date = d.toLocaleDateString();
            const time = d.toISOString().includes('T') ? (d.toTimeString().substring(0,5)) : '';
            return `${data.subject || data.code || 'Unknown'} • Due: ${date}${time ? ' ' + time : ''}`;
          }
          return `${data.subject || data.code || 'Unknown'} • Assessment`;
        case 'class':
          return `${data.code || data.subject || 'Unknown'} • ${data.teacher || 'Unknown Teacher'}`;
        case 'subject':
          return `${data.code || 'Unknown Code'} • ${data.teacher || 'Unknown Teacher'}`;
        case 'timetable':
          return `${data.subject || 'Unknown Subject'} • ${data.time || 'Unknown Time'}`;
        default:
          return 'SEQTA Element';
      }
    }

       private async refreshMentionData(mention: HTMLElement, mentionId: string, mentionType: string) {
      try {
        // Parse embed meta if present
        let meta: any = undefined;
        const b64 = mention.dataset.mentionMeta;
        if (b64) {
          try {
            const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
            const b64std = b64.replace(/-/g, '+').replace(/_/g, '/') + pad;
            const bin = atob(b64std);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            meta = JSON.parse(new TextDecoder().decode(bytes));
          } catch {}
        }
        // Get fresh data from SEQTA
        const updatedData = await SeqtaMentionsService.updateMentionData(mentionId, mentionType, meta);
        
        if (updatedData) {
          // Update the mention's data attributes
          mention.dataset.mentionData = JSON.stringify(updatedData.data);
          mention.dataset.mentionId = updatedData.id;
          mention.dataset.mentionType = updatedData.type;
          
          // Update the display text
          // Re-render content with inline info
          this.applyMentionContent(mention, updatedData);
          
          // Update the mention registry
          // Persist the enriched suggestion
           this.mentionRegistry.set(updatedData.id, updatedData);
          
          // Update tooltip
          mention.title = this.formatMentionSubtitle(updatedData.type, updatedData.data);
          
          this.triggerChange();
          
          // Show success notification instead of alert
          // this.showNotification('Mention updated successfully!', 'success');
        } else {
         this.showNotification('Could not refresh mention data', 'error');
       }
     } catch (error) {
       console.error('Error refreshing mention data:', error);
       this.showNotification('Error refreshing mention data', 'error');
     }
   }

   private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
     const notification = document.createElement('div');
     
     // Apply proper Tailwind classes based on type
     const baseClasses = 'fixed top-4 right-4 p-4 rounded-lg shadow-xl z-50 font-medium text-sm max-w-sm transform transition-all duration-300 ease-out';
     const typeClasses = {
       success: 'bg-green-500 text-white',
       error: 'bg-red-500 text-white', 
       info: 'bg-blue-500 text-white'
     };
     
     notification.className = `${baseClasses} ${typeClasses[type]}`;
     notification.textContent = message;
     
     // Add icon based on type
     const icon = document.createElement('span');
     icon.className = 'inline-block mr-2';
     switch (type) {
       case 'success':
         icon.innerHTML = '✓';
         break;
       case 'error':
         icon.innerHTML = '✗';
         break;
       case 'info':
         icon.innerHTML = 'ℹ';
         break;
     }
     
     notification.insertBefore(icon, notification.firstChild);
     
     // Initial animation state
     notification.style.transform = 'translateX(100%)';
     notification.style.opacity = '0';
     
     document.body.appendChild(notification);
     
     // Trigger enter animation
     requestAnimationFrame(() => {
       notification.style.transform = 'translateX(0)';
       notification.style.opacity = '1';
     });
     
     // Auto remove after 3 seconds
     setTimeout(() => {
       notification.style.transform = 'translateX(100%)';
       notification.style.opacity = '0';
       
       setTimeout(() => {
         if (notification.parentNode) {
           document.body.removeChild(notification);
         }
       }, 300);
     }, 3000);
   }

   private showMentionDetails(suggestion: any) {
     // This method is now replaced by the modal system
     // Kept for compatibility with existing handleMentionClick calls
     console.log('Mention details:', suggestion);
   }

       private async updateMentionData(mention: HTMLElement, suggestion: any) {
      try {
        mention.style.opacity = '0.7';
        
        const updatedData = await SeqtaMentionsService.updateMentionData(
          suggestion.id || mention.dataset.mentionId,
          suggestion.type || mention.dataset.mentionType
        );
        
        if (updatedData) {
          // Update the mention display
          this.applyMentionContent(mention, updatedData);
          mention.dataset.mentionData = JSON.stringify(updatedData.data);
          mention.title = `Updated: ${new Date().toLocaleTimeString()}`;
          this.triggerChange();
        }
        
        mention.style.opacity = '1';
      } catch (error) {
        console.error('Failed to update mention data:', error);
        mention.style.opacity = '1';
        mention.title = 'Update failed';
      }
    }

   private removeMentionDropdown() {
     if (this.currentMentionDropdown) {
       document.body.removeChild(this.currentMentionDropdown);
       this.currentMentionDropdown = null;
     }
     
     if (this.currentMentionKeyHandler) {
       document.removeEventListener('keydown', this.currentMentionKeyHandler);
       this.currentMentionKeyHandler = null;
     }
     
     if (this.mentionSearchTimeout) {
       clearTimeout(this.mentionSearchTimeout);
       this.mentionSearchTimeout = null;
     }
   }

   private storeMentionData(id: string, suggestion: SeqtaMentionItem) {
     // Sanitize key to avoid invalid characters
    const safeId = id.replace(/[\n\r\t]/g, '');
    this.mentionRegistry.set(safeId, suggestion);
   }

   private convertTextMentionsToVisual() {
     const walker = document.createTreeWalker(
       this.element,
       NodeFilter.SHOW_TEXT,
       null
     );

     const textNodes: Text[] = [];
     let node: Node | null;
     while (node = walker.nextNode()) {
       textNodes.push(node as Text);
     }

     // Process text nodes for mention patterns
     textNodes.forEach(textNode => {
             const text = textNode.textContent || '';
      // Support both legacy @[type:id:title] and new @[[base64url(JSON)]]
      const mentionRegex = /@\[\[([A-Za-z0-9_\-=]+)\]\]|@\[([^:]+):([^:]+):([^\]]+)\]/g;
      let match;
      const replacements: { start: number, end: number, element: HTMLElement }[] = [];

               while ((match = mentionRegex.exec(text)) !== null) {
          const [fullMatch, b64, legacyType, legacyId, legacyTitle] = match as unknown as [string, string, string, string, string];

          let suggestion: SeqtaMentionItem | null = null;
          if (b64) {
            // New structured embed path
            const fromBase64Url = (s: string) => {
              const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
              const b64std = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
              const bin = atob(b64std);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              return JSON.parse(new TextDecoder().decode(bytes));
            };
            try {
              const embed = fromBase64Url(b64);
              const id = embed.id || embed.lookup?.id || crypto.randomUUID();
              const type = embed.type as SeqtaMentionItem['type'];
              const title = embed.title || 'SEQTA Item';
              const data = embed.snapshot || {};
              suggestion = {
                id,
                type,
                title,
                subtitle: embed.subtitle || `${type} mention` ,
                data,
                lastUpdated: embed.ts || new Date().toISOString()
              };
              this.storeMentionData(id, suggestion);
            } catch (e) {
              console.warn('Failed to decode mention embed, skipping:', e);
              continue;
            }
          } else {
            // Legacy @[type:id:title]
            const type = legacyType;
            const id = legacyId;
            const title = legacyTitle.replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&#58;/g, ':');
            suggestion = this.mentionRegistry.get(id) || {
              id,
              type: type as any,
              title,
              subtitle: `${type} mention`,
              data: { code: type === 'class' ? id.split(':').pop() : undefined },
              lastUpdated: new Date().toISOString()
            } as SeqtaMentionItem;
          }

          if (!suggestion) continue;

                    // Create visual mention element
          const mention = this.createVisualMention(suggestion);
          // Attach embed meta if available
          if (b64) {
            (mention as HTMLElement).dataset.mentionMeta = b64;
          }
          
          replacements.push({
            start: match.index!,
            end: match.index! + fullMatch.length,
            element: mention
          });
        }

       // Apply replacements in reverse order to maintain indices
       replacements.reverse().forEach(replacement => {
         const range = document.createRange();
         range.setStart(textNode, replacement.start);
         range.setEnd(textNode, replacement.end);
         range.deleteContents();
         range.insertNode(replacement.element);
       });
     });
   }

     private applyMentionContent(target: HTMLElement, suggestion: SeqtaMentionItem) {
    // Clear and rebuild content with inline info
    target.innerHTML = '';
    const iconSpan = document.createElement('span');
    iconSpan.textContent = `${this.getMentionIcon(suggestion.type)} `;
    target.appendChild(iconSpan);
    const titleSpan = document.createElement('span');
    titleSpan.textContent = suggestion.title || '';
    target.appendChild(titleSpan);
    const info = this.getInlineInfoForMention(suggestion);
    if (info) {
      const infoSpan = document.createElement('span');
      infoSpan.textContent = info;
      infoSpan.className = 'ml-2 px-1.5 py-0.5 rounded bg-white/20 text-white/90 text-xs align-middle';
      infoSpan.style.marginLeft = '0.375rem';
      infoSpan.style.padding = '0.125rem 0.375rem';
      infoSpan.style.borderRadius = '0.25rem';
      infoSpan.style.background = 'rgba(255,255,255,0.2)';
      infoSpan.style.fontSize = '0.75rem';
      target.appendChild(infoSpan);
    }
  }

  private getInlineInfoForMention(s: SeqtaMentionItem): string | null {
    try {
      const data: any = s.data || {};
      if (s.type === 'assessment' || s.type === 'assignment') {
        const due = data.due || data.dueDate;
        if (!due) return null;
        const d = new Date(due);
        if (isNaN(d.getTime())) return null;
        const date = d.toLocaleDateString();
        const time = (typeof due === 'string' && due.includes('T')) ? d.toTimeString().substring(0,5) : '';
        return `Due: ${date}${time ? ' ' + time : ''}`;
      }
      if (s.type === 'class' || s.type === 'subject') {
        const teacher = data.teacher;
        if (teacher && typeof teacher === 'string') return teacher;
        return null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private createVisualMention(suggestion: SeqtaMentionItem): HTMLElement {
    const mention = document.createElement('span');
     mention.className = 'seqta-mention';
     mention.contentEditable = 'false';
     mention.dataset.mentionId = suggestion.id;
     mention.dataset.mentionType = suggestion.type;
     mention.dataset.mentionData = JSON.stringify(suggestion.data);
     
     mention.style.cssText = `
       display: inline-block;
       background: var(--accent-color, #3b82f6);
       color: white;
       padding: 0.125rem 0.5rem;
       border-radius: 0.375rem;
       font-size: 0.875rem;
       font-weight: 500;
       margin: 0 0.125rem;
       cursor: pointer;
       transition: all 0.2s;
     `;
     
           // Render content with inline info (due date, teacher, etc.)
      this.applyMentionContent(mention, suggestion);
     
     // Add click handler
     mention.addEventListener('click', (e) => {
       e.preventDefault();
       e.stopPropagation();
       // Pass the suggestion object directly to avoid JSON encoding issues
       this.handlePersistedMentionClick(mention, suggestion);
     });
     
     // Add hover effects
     mention.addEventListener('mouseenter', () => {
       mention.style.opacity = '0.8';
       mention.style.transform = 'scale(1.02)';
     });
     
     mention.addEventListener('mouseleave', () => {
       mention.style.opacity = '1';
       mention.style.transform = 'scale(1)';
     });
     
     return mention;
   }

     private convertVisualMentionsToText(element: HTMLElement) {
      const mentions = element.querySelectorAll('span.seqta-mention');
      
      mentions.forEach(mention => {
        const mentionId = mention.getAttribute('data-mention-id') || '';
        const mentionType = mention.getAttribute('data-mention-type') || '';
        const item = this.mentionRegistry.get(mentionId.replace(/[\n\r\t]/g, ''));
        const data = item?.data || {};
        const subtitle = this.formatMentionSubtitle(item?.type || mentionType, data);
        // Build new structured embed
        const toBase64Url = (obj: any) => {
          const json = JSON.stringify(obj);
          const utf8 = new TextEncoder().encode(json);
          let binary = '';
          utf8.forEach((b) => (binary += String.fromCharCode(b)));
          return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
        };
        const embed = {
          v: 1,
          type: item?.type || mentionType,
          id: mentionId,
          title: item?.title || '',
          subtitle,
          lookup: (() => {
            switch (item?.type || mentionType) {
              case 'class': return { programme: data.programme, metaclass: data.metaclass, code: data.code };
              case 'assignment':
              case 'assessment': return { id: data.id || mentionId, subject: data.subject || data.code };
              case 'subject': return { programme: data.programme, metaclass: data.metaclass, code: data.code };
              default: return {};
            }
          })(),
          snapshot: (() => {
            const base: any = {};
            ['id','title','subject','code','due','dueDate','teacher','programme','metaclass','lessons','room']
              .forEach(k=>{ if (data[k] !== undefined) base[k] = data[k]; });
            return base;
          })(),
          ts: new Date().toISOString()
        };
        const mentionText = `@[[${toBase64Url(embed)}]]`;
        const textNode = document.createTextNode(mentionText);
        mention.parentNode?.replaceChild(textNode, mention);
      });
    }

   private reinitializeMentions() {
     // Convert any text-based mentions to visual mentions
     this.convertTextMentionsToVisual();
   }

   // Add properties to track mention state
   private currentMentionDropdown: HTMLElement | null = null;
   private currentMentionKeyHandler: ((e: KeyboardEvent) => void) | null = null;
   private mentionSearchTimeout: number | null = null;
   private mentionRegistry: Map<string, SeqtaMentionItem> = new Map();
   private currentMentionModal: HTMLElement | null = null;

  public getActiveFormats(): Set<string> {
    const activeFormats = new Set<string>();
    
    if (document.queryCommandState('bold')) activeFormats.add('bold');
    if (document.queryCommandState('italic')) activeFormats.add('italic');
    if (document.queryCommandState('underline')) activeFormats.add('underline');
    if (document.queryCommandState('strikeThrough')) activeFormats.add('strikethrough');
    
    // Check for code formatting manually since queryCommandState doesn't handle it
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      
      // Walk up the DOM tree to find code elements
      while (node && node !== this.element) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (element.tagName === 'CODE') {
            activeFormats.add('code');
            break;
          }
        }
        const parentNode = node.parentNode;
        if (!parentNode) break;
        node = parentNode;
      }
    }
    
    return activeFormats;
  }

  public getCurrentBlockType(): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 'paragraph';

    const range = selection.getRangeAt(0);
    const currentElement = this.getBlockElement(range.startContainer);
    
    if (!currentElement) return 'paragraph';

    // Check if we're in a list first
    const parentList = this.findParentList(currentElement);
    if (parentList) {
      return parentList.tagName.toLowerCase() === 'ul' ? 'bullet-list' : 'numbered-list';
    }

    switch (currentElement.tagName.toLowerCase()) {
      case 'h1': return 'heading-1';
      case 'h2': return 'heading-2';
      case 'h3': return 'heading-3';
      case 'h4': return 'heading-4';
      case 'h5': return 'heading-5';
      case 'h6': return 'heading-6';
      case 'blockquote': return 'blockquote';
      case 'pre': return 'code-block';
      case 'code': 
        // Check if this code element is inside a pre (code block)
        const preParent = currentElement.closest('pre');
        if (preParent) return 'code-block';
        return 'paragraph';
      default: return 'paragraph';
    }
  }

  public destroy() {
    // Remove event listeners
    this.element.removeEventListener('input', this.handleInput.bind(this));
    this.element.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.element.removeEventListener('keyup', this.handleKeyUp.bind(this));
    this.element.removeEventListener('paste', this.handlePaste.bind(this));
    this.element.removeEventListener('focus', this.handleFocus.bind(this));
    this.element.removeEventListener('blur', this.handleBlur.bind(this));
    document.removeEventListener('selectionchange', this.handleSelectionChange.bind(this));

    this.isInitialized = false;
  }

  // Private helper methods
  public triggerChange() {
    // Clean up any orphaned format markers
    this.cleanupFormatMarkers();
    
    // Save to history (debounced to avoid too many history entries)
    this.debouncedSaveToHistory();
    
    if (this.options.onChange) {
      const content = this.getContent();
      this.options.onChange(content);
    }
  }

  private debouncedSaveToHistory = this.debounce(() => {
    this.saveToHistory();
  }, 500);

  private debounce(func: Function, wait: number) {
    let timeout: number;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  private updateCurrentSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      this.currentSelection = null;
      return;
    }

    // Only update if the selection is within our editor
    const range = selection.getRangeAt(0);
    if (!this.element.contains(range.commonAncestorContainer)) {
      this.currentSelection = null;
      return;
    }

    this.currentSelection = {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
      isCollapsed: selection.isCollapsed,
      rangeCount: selection.rangeCount
    };
  }

  private getBlockElement(node: Node): HTMLElement | null {
    let current = node;
    
    while (current && current !== this.element) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as HTMLElement;
        if (this.isBlockElement(element)) {
          return element;
        }
      }
      current = current.parentNode!;
    }
    
    return null;
  }

  private isBlockElement(element: HTMLElement): boolean {
    const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'BLOCKQUOTE', 'PRE', 'LI'];
    return blockTags.includes(element.tagName);
  }

  private isHeading(element: HTMLElement): boolean {
    return /^H[1-6]$/.test(element.tagName);
  }

  private isFormatActive(format: FormatType): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    // Check if the selection contains or is within a format element
    let node = range.startContainer;
    
    // If we have a selection, check all nodes within it
    if (!range.collapsed) {
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            const element = node as HTMLElement;
            if (this.isFormatElement(element, format) && range.intersectsNode(element)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      return walker.nextNode() !== null;
    }
    
    // For collapsed selection, check parent elements
    while (node && node !== this.element) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (this.isFormatElement(element, format)) {
          return true;
        }
      }
      const parentNode = node.parentNode;
      if (!parentNode) break;
      node = parentNode;
    }
    
    return false;
  }

  private applyFormat(format: FormatType, range: Range) {
    // Clone the range to avoid modifying the original
    const workingRange = range.cloneRange();
    
    // Extract the contents
    const contents = workingRange.extractContents();
    
    // Create the formatting element
    let element: HTMLElement;
    switch (format) {
      case 'bold':
        element = document.createElement('strong');
        break;
      case 'italic':
        element = document.createElement('em');
        break;
      case 'underline':
        element = document.createElement('u');
        break;
      case 'strikethrough':
        element = document.createElement('s');
        break;
      case 'code':
        element = document.createElement('code');
        break;
      default:
        return;
    }

    // Move the extracted contents into the formatting element
    element.appendChild(contents);
    
    // Insert the formatted element back into the range
    workingRange.insertNode(element);
    
    // Update the selection to encompass the new element
    const newRange = document.createRange();
    newRange.selectNodeContents(element);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private removeFormat(format: FormatType, range: Range) {
    // Save the original range
    const originalRange = range.cloneRange();
    
    if (range.collapsed) {
      // For collapsed selection, find and unwrap the closest format element
      let node = range.startContainer;
      while (node && node !== this.element) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (this.isFormatElement(element, format)) {
            this.unwrapElement(element);
            break;
          }
        }
        const parentNode = node.parentNode;
        if (!parentNode) break;
        node = parentNode;
      }
      return;
    }

    // For non-collapsed selection, find all format elements that intersect
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as HTMLElement;
          if (this.isFormatElement(element, format)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const elementsToProcess: HTMLElement[] = [];
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const element = node as HTMLElement;
      if (range.intersectsNode(element)) {
        elementsToProcess.push(element);
      }
    }

    // Process elements from innermost to outermost to avoid DOM disruption
    elementsToProcess.sort((a, b) => {
      if (a.contains(b)) return 1;
      if (b.contains(a)) return -1;
      return 0;
    });

    // Remove formatting by unwrapping elements
    elementsToProcess.forEach(element => {
      // Check if the element is fully within the selection
      const elementRange = document.createRange();
      elementRange.selectNodeContents(element);
      
      if (originalRange.compareBoundaryPoints(Range.START_TO_START, elementRange) <= 0 &&
          originalRange.compareBoundaryPoints(Range.END_TO_END, elementRange) >= 0) {
        // Fully selected - unwrap completely
        this.unwrapElement(element);
      } else {
        // Partially selected - need to split the element
        this.splitAndUnwrapElement(element, originalRange);
      }
    });
  }

  private splitAndUnwrapElement(element: HTMLElement, range: Range) {
    // This is a complex operation - for now, just unwrap the whole element
    // In a production app, you'd want to split the element at the range boundaries
    this.unwrapElement(element);
  }

  private isFormatElement(element: HTMLElement, format: FormatType): boolean {
    switch (format) {
      case 'bold':
        return element.tagName === 'STRONG' || element.tagName === 'B';
      case 'italic':
        return element.tagName === 'EM' || element.tagName === 'I';
      case 'underline':
        return element.tagName === 'U';
      case 'strikethrough':
        return element.tagName === 'S' || element.tagName === 'STRIKE';
      case 'code':
        return element.tagName === 'CODE';
      default:
        return false;
    }
  }

  private unwrapElement(element: HTMLElement) {
    const parent = element.parentNode;
    if (!parent) return;

    // Move all children to parent
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    
    // Remove the empty element
    parent.removeChild(element);
  }

  private insertLineBreak() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let range = selection.getRangeAt(0).cloneRange();

    // Guard: if start container has no parent (stale), relocate caret to a safe position in editor
    const startContainer = range.startContainer;
    if (!startContainer || (startContainer.nodeType === Node.TEXT_NODE && !startContainer.parentNode)) {
      this.element.focus();
      range = document.createRange();
      if (this.element.lastChild) {
        range.setStartAfter(this.element.lastChild);
      } else {
        range.setStart(this.element, 0);
      }
      range.collapse(true);
    }

    const br = document.createElement('br');
    // Ensure we insert into a node with a parent
    if (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode) {
      // ok
    } else if (range.startContainer.nodeType !== Node.TEXT_NODE && !(range.startContainer as Node).parentNode) {
      // Move to editor root if still detached
      range.setStart(this.element, 0);
    }

    range.insertNode(br);
    range.setStartAfter(br);
    range.setEndAfter(br);
    
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private insertParagraphAfter(element: HTMLElement) {
    const newParagraph = document.createElement('p');
    newParagraph.innerHTML = '<br>';
    
    element.parentNode?.insertBefore(newParagraph, element.nextSibling);
    
    // Move cursor to new paragraph
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(newParagraph, 0);
      range.setEnd(newParagraph, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private convertToParagraph(element: HTMLElement) {
    const newParagraph = document.createElement('p');
    newParagraph.innerHTML = '<br>';
    element.parentNode?.replaceChild(newParagraph, element);
    
    // Move cursor to new paragraph
    this.restoreSelectionInElement(newParagraph);
  }

  private setCursorToStart() {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(this.element, 0);
      range.setEnd(this.element, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private restoreSelectionInElement(element: HTMLElement) {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(element, 0);
      range.setEnd(element, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private parseHTMLToNodes(element: HTMLElement): any[] {
    return [];
  }

  private parseElementToNode(element: HTMLElement): any {
    return { type: 'paragraph', text: element.textContent || '', children: [] };
  }

  private renderNodesToHTML(nodes: any[]): string {
    return this.element.innerHTML;
  }

  private calculateMetadata(nodes: any[]) {
    const text = this.element.textContent || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return {
      word_count: words.length,
      character_count: text.length,
      seqta_references: []
    };
  }

  // History management methods
  private saveToHistory() {
    const currentContent = this.element.innerHTML;
    
    // Remove future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Add new state
    this.history.push(currentContent);
    this.historyIndex = this.history.length - 1;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      this.historyIndex = this.history.length - 1;
    }
  }

  public undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.element.innerHTML = this.history[this.historyIndex];
      this.triggerChange();
      return true;
    }
    return false;
  }

  public redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.element.innerHTML = this.history[this.historyIndex];
      this.triggerChange();
      return true;
    }
    return false;
  }

  // Selection management methods
  public saveSelection(): EditorSelection | null {
    this.updateCurrentSelection();
    return this.currentSelection;
  }

  public restoreSelection(selection: EditorSelection | null) {
    if (!selection) return false;

    const windowSelection = window.getSelection();
    if (!windowSelection) return false;

    try {
      windowSelection.removeAllRanges();
      
      const range = document.createRange();
      
      // Validate that the nodes are still in the document
      if (selection.anchorNode && 
          selection.focusNode && 
          this.element.contains(selection.anchorNode) &&
          this.element.contains(selection.focusNode)) {
        
        range.setStart(selection.anchorNode, selection.anchorOffset);
        range.setEnd(selection.focusNode, selection.focusOffset);
        
        windowSelection.addRange(range);
        return true;
      }
    } catch (error) {
      // Selection restoration failed, which can happen if DOM changed
      console.warn('Failed to restore selection:', error);
    }
    
    return false;
  }

  public selectAll() {
    const range = document.createRange();
    range.selectNodeContents(this.element);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  public collapseToEnd() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToEnd();
    }
  }

  public collapseToStart() {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.collapseToStart();
    }
  }

  public getSelectedText(): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    
    return selection.toString();
  }

  public replaceSelection(text: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    
    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // New tag-based formatting system
  private insertFormatToggle(format: FormatType) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const tagName = this.getFormatTagName(format);
    
    // Check if we're already inside this format
    if (this.isInsideFormatTag(format, range.startContainer)) {
      // Insert closing tag
      const closingTag = document.createTextNode(`</${tagName}>`);
      range.insertNode(closingTag);
      // Move cursor after the tag
      range.setStartAfter(closingTag);
      range.collapse(true);
    } else {
      // Insert opening tag
      const openingTag = document.createTextNode(`<${tagName}>`);
      range.insertNode(openingTag);
      // Move cursor after the tag
      range.setStartAfter(openingTag);
      range.collapse(true);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private isTagFormatActive(format: FormatType, range: Range): boolean {
    const tagName = this.getFormatTagName(format);
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    
    // Get the full text content of the editor
    const fullText = this.element.textContent || '';
    
    // Find the position of our selection in the full text
    const rangeText = range.toString();
    const startOffset = this.getTextOffsetInElement(range.startContainer, range.startOffset);
    const endOffset = startOffset + rangeText.length;
    
    // Look for tags around the selection
    const beforeText = fullText.substring(0, startOffset);
    const afterText = fullText.substring(endOffset);
    
    // Find the last opening tag before selection
    const lastOpenIndex = beforeText.lastIndexOf(openTag);
    // Find the first closing tag after selection  
    const firstCloseIndex = afterText.indexOf(closeTag);
    
    // Check if we have a matching pair around our selection
    if (lastOpenIndex !== -1 && firstCloseIndex !== -1) {
      // Make sure there's no closing tag between the open tag and our selection
      const betweenOpenAndSelection = beforeText.substring(lastOpenIndex + openTag.length);
      const hasCloseInBetween = betweenOpenAndSelection.includes(closeTag);
      
      return !hasCloseInBetween;
    }
    
    return false;
  }

  private applyTagFormat(format: FormatType, range: Range) {
    const tagName = this.getFormatTagName(format);
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    
    // Get the selected text
    const selectedText = range.toString();
    
    // Create the formatted text with tags
    const formattedText = `${openTag}${selectedText}${closeTag}`;
    
    // Replace the selection with the tagged text
    range.deleteContents();
    const textNode = document.createTextNode(formattedText);
    range.insertNode(textNode);
    
    // Update selection to encompass the content between tags
    const newRange = document.createRange();
    newRange.setStart(textNode, openTag.length);
    newRange.setEnd(textNode, openTag.length + selectedText.length);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private removeTagFormat(format: FormatType, range: Range) {
    const tagName = this.getFormatTagName(format);
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    
    const fullText = this.element.textContent || '';
    const startOffset = this.getTextOffsetInElement(range.startContainer, range.startOffset);
    const endOffset = startOffset + range.toString().length;
    
    const beforeText = fullText.substring(0, startOffset);
    const afterText = fullText.substring(endOffset);
    
    // Find the tags to remove
    const lastOpenIndex = beforeText.lastIndexOf(openTag);
    const firstCloseIndex = afterText.indexOf(closeTag);
    
    if (lastOpenIndex !== -1 && firstCloseIndex !== -1) {
      const globalCloseIndex = endOffset + firstCloseIndex;
      
      // Remove the tags by reconstructing the text
      const newText = fullText.substring(0, lastOpenIndex) + 
                     fullText.substring(lastOpenIndex + openTag.length, globalCloseIndex) + 
                     fullText.substring(globalCloseIndex + closeTag.length);
      
      // Replace the entire editor content
      this.element.textContent = newText;
      
      // Restore selection (adjusted for removed tags)
      const newStartOffset = lastOpenIndex;
      const newEndOffset = lastOpenIndex + (endOffset - startOffset);
      
      this.setSelectionByOffset(newStartOffset, newEndOffset);
    }
  }

  private isInsideFormatTag(format: FormatType, node: Node): boolean {
    const tagName = this.getFormatTagName(format);
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;
    
    const fullText = this.element.textContent || '';
    const currentOffset = this.getTextOffsetInElement(node, 0);
    const beforeText = fullText.substring(0, currentOffset);
    
    // Count opening and closing tags before this position
    const openMatches = beforeText.match(new RegExp(`<${tagName}>`, 'g'));
    const closeMatches = beforeText.match(new RegExp(`</${tagName}>`, 'g'));
    
    const openCount = openMatches ? openMatches.length : 0;
    const closeCount = closeMatches ? closeMatches.length : 0;
    
    return openCount > closeCount;
  }

  private getFormatTagName(format: FormatType): string {
    switch (format) {
      case 'bold': return 'bold';
      case 'italic': return 'italic';
      case 'underline': return 'underline';
      case 'strikethrough': return 'strikethrough';
      case 'code': return 'code';
      default: return format;
    }
  }

  private getTextOffsetInElement(node: Node, offset: number): number {
    let textOffset = 0;
    const walker = document.createTreeWalker(
      this.element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent?.length || 0;
    }
    
    return textOffset;
  }

  private setSelectionByOffset(startOffset: number, endOffset: number) {
    let currentOffset = 0;
    const walker = document.createTreeWalker(
      this.element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let startNode: Node | null = null;
    let startNodeOffset = 0;
    let endNode: Node | null = null;
    let endNodeOffset = 0;
    
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      const nodeLength = currentNode.textContent?.length || 0;
      
      if (!startNode && currentOffset + nodeLength >= startOffset) {
        startNode = currentNode;
        startNodeOffset = startOffset - currentOffset;
      }
      
      if (!endNode && currentOffset + nodeLength >= endOffset) {
        endNode = currentNode;
        endNodeOffset = endOffset - currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }
    
    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  public setFontSize(size: string): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
      // For collapsed selection, create a span and focus inside it
      const span = document.createElement('span');
      span.style.fontSize = size;
      span.textContent = '\u200B'; // Zero-width space
      range.insertNode(span);
      
      // Position cursor inside the span
      const newRange = document.createRange();
      newRange.setStart(span, 1);
      newRange.collapse(true);
      
      selection.removeAllRanges();
      selection.addRange(newRange);
      return true;
    }

    // Apply font size to selected text using HTML
    this.applyFontSizeToSelection(size, range);
    this.triggerChange();
    return true;
  }

  private insertFontSizeToggle(size: string) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Check if we're already inside a font size tag
    if (this.isInsideFontSizeTag(range.startContainer)) {
      // Insert closing tag
      const closingTag = document.createTextNode(`</fontsize>`);
      range.insertNode(closingTag);
      range.setStartAfter(closingTag);
      range.collapse(true);
    } else {
      // Insert opening tag with size
      const openingTag = document.createTextNode(`<fontsize="${size}">`);
      range.insertNode(openingTag);
      range.setStartAfter(openingTag);
      range.collapse(true);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private applyFontSizeToSelection(size: string, range: Range) {
    // Get the selected text
    const selectedText = range.toString();
    
    // Create a span element with the font size
    const span = document.createElement('span');
    span.style.fontSize = size;
    span.textContent = selectedText;
    
    // Replace the selection with the styled span
    range.deleteContents();
    range.insertNode(span);
    
    // Update selection to encompass the new span
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private isInsideFontSizeTag(node: Node): boolean {
    const fullText = this.element.textContent || '';
    const currentOffset = this.getTextOffsetInElement(node, 0);
    const beforeText = fullText.substring(0, currentOffset);
    
    // Count opening and closing font size tags before this position
    const openMatches = beforeText.match(/<fontsize="[^"]*">/g);
    const closeMatches = beforeText.match(/<\/fontsize>/g);
    
    const openCount = openMatches ? openMatches.length : 0;
    const closeCount = closeMatches ? closeMatches.length : 0;
    
    return openCount > closeCount;
  }

  // Improved formatting methods
  private applyFormatReliably(format: FormatType, range: Range) {
    // Save the selection
    const selectedText = range.toString();
    
    if (!selectedText) {
      // For collapsed selection, just use execCommand
      const commandMap: { [key in FormatType]?: string } = {
        'bold': 'bold',
        'italic': 'italic',
        'underline': 'underline',
        'strikethrough': 'strikeThrough'
      };
      
      const command = commandMap[format];
      if (command) {
        document.execCommand(command);
      } else if (format === 'code') {
        // Custom handling for code
        this.applyFormat(format, range);
      }
      return;
    }

    // For selections with text, use the existing reliable method
    this.applyFormat(format, range);
  }

  private cleanupFormattingInRange(range: Range, excludeFormat: FormatType) {
    // This method would clean up formatting while preserving other formats
    // For now, we'll just restore the selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  // Cursor-based formatting methods
  private insertFormattingEndMarker(format: FormatType, range: Range) {
    // Create an invisible marker to "close" the formatting
    const marker = document.createElement('span');
    marker.className = 'format-end-marker';
    marker.setAttribute('data-format', format);
    marker.textContent = '\u200B'; // Zero-width space
    
    // Insert the marker at cursor position
    range.insertNode(marker);
    
    // Position cursor after the marker
    const newRange = document.createRange();
    newRange.setStartAfter(marker);
    newRange.collapse(true);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    
    // Remove any parent formatting elements by breaking out of them
    this.breakOutOfFormattingContext(format, marker);
  }

  private insertFormattingStartMarker(format: FormatType, range: Range) {
    // Create a formatting element to start formatting
    let element: HTMLElement;
    
    switch (format) {
      case 'bold':
        element = document.createElement('strong');
        break;
      case 'italic':
        element = document.createElement('em');
        break;
      case 'underline':
        element = document.createElement('u');
        break;
      case 'strikethrough':
        element = document.createElement('s');
        break;
      case 'code':
        element = document.createElement('code');
        break;
      default:
        return;
    }
    
    // Add a zero-width space to make the element "active"
    element.textContent = '\u200B';
    
    // Insert the element at cursor position
    range.insertNode(element);
    
    // Position cursor inside the element
    const newRange = document.createRange();
    newRange.setStart(element, 1);
    newRange.collapse(true);
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private removeFormatFromSelection(format: FormatType, range: Range) {
    // Find all format elements within the selection and unwrap them
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as HTMLElement;
          if (this.isFormatElement(element, format) && range.intersectsNode(element)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    const elementsToRemove: HTMLElement[] = [];
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      elementsToRemove.push(node as HTMLElement);
    }

    // Remove formatting by unwrapping elements
    elementsToRemove.forEach(element => {
      this.unwrapElement(element);
    });
  }

  private breakOutOfFormattingContext(format: FormatType, marker: Node) {
    // Find the parent formatting element and split it
    let parent = marker.parentNode;
    while (parent && parent !== this.element) {
      if (parent.nodeType === Node.ELEMENT_NODE) {
        const element = parent as HTMLElement;
        if (this.isFormatElement(element, format)) {
          // Split the formatting element at the marker position
          this.splitFormattingElement(element, marker);
          break;
        }
      }
      parent = parent.parentNode;
    }
  }

  private splitFormattingElement(element: HTMLElement, splitPoint: Node) {
    // Create a new element of the same type for content after split point
    const newElement = element.cloneNode(false) as HTMLElement;
    
    // Move all nodes after the split point to the new element
    let currentNode = splitPoint.nextSibling;
    while (currentNode) {
      const nextNode = currentNode.nextSibling;
      newElement.appendChild(currentNode);
      currentNode = nextNode;
    }
    
    // Insert the new element after the original
    if (element.parentNode) {
      element.parentNode.insertBefore(newElement, element.nextSibling);
    }
    
    // Remove the split point (marker) from the original element
    if (splitPoint.parentNode === element) {
      element.removeChild(splitPoint);
    }
    
    // If the original element is now empty, remove it
    if (!element.textContent || element.textContent === '\u200B') {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  }

  // Method to process content and render formatting tags as HTML
  public processContentForDisplay(): void {
    const rawContent = this.element.textContent || '';
    const processedHTML = this.convertTagsToHTML(rawContent);
    this.element.innerHTML = processedHTML;
  }

  private convertTagsToHTML(text: string): string {
    let html = text;
    
    // Process formatting tags
    html = html.replace(/<bold>(.*?)<\/bold>/g, '<strong>$1</strong>');
    html = html.replace(/<italic>(.*?)<\/italic>/g, '<em>$1</em>');
    html = html.replace(/<underline>(.*?)<\/underline>/g, '<u>$1</u>');
    html = html.replace(/<strikethrough>(.*?)<\/strikethrough>/g, '<s>$1</s>');
    html = html.replace(/<code>(.*?)<\/code>/g, '<code>$1</code>');
    
    // Process font size tags
    html = html.replace(/<fontsize="([^"]*)">(.*?)<\/fontsize>/g, '<span style="font-size: $1">$2</span>');
    
    // Convert line breaks to <br> tags
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  // Method to get raw content with tags for saving
  public getRawContent(): string {
    return this.element.textContent || '';
  }

  // Method to convert content from raw tags to HTML when loading
  public loadContentFromRaw(rawContent: string): void {
    if (rawContent.includes('<bold>') || rawContent.includes('<italic>') || rawContent.includes('<fontsize=')) {
      const processedHTML = this.convertTagsToHTML(rawContent);
      this.element.innerHTML = processedHTML;
    } else {
      this.element.textContent = rawContent;
    }
    
    this.makeExistingImagesResizable();
    this.triggerChange();
  }

  // Cleanup method for format markers
  private cleanupFormatMarkers() {
    const markers = this.element.querySelectorAll('.format-end-marker');
    markers.forEach(marker => {
      // Check if marker is still needed (has content after it in the same context)
      const nextSibling = marker.nextSibling;
      if (!nextSibling || (nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent?.trim())) {
        // Remove orphaned markers
        marker.remove();
      }
    });

    // Also clean up empty formatting elements with only zero-width spaces
    const formatElements = this.element.querySelectorAll('strong, em, u, s, code');
    formatElements.forEach(element => {
      if (element.textContent === '\u200B' && !element.nextSibling) {
        // Remove empty formatting elements at the end
        element.remove();
      }
    });
  }

  private toggleCodeFormat(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const isActive = this.isFormatActive('code');

    if (isActive) {
      // Remove code formatting
      this.removeFormat('code', range);
    } else {
      // Apply code formatting
      this.applyFormat('code', range);
    }
  }

  // Convert HTML tags to custom tags for saving
  private convertHTMLToCustomTags(html: string): string {
    let result = html;
    
    // Convert HTML formatting tags to custom tags
    result = result.replace(/<strong>(.*?)<\/strong>/g, '<bold>$1</bold>');
    result = result.replace(/<b>(.*?)<\/b>/g, '<bold>$1</bold>');
    result = result.replace(/<em>(.*?)<\/em>/g, '<italic>$1</italic>');
    result = result.replace(/<i>(.*?)<\/i>/g, '<italic>$1</italic>');
    result = result.replace(/<u>(.*?)<\/u>/g, '<underline>$1</underline>');
    result = result.replace(/<s>(.*?)<\/s>/g, '<strikethrough>$1</strikethrough>');
    result = result.replace(/<code>(.*?)<\/code>/g, '<code>$1</code>');
    result = result.replace(/<span style="font-size:\s*([^"]*)">(.*?)<\/span>/g, '<fontsize="$1">$2</fontsize>');
    
    return result;
  }

  // Convert custom tags back to HTML for display
  private convertCustomTagsToHTML(content: string): string {
    let result = content;
    
    // Convert custom tags back to HTML
    result = result.replace(/<bold>(.*?)<\/bold>/g, '<strong>$1</strong>');
    result = result.replace(/<italic>(.*?)<\/italic>/g, '<em>$1</em>');
    result = result.replace(/<underline>(.*?)<\/underline>/g, '<u>$1</u>');
    result = result.replace(/<strikethrough>(.*?)<\/strikethrough>/g, '<s>$1</s>');
    result = result.replace(/<fontsize="([^"]*)">(.*?)<\/fontsize>/g, '<span style="font-size: $1">$2</span>');
    
    return result;
  }
} 