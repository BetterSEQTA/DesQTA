import { invoke } from '@tauri-apps/api/core';
import type { 
  Note, 
  NoteFolder, 
  NoteMetadata,
  SeqtaReference,
  SearchResult,
  SearchFilters
} from '../components/notes/types/editor';

export class NotesService {
  /**
   * Load all notes from the backend
   */
  static async loadNotes(): Promise<Note[]> {
    try {
      return await invoke<Note[]>('load_notes');
    } catch (error) {
      console.error('Failed to load notes:', error);
      throw new Error(`Failed to load notes: ${error}`);
    }
  }

  /**
   * Save a note to the backend
   */
  static async saveNote(note: Note): Promise<void> {
    try {
      await invoke('save_note', { note });
    } catch (error) {
      console.error('Failed to save note:', error);
      throw new Error(`Failed to save note: ${error}`);
    }
  }

  /**
   * Create a new note with default values
   */
  static async createNote(title: string = 'Untitled Note', folderId: string = 'default'): Promise<Note> {
    const now = new Date().toISOString();
    const noteId = crypto.randomUUID();

    const note: Note = {
      id: noteId,
      title,
      content: '<p><br></p>', // Simple HTML content
      folder_path: [folderId],
      tags: [],
      seqta_references: [],
      created_at: now,
      updated_at: now,
      last_accessed: now,
      metadata: {
        word_count: 0,
        character_count: 0,
        reading_time: 0,
        version: 1
      }
    };

    await this.saveNote(note);
    return note;
  }

  /**
   * Update an existing note's content
   */
  static async updateNoteContent(noteId: string, content: string): Promise<void> {
    try {
      // First get the existing note
      const existingNote = await this.getNote(noteId);
      if (!existingNote) {
        throw new Error('Note not found');
      }

      // Update the content and metadata
      const now = new Date().toISOString();
      
      // Calculate word count from HTML content
      const textContent = content.replace(/<[^>]*>/g, '').trim();
      const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
      
      const updatedNote: Note = {
        ...existingNote,
        content,
        updated_at: now,
        last_accessed: now,
        metadata: {
          ...existingNote.metadata,
          word_count: wordCount,
          character_count: textContent.length,
          reading_time: Math.ceil(wordCount / 200), // 200 words per minute
          version: existingNote.metadata.version + 1
        }
      };

      await this.saveNote(updatedNote);
    } catch (error) {
      console.error('Failed to update note content:', error);
      throw new Error(`Failed to update note content: ${error}`);
    }
  }

  /**
   * Delete a note
   */
  static async deleteNote(noteId: string): Promise<void> {
    try {
      await invoke('delete_note', { noteId });
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw new Error(`Failed to delete note: ${error}`);
    }
  }

  /**
   * Get a specific note by ID
   */
  static async getNote(noteId: string): Promise<Note | null> {
    try {
      return await invoke<Note | null>('get_note', { noteId });
    } catch (error) {
      console.error('Failed to get note:', error);
      throw new Error(`Failed to get note: ${error}`);
    }
  }

  /**
   * Search notes by query
   */
  static async searchNotes(query: string): Promise<Note[]> {
    try {
      return await invoke<Note[]>('search_notes', { query });
    } catch (error) {
      console.error('Failed to search notes:', error);
      throw new Error(`Failed to search notes: ${error}`);
    }
  }

  /**
   * Advanced search with filters and scoring
   */
  static async searchNotesAdvanced(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
    try {
      return await invoke<SearchResult[]>('search_notes_advanced', { query, filters });
    } catch (error) {
      console.error('Failed to perform advanced search:', error);
      throw new Error(`Failed to perform advanced search: ${error}`);
    }
  }

  /**
   * Save image from base64 data to filesystem
   */
  static async saveImageFromBase64(noteId: string, imageData: string, filename: string): Promise<string> {
    try {
      return await invoke<string>('save_image_from_base64', { noteId, imageData, filename });
    } catch (error) {
      console.error('Failed to save image:', error);
      throw new Error(`Failed to save image: ${error}`);
    }
  }

  /**
   * Get full path for image file
   */
  static async getImagePath(relativePath: string): Promise<string> {
    try {
      return await invoke<string>('get_image_path', { relativePath });
    } catch (error) {
      console.error('Failed to get image path:', error);
      throw new Error(`Failed to get image path: ${error}`);
    }
  }

  /**
   * Delete all images for a note
   */
  static async deleteNoteImages(noteId: string): Promise<void> {
    try {
      await invoke('delete_note_images', { noteId });
    } catch (error) {
      console.error('Failed to delete note images:', error);
      throw new Error(`Failed to delete note images: ${error}`);
    }
  }

  /**
   * Clean up unused images
   */
  static async cleanupUnusedImages(): Promise<number> {
    try {
      return await invoke<number>('cleanup_unused_images');
    } catch (error) {
      console.error('Failed to cleanup unused images:', error);
      throw new Error(`Failed to cleanup unused images: ${error}`);
    }
  }

  /**
   * Load all folders
   */
  static async loadFolders(): Promise<NoteFolder[]> {
    try {
      return await invoke<NoteFolder[]>('load_folders');
    } catch (error) {
      console.error('Failed to load folders:', error);
      throw new Error(`Failed to load folders: ${error}`);
    }
  }

  /**
   * Create a new folder
   */
  static async createFolder(name: string, parentId?: string): Promise<string> {
    try {
      const now = new Date().toISOString();
      const folder: NoteFolder = {
        id: crypto.randomUUID(),
        name,
        parent_id: parentId,
        auto_generated: false,
        created_at: now,
        updated_at: now
      };

      return await invoke<string>('create_folder', { folder });
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw new Error(`Failed to create folder: ${error}`);
    }
  }

  /**
   * Delete a folder
   */
  static async deleteFolder(folderId: string): Promise<void> {
    try {
      await invoke('delete_folder', { folderId });
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw new Error(`Failed to delete folder: ${error}`);
    }
  }

  /**
   * Move a note to a different folder
   */
  static async moveNoteToFolder(noteId: string, folderId: string): Promise<void> {
    try {
      await invoke('move_note_to_folder', { noteId, folderId });
    } catch (error) {
      console.error('Failed to move note to folder:', error);
      throw new Error(`Failed to move note to folder: ${error}`);
    }
  }

  /**
   * Get notes statistics
   */
  static async getNotesStats(): Promise<{
    total_notes: number;
    total_words: number;
    total_folders: number;
    database_version: string;
  }> {
    try {
      return await invoke('get_notes_stats');
    } catch (error) {
      console.error('Failed to get notes stats:', error);
      throw new Error(`Failed to get notes stats: ${error}`);
    }
  }

  /**
   * Backup notes database
   */
  static async backupNotes(): Promise<string> {
    try {
      return await invoke<string>('backup_notes');
    } catch (error) {
      console.error('Failed to backup notes:', error);
      throw new Error(`Failed to backup notes: ${error}`);
    }
  }

  /**
   * Restore notes from backup
   */
  static async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      await invoke('restore_notes_from_backup', { backupPath });
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw new Error(`Failed to restore from backup: ${error}`);
    }
  }

  /**
   * Auto-save functionality with debouncing
   */
  private static autoSaveTimeouts: Map<string, number> = new Map();

  static scheduleAutoSave(noteId: string, content: string, delay: number = 2000): void {
    // Clear existing timeout for this note
    const existingTimeout = this.autoSaveTimeouts.get(noteId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new auto-save
    const timeout = setTimeout(async () => {
      try {
        await this.updateNoteContent(noteId, content);
        console.log(`Auto-saved note: ${noteId}`);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        this.autoSaveTimeouts.delete(noteId);
      }
    }, delay);

    this.autoSaveTimeouts.set(noteId, timeout);
  }

  /**
   * Cancel pending auto-save for a note
   */
  static cancelAutoSave(noteId: string): void {
    const timeout = this.autoSaveTimeouts.get(noteId);
    if (timeout) {
      clearTimeout(timeout);
      this.autoSaveTimeouts.delete(noteId);
    }
  }
} 