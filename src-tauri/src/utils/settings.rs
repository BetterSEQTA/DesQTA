use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
};
use reqwest;
use serde_json;

#[path = "session.rs"]
mod session;

/// Location: `$DATA_DIR/DesQTA/settings.json`
fn settings_file() -> PathBuf {
    let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
    dir.push("DesQTA");
    if !dir.exists() {
        fs::create_dir_all(&dir).expect("Unable to create data dir");
    }
    dir.push("settings.json");
    dir
}

fn cloud_token_file() -> PathBuf {
    let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
    dir.push("DesQTA");
    if !dir.exists() {
        fs::create_dir_all(&dir).expect("Unable to create data dir");
    }
    dir.push("cloud_token.json");
    dir
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
            theme: "system".to_string(), // Default to dark theme
            disable_school_picture: false,
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
pub struct CloudUser {
    pub id: i32,
    pub email: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "pfpUrl")]
    pub pfp_url: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

// Cloud API types
#[derive(Debug, Serialize, Deserialize)]
struct CloudFile {
    id: i32,
    #[serde(rename = "userId")]
    user_id: i32, // Now guaranteed to be present
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

#[derive(Debug, Serialize, Deserialize)]
struct APIError {
    statusCode: i32,
    statusMessage: String,
}

impl Settings {
    /// Load from disk; returns default if none.
    pub fn load() -> Self {
        let path = settings_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
                    return settings;
                }
            }
        }
        Settings::default()
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
    Settings::load()
}

#[tauri::command]
pub fn save_settings(new_settings: Settings) -> Result<(), String> {
    new_settings.save().map_err(|e| e.to_string())
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
    let base_url = "https://accounts.betterseqta.org/api";
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
    cloud_token.save().map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
pub fn get_cloud_user() -> Option<CloudUser> {
    let cloud_token = CloudToken::load();
    cloud_token.user
}

#[tauri::command]
pub fn clear_cloud_token() -> Result<(), String> {
    CloudToken::clear_file().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_settings_to_cloud() -> Result<(), String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.clone().ok_or("No cloud token found. Please authenticate first.")?;
    let base_url = "https://accounts.betterseqta.org/api";
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
    let base_url = "https://accounts.betterseqta.org/api";
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
    let base_url = "https://accounts.betterseqta.org/api";
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
