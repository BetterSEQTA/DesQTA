use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub struct AssessmentData {
    pub id: i32,
    pub title: String,
    pub subject: String,
    pub status: String,
    pub due: String,
    pub code: String,
    pub metaclass_id: i32,
    pub programme_id: i32,
    pub graded: bool,
    pub overdue: bool,
    pub has_feedback: bool,
    pub expectations_enabled: bool,
    pub expectations_completed: bool,
    pub reflections_enabled: bool,
    pub reflections_completed: bool,
    pub availability: String,
    pub final_grade: Option<f32>,
}

fn analytics_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("analytics.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("analytics.json");
        dir
    }
}

#[tauri::command]
pub fn save_analytics(data: String) -> Result<(), String> {
    let path = analytics_file();
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_analytics() -> Result<String, String> {
    let path = analytics_file();
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_analytics() -> Result<(), String> {
    let path = analytics_file();
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
} 