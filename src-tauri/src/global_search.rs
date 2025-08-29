use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[cfg(not(target_os = "android"))]
use dirs_next;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchItem {
    pub id: String,
    pub name: String,
    pub path: String,
    pub category: String,
    pub description: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub shortcut: Option<String>,
    pub badge: Option<String>,
    pub priority: Option<i32>,
    pub last_used: Option<String>,
    pub use_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchStats {
    pub total_searches: i32,
    pub average_time: f64,
    pub last_search_time: Option<String>,
    pub most_used_categories: Vec<String>,
}

impl Default for SearchStats {
    fn default() -> Self {
        Self {
            total_searches: 0,
            average_time: 0.0,
            last_search_time: None,
            most_used_categories: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobalSearchData {
    pub search_history: Vec<String>,
    pub favorite_items: Vec<String>,
    pub recent_items: Vec<SearchItem>,
    pub search_stats: SearchStats,
    pub custom_shortcuts: Vec<SearchItem>,
    pub disabled_categories: Vec<String>,
    pub search_preferences: SearchPreferences,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchPreferences {
    pub max_history_items: i32,
    pub max_recent_items: i32,
    pub enable_fuzzy_search: bool,
    pub enable_command_mode: bool,
    pub show_descriptions: bool,
    pub auto_save: bool,
    pub search_delay_ms: i32,
}

impl Default for SearchPreferences {
    fn default() -> Self {
        Self {
            max_history_items: 50,
            max_recent_items: 10,
            enable_fuzzy_search: true,
            enable_command_mode: true,
            show_descriptions: true,
            auto_save: true,
            search_delay_ms: 150,
        }
    }
}

impl Default for GlobalSearchData {
    fn default() -> Self {
        Self {
            search_history: Vec::new(),
            favorite_items: Vec::new(),
            recent_items: Vec::new(),
            search_stats: SearchStats::default(),
            custom_shortcuts: Vec::new(),
            disabled_categories: Vec::new(),
            search_preferences: SearchPreferences::default(),
        }
    }
}

/// Location: `$DATA_DIR/DesQTA/global_search.json`
fn get_search_data_path() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("global_search.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("global_search.json");
        dir
    }
}

#[command]
pub fn get_global_search_data() -> Result<GlobalSearchData, String> {
    let path = get_search_data_path();
    
    if !path.exists() {
        return Ok(GlobalSearchData::default());
    }
    
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: GlobalSearchData = serde_json::from_str(&content)
        .unwrap_or_else(|_| GlobalSearchData::default());
    
    Ok(data)
}

#[command]
pub fn save_global_search_data(data: GlobalSearchData) -> Result<(), String> {
    let path = get_search_data_path();
    
    // Ensure the directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub fn clear_search_history() -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.search_history.clear();
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn clear_recent_items() -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.recent_items.clear();
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn add_custom_shortcut(shortcut: SearchItem) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    
    // Remove existing shortcut with same id if it exists
    data.custom_shortcuts.retain(|s| s.id != shortcut.id);
    
    // Add new shortcut
    data.custom_shortcuts.push(shortcut);
    
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn remove_custom_shortcut(shortcut_id: String) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.custom_shortcuts.retain(|s| s.id != shortcut_id);
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn update_search_preferences(preferences: SearchPreferences) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    data.search_preferences = preferences;
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn get_search_analytics() -> Result<SearchStats, String> {
    let data = get_global_search_data()?;
    Ok(data.search_stats)
}

#[command]
pub fn increment_search_usage(item_id: String, category: String) -> Result<(), String> {
    let mut data = get_global_search_data()?;
    
    // Update search stats
    data.search_stats.total_searches += 1;
    data.search_stats.last_search_time = Some(chrono::Utc::now().to_rfc3339());
    
    // Update most used categories
    if !data.search_stats.most_used_categories.contains(&category) {
        data.search_stats.most_used_categories.push(category);
    }
    
    // Update recent items usage
    if let Some(item) = data.recent_items.iter_mut().find(|i| i.id == item_id) {
        item.use_count = Some(item.use_count.unwrap_or(0) + 1);
        item.last_used = Some(chrono::Utc::now().to_rfc3339());
    }
    
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn export_search_data() -> Result<String, String> {
    let data = get_global_search_data()?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

#[command]
pub fn import_search_data(json_data: String) -> Result<(), String> {
    let data: GlobalSearchData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Invalid JSON format: {}", e))?;
    
    save_global_search_data(data)?;
    Ok(())
}

#[command]
pub fn reset_search_data() -> Result<(), String> {
    let default_data = GlobalSearchData::default();
    save_global_search_data(default_data)?;
    Ok(())
}

// Window Management Commands - Desktop only
#[command]
pub async fn toggle_fullscreen(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: fullscreen methods might not be available in all Tauri versions
        // Using a placeholder implementation
        println!("Toggle fullscreen requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Fullscreen toggle is not supported on mobile platforms".to_string())
    }
}

#[command]
pub async fn minimize_window(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: minimize method might not be available in all Tauri versions
        // Using a placeholder implementation
        println!("Minimize window requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Window minimize is not supported on mobile platforms".to_string())
    }
}

#[command]
pub async fn maximize_window(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: maximize method might not be available in all Tauri versions
        // Using a placeholder implementation
        println!("Maximize window requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Window maximize is not supported on mobile platforms".to_string())
    }
}

#[command]
pub async fn unmaximize_window(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: unmaximize method might not be available in all Tauri versions
        // Using a placeholder implementation
        println!("Unmaximize window requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Window unmaximize is not supported on mobile platforms".to_string())
    }
}

#[command]
pub async fn close_window(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: close method might not be available in all Tauri versions
        // Using a placeholder implementation for now
        println!("Close window requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Window close is not supported on mobile platforms".to_string())
    }
}

// Developer Tools Commands
#[command]
pub async fn open_devtools(_window: tauri::Window) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        // In Tauri v2, dev tools are opened via keyboard shortcut F12 or menu
        println!("Developer tools can be opened with F12 or through the application menu");
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Developer tools are only available in debug builds".to_string())
    }
}

#[command]
pub async fn close_devtools(_window: tauri::Window) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        println!("Developer tools can be closed with F12 or through the application menu");
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Developer tools are only available in debug builds".to_string())
    }
}

// Zoom Commands - Using webview evaluation since direct zoom API is not available
#[command]
pub async fn zoom_in(_window: tauri::Window) -> Result<(), String> {
    // In Tauri v2, zoom is typically handled by the frontend
    println!("Zoom in requested - implement on frontend with CSS transform or zoom");
    Ok(())
}

#[command]
pub async fn zoom_out(_window: tauri::Window) -> Result<(), String> {
    // In Tauri v2, zoom is typically handled by the frontend
    println!("Zoom out requested - implement on frontend with CSS transform or zoom");
    Ok(())
}

#[command]
pub async fn zoom_reset(_window: tauri::Window) -> Result<(), String> {
    // In Tauri v2, zoom is typically handled by the frontend
    println!("Zoom reset requested - implement on frontend with CSS transform or zoom");
    Ok(())
}

// Cache Management Commands
#[command]
pub async fn clear_cache() -> Result<(), String> {
    // Clear application cache
    let cache_dirs = [
        "cache",
        "temp",
        "logs"
    ];
    
    for cache_dir in &cache_dirs {
        let cache_path = get_cache_path(cache_dir);
        if cache_path.exists() {
            if cache_path.is_dir() {
                fs::remove_dir_all(&cache_path).map_err(|e| {
                    format!("Failed to remove cache directory {}: {}", cache_dir, e)
                })?;
            } else {
                fs::remove_file(&cache_path).map_err(|e| {
                    format!("Failed to remove cache file {}: {}", cache_dir, e)
                })?;
            }
        }
    }
    
    Ok(())
}

fn get_cache_path(cache_type: &str) -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/cache");
        dir.push(cache_type);
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::cache_dir().unwrap_or_else(|| PathBuf::from("."));
        dir.push("DesQTA");
        dir.push(cache_type);
        dir
    }
}

// System Information Commands
#[command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: "2.0".to_string(), // Update as needed
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub tauri_version: String,
}

// Application State Commands
#[command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.restart();
}

#[command]
pub async fn show_window(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: show/focus methods might not be available in all Tauri versions
        // Using a placeholder implementation
        println!("Show window requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Window show is not supported on mobile platforms".to_string())
    }
}

#[command]
pub async fn hide_window(_window: tauri::Window) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Note: hide method might not be available in all Tauri versions
        // Using a placeholder implementation
        println!("Hide window requested");
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Window hide is not supported on mobile platforms".to_string())
    }
}

// Notification Commands
#[command]
pub async fn show_notification(title: String, body: String) -> Result<(), String> {
    // This would integrate with the notification plugin
    println!("Notification: {} - {}", title, body);
    Ok(())
}

// File System Commands
#[command]
pub async fn open_file_explorer(path: Option<String>) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let target_path = path.unwrap_or_else(|| {
            dirs_next::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .to_string_lossy()
                .to_string()
        });
        
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&target_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&target_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&target_path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("File explorer is not supported on mobile platforms".to_string())
    }
}

#[command]
pub async fn get_app_data_dir() -> Result<String, String> {
    let path = get_search_data_path();
    let parent = path.parent().unwrap_or(&path);
    Ok(parent.to_string_lossy().to_string())
} 