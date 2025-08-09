use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtask {
    pub id: String,
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub related_subject: Option<String>,
    #[serde(default)]
    pub related_assessment: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>, // ISO date (YYYY-MM-DD)
    #[serde(default)]
    pub due_time: Option<String>, // 24h time (HH:MM)
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub subtasks: Option<Vec<Subtask>>,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub priority: Option<String>, // e.g. low | medium | high
    #[serde(default)]
    pub created_at: Option<String>, // ISO timestamp
    #[serde(default)]
    pub updated_at: Option<String>, // ISO timestamp
}

/// Location strategy mirrors settings.rs:
/// - Android: /data/data/com.desqta.app/files/DesQTA/todolist.json
/// - Other platforms: <OS data dir>/DesQTA/todolist.json
fn todos_file_path(_app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("todolist.json");
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().ok_or_else(|| "Unable to determine data dir".to_string())?;
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        }
        dir.push("todolist.json");
        Ok(dir)
    }
}

fn ensure_parent_dir(path: &PathBuf) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create data dir: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_todos(app: AppHandle) -> Result<Vec<TodoItem>, String> {
    let path = todos_file_path(&app)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    if contents.trim().is_empty() {
        return Ok(vec![]);
    }
    let todos: Vec<TodoItem> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    Ok(todos)
}

#[tauri::command]
pub fn save_todos(app: AppHandle, todos: Vec<TodoItem>) -> Result<(), String> {
    let path = todos_file_path(&app)?;
    ensure_parent_dir(&path)?;
    let json = serde_json::to_string_pretty(&todos)
        .map_err(|e| format!("Failed to serialize todos: {}", e))?;
    let mut file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
} 