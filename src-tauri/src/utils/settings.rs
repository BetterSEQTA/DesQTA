use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
};
use reqwest;
use serde_json;
use crate::logger;

#[path = "session.rs"]
mod session;

/// Location: `$DATA_DIR/DesQTA/settings.json`
fn settings_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("settings.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("settings.json");
        dir
    }
}

fn cloud_token_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("cloud_token.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("cloud_token.json");
        dir
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CloudToken {
    pub token: Option<String>,
    pub user: Option<CloudUser>,
}

impl CloudToken {
    pub fn load() -> Self {
        let path = cloud_token_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(tok) = serde_json::from_str::<CloudToken>(&contents) {
                    return tok;
                }
            }
        }
        CloudToken::default()
    }
    pub fn save(&self) -> io::Result<()> {
        let path = cloud_token_file();
        fs::write(path, serde_json::to_string(self).unwrap())
    }
    pub fn clear_file() -> io::Result<()> {
        let path = cloud_token_file();
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub shortcuts: Vec<Shortcut>,
    pub feeds: Vec<Feed>,
    pub weather_enabled: bool,
    pub weather_city: String,
    pub weather_country: String,
    pub reminders_enabled: bool,
    pub force_use_location: bool,
    pub accent_color: String,
    pub theme: String,
    pub disable_school_picture: bool,
    pub enhanced_animations: bool,
    pub gemini_api_key: Option<String>,
    pub ai_integrations_enabled: Option<bool>,
    pub grade_analyser_enabled: Option<bool>,
    pub lesson_summary_analyser_enabled: Option<bool>,
    pub auto_collapse_sidebar: bool,
    pub auto_expand_sidebar_hover: bool,
    pub global_search_enabled: bool,
    pub current_theme: Option<String>,
    pub widget_layout: Vec<WidgetLayout>,
    pub dev_sensitive_info_hider: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            shortcuts: Vec::new(),
            feeds: Vec::new(),
            weather_enabled: false,
            force_use_location: false,
            weather_city: String::new(),
            weather_country: String::new(),
            reminders_enabled: true,
            accent_color: "#3b82f6".to_string(), // Default to blue-500
            theme: "default".to_string(), // Default to DesQTA theme
            disable_school_picture: false,
            enhanced_animations: true,
            gemini_api_key: None,
            ai_integrations_enabled: Some(false),
            grade_analyser_enabled: Some(true),
            lesson_summary_analyser_enabled: Some(true),
            auto_collapse_sidebar: false,
            auto_expand_sidebar_hover: false,
            global_search_enabled: false,
            current_theme: Some("default".to_string()),
            widget_layout: vec![
                WidgetLayout { id: "shortcuts".to_string(), x: 0, y: 0, width: 2, height: 1, enabled: true },
                WidgetLayout { id: "today_schedule".to_string(), x: 0, y: 1, width: 2, height: 1, enabled: true },
                WidgetLayout { id: "notices".to_string(), x: 0, y: 2, width: 2, height: 1, enabled: true },
                WidgetLayout { id: "upcoming_assessments".to_string(), x: 0, y: 3, width: 2, height: 1, enabled: true },
                WidgetLayout { id: "welcome_portal".to_string(), x: 0, y: 4, width: 2, height: 1, enabled: true },
                WidgetLayout { id: "homework".to_string(), x: 0, y: 5, width: 1, height: 1, enabled: true },
                WidgetLayout { id: "todo_list".to_string(), x: 0, y: 6, width: 1, height: 1, enabled: true },
                WidgetLayout { id: "focus_timer".to_string(), x: 1, y: 5, width: 1, height: 2, enabled: true },
            ],
            dev_sensitive_info_hider: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Shortcut {
    pub name: String,
    pub icon: String,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Feed {
    
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WidgetLayout {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: i32, // 1 = half width, 2 = full width
    pub height: i32, // 1 = normal height, 2 = double height
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudUser {
    pub id: String,
    pub email: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "pfpUrl")]
    pub pfp_url: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudUserWithToken {
    pub user: Option<CloudUser>,
    pub token: Option<String>,
}

// Cloud API types
#[derive(Debug, Serialize, Deserialize)]
struct CloudFile {
    id: String,
    #[serde(rename = "userId")]
    user_id: String, // Now guaranteed to be present
    filename: String,
    #[serde(rename = "storedName")]
    stored_name: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    size: i64,
    path: String,
    #[serde(rename = "isPublic")]
    is_public: bool,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct FileListResponse {
    files: Vec<CloudFile>,
    pagination: Pagination,
}

#[derive(Debug, Serialize, Deserialize)]
struct Pagination {
    page: i32,
    limit: i32,
    total: i32,
    pages: i32,
}

#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
struct APIError {
    statusCode: i32,
    statusMessage: String,
}

impl Settings {
    /// Load from disk with smart merging; returns default if none.
    pub fn load() -> Self {
        let path = settings_file();
        if let Ok(mut file) = fs::File::open(&path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                // Try to parse as the current Settings struct first
                if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
                    return settings;
                }
                
                // If that fails, try to merge with existing JSON
                if let Ok(existing_json) = serde_json::from_str::<serde_json::Value>(&contents) {
                    return Self::merge_with_existing(existing_json);
                }
            }
        }
        Settings::default()
    }

    /// Smart merge function that preserves existing settings when new fields are added
    fn merge_with_existing(existing_json: serde_json::Value) -> Self {
        let mut default_settings = Settings::default();
        
        // Helper function to safely extract values with fallbacks
        let get_string = |json: &serde_json::Value, key: &str, default: &str| {
            json.get(key)
                .and_then(|v| v.as_str())
                .unwrap_or(default)
                .to_string()
        };
        
        let get_bool = |json: &serde_json::Value, key: &str, default: bool| {
            json.get(key)
                .and_then(|v| v.as_bool())
                .unwrap_or(default)
        };
        
        let get_array = |json: &serde_json::Value, key: &str| {
            json.get(key)
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default()
        };

        let get_opt_string = |json: &serde_json::Value, key: &str| {
            json.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
        };

        let get_opt_bool = |json: &serde_json::Value, key: &str| {
            json.get(key).and_then(|v| v.as_bool())
        };

        // Merge shortcuts
        let shortcuts_json = get_array(&existing_json, "shortcuts");
        let mut shortcuts = Vec::new();
        for shortcut_json in shortcuts_json {
            if let (Some(name), Some(icon), Some(url)) = (
                shortcut_json.get("name").and_then(|v| v.as_str()),
                shortcut_json.get("icon").and_then(|v| v.as_str()),
                shortcut_json.get("url").and_then(|v| v.as_str()),
            ) {
                shortcuts.push(Shortcut {
                    name: name.to_string(),
                    icon: icon.to_string(),
                    url: url.to_string(),
                });
            }
        }
        default_settings.shortcuts = shortcuts;

        // Merge feeds
        let feeds_json = get_array(&existing_json, "feeds");
        let mut feeds = Vec::new();
        for feed_json in feeds_json {
            if let Some(url) = feed_json.get("url").and_then(|v| v.as_str()) {
                feeds.push(Feed {
                    url: url.to_string(),
                });
            }
        }
        default_settings.feeds = feeds;

        // Merge individual settings with fallbacks to defaults
        default_settings.weather_enabled = get_bool(&existing_json, "weather_enabled", default_settings.weather_enabled);
        default_settings.weather_city = get_string(&existing_json, "weather_city", &default_settings.weather_city);
        default_settings.weather_country = get_string(&existing_json, "weather_country", &default_settings.weather_country);
        default_settings.reminders_enabled = get_bool(&existing_json, "reminders_enabled", default_settings.reminders_enabled);
        default_settings.force_use_location = get_bool(&existing_json, "force_use_location", default_settings.force_use_location);
        default_settings.accent_color = get_string(&existing_json, "accent_color", &default_settings.accent_color);
        default_settings.theme = get_string(&existing_json, "theme", &default_settings.theme);
        default_settings.disable_school_picture = get_bool(&existing_json, "disable_school_picture", default_settings.disable_school_picture);
        default_settings.enhanced_animations = get_bool(&existing_json, "enhanced_animations", default_settings.enhanced_animations);
        default_settings.gemini_api_key = get_opt_string(&existing_json, "gemini_api_key");
        default_settings.ai_integrations_enabled = get_opt_bool(&existing_json, "ai_integrations_enabled");
        default_settings.grade_analyser_enabled = get_opt_bool(&existing_json, "grade_analyser_enabled");
        default_settings.lesson_summary_analyser_enabled = get_opt_bool(&existing_json, "lesson_summary_analyser_enabled");
        default_settings.auto_collapse_sidebar = get_bool(&existing_json, "auto_collapse_sidebar", default_settings.auto_collapse_sidebar);
        default_settings.auto_expand_sidebar_hover = get_bool(&existing_json, "auto_expand_sidebar_hover", default_settings.auto_expand_sidebar_hover);
        default_settings.global_search_enabled = get_bool(&existing_json, "global_search_enabled", default_settings.global_search_enabled);
        default_settings.current_theme = get_opt_string(&existing_json, "current_theme");
        default_settings.dev_sensitive_info_hider = get_bool(&existing_json, "dev_sensitive_info_hider", default_settings.dev_sensitive_info_hider);
        
        // Merge widget layout
        let widget_layout_json = get_array(&existing_json, "widget_layout");
        let mut widget_layout = Vec::new();
        for layout_json in widget_layout_json {
            if let (Some(id), Some(x), Some(y), Some(width), Some(height), Some(enabled)) = (
                layout_json.get("id").and_then(|v| v.as_str()),
                layout_json.get("x").and_then(|v| v.as_i64()),
                layout_json.get("y").and_then(|v| v.as_i64()),
                layout_json.get("width").and_then(|v| v.as_i64()),
                layout_json.get("height").and_then(|v| v.as_i64()),
                layout_json.get("enabled").and_then(|v| v.as_bool()),
            ) {
                widget_layout.push(WidgetLayout {
                    id: id.to_string(),
                    x: x as i32,
                    y: y as i32,
                    width: width as i32,
                    height: height as i32,
                    enabled,
                });
            }
        }
        if !widget_layout.is_empty() {
            default_settings.widget_layout = widget_layout;
        }

        default_settings
    }

    /// Persist to disk.
    pub fn save(&self) -> io::Result<()> {
        let path = settings_file();
        fs::write(path, serde_json::to_string(self).unwrap())
    }

    /// Convert to JSON string for cloud sync
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string(self).map_err(|e| e.to_string())
    }

    /// Create from JSON string for cloud sync
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn get_settings() -> Settings {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "settings",
            "get_settings",
            "Loading application settings",
            serde_json::json!({})
        );
    }
    Settings::load()
}

#[tauri::command]
pub fn save_settings(new_settings: Settings) -> Result<(), String> {
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "settings",
            "save_settings",
            "Saving application settings",
            serde_json::json!({})
        );
    }
    
    match new_settings.save() {
        Ok(_) => {
            if let Some(logger) = logger::get_logger() {
                let _ = logger.log(
                    logger::LogLevel::DEBUG,
                    "settings",
                    "save_settings",
                    "Settings saved successfully",
                    serde_json::json!({})
                );
            }
            Ok(())
        }
        Err(e) => {
            if let Some(logger) = logger::get_logger() {
                let _ = logger.log(
                    logger::LogLevel::ERROR,
                    "settings",
                    "save_settings",
                    &format!("Failed to save settings: {}", e),
                    serde_json::json!({"error": e.to_string()})
                );
            }
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn get_settings_json() -> Result<String, String> {
    let settings = Settings::load();
    settings.to_json()
}

#[tauri::command]
pub fn save_settings_from_json(json: String) -> Result<(), String> {
    let settings = Settings::from_json(&json)?;
    settings.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_cloud_token(token: String) -> Result<CloudUser, String> {
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/auth/me", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!("API Error {}: {}", api_error.statusCode, api_error.statusMessage));
        }
        return Err(format!("Authentication failed: {} - {}", status, error_text));
    }
    let user_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    let user: CloudUser = serde_json::from_str(&user_text)
        .map_err(|e| format!("Failed to parse user response: {} - Raw response: {}", e, user_text))?;
    let mut cloud_token = CloudToken::load();
    cloud_token.token = Some(token);
    cloud_token.user = Some(user.clone());
    // This uses cloud_token_file(), which saves to the correct Android folder on Android
    cloud_token.save().map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
pub fn get_cloud_user() -> CloudUserWithToken {
    let cloud_token = CloudToken::load();
    CloudUserWithToken {
        user: cloud_token.user,
        token: cloud_token.token,
    }
}

#[tauri::command]
pub fn clear_cloud_token() -> Result<(), String> {
    CloudToken::clear_file().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_settings_to_cloud() -> Result<(), String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.clone().ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let settings = Settings::load();
    let settings_json = settings.to_json()?;
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::text(settings_json)
            .file_name("desqta-settings.json")
            .mime_str("application/json").unwrap());
    let response = client
        .post(&format!("{}/files/upload", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Upload failed: {} - {}", status, error_text));
    }
    Ok(())
}

#[tauri::command]
pub async fn download_settings_from_cloud() -> Result<Settings, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.clone().ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/files/list", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .query(&[("search", "desqta-settings.json"), ("limit", "10")])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!("API Error {}: {}", api_error.statusCode, api_error.statusMessage));
        }
        return Err(format!("List files failed: {} - {}", status, error_text));
    }
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    let file_list: FileListResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {} - Raw response: {}", e, response_text))?;
    let settings_file = file_list.files.iter()
        .find(|file| file.filename == "desqta-settings.json")
        .ok_or("No settings file found in cloud")?;
    let download_url = if settings_file.is_public {
        format!("{}/files/public/{}", base_url, settings_file.stored_name)
    } else {
        format!("{}/files/{}", base_url, settings_file.stored_name)
    };
    let mut request_builder = client.get(&download_url)
        .header("Accept", "*/*");
    if !settings_file.is_public {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
    }
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!("API Error {}: {} - StoredName: {}, IsPublic: {}", 
                              api_error.statusCode, api_error.statusMessage, 
                              settings_file.stored_name, settings_file.is_public));
        }
        return Err(format!("Download failed: {} - {} - StoredName: {}, IsPublic: {}", 
                          status, error_text, settings_file.stored_name, settings_file.is_public));
    }
    let settings_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    Settings::from_json(&settings_text)
}

#[tauri::command]
pub async fn check_cloud_settings() -> Result<bool, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.clone().ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/files/list", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .query(&[("search", "desqta-settings.json"), ("limit", "1")])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!("API Error {}: {}", api_error.statusCode, api_error.statusMessage));
        }
        return Err(format!("Check failed: {} - {}", status, error_text));
    }
    let response_text = response.text().await
        .map_err(|_| "Failed to read response")?;
    let file_list: FileListResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {} - Raw response: {}", e, response_text))?;
    Ok(!file_list.files.is_empty())
}
