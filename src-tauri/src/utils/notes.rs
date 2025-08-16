use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle};
use base64::{Engine as _, engine::general_purpose};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeqtaReference {
    #[serde(rename = "type")]
    pub ref_type: String, // 'subject' | 'assessment' | 'teacher' | 'class' | 'assignment' | 'portal'
    pub id: String,
    pub display_name: String,
    #[serde(default)]
    pub cached_data: Option<serde_json::Value>,
    #[serde(default)]
    pub last_synced: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub word_count: u32,
    pub character_count: u32,
    pub reading_time: u32, // in minutes
    #[serde(default)]
    pub last_auto_save: Option<String>,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String, // Raw HTML content with custom tags
    pub folder_path: Vec<String>,
    pub tags: Vec<String>,
    pub seqta_references: Vec<SeqtaReference>,
    pub created_at: String,
    pub updated_at: String,
    pub last_accessed: String,
    pub metadata: NoteMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteFolder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    pub auto_generated: bool, // true for SEQTA-synced folders
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotesSettings {
    pub auto_save_interval: u32, // seconds
    pub default_folder: String,
    pub backup_enabled: bool,
    pub max_backups: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotesDatabase {
    pub notes: Vec<Note>,
    pub folders: Vec<NoteFolder>,
    pub settings: NotesSettings,
    pub version: String,
}

impl NotesDatabase {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for NotesDatabase {
    fn default() -> Self {
        Self {
            notes: Vec::new(),
            folders: vec![
                NoteFolder {
                    id: "default".to_string(),
                    name: "My Notes".to_string(),
                    parent_id: None,
                    color: None,
                    icon: Some("📝".to_string()),
                    auto_generated: false,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                }
            ],
            settings: NotesSettings {
                auto_save_interval: 30,
                default_folder: "default".to_string(),
                backup_enabled: true,
                max_backups: 10,
            },
            version: "1.0".to_string(),
        }
    }
}

/// Location strategy mirrors settings.rs and todolist.rs:
/// - Android: /data/data/com.desqta.app/files/DesQTA/notes.json
/// - Other platforms: <OS data dir>/DesQTA/notes.json
fn notes_file_path(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("notes.json");
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("notes.json");
        Ok(dir)
    }
}

fn ensure_parent_dir(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create data dir: {}", e))?;
    }
    Ok(())
}

// Removed legacy migration structures and conversion functions
fn load_notes_database(app: &AppHandle) -> Result<NotesDatabase, String> {
    let path = notes_file_path(app)?;
    if !path.exists() {
        return Ok(NotesDatabase::default());
    }
    
    let mut file = File::open(&path).map_err(|e| format!("Failed to open notes file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read notes file: {}", e))?;
    
    if contents.trim().is_empty() {
        return Ok(NotesDatabase::default());
    }
    
    // Parse as current format only
    let database: NotesDatabase = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse notes database (current format): {}", e))?;
    Ok(database)
}

fn save_notes_database(app: &AppHandle, database: &NotesDatabase) -> Result<(), String> {
    let path = notes_file_path(app)?;
    ensure_parent_dir(&path)?;
    
    let json = serde_json::to_string_pretty(database)
        .map_err(|e| format!("Failed to serialize notes database: {}", e))?;
    
    let mut file = File::create(&path).map_err(|e| format!("Failed to create notes file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write notes file: {}", e))?;
    
    Ok(())
}

// Tauri Commands

#[tauri::command]
pub fn load_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    let database = load_notes_database(&app)?;
    Ok(database.notes)
}

#[tauri::command]
pub fn save_note(app: AppHandle, note: Note) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    
    // Find existing note or add new one
    if let Some(existing_index) = database.notes.iter().position(|n| n.id == note.id) {
        database.notes[existing_index] = note;
    } else {
        database.notes.push(note);
    }
    
    save_notes_database(&app, &database)?;
    Ok(())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, note_id: String) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    database.notes.retain(|note| note.id != note_id);
    save_notes_database(&app, &database)?;
    Ok(())
}

#[tauri::command]
pub fn get_note(app: AppHandle, note_id: String) -> Result<Option<Note>, String> {
    let database = load_notes_database(&app)?;
    Ok(database.notes.into_iter().find(|note| note.id == note_id))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub note: Note,
    pub score: f32,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub field: String, // "title", "content", "tags", "seqta_references"
    pub snippet: String,
    pub position: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub folder_ids: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub word_count_min: Option<u32>,
    pub word_count_max: Option<u32>,
    pub has_seqta_references: Option<bool>,
}

#[tauri::command]
pub fn search_notes(app: AppHandle, query: String) -> Result<Vec<Note>, String> {
    let database = load_notes_database(&app)?;
    let query_lower = query.to_lowercase();
    
    let matching_notes: Vec<Note> = database.notes
        .into_iter()
        .filter(|note| {
            note.title.to_lowercase().contains(&query_lower) ||
            note.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower)) ||
            // Search in content text (HTML content)
            note.content.to_lowercase().contains(&query_lower)
        })
        .collect();
    
    Ok(matching_notes)
}

#[tauri::command]
pub fn search_notes_advanced(
    app: AppHandle, 
    query: String, 
    filters: Option<SearchFilters>
) -> Result<Vec<SearchResult>, String> {
    let database = load_notes_database(&app)?;
    let query_lower = query.trim().to_lowercase();
    
    if query_lower.is_empty() {
        return Ok(vec![]);
    }
    
    let search_terms: Vec<&str> = query_lower.split_whitespace().collect();
    let mut results: Vec<SearchResult> = Vec::new();
    
    for note in database.notes {
        // Apply folder filter
        if let Some(ref f) = filters {
            if let Some(ref folder_ids) = f.folder_ids {
                if !folder_ids.iter().any(|fid| note.folder_path.contains(fid)) {
                    continue;
                }
            }
            
            // Apply tag filter
            if let Some(ref filter_tags) = f.tags {
                if !filter_tags.iter().any(|tag| note.tags.contains(tag)) {
                    continue;
                }
            }
            
            // Apply date filters
            if let Some(ref date_from) = f.date_from {
                if note.created_at < *date_from {
                    continue;
                }
            }
            
            if let Some(ref date_to) = f.date_to {
                if note.created_at > *date_to {
                    continue;
                }
            }
            
            // Apply word count filters
            if let Some(min_words) = f.word_count_min {
                if note.metadata.word_count < min_words {
                    continue;
                }
            }
            
            if let Some(max_words) = f.word_count_max {
                if note.metadata.word_count > max_words {
                    continue;
                }
            }
            
            // Apply SEQTA references filter
            if let Some(has_seqta) = f.has_seqta_references {
                let note_has_seqta = !note.seqta_references.is_empty();
                if has_seqta != note_has_seqta {
                    continue;
                }
            }
        }
        
        let mut score = 0.0f32;
        let mut matches = Vec::new();
        
        // Search in title (highest weight)
        let title_lower = note.title.to_lowercase();
        for term in &search_terms {
            if title_lower.contains(term) {
                score += 10.0;
                if let Some(pos) = title_lower.find(term) {
                    matches.push(SearchMatch {
                        field: "title".to_string(),
                        snippet: highlight_match(&note.title, term, pos),
                        position: pos,
                    });
                }
            }
        }
        
        // Search in tags (high weight)
        for tag in &note.tags {
            let tag_lower = tag.to_lowercase();
            for term in &search_terms {
                if tag_lower.contains(term) {
                    score += 5.0;
                    matches.push(SearchMatch {
                        field: "tags".to_string(),
                        snippet: tag.clone(),
                        position: 0,
                    });
                }
            }
        }
        
        // Search in content (medium weight)
        let content_text = strip_html_tags(&note.content);
        let content_lower = content_text.to_lowercase();
        for term in &search_terms {
            if content_lower.contains(term) {
                score += 2.0;
                if let Some(pos) = content_lower.find(term) {
                    matches.push(SearchMatch {
                        field: "content".to_string(),
                        snippet: create_snippet(&content_text, term, pos),
                        position: pos,
                    });
                }
            }
        }
        
        // Search in SEQTA references (low weight)
        for seqta_ref in &note.seqta_references {
            let display_name_lower = seqta_ref.display_name.to_lowercase();
            for term in &search_terms {
                if display_name_lower.contains(term) {
                    score += 1.0;
                    matches.push(SearchMatch {
                        field: "seqta_references".to_string(),
                        snippet: seqta_ref.display_name.clone(),
                        position: 0,
                    });
                }
            }
        }
        
        // Boost score for exact matches
        if title_lower == query_lower {
            score += 20.0;
        }
        
        // Boost score for matches at the beginning
        if title_lower.starts_with(&query_lower) {
            score += 5.0;
        }
        
        // Only include notes with matches
        if score > 0.0 {
            results.push(SearchResult {
                note,
                score,
                matches,
            });
        }
    }
    
    // Sort by score (descending) and then by update date (descending)
    results.sort_by(|a, b| {
        b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.note.updated_at.cmp(&a.note.updated_at))
    });
    
    Ok(results)
}

fn highlight_match(text: &str, term: &str, position: usize) -> String {
    let start = position.saturating_sub(20);
    let end = (position + term.len() + 20).min(text.len());
    let snippet = &text[start..end];
    
    if start > 0 {
        format!("...{}", snippet)
    } else if end < text.len() {
        format!("{}...", snippet)
    } else {
        snippet.to_string()
    }
}

fn create_snippet(text: &str, term: &str, position: usize) -> String {
    let start = position.saturating_sub(50);
    let end = (position + term.len() + 50).min(text.len());
    let snippet = &text[start..end];
    
    let prefix = if start > 0 { "..." } else { "" };
    let suffix = if end < text.len() { "..." } else { "" };
    
    format!("{}{}{}", prefix, snippet, suffix)
}

fn strip_html_tags(html: &str) -> String {
    // Simple HTML tag removal
    let mut result = String::new();
    let mut in_tag = false;
    
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(ch),
            _ => {} // Skip characters inside tags
        }
    }
    
    result
}

// Folder management

#[tauri::command]
pub fn load_folders(app: AppHandle) -> Result<Vec<NoteFolder>, String> {
    let database = load_notes_database(&app)?;
    Ok(database.folders)
}

#[tauri::command]
pub fn create_folder(app: AppHandle, folder: NoteFolder) -> Result<String, String> {
    let mut database = load_notes_database(&app)?;
    
    // Check if folder ID already exists
    if database.folders.iter().any(|f| f.id == folder.id) {
        return Err("Folder with this ID already exists".to_string());
    }
    
    let folder_id = folder.id.clone();
    database.folders.push(folder);
    save_notes_database(&app, &database)?;
    
    Ok(folder_id)
}

#[tauri::command]
pub fn delete_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    
    // Don't allow deleting the default folder
    if folder_id == "default" {
        return Err("Cannot delete the default folder".to_string());
    }
    
    // Move notes from deleted folder to default
    for note in &mut database.notes {
        if note.folder_path.contains(&folder_id) {
            note.folder_path = vec!["default".to_string()];
            note.updated_at = chrono::Utc::now().to_rfc3339();
        }
    }
    
    // Remove the folder
    database.folders.retain(|folder| folder.id != folder_id);
    save_notes_database(&app, &database)?;
    
    Ok(())
}

#[tauri::command]
pub fn move_note_to_folder(app: AppHandle, note_id: String, folder_id: String) -> Result<(), String> {
    let mut database = load_notes_database(&app)?;
    
    // Verify folder exists
    if !database.folders.iter().any(|f| f.id == folder_id) {
        return Err("Target folder does not exist".to_string());
    }
    
    // Find and update note
    if let Some(note) = database.notes.iter_mut().find(|n| n.id == note_id) {
        note.folder_path = vec![folder_id];
        note.updated_at = chrono::Utc::now().to_rfc3339();
    } else {
        return Err("Note not found".to_string());
    }
    
    save_notes_database(&app, &database)?;
    Ok(())
}

// Utility functions

#[tauri::command]
pub fn get_notes_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    let database = load_notes_database(&app)?;
    
    let total_notes = database.notes.len();
    let total_words: u32 = database.notes.iter().map(|n| n.metadata.word_count).sum();
    let total_folders = database.folders.len();
    
    let stats = serde_json::json!({
        "total_notes": total_notes,
        "total_words": total_words,
        "total_folders": total_folders,
        "database_version": database.version
    });
    
    Ok(stats)
}

#[tauri::command]
pub fn backup_notes(app: AppHandle) -> Result<String, String> {
    let database = load_notes_database(&app)?;
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    
    #[cfg(target_os = "android")]
    let backup_dir = PathBuf::from("/data/data/com.desqta.app/files/DesQTA/backups");
    #[cfg(not(target_os = "android"))]
    let backup_dir = dirs_next::data_dir()
        .ok_or_else(|| "Unable to determine data dir".to_string())?
        .join("DesQTA")
        .join("backups");
    
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir).map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }
    
    let backup_file = backup_dir.join(format!("notes_backup_{}.json", timestamp));
    let json = serde_json::to_string_pretty(&database)
        .map_err(|e| format!("Failed to serialize backup: {}", e))?;
    
    let mut file = File::create(&backup_file).map_err(|e| format!("Failed to create backup file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write backup file: {}", e))?;
    
    Ok(backup_file.to_string_lossy().to_string())
}

#[tauri::command]
pub fn restore_notes_from_backup(app: AppHandle, backup_path: String) -> Result<(), String> {
    let backup_file = PathBuf::from(backup_path);
    if !backup_file.exists() {
        return Err("Backup file does not exist".to_string());
    }
    
    let mut file = File::open(&backup_file).map_err(|e| format!("Failed to open backup file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read backup file: {}", e))?;
    
    let database: NotesDatabase = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse backup JSON: {}", e))?;
    
    save_notes_database(&app, &database)?;
    Ok(())
}

// Image handling functions

fn get_notes_images_dir(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("note_contents");
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create note_contents directory: {}", e))?;
        }
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("note_contents");
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .map_err(|e| format!("Failed to create note_contents directory: {}", e))?;
        }
        Ok(dir)
    }
}

#[tauri::command]
pub fn save_image_from_base64(
    app: AppHandle, 
    note_id: String, 
    image_data: String, 
    filename: String
) -> Result<String, String> {
    // Remove data URL prefix if present
    let base64_data = if image_data.starts_with("data:") {
        image_data.split(',').nth(1).unwrap_or(&image_data)
    } else {
        &image_data
    };
    
    // Decode base64
    let image_bytes = general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;
    
    // Get images directory
    let images_dir = get_notes_images_dir(&app)?;
    
    // Create note-specific directory
    let note_images_dir = images_dir.join(&note_id);
    if !note_images_dir.exists() {
        fs::create_dir_all(&note_images_dir)
            .map_err(|e| format!("Failed to create note images directory: {}", e))?;
    }
    
    // Generate unique filename
    let timestamp = chrono::Utc::now().timestamp_millis();
    let file_extension = filename.split('.').last().unwrap_or("png");
    let unique_filename = format!("{}_{}.{}", timestamp, filename.replace(".", "_"), file_extension);
    
    let image_path = note_images_dir.join(&unique_filename);
    
    // Write image to file
    let mut file = File::create(&image_path)
        .map_err(|e| format!("Failed to create image file: {}", e))?;
    file.write_all(&image_bytes)
        .map_err(|e| format!("Failed to write image data: {}", e))?;
    
    // Return relative path for storage in note content
    let relative_path = format!("note_contents/{}/{}", note_id, unique_filename);
    Ok(relative_path)
}

#[tauri::command]
pub fn get_image_path(app: AppHandle, relative_path: String) -> Result<String, String> {
    // Get the base notes directory (same as notes.json location but without the filename)
    #[cfg(target_os = "android")]
    let base_dir = PathBuf::from("/data/data/com.desqta.app/files");
    
    #[cfg(not(target_os = "android"))]
    let base_dir = {
        let mut dir = dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        dir
    };
    
    let full_path = base_dir.join(&relative_path);
    
    if !full_path.exists() {
        return Err(format!("Image file does not exist: {}", relative_path));
    }
    
    full_path.to_str()
        .ok_or("Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
pub fn get_image_as_base64(app: AppHandle, relative_path: String) -> Result<String, String> {
    // Get the base notes directory
    #[cfg(target_os = "android")]
    let base_dir = PathBuf::from("/data/data/com.desqta.app/files");
    
    #[cfg(not(target_os = "android"))]
    let base_dir = {
        let mut dir = dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        dir
    };
    
    let full_path = base_dir.join(&relative_path);
    
    if !full_path.exists() {
        return Err(format!("Image file does not exist: {}", relative_path));
    }
    
    // Read the file
    let image_bytes = fs::read(&full_path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;
    
    // Encode as base64
    let base64_data = general_purpose::STANDARD.encode(&image_bytes);
    
    // Determine MIME type from extension
    let extension = full_path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png")
        .to_lowercase();
    
    let mime_type = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    
    // Return as data URL
    Ok(format!("data:{};base64,{}", mime_type, base64_data))
}

#[tauri::command]
pub fn delete_note_images(app: AppHandle, note_id: String) -> Result<(), String> {
    let images_dir = get_notes_images_dir(&app)?;
    let note_images_dir = images_dir.join(&note_id);
    
    if note_images_dir.exists() {
        fs::remove_dir_all(&note_images_dir)
            .map_err(|e| format!("Failed to delete note images: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn cleanup_unused_images(app: AppHandle) -> Result<u32, String> {
    let database = load_notes_database(&app)?;
    let images_dir = get_notes_images_dir(&app)?;
    
    if !images_dir.exists() {
        return Ok(0);
    }
    
    let mut deleted_count = 0;
    
    // Get all note IDs that still exist
    let existing_note_ids: std::collections::HashSet<String> = 
        database.notes.iter().map(|n| n.id.clone()).collect();
    
    // Iterate through image directories
    if let Ok(entries) = fs::read_dir(&images_dir) {
        for entry in entries.flatten() {
            if let Some(dir_name) = entry.file_name().to_str() {
                // If this directory doesn't correspond to an existing note, delete it
                if !existing_note_ids.contains(dir_name) {
                    if let Err(e) = fs::remove_dir_all(entry.path()) {
                        eprintln!("Failed to delete unused image directory {}: {}", dir_name, e);
                    } else {
                        deleted_count += 1;
                    }
                }
            }
        }
    }
    
    Ok(deleted_count)
} 