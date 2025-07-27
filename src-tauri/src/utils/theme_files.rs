use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::command;

#[derive(Serialize)]
pub struct UserThemeInfo {
    pub name: String,
    pub has_manifest: bool,
}

fn user_themes_dir() -> PathBuf {
    let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
    dir.push("DesQTA");
    dir.push("themes");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

#[command]
pub fn list_user_themes() -> Vec<UserThemeInfo> {
    let dir = user_themes_dir();
    let mut themes = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let manifest = entry.path().join("theme-manifest.json");
                themes.push(UserThemeInfo {
                    name: entry.file_name().to_string_lossy().to_string(),
                    has_manifest: manifest.exists(),
                });
            }
        }
    }
    themes
}

#[command]
pub fn read_user_theme_manifest(theme_name: String) -> Result<String, String> {
    let dir = user_themes_dir().join(&theme_name).join("theme-manifest.json");
    fs::read_to_string(dir).map_err(|e| e.to_string())
}

#[command]
pub fn read_user_theme_css(theme_name: String, css_file: String) -> Result<String, String> {
    let dir = user_themes_dir().join(&theme_name).join("styles").join(css_file);
    fs::read_to_string(dir).map_err(|e| e.to_string())
} 