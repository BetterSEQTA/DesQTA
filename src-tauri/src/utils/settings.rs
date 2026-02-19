use crate::logger;
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
};

#[path = "session.rs"]
mod session;
use crate::profiles;

/// Location: `$DATA_DIR/DesQTA/profiles/{profile_id}/settings.json`
fn settings_file() -> PathBuf {
    let mut dir = profiles::get_profile_dir(
        &profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string())
    );
    dir.push("settings.json");
    dir
}

fn cloud_token_file() -> PathBuf {
    let mut dir = profiles::get_profile_dir(
        &profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string())
    );
    dir.push("cloud_token.json");
    dir
}

/// Per-profile storage for cloud sign-in state (separate from settings).
/// Used to detect when user was previously signed in but got signed out (e.g. token expiry).
fn cloud_state_file() -> PathBuf {
    let mut dir = profiles::get_profile_dir(
        &profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string()),
    );
    dir.push("cloud_state.json");
    dir
}

/// Per-profile storage for DesQTA reserved client ID.
fn reserved_client_file() -> PathBuf {
    let mut dir = profiles::get_profile_dir(
        &profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string()),
    );
    dir.push("reserved_client.json");
    dir
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CloudToken {
    pub token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    pub user: Option<CloudUser>,
    #[serde(default)]
    pub base_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CloudState {
    #[serde(default)]
    pub previously_signed_into_cloud: bool,
}

impl CloudState {
    pub fn load() -> Self {
        let path = cloud_state_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(state) = serde_json::from_str::<CloudState>(&contents) {
                    return state;
                }
            }
        }
        CloudState::default()
    }
    pub fn save(&self) -> io::Result<()> {
        let path = cloud_state_file();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, serde_json::to_string(self).unwrap())
    }
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

/// Reserved DesQTA client ID (per app instance, stored at app level).
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ReservedClient {
    pub client_id: String,
    pub redirect_uri: String,
}

impl ReservedClient {
    pub fn load() -> Option<Self> {
        let path = reserved_client_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(rc) = serde_json::from_str::<ReservedClient>(&contents) {
                    if !rc.client_id.is_empty() {
                        return Some(rc);
                    }
                }
            }
        }
        None
    }
    pub fn save(&self) -> io::Result<()> {
        let path = reserved_client_file();
        fs::write(path, serde_json::to_string(self).unwrap())
    }
    pub fn clear_file() -> io::Result<()> {
        let path = reserved_client_file();
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
    pub auto_dismiss_message_notifications: bool,
    pub force_use_location: bool,
    pub accent_color: String,
    pub theme: String,
    pub disable_school_picture: bool,
    pub enhanced_animations: bool,
    pub gemini_api_key: Option<String>,
    pub cerebras_api_key: Option<String>,
    pub ai_provider: Option<String>, // "gemini" or "cerebras"
    pub ai_integrations_enabled: Option<bool>,
    pub grade_analyser_enabled: Option<bool>,
    pub lesson_summary_analyser_enabled: Option<bool>,
    pub quiz_generator_enabled: Option<bool>,
    pub auto_collapse_sidebar: bool,
    pub auto_expand_sidebar_hover: bool,
    pub global_search_enabled: bool,
    pub current_theme: Option<String>,
    pub dev_sensitive_info_hider: bool,
    pub dev_force_offline_mode: bool,
    pub accepted_cloud_eula: bool,
    pub language: String,
    #[serde(default)]
    pub menu_order: Option<Vec<String>>,
    #[serde(default)]
    pub has_been_through_onboarding: bool,
    #[serde(default)]
    pub has_completed_setup_assistant: bool,
    #[serde(default)]
    pub separate_rss_feed: bool,
    #[serde(default)]
    pub dashboard_widgets_layout: Option<String>,
    #[serde(default)]
    pub sidebar_folders: Option<Vec<SidebarFolder>>,
    #[serde(default)]
    pub sidebar_favorites: Option<Vec<String>>, // Array of paths
    #[serde(default)]
    pub sidebar_recent_activity: Option<Vec<RecentActivity>>,
    #[serde(default)]
    pub downloaded_theme_ids: Option<Vec<String>>, // Array of theme UUIDs from cloud store
    #[serde(default)]
    pub downloaded_theme_metadata: Option<serde_json::Value>, // Map of theme UUID -> { version, checksum, updated_at }
    /// Interface zoom level (0.5 to 2.0, default 1.0)
    #[serde(default)]
    pub zoom_level: Option<f64>,
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
            auto_dismiss_message_notifications: false,
            accent_color: "#3b82f6".to_string(), // Default to blue-500
            theme: "dark".to_string(),            // Default color mode: dark (light/dark/system)
            disable_school_picture: false,
            enhanced_animations: true,
            gemini_api_key: None,
            cerebras_api_key: None,
            ai_provider: Some("gemini".to_string()), // Default to Gemini
            ai_integrations_enabled: Some(false),
            grade_analyser_enabled: Some(true),
            lesson_summary_analyser_enabled: Some(true),
            quiz_generator_enabled: Some(true),
            auto_collapse_sidebar: false,
            auto_expand_sidebar_hover: false,
            global_search_enabled: false,
            current_theme: Some("default".to_string()),
            dev_sensitive_info_hider: false,
            dev_force_offline_mode: false,
            accepted_cloud_eula: false,
            language: "en".to_string(), // Default to English
            menu_order: None,
            has_been_through_onboarding: false,
            has_completed_setup_assistant: false,
            separate_rss_feed: false,
            dashboard_widgets_layout: None,
            sidebar_folders: None,
            sidebar_favorites: None,
            sidebar_recent_activity: None,
            downloaded_theme_ids: None,
            downloaded_theme_metadata: None,
            zoom_level: None,
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
pub struct SidebarFolder {
    pub id: String,
    pub name: String,
    pub icon: Option<String>, // Optional icon identifier
    pub items: Vec<String>,   // Array of menu item paths
    pub collapsed: bool,      // Default collapsed state
    pub order: i32,           // Display order
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentActivity {
    pub path: String,
    pub visited_at: i64, // Unix timestamp
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudUser {
    pub id: String,
    pub email: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "pfpUrl")]
    pub pfp_url: Option<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<String>,
    #[serde(rename = "is_admin", default)]
    pub is_admin: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudUserWithToken {
    pub user: Option<CloudUser>,
    pub token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
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
            json.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
        };

        let get_array = |json: &serde_json::Value, key: &str| {
            json.get(key)
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default()
        };

        let get_opt_string = |json: &serde_json::Value, key: &str| {
            json.get(key)
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        let get_opt_bool =
            |json: &serde_json::Value, key: &str| json.get(key).and_then(|v| v.as_bool());

        let get_opt_string_array = |json: &serde_json::Value, key: &str| -> Option<Vec<String>> {
            json.get(key)
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
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
        default_settings.weather_enabled = get_bool(
            &existing_json,
            "weather_enabled",
            default_settings.weather_enabled,
        );
        default_settings.weather_city = get_string(
            &existing_json,
            "weather_city",
            &default_settings.weather_city,
        );
        default_settings.weather_country = get_string(
            &existing_json,
            "weather_country",
            &default_settings.weather_country,
        );
        default_settings.reminders_enabled = get_bool(
            &existing_json,
            "reminders_enabled",
            default_settings.reminders_enabled,
        );
        default_settings.auto_dismiss_message_notifications = get_bool(
            &existing_json,
            "auto_dismiss_message_notifications",
            default_settings.auto_dismiss_message_notifications,
        );
        default_settings.force_use_location = get_bool(
            &existing_json,
            "force_use_location",
            default_settings.force_use_location,
        );
        default_settings.accent_color = get_string(
            &existing_json,
            "accent_color",
            &default_settings.accent_color,
        );
        default_settings.theme = get_string(&existing_json, "theme", &default_settings.theme);
        default_settings.disable_school_picture = get_bool(
            &existing_json,
            "disable_school_picture",
            default_settings.disable_school_picture,
        );
        default_settings.enhanced_animations = get_bool(
            &existing_json,
            "enhanced_animations",
            default_settings.enhanced_animations,
        );
        default_settings.gemini_api_key = get_opt_string(&existing_json, "gemini_api_key");
        default_settings.cerebras_api_key = get_opt_string(&existing_json, "cerebras_api_key");
        default_settings.ai_provider = get_opt_string(&existing_json, "ai_provider").or_else(|| Some("gemini".to_string()));
        default_settings.ai_integrations_enabled =
            get_opt_bool(&existing_json, "ai_integrations_enabled");
        default_settings.grade_analyser_enabled =
            get_opt_bool(&existing_json, "grade_analyser_enabled");
        default_settings.lesson_summary_analyser_enabled =
            get_opt_bool(&existing_json, "lesson_summary_analyser_enabled");
        default_settings.quiz_generator_enabled =
            get_opt_bool(&existing_json, "quiz_generator_enabled");
        default_settings.auto_collapse_sidebar = get_bool(
            &existing_json,
            "auto_collapse_sidebar",
            default_settings.auto_collapse_sidebar,
        );
        default_settings.auto_expand_sidebar_hover = get_bool(
            &existing_json,
            "auto_expand_sidebar_hover",
            default_settings.auto_expand_sidebar_hover,
        );
        default_settings.global_search_enabled = get_bool(
            &existing_json,
            "global_search_enabled",
            default_settings.global_search_enabled,
        );
        default_settings.current_theme = get_opt_string(&existing_json, "current_theme");
        default_settings.dev_sensitive_info_hider = get_bool(
            &existing_json,
            "dev_sensitive_info_hider",
            default_settings.dev_sensitive_info_hider,
        );
        default_settings.dev_force_offline_mode = get_bool(
            &existing_json,
            "dev_force_offline_mode",
            default_settings.dev_force_offline_mode,
        );
        default_settings.accepted_cloud_eula = get_bool(
            &existing_json,
            "accepted_cloud_eula",
            default_settings.accepted_cloud_eula,
        );
        default_settings.language =
            get_string(&existing_json, "language", &default_settings.language);
        default_settings.menu_order = get_opt_string_array(&existing_json, "menu_order");
        default_settings.has_been_through_onboarding = get_bool(
            &existing_json,
            "has_been_through_onboarding",
            default_settings.has_been_through_onboarding,
        );
        default_settings.has_completed_setup_assistant = get_bool(
            &existing_json,
            "has_completed_setup_assistant",
            default_settings.has_completed_setup_assistant,
        );
        default_settings.separate_rss_feed = get_bool(
            &existing_json,
            "separate_rss_feed",
            default_settings.separate_rss_feed,
        );
        default_settings.dashboard_widgets_layout = get_opt_string(&existing_json, "dashboard_widgets_layout");

        // Merge sidebar folders
        if let Some(folders_json) = existing_json.get("sidebar_folders").and_then(|v| v.as_array()) {
            let mut folders = Vec::new();
            for folder_json in folders_json {
                if let (Some(id), Some(name)) = (
                    folder_json.get("id").and_then(|v| v.as_str()),
                    folder_json.get("name").and_then(|v| v.as_str()),
                ) {
                    let items = folder_json
                        .get("items")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();
                    let collapsed = folder_json
                        .get("collapsed")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let order = folder_json
                        .get("order")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32)
                        .unwrap_or(0);
                    let icon = folder_json
                        .get("icon")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    folders.push(SidebarFolder {
                        id: id.to_string(),
                        name: name.to_string(),
                        icon,
                        items,
                        collapsed,
                        order,
                    });
                }
            }
            default_settings.sidebar_folders = Some(folders);
        }

        // Merge sidebar favorites
        default_settings.sidebar_favorites = get_opt_string_array(&existing_json, "sidebar_favorites");

        // Merge recent activity
        if let Some(activity_json) = existing_json.get("sidebar_recent_activity").and_then(|v| v.as_array()) {
            let mut activities = Vec::new();
            for activity_item in activity_json {
                if let (Some(path), Some(visited_at)) = (
                    activity_item.get("path").and_then(|v| v.as_str()),
                    activity_item.get("visited_at").and_then(|v| v.as_i64()),
                ) {
                    activities.push(RecentActivity {
                        path: path.to_string(),
                        visited_at,
                    });
                }
            }
            default_settings.sidebar_recent_activity = Some(activities);
        }

        // Merge downloaded theme IDs
        default_settings.downloaded_theme_ids = get_opt_string_array(&existing_json, "downloaded_theme_ids");

        // Merge downloaded theme metadata (preserve as JSON value)
        if let Some(metadata_json) = existing_json.get("downloaded_theme_metadata") {
            default_settings.downloaded_theme_metadata = Some(metadata_json.clone());
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

fn default_base_url() -> String {
    "https://accounts.betterseqta.org".to_string()
}

fn get_base_api_url() -> String {
    let tok = CloudToken::load();
    let base = tok.base_url.unwrap_or_else(|| default_base_url());
    if base.ends_with("/api") {
        base
    } else {
        format!("{}/api", base.trim_end_matches('/'))
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
            serde_json::json!({}),
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
            serde_json::json!({}),
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
                    serde_json::json!({}),
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
                    serde_json::json!({"error": e.to_string()}),
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

/// Return a subset of settings keys to reduce round-trips from the frontend.
#[tauri::command]
pub fn get_settings_subset(keys: Vec<String>) -> Result<serde_json::Value, String> {
    let settings = Settings::load();
    let full = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    let mut result = serde_json::Map::new();
    for k in keys {
        if let Some(v) = full.get(&k) {
            result.insert(k, v.clone());
        }
    }
    Ok(serde_json::Value::Object(result))
}

/// Merge partial settings into current settings and save (coalesces get+save into one call).
#[tauri::command]
pub fn save_settings_merge(patch: serde_json::Value) -> Result<(), String> {
    let current = Settings::load();
    let mut current_val = serde_json::to_value(current).map_err(|e| e.to_string())?;

    // Shallow merge top-level keys from patch into current
    if let (Some(obj_curr), Some(obj_patch)) = (current_val.as_object_mut(), patch.as_object()) {
        for (k, v) in obj_patch.iter() {
            obj_curr.insert(k.clone(), v.clone());
        }
    }

    let merged: Settings = serde_json::from_value(current_val).map_err(|e| e.to_string())?;
    merged.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_cloud_token(
    token: String,
    refresh_token: Option<String>,
    user_json: Option<String>,
) -> Result<CloudUser, String> {
    let base_url = get_base_api_url();
    let user: CloudUser = if let Some(json) = user_json {
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse user: {}", e))?
    } else {
        let client = reqwest::Client::new();
        let response = client
            .get(&format!("{}/auth/me", base_url))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
                return Err(format!(
                    "API Error {}: {}",
                    api_error.statusCode, api_error.statusMessage
                ));
            }
            return Err(format!(
                "Authentication failed: {} - {}",
                status, error_text
            ));
        }
        let user_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        serde_json::from_str(&user_text).map_err(|e| {
            format!(
                "Failed to parse user response: {} - Raw response: {}",
                e, user_text
            )
        })?
    };
    let mut cloud_token = CloudToken::load();
    cloud_token.token = Some(token);
    cloud_token.refresh_token = refresh_token;
    cloud_token.user = Some(user.clone());
    // This uses cloud_token_file(), which saves to the correct Android folder on Android
    cloud_token.save().map_err(|e| e.to_string())?;
    // Mark that user has signed into cloud (for sign-out detection)
    let mut state = CloudState::load();
    state.previously_signed_into_cloud = true;
    let _ = state.save();
    Ok(user)
}

#[tauri::command]
pub fn get_cloud_user() -> CloudUserWithToken {
    let cloud_token = CloudToken::load();
    CloudUserWithToken {
        user: cloud_token.user,
        token: cloud_token.token,
        refresh_token: cloud_token.refresh_token,
    }
}

#[tauri::command]
pub fn clear_cloud_token() -> Result<(), String> {
    CloudToken::clear_file().map_err(|e| e.to_string())?;
    // Clear previously-signed flag on explicit logout
    let mut state = CloudState::load();
    state.previously_signed_into_cloud = false;
    state.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_cloud_state() -> CloudState {
    CloudState::load()
}

#[tauri::command]
pub fn set_cloud_state_previously_signed(value: bool) -> Result<(), String> {
    let mut state = CloudState::load();
    state.previously_signed_into_cloud = value;
    state.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_reserved_client() -> Option<ReservedClient> {
    ReservedClient::load()
}

#[tauri::command]
pub fn clear_reserved_client() -> Result<(), String> {
    ReservedClient::clear_file().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_reserved_client(client_id: String, redirect_uri: String) -> Result<(), String> {
    if client_id.is_empty() {
        return Err("client_id cannot be empty".to_string());
    }
    let rc = ReservedClient {
        client_id,
        redirect_uri,
    };
    rc.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_cloud_base_url() -> String {
    let tok = CloudToken::load();
    tok.base_url.unwrap_or_else(|| default_base_url())
}

#[tauri::command]
pub fn set_cloud_base_url(new_base_url: String) -> Result<(), String> {
    // Basic validation
    if !(new_base_url.starts_with("http://") || new_base_url.starts_with("https://")) {
        return Err("Base URL must start with http:// or https://".to_string());
    }
    let mut tok = CloudToken::load();
    tok.base_url = Some(new_base_url);
    tok.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_settings_to_cloud() -> Result<(), String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token
        .token
        .clone()
        .ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = get_base_api_url();
    let settings = Settings::load();
    let settings_json = settings.to_json()?;
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new().part(
        "file",
        reqwest::multipart::Part::text(settings_json)
            .file_name("desqta-settings.json")
            .mime_str("application/json")
            .unwrap(),
    );
    let response = client
        .post(&format!("{}/files/upload", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Upload failed: {} - {}", status, error_text));
    }
    Ok(())
}

#[tauri::command]
pub async fn download_settings_from_cloud() -> Result<Settings, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token
        .token
        .clone()
        .ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = get_base_api_url();
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
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!(
                "API Error {}: {}",
                api_error.statusCode, api_error.statusMessage
            ));
        }
        return Err(format!("List files failed: {} - {}", status, error_text));
    }
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    let file_list: FileListResponse = serde_json::from_str(&response_text).map_err(|e| {
        format!(
            "Failed to parse response: {} - Raw response: {}",
            e, response_text
        )
    })?;
    let settings_file = file_list
        .files
        .iter()
        .find(|file| file.filename == "desqta-settings.json")
        .ok_or("No settings file found in cloud")?;
    let download_url = if settings_file.is_public {
        format!("{}/files/public/{}", base_url, settings_file.stored_name)
    } else {
        format!("{}/files/{}", base_url, settings_file.stored_name)
    };
    let mut request_builder = client.get(&download_url).header("Accept", "*/*");
    if !settings_file.is_public {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", token));
    }
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!(
                "API Error {}: {} - StoredName: {}, IsPublic: {}",
                api_error.statusCode,
                api_error.statusMessage,
                settings_file.stored_name,
                settings_file.is_public
            ));
        }
        return Err(format!(
            "Download failed: {} - {} - StoredName: {}, IsPublic: {}",
            status, error_text, settings_file.stored_name, settings_file.is_public
        ));
    }
    let settings_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    Settings::from_json(&settings_text)
}

#[tauri::command]
pub async fn check_cloud_settings() -> Result<bool, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token
        .token
        .clone()
        .ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = get_base_api_url();
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
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        if let Ok(api_error) = serde_json::from_str::<APIError>(&error_text) {
            return Err(format!(
                "API Error {}: {}",
                api_error.statusCode, api_error.statusMessage
            ));
        }
        return Err(format!("Check failed: {} - {}", status, error_text));
    }
    let response_text = response
        .text()
        .await
        .map_err(|_| "Failed to read response")?;
    let file_list: FileListResponse = serde_json::from_str(&response_text).map_err(|e| {
        format!(
            "Failed to parse response: {} - Raw response: {}",
            e, response_text
        )
    })?;
    Ok(!file_list.files.is_empty())
}
