// Core editor types
// Removed EditorDocument and node-based types since we store pure HTML

// SEQTA Integration types
export interface SeqtaReference {
  type: SeqtaReferenceType;
  id: string;
  display_name: string;
  cached_data?: any;
  last_synced?: string;
}

export type SeqtaReferenceType = 
  | 'subject' 
  | 'assessment' 
  | 'teacher' 
  | 'class' 
  | 'assignment' 
  | 'portal';

// Editor configuration
export interface EditorOptions {
  placeholder?: string;
  readonly?: boolean;
  onChange?: (content: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSelectionChange?: (selection: EditorSelection) => void;
  onImageClick?: (element: HTMLElement, img: HTMLImageElement) => void;
  noteId?: string;
}

// Selection and range types
export interface EditorSelection {
  anchorNode: Node | null;
  anchorOffset: number;
  focusNode: Node | null;
  focusOffset: number;
  isCollapsed: boolean;
  rangeCount: number;
}

export interface EditorRange {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
  collapsed: boolean;
}

// Formatting types
export type FormatType = 
  | 'bold' 
  | 'italic' 
  | 'underline' 
  | 'strikethrough'
  | 'code'
  | 'highlight'
  | 'subscript'
  | 'superscript';

export type BlockType = 
  | 'paragraph' 
  | 'heading-1' 
  | 'heading-2' 
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'blockquote'
  | 'code-block'
  | 'ordered-list'
  | 'unordered-list';

// Command types
export interface EditorCommand {
  name: string;
  execute: (editor: any, value?: any) => boolean;
  canExecute?: (editor: any) => boolean;
  isActive?: (editor: any) => boolean;
}

// Plugin types
export interface EditorPlugin {
  name: string;
  initialize: (editor: any) => void;
  handleKeyPress?: (event: KeyboardEvent) => boolean;
  handleInput?: (event: InputEvent) => boolean;
  handlePaste?: (event: ClipboardEvent) => boolean;
  destroy?: () => void;
}

// Event types
export interface EditorSelectionChangeEvent {
  selection: EditorSelection;
  range: EditorRange | null;
}

// Toolbar types
export interface ToolbarButton {
  name: string;
  label: string;
  icon?: string;
  command: string;
  value?: any;
  type: 'button' | 'dropdown' | 'color-picker';
  group?: string;
  shortcut?: string;
}

export interface ToolbarGroup {
  name: string;
  buttons: ToolbarButton[];
}

// Export/Import types
export type ExportFormat = 'markdown' | 'html' | 'pdf' | 'json';
export type ImportFormat = 'markdown' | 'html' | 'json';

// Note management types
export interface Note {
  id: string;
  title: string;
  content: string; // Raw HTML content with custom tags
  folder_path: string[];
  tags: string[];
  seqta_references: SeqtaReference[];
  created_at: string;
  updated_at: string;
  last_accessed: string;
  metadata: NoteMetadata;
}

export interface NoteMetadata {
  word_count: number;
  character_count: number;
  reading_time: number; // in minutes
  last_auto_save?: string;
  version: number;
}

export interface NoteFolder {
  id: string;
  name: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

// Search types (deduplicated to match backend)
export interface SearchFilters {
  folder_ids?: string[];
  tags?: string[];
  date_from?: string;
  date_to?: string;
  word_count_min?: number;
  word_count_max?: number;
  has_seqta_references?: boolean;
}

export interface SearchResult {
  note: Note;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: string; // "title", "content", "tags", "seqta_references"
  snippet: string;
  position: number;
} 