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

/// Per-profile storage for anonymous usage analytics state (daily session counts, last sent date).
fn usage_analytics_state_file() -> PathBuf {
    let mut dir = profiles::get_profile_dir(
        &profiles::ProfileManager::get_current_profile()
            .map(|p| p.id)
            .unwrap_or_else(|| "default".to_string()),
    );
    dir.push("usage_analytics_state.json");
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

/// Per-profile state for anonymous usage analytics (daily session counts).
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UsageAnalyticsState {
    /// Date we're accumulating sessions for (YYYY-MM-DD).
    #[serde(default)]
    pub tracking_date: String,
    /// Session count for tracking_date.
    #[serde(default)]
    pub sessions_count: u32,
    /// Last date we successfully sent a report for.
    #[serde(default)]
    pub last_sent_date: Option<String>,
    /// Pending date we have data for but haven't sent yet (e.g. yesterday).
    #[serde(default)]
    pub pending_date: Option<String>,
    /// Session count for pending_date.
    #[serde(default)]
    pub pending_sessions: u32,
}

impl UsageAnalyticsState {
    pub fn load() -> Self {
        let path = usage_analytics_state_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(state) = serde_json::from_str::<UsageAnalyticsState>(&contents) {
                    return state;
                }
            }
        }
        UsageAnalyticsState::default()
    }
    pub fn save(&self) -> io::Result<()> {
        let path = usage_analytics_state_file();
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
    #[serde(default)]
    pub send_anonymous_usage_statistics: bool,
    #[serde(default)]
    pub sync_cloud_pfp: bool,
    #[serde(default)]
    pub last_synced_cloud_pfp_url: Option<String>,
    pub language: String,
    #[serde(default)]
    pub menu_order: Option<Vec<String>>,
    #[serde(default)]
    pub has_been_through_onboarding: bool,
    #[serde(default)]
    pub has_completed_setup_assistant: bool,
    /// Post-login prompts completed (biometric + usage stats)
    #[serde(default)]
    pub has_completed_post_login_prompts: bool,
    /// Enable biometric (Face ID / fingerprint) to unlock app on mobile
    #[serde(default)]
    pub biometric_enabled: bool,
    #[serde(default)]
    pub separate_rss_feed: bool,
    #[serde(default)]
    pub dashboard_widgets_layout: Option<String>,
    #[serde(default)]
    pub sidebar_folders: Option<Vec<SidebarFolder>>,
    #[serde(default)]
    pub sidebar_favorites: Option<Vec<String>>, // Array of paths
    /// Pages hidden from the sidebar (array of paths)
    #[serde(default)]
    pub disabled_sidebar_pages: Option<Vec<String>>,
    #[serde(default)]
    pub sidebar_recent_activity: Option<Vec<RecentActivity>>,
    #[serde(default)]
    pub downloaded_theme_ids: Option<Vec<String>>, // Array of theme UUIDs from cloud store
    #[serde(default)]
    pub downloaded_theme_metadata: Option<serde_json::Value>, // Map of theme UUID -> { version, checksum, updated_at }
    /// Interface zoom level (0.5 to 2.0, default 1.0)
    #[serde(default)]
    pub zoom_level: Option<f64>,
    /// When true, closing the window hides to system tray. When false, closing fully quits the app.
    #[serde(default = "default_minimize_to_tray")]
    pub minimize_to_tray: bool,
    /// Last settings revision returned by accounts.betterseqta.org (`sync-init` / `POST /api/settings`).
    #[serde(default)]
    pub cloud_settings_server_revision: i64,
    /// ISO 8601 UTC timestamp from server metadata (optional).
    #[serde(default)]
    pub cloud_settings_server_updated_at: Option<String>,
    /// When true, dashboard Today's Schedule widget fits all lessons in the tile width (no horizontal scroll).
    #[serde(default = "default_dashboard_today_schedule_fit_width")]
    pub dashboard_today_schedule_fit_width: bool,
    /// Use a custom image background (file stored in app data dir via background_image commands).
    #[serde(default)]
    pub custom_background_enabled: bool,
    /// Background image fit: cover, contain, or fill.
    #[serde(default = "default_custom_background_fit")]
    pub custom_background_fit: String,
    /// Background image opacity from 0.2 to 1.0.
    #[serde(default = "default_custom_background_opacity")]
    pub custom_background_opacity: f64,
    /// Dark overlay on top of the background (0.0–0.8) for readability.
    #[serde(default)]
    pub custom_background_dim: f64,
}

fn default_minimize_to_tray() -> bool {
    true
}

fn default_dashboard_today_schedule_fit_width() -> bool {
    true
}

fn default_custom_background_fit() -> String {
    "cover".to_string()
}

fn default_custom_background_opacity() -> f64 {
    1.0
}

/// Every setting key that participates in cloud sync (whitelist + patch-tier keys).
/// Kept in sync with `CLOUD_SYNC_SUBSET_KEYS` + patch keys in `src/lib/services/settingsSync.ts`.
/// On load, missing keys are materialized from defaults and persisted so uploads send a full schema.
const CLOUD_SYNC_STORAGE_KEYS: &[&str] = &[
    // Tier 1 — canonical whitelist
    "shortcuts",
    "feeds",
    "weather_enabled",
    "weather_city",
    "weather_country",
    "reminders_enabled",
    "force_use_location",
    "accent_color",
    "theme",
    "current_theme",
    "disable_school_picture",
    "enhanced_animations",
    "gemini_api_key",
    "ai_integrations_enabled",
    "grade_analyser_enabled",
    "lesson_summary_analyser_enabled",
    "quiz_generator_enabled",
    "auto_collapse_sidebar",
    "auto_expand_sidebar_hover",
    "global_search_enabled",
    "dev_sensitive_info_hider",
    "dev_force_offline_mode",
    "accepted_cloud_eula",
    "send_anonymous_usage_statistics",
    "sync_cloud_pfp",
    "language",
    "zoom_level",
    "biometric_enabled",
    "dashboard_today_schedule_fit_width",
    // Tier 2 — synced on patch / full schema
    "auto_dismiss_message_notifications",
    "cerebras_api_key",
    "ai_provider",
    "minimize_to_tray",
    "separate_rss_feed",
    "menu_order",
    "sidebar_folders",
    "sidebar_favorites",
    "disabled_sidebar_pages",
    "downloaded_theme_ids",
    "downloaded_theme_metadata",
    "custom_background_enabled",
    "custom_background_fit",
    "custom_background_opacity",
    "custom_background_dim",
    "has_been_through_onboarding",
    "has_completed_setup_assistant",
    "has_completed_post_login_prompts",
];

fn json_missing_cloud_sync_keys(obj: &serde_json::Value) -> bool {
    let Some(map) = obj.as_object() else {
        return true;
    };
    CLOUD_SYNC_STORAGE_KEYS
        .iter()
        .any(|k| !map.contains_key(*k))
}

/// Insert only absent cloud-sync keys from `settings` into existing JSON (never overwrite present keys).
fn materialize_missing_cloud_sync_keys(
    settings: &Settings,
    root: &mut serde_json::Value,
) -> io::Result<bool> {
    let full = serde_json::to_value(settings).map_err(|e| {
        io::Error::new(io::ErrorKind::InvalidData, e.to_string())
    })?;
    let Some(map) = root.as_object_mut() else {
        return Ok(false);
    };
    let mut changed = false;
    for k in CLOUD_SYNC_STORAGE_KEYS {
        if !map.contains_key(*k) {
            if let Some(v) = full.get(*k) {
                map.insert((*k).to_string(), v.clone());
                changed = true;
            }
        }
    }
    Ok(changed)
}

/// Merge all Settings fields into existing JSON while preserving unknown top-level keys.
fn persist_settings_merging_json(settings: &Settings, original_json: &serde_json::Value) -> io::Result<()> {
    let path = settings_file();
    let merged_settings = serde_json::to_value(settings).map_err(|e| {
        io::Error::new(io::ErrorKind::InvalidData, e.to_string())
    })?;
    let mut root = original_json.clone();
    if let (Some(root_map), Some(settings_map)) = (root.as_object_mut(), merged_settings.as_object()) {
        for (k, v) in settings_map {
            root_map.insert(k.clone(), v.clone());
        }
        fs::write(path, serde_json::to_string(&root).map_err(|e| {
            io::Error::new(io::ErrorKind::InvalidData, e.to_string())
        })?)
    } else {
        settings.save()
    }
}

fn persist_materialized_cloud_sync_keys(settings: &Settings, contents: &str) -> io::Result<()> {
    let path = settings_file();
    let mut json: serde_json::Value = serde_json::from_str(contents).map_err(|e| {
        io::Error::new(io::ErrorKind::InvalidData, e.to_string())
    })?;
    if !json_missing_cloud_sync_keys(&json) {
        return Ok(());
    }
    if materialize_missing_cloud_sync_keys(settings, &mut json)? {
        fs::write(path, serde_json::to_string(&json).map_err(|e| {
            io::Error::new(io::ErrorKind::InvalidData, e.to_string())
        })?)
    } else {
        Ok(())
    }
}

fn settings_value_for_cloud_sync_keys(settings: &Settings) -> Result<serde_json::Value, String> {
    let full = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    let defaults = serde_json::to_value(Settings::default()).map_err(|e| e.to_string())?;
    let mut result = serde_json::Map::new();
    for k in CLOUD_SYNC_STORAGE_KEYS {
        let v = full
            .get(*k)
            .or_else(|| defaults.get(*k))
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        result.insert((*k).to_string(), v);
    }
    Ok(serde_json::Value::Object(result))
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            shortcuts: Vec::new(),
            feeds: Vec::new(),
            weather_enabled: false,
            force_use_location: false,
            weather_city: "Adelaide".to_string(),
            weather_country: "AU".to_string(),
            reminders_enabled: false,
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
            send_anonymous_usage_statistics: false,
            sync_cloud_pfp: false,
            last_synced_cloud_pfp_url: None,
            language: "en".to_string(), // Default to English
            menu_order: None,
            has_been_through_onboarding: false,
            has_completed_setup_assistant: false,
            has_completed_post_login_prompts: false,
            biometric_enabled: false,
            separate_rss_feed: false,
            dashboard_widgets_layout: None,
            sidebar_folders: None,
            sidebar_favorites: None,
            disabled_sidebar_pages: None,
            sidebar_recent_activity: None,
            downloaded_theme_ids: None,
            downloaded_theme_metadata: None,
            zoom_level: None,
            minimize_to_tray: true,
            cloud_settings_server_revision: 0,
            cloud_settings_server_updated_at: None,
            dashboard_today_schedule_fit_width: true,
            custom_background_enabled: false,
            custom_background_fit: default_custom_background_fit(),
            custom_background_opacity: default_custom_background_opacity(),
            custom_background_dim: 0.0,
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
    #[serde(rename = "pfpHash", default)]
    pub pfp_hash: Option<String>,
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
    /// Materializes missing cloud-sync keys without overwriting existing values or unknown JSON keys.
    pub fn load() -> Self {
        let path = settings_file();
        match fs::read_to_string(&path) {
            Ok(contents) if !contents.trim().is_empty() => {
                if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
                    if let Ok(_) = persist_materialized_cloud_sync_keys(&settings, &contents) {
                        // Missing cloud-sync keys added in place; existing keys untouched.
                    } else if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::WARN,
                            "settings",
                            "load",
                            "Could not materialize cloud-sync keys; using loaded settings in memory",
                            serde_json::json!({}),
                        );
                    }
                    settings
                } else if let Ok(existing_json) =
                    serde_json::from_str::<serde_json::Value>(&contents)
                {
                    let settings = Self::merge_with_existing(existing_json.clone());
                    if let Err(e) = persist_settings_merging_json(&settings, &existing_json) {
                        if let Some(logger) = logger::get_logger() {
                            let _ = logger.log(
                                logger::LogLevel::WARN,
                                "settings",
                                "load",
                                &format!("Legacy merge persist failed: {}", e),
                                serde_json::json!({"error": e.to_string()}),
                            );
                        }
                    }
                    settings
                } else {
                    // Unparseable JSON — do not overwrite the file (avoid data loss).
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::ERROR,
                            "settings",
                            "load",
                            "settings.json is corrupt; using in-memory defaults without overwriting disk",
                            serde_json::json!({}),
                        );
                    }
                    Settings::default()
                }
            }
            _ => {
                let settings = Settings::default();
                let _ = settings.save();
                settings
            }
        }
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
        default_settings.send_anonymous_usage_statistics = get_bool(
            &existing_json,
            "send_anonymous_usage_statistics",
            default_settings.send_anonymous_usage_statistics,
        );
        default_settings.sync_cloud_pfp = get_bool(
            &existing_json,
            "sync_cloud_pfp",
            default_settings.sync_cloud_pfp,
        );
        default_settings.last_synced_cloud_pfp_url =
            get_opt_string(&existing_json, "last_synced_cloud_pfp_url");
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
        default_settings.has_completed_post_login_prompts = get_bool(
            &existing_json,
            "has_completed_post_login_prompts",
            default_settings.has_completed_post_login_prompts,
        );
        default_settings.biometric_enabled = get_bool(
            &existing_json,
            "biometric_enabled",
            default_settings.biometric_enabled,
        );
        default_settings.separate_rss_feed = get_bool(
            &existing_json,
            "separate_rss_feed",
            default_settings.separate_rss_feed,
        );
        default_settings.dashboard_today_schedule_fit_width = get_bool(
            &existing_json,
            "dashboard_today_schedule_fit_width",
            default_settings.dashboard_today_schedule_fit_width,
        );
        default_settings.custom_background_enabled = get_bool(
            &existing_json,
            "custom_background_enabled",
            default_settings.custom_background_enabled,
        );
        default_settings.custom_background_fit = existing_json
            .get("custom_background_fit")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(default_custom_background_fit);
        default_settings.custom_background_opacity = existing_json
            .get("custom_background_opacity")
            .and_then(|v| v.as_f64())
            .unwrap_or_else(default_custom_background_opacity);
        default_settings.custom_background_dim = existing_json
            .get("custom_background_dim")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        default_settings.minimize_to_tray = get_bool(
            &existing_json,
            "minimize_to_tray",
            default_settings.minimize_to_tray,
        );
        default_settings.cloud_settings_server_revision = existing_json
            .get("cloud_settings_server_revision")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        default_settings.cloud_settings_server_updated_at =
            get_opt_string(&existing_json, "cloud_settings_server_updated_at");
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

        // Merge disabled sidebar pages
        default_settings.disabled_sidebar_pages =
            get_opt_string_array(&existing_json, "disabled_sidebar_pages");

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
    let full = serde_json::to_value(&settings).map_err(|e| e.to_string())?;
    let mut result = serde_json::Map::new();
    for k in keys {
        if let Some(v) = full.get(&k) {
            result.insert(k, v.clone());
        }
    }
    Ok(serde_json::Value::Object(result))
}

/// Full cloud-sync schema snapshot (all tier-1 + tier-2 sync keys with defaults materialized).
#[tauri::command]
pub fn get_cloud_sync_settings() -> Result<serde_json::Value, String> {
    let settings = Settings::load();
    settings_value_for_cloud_sync_keys(&settings)
}

/// Merge partial settings into current settings and save (coalesces get+save into one call).
#[tauri::command]
pub fn save_settings_merge(patch: serde_json::Value) -> Result<(), String> {
    let current = Settings::load();
    let mut current_val = serde_json::to_value(current).map_err(|e| e.to_string())?;

    // Shallow merge top-level keys from patch into current
    if let (Some(obj_curr), Some(obj_patch)) = (current_val.as_object_mut(), patch.as_object()) {
        for (k, v) in obj_patch.iter() {
            // Never persist API envelope keys from POST /api/settings
            if k == "ok" || k == "server" || k == "patch" {
                continue;
            }
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

/// Remove cloud tokens only (401 / refresh failure). Keeps `previously_signed_into_cloud` so the UI can toast "signed out".
#[tauri::command]
pub fn clear_expired_cloud_session() -> Result<(), String> {
    CloudToken::clear_file().map_err(|e| e.to_string())
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
pub fn get_usage_analytics_state() -> UsageAnalyticsState {
    UsageAnalyticsState::load()
}

#[tauri::command]
pub fn increment_usage_analytics_session() -> Result<UsageAnalyticsState, String> {
    use chrono::Utc;
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut state = UsageAnalyticsState::load();
    if state.tracking_date.is_empty() {
        state.tracking_date = today.clone();
        state.sessions_count = 1;
    } else if state.tracking_date == today {
        state.sessions_count += 1;
    } else {
        // New day: move current to pending, start fresh for today
        state.pending_date = Some(state.tracking_date.clone());
        state.pending_sessions = state.sessions_count;
        state.tracking_date = today.clone();
        state.sessions_count = 1;
    }
    state.save().map_err(|e| e.to_string())?;
    Ok(state)
}

#[tauri::command]
pub fn mark_usage_analytics_sent_and_reset(date: String) -> Result<UsageAnalyticsState, String> {
    use chrono::Utc;
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut state = UsageAnalyticsState::load();
    state.last_sent_date = Some(date.clone());
    if state.pending_date.as_deref() == Some(date.as_str()) {
        state.pending_date = None;
        state.pending_sessions = 0;
    }
    if state.tracking_date == date {
        state.tracking_date = today;
        state.sessions_count = 1;
    }
    state.save().map_err(|e| e.to_string())?;
    Ok(state)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageAnalyticsPayload {
    pub date: String,
    pub sessions_count: u32,
    pub cloud_signed_in: bool,
    pub app_version: String,
    pub platform: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
}

#[tauri::command]
pub async fn send_usage_analytics_report(payload: UsageAnalyticsPayload) -> Result<bool, String> {
    let url = "https://betterseqta.org/api/analytics/usage";
    let client = reqwest::Client::new();

    let mut request = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&payload);

    if payload.cloud_signed_in {
        let cloud_token = CloudToken::load();
        if let Some(ref token) = cloud_token.token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    Ok(response.status().is_success())
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

#[cfg(test)]
mod cloud_sync_storage_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_keys_detects_absent_cloud_sync_key() {
        assert!(json_missing_cloud_sync_keys(&json!({"theme": "dark"})));
    }

    #[test]
    fn missing_keys_treats_null_as_present() {
        let mut obj = serde_json::Map::new();
        obj.insert("theme".to_string(), json!("dark"));
        for k in CLOUD_SYNC_STORAGE_KEYS {
            if *k != "theme" {
                obj.insert((*k).to_string(), serde_json::Value::Null);
            }
        }
        assert!(!json_missing_cloud_sync_keys(&serde_json::Value::Object(obj)));
    }

    #[test]
    fn materialize_preserves_existing_and_unknown_keys() {
        let mut json = json!({
            "theme": "light",
            "accent_color": "#ff0000",
            "legacy_unknown_key": true
        });
        let settings = Settings::default();
        assert!(json_missing_cloud_sync_keys(&json));
        materialize_missing_cloud_sync_keys(&settings, &mut json).unwrap();
        assert_eq!(json["theme"], "light");
        assert_eq!(json["accent_color"], "#ff0000");
        assert_eq!(json["legacy_unknown_key"], true);
        assert_eq!(json["language"], "en");
        assert!(!json_missing_cloud_sync_keys(&json));
    }

    #[test]
    fn materialize_does_not_overwrite_existing_values() {
        let mut json = json!({
            "theme": "light",
            "language": "de"
        });
        let settings = Settings::default();
        materialize_missing_cloud_sync_keys(&settings, &mut json).unwrap();
        assert_eq!(json["theme"], "light");
        assert_eq!(json["language"], "de");
    }

    #[test]
    fn cloud_sync_snapshot_includes_all_storage_keys() {
        let settings = Settings::default();
        let snapshot = settings_value_for_cloud_sync_keys(&settings).unwrap();
        let obj = snapshot.as_object().unwrap();
        assert_eq!(obj.len(), CLOUD_SYNC_STORAGE_KEYS.len());
        for k in CLOUD_SYNC_STORAGE_KEYS {
            assert!(obj.contains_key(*k), "missing key in snapshot: {}", k);
        }
    }
}
