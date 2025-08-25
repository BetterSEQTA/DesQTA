# File System & Data Persistence

This document covers DesQTA's comprehensive file system architecture, data persistence patterns, caching strategies, and cross-platform storage solutions.

## 🏗 File System Architecture

DesQTA implements a multi-layered file system architecture that handles:

- **Cross-Platform Storage**: Consistent file paths across Windows, macOS, Linux, Android, iOS
- **Data Persistence**: Secure local storage for settings, sessions, and user data
- **Cache Management**: Intelligent caching with TTL and memory management
- **Cloud Synchronization**: Bidirectional sync with BetterSEQTA Cloud
- **File Operations**: Upload, download, and manipulation of various file types
- **Error Handling**: Robust error recovery and data integrity

### Storage Hierarchy

```
Application Data Directory/
├── DesQTA/
│   ├── settings.json           # User preferences and configuration
│   ├── session.json            # Authentication session data
│   ├── seqtaConfig.json       # SEQTA-specific configuration
│   ├── analytics.json         # Performance and usage analytics
│   ├── cloud_token.json       # BetterSEQTA Cloud authentication
│   └── cache/                 # Temporary cached data
│       ├── messages/          # Cached message content
│       ├── images/            # Cached images and media
│       └── api/               # Cached API responses
```

### Cross-Platform Path Resolution

```rust
fn get_app_data_dir() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // Android: Use app's internal storage (private to app)
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        dir
    }
    #[cfg(target_os = "ios")]
    {
        // iOS: Use Documents directory
        let mut dir = dirs_next::document_dir()
            .expect("Unable to determine documents dir");
        dir.push("DesQTA");
        dir
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Desktop: Use system data directory
        // Windows: %APPDATA%/DesQTA
        // macOS: ~/Library/Application Support/DesQTA
        // Linux: ~/.local/share/DesQTA
        let mut dir = dirs_next::data_dir()
            .expect("Unable to determine data dir");
        dir.push("DesQTA");
        dir
    }
}
```

## 📁 Core Data Structures

### Settings Management

The settings system provides comprehensive application configuration with smart migration and cloud sync capabilities.

#### Settings Data Structure

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    // User Interface
    pub accent_color: String,
    pub theme: String,
    pub current_theme: Option<String>,
    pub enhanced_animations: bool,
    pub disable_school_picture: bool,
    pub auto_collapse_sidebar: bool,
    pub auto_expand_sidebar_hover: bool,
    
    // Features
    pub global_search_enabled: bool,
    pub weather_enabled: bool,
    pub weather_city: String,
    pub weather_country: String,
    pub reminders_enabled: bool,
    pub force_use_location: bool,
    
    // AI Integration
    pub gemini_api_key: Option<String>,
    pub ai_integrations_enabled: Option<bool>,
    pub grade_analyser_enabled: Option<bool>,
    pub lesson_summary_analyser_enabled: Option<bool>,
    
    // User Content
    pub shortcuts: Vec<Shortcut>,
    pub feeds: Vec<Feed>,
    pub widget_layout: Vec<WidgetLayout>,
    
    // Development
    pub dev_sensitive_info_hider: bool,
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
    pub width: i32,    // 1 = half width, 2 = full width
    pub height: i32,   // 1 = normal height, 2 = double height
    pub enabled: bool,
}
```

#### Smart Settings Migration

The settings system includes intelligent migration that preserves user data when new fields are added:

```rust
impl Settings {
    pub fn load() -> Self {
        let path = settings_file();
        if let Ok(mut file) = fs::File::open(&path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                // Try to parse as current Settings struct first
                if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
                    return settings;
                }
                
                // If that fails, perform smart merge with existing JSON
                if let Ok(existing_json) = serde_json::from_str::<serde_json::Value>(&contents) {
                    return Self::merge_with_existing(existing_json);
                }
            }
        }
        Settings::default()
    }

    fn merge_with_existing(existing_json: serde_json::Value) -> Self {
        let mut default_settings = Settings::default();
        
        if let serde_json::Value::Object(existing_map) = existing_json {
            // Preserve existing shortcuts
            if let Some(shortcuts) = existing_map.get("shortcuts") {
                if let Ok(shortcuts) = serde_json::from_value::<Vec<Shortcut>>(shortcuts.clone()) {
                    default_settings.shortcuts = shortcuts;
                }
            }
            
            // Preserve existing feeds
            if let Some(feeds) = existing_map.get("feeds") {
                if let Ok(feeds) = serde_json::from_value::<Vec<Feed>>(feeds.clone()) {
                    default_settings.feeds = feeds;
                }
            }
            
            // Preserve UI settings
            if let Some(accent_color) = existing_map.get("accent_color") {
                if let Some(color) = accent_color.as_str() {
                    default_settings.accent_color = color.to_string();
                }
            }
            
            if let Some(theme) = existing_map.get("theme") {
                if let Some(theme_str) = theme.as_str() {
                    default_settings.theme = theme_str.to_string();
                }
            }
            
            // Preserve boolean settings
            default_settings.weather_enabled = get_bool(&existing_json, "weather_enabled", default_settings.weather_enabled);
            default_settings.enhanced_animations = get_bool(&existing_json, "enhanced_animations", default_settings.enhanced_animations);
            default_settings.global_search_enabled = get_bool(&existing_json, "global_search_enabled", default_settings.global_search_enabled);
            
            // Preserve widget layout
            if let Some(widget_layout) = existing_map.get("widget_layout") {
                if let Ok(layouts) = serde_json::from_value::<Vec<WidgetLayout>>(widget_layout.clone()) {
                    default_settings.widget_layout = layouts;
                }
            }
        }
        
        default_settings
    }

    pub fn save(&self) -> io::Result<()> {
        let path = settings_file();
        
        // Ensure directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        // Write settings atomically
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, serde_json::to_string_pretty(self)?)?;
        fs::rename(temp_path, path)?;
        
        Ok(())
    }
}
```

#### Settings Commands

```rust
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
    serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings_from_json(json: String) -> Result<(), String> {
    let settings: Settings = serde_json::from_str(&json)
        .map_err(|e| e.to_string())?;
    settings.save().map_err(|e| e.to_string())
}
```

### Session Persistence

Session data is securely stored and managed across application restarts.

#### Session Data Structure

```rust
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Session {
    pub base_url: String,               // SEQTA server URL
    pub jsessionid: String,             // Session identifier/JWT token
    pub additional_cookies: Vec<Cookie>, // Additional authentication cookies
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cookie {
    pub name: String,                   // Cookie name
    pub value: String,                  // Cookie value
    pub domain: Option<String>,         // Cookie domain
    pub path: Option<String>,           // Cookie path
}
```

#### Session Operations

```rust
impl Session {
    pub fn load() -> Self {
        let path = session_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(sess) = serde_json::from_str::<Session>(&contents) {
                    return sess;
                }
            }
        }
        Session::default()
    }

    pub fn save(&self) -> io::Result<()> {
        let path = session_file();
        
        // Ensure directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        // Write session data with restrictive permissions
        let data = serde_json::to_string(self)?;
        fs::write(&path, data)?;
        
        // Set restrictive permissions on Unix systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&path)?.permissions();
            perms.set_mode(0o600); // Owner read/write only
            fs::set_permissions(&path, perms)?;
        }
        
        Ok(())
    }

    pub fn exists() -> bool {
        let s = Self::load();
        !(s.base_url.is_empty() || s.jsessionid.is_empty())
    }

    pub fn clear_file() -> io::Result<()> {
        let path = session_file();
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}
```

### Analytics Data Storage

Analytics data is collected and stored for performance monitoring and user insights.

#### Analytics Data Structure

```rust
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

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub page_load_times: HashMap<String, Vec<u64>>,
    pub api_response_times: HashMap<String, Vec<u64>>,
    pub error_counts: HashMap<String, u32>,
    pub feature_usage: HashMap<String, u32>,
    pub session_duration: u64,
    pub memory_usage: Vec<MemorySnapshot>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySnapshot {
    pub timestamp: u64,
    pub heap_used: u64,
    pub heap_total: u64,
}
```

#### Analytics Commands

```rust
#[tauri::command]
pub fn save_analytics(data: String) -> Result<(), String> {
    let path = analytics_file();
    
    // Validate JSON before saving
    let _: serde_json::Value = serde_json::from_str(&data)
        .map_err(|e| format!("Invalid analytics data: {}", e))?;
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
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
        fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}
```

### SEQTA Configuration Management

SEQTA-specific configuration is stored separately for modularity and easy management.

#### Configuration Operations

```rust
#[tauri::command]
pub fn load_seqta_config() -> Option<Value> {
    let path = config_file();
    if let Ok(mut file) = fs::File::open(&path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                return Some(json);
            }
        }
    }
    None
}

#[tauri::command]
pub fn save_seqta_config(config: Value) -> Result<(), String> {
    let path = config_file();
    
    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let formatted_json = serde_json::to_string_pretty(&config)
        .map_err(|e| e.to_string())?;
    
    fs::write(path, formatted_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_seqta_config_different(new_config: Value) -> bool {
    let current = load_seqta_config();
    match current {
        Some(existing) => existing != new_config,
        None => true,
    }
}
```

## 💾 Client-Side Caching System

The frontend implements a sophisticated caching system for optimal performance and offline capability.

### Cache Architecture

```typescript
interface CacheItem<T> {
  data: T;
  timestamp: number;  // Expiration timestamp
}

class Cache {
  private static instance: Cache;
  private cache: Map<string, CacheItem<any>>;
  private defaultTTL: number = 5; // 5 minutes default

  // Common TTL presets in minutes
  static readonly TTL = {
    SHORT: 5,        // 5 minutes - API responses
    MEDIUM: 15,      // 15 minutes - User data
    LONG: 60,        // 1 hour - Static content
    VERY_LONG: 1440, // 24 hours - Configuration
  };

  private constructor() {
    this.cache = new Map();
    this.startCleanupInterval();
  }

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }
}
```

### Cache Operations

```typescript
public set<T>(key: string, data: T, ttlMinutes: number = this.defaultTTL): void {
  this.cache.set(key, {
    data,
    timestamp: Date.now() + ttlMinutes * 60 * 1000,
  });
  
  // Trigger cleanup if cache is getting large
  if (this.cache.size > 1000) {
    this.cleanup();
  }
}

public get<T>(key: string): T | null {
  const item = this.cache.get(key);
  if (!item) return null;

  // Check expiration
  if (Date.now() > item.timestamp) {
    this.cache.delete(key);
    return null;
  }

  return item.data as T;
}

public has(key: string): boolean {
  const item = this.cache.get(key);
  if (!item) return false;

  if (Date.now() > item.timestamp) {
    this.cache.delete(key);
    return false;
  }

  return true;
}

private cleanup(): void {
  const now = Date.now();
  for (const [key, item] of this.cache.entries()) {
    if (now > item.timestamp) {
      this.cache.delete(key);
    }
  }
}

private startCleanupInterval(): void {
  // Clean up expired items every 5 minutes
  setInterval(() => this.cleanup(), 5 * 60 * 1000);
}
```

### Cache Usage Patterns

```typescript
// Message content caching
const cacheKey = `message_${messageId}`;
const cachedContent = cache.get<string>(cacheKey);

if (cachedContent) {
  message.body = cachedContent;
} else {
  const content = await fetchMessageContent(messageId);
  cache.set(cacheKey, content, Cache.TTL.VERY_LONG); // 24 hours
  message.body = content;
}

// API response caching
const apiCacheKey = `api_${endpoint}_${JSON.stringify(params)}`;
const cachedResponse = cache.get<ApiResponse>(apiCacheKey);

if (cachedResponse) {
  return cachedResponse;
} else {
  const response = await apiCall(endpoint, params);
  cache.set(apiCacheKey, response, Cache.TTL.MEDIUM); // 15 minutes
  return response;
}

// User preference caching
const prefKey = `user_pref_${userId}`;
cache.set(prefKey, userPreferences, Cache.TTL.LONG); // 1 hour
```

## ☁️ Cloud Synchronization

DesQTA provides bidirectional synchronization with BetterSEQTA Cloud for settings and user data.

### Cloud Token Management

```rust
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CloudToken {
    pub token: Option<String>,
    pub user: Option<CloudUser>,
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
        
        // Ensure directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        // Encrypt sensitive data before storage
        let encrypted_data = self.encrypt()?;
        fs::write(path, encrypted_data)?;
        
        Ok(())
    }
    
    fn encrypt(&self) -> io::Result<String> {
        // In production, implement proper encryption
        // For now, use base64 encoding as placeholder
        let json = serde_json::to_string(self)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        
        use base64::{engine::general_purpose, Engine as _};
        Ok(general_purpose::STANDARD.encode(json.as_bytes()))
    }
    
    fn decrypt(data: &str) -> io::Result<Self> {
        use base64::{engine::general_purpose, Engine as _};
        let decoded = general_purpose::STANDARD.decode(data)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        
        let json = String::from_utf8(decoded)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        
        serde_json::from_str(&json)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }
}
```

### Settings Cloud Sync

```rust
#[tauri::command]
pub async fn upload_settings_to_cloud() -> Result<(), String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token
        .ok_or("No cloud token found. Please authenticate first.")?;
    
    let settings = Settings::load();
    let settings_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| e.to_string())?;
    
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    
    // Create multipart form for file upload
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
    
    if !response.status().is_success() {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Upload failed: {} - {}", response.status(), error_text));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn download_settings_from_cloud() -> Result<Settings, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token
        .ok_or("No cloud token found. Please authenticate first.")?;
    
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    
    // List files to find settings file
    let response = client
        .get(&format!("{}/files/list", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .query(&[("search", "desqta-settings.json"), ("limit", "10")])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("List files failed: {} - {}", response.status(), error_text));
    }
    
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    let file_list: FileListResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {} - Raw: {}", e, response_text))?;
    
    let settings_file = file_list.files.iter()
        .find(|file| file.filename == "desqta-settings.json")
        .ok_or("No settings file found in cloud")?;
    
    // Download the settings file
    let download_url = if settings_file.is_public {
        format!("{}/files/public/{}", base_url, settings_file.stored_name)
    } else {
        format!("{}/files/{}", base_url, settings_file.stored_name)
    };
    
    let mut request_builder = client.get(&download_url)
        .header("Accept", "*/*");
    
    if !settings_file.is_public {
        request_builder = request_builder
            .header("Authorization", format!("Bearer {}", token));
    }
    
    let download_response = request_builder.send().await
        .map_err(|e| format!("Download error: {}", e))?;
    
    if !download_response.status().is_success() {
        return Err(format!("Download failed: {}", download_response.status()));
    }
    
    let settings_json = download_response.text().await
        .map_err(|e| format!("Failed to read download: {}", e))?;
    
    let settings: Settings = serde_json::from_str(&settings_json)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;
    
    // Save downloaded settings locally
    settings.save().map_err(|e| e.to_string())?;
    
    Ok(settings)
}

#[tauri::command]
pub async fn check_cloud_settings() -> Result<bool, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token
        .ok_or("No cloud token found. Please authenticate first.")?;
    
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    
    let response = client
        .get(&format!("{}/files/list", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .query(&[("search", "desqta-settings.json"), ("limit", "1")])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        return Ok(false);
    }
    
    let response_text = response.text().await
        .map_err(|_| "Failed to read response")?;
    
    let file_list: FileListResponse = serde_json::from_str(&response_text)
        .map_err(|_| "Failed to parse response")?;
    
    Ok(!file_list.files.is_empty())
}
```

## 📤 File Upload & Download

DesQTA supports various file operations for both SEQTA integration and cloud storage.

### SEQTA File Upload

```rust
#[tauri::command]
pub async fn upload_seqta_file(file_name: String, file_path: String) -> Result<String, String> {
    let client = create_client();
    let session = session::Session::load();

    // Read the file content
    let file_content = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let url = format!("{}/seqta/student/file/upload/xhr2", session.base_url);
    let mut request = client.post(&url);
    request = append_default_headers(request).await;

    // URL encode filename for proper handling
    let url_filename: String = form_urlencoded::byte_serialize(&file_name.as_bytes()).collect();

    // Set headers exactly like the web UI
    request = request.header("X-File-Name", url_filename);
    request = request.header("X-Accept-Mimes", "null");
    request = request.header("X-Requested-With", "XMLHttpRequest");

    let response = request.body(file_content).send().await
        .map_err(|e| format!("File upload failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Upload failed with status: {}", response.status()));
    }

    response.text().await.map_err(|e| e.to_string())
}
```

### Cloud File Operations

```rust
#[tauri::command]
pub async fn upload_attachment(token: String, file_path: String) -> Result<Attachment, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/files/upload", BASE_URL);
    
    // Use temp directory for the full path
    let temp_dir = std::env::temp_dir();
    let full_path = temp_dir.join(&file_path);
    
    // Read the file
    let file_bytes = std::fs::read(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    
    // Create multipart form
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name.to_string())
            .mime_str("application/octet-stream").unwrap());
    
    let response = client.post(&url).multipart(form).send().await
        .map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to upload file: {}", response.status()));
    }
    
    let attachment = response.json::<Attachment>().await
        .map_err(|e| e.to_string())?;
    
    Ok(attachment)
}

#[tauri::command]
pub async fn write_temp_file(file_name: String, data: Vec<u8>) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&file_name);
    
    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    use std::io::Write;
    file.write_all(&data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn delete_temp_file(file_name: String) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&file_name);
    
    if file_path.exists() {
        std::fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete temp file: {}", e))?;
    }
    
    Ok(())
}
```

## 🛠 Error Handling & Recovery

DesQTA implements comprehensive error handling for file operations with automatic recovery mechanisms.

### Frontend Error Handling

```typescript
// Error handling utility functions
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage?: string,
  status: number = 500
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'An error occurred');
    errorService.handleManualError(message, status);
    return null;
  }
}

// Safe Tauri invoke with error handling
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, any>,
  errorMessage?: string
): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (error) {
    const message = errorMessage || (error instanceof Error ? error.message : 'Tauri command failed');
    errorService.handleManualError(message, 500);
    return null;
  }
}

// File operation error handling
export async function safeFileOperation<T>(
  operation: () => Promise<T>,
  retryCount: number = 3,
  retryDelay: number = 1000
): Promise<T | null> {
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retryCount - 1) {
        console.error(`File operation failed after ${retryCount} attempts:`, error);
        return null;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }
  
  return null;
}
```

### Backend Error Recovery

```rust
// Atomic file operations with backup
pub fn save_with_backup<T: Serialize>(data: &T, path: &PathBuf) -> io::Result<()> {
    // Create backup if file exists
    if path.exists() {
        let backup_path = path.with_extension("bak");
        fs::copy(path, &backup_path)?;
    }
    
    // Write to temporary file first
    let temp_path = path.with_extension("tmp");
    let serialized = serde_json::to_string_pretty(data)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    
    fs::write(&temp_path, serialized)?;
    
    // Atomic rename
    fs::rename(temp_path, path)?;
    
    Ok(())
}

// Load with fallback to backup
pub fn load_with_fallback<T: DeserializeOwned>(path: &PathBuf) -> Option<T> {
    // Try loading main file
    if let Ok(data) = load_file::<T>(path) {
        return Some(data);
    }
    
    // Try loading backup
    let backup_path = path.with_extension("bak");
    if let Ok(data) = load_file::<T>(&backup_path) {
        // Restore from backup
        let _ = fs::copy(&backup_path, path);
        return Some(data);
    }
    
    None
}

fn load_file<T: DeserializeOwned>(path: &PathBuf) -> io::Result<T> {
    let contents = fs::read_to_string(path)?;
    serde_json::from_str(&contents)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

// Directory creation with error handling
pub fn ensure_directory_exists(path: &PathBuf) -> io::Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
        
        // Set appropriate permissions
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(path)?.permissions();
            perms.set_mode(0o755); // Owner full, group/others read+execute
            fs::set_permissions(path, perms)?;
        }
    }
    
    Ok(())
}
```

## 🔒 Security Considerations

### File System Security

```rust
// Secure file path validation
pub fn validate_file_path(path: &str) -> Result<PathBuf, String> {
    let path_buf = PathBuf::from(path);
    
    // Prevent directory traversal
    if path.contains("..") || path.contains("~") {
        return Err("Invalid path: directory traversal not allowed".to_string());
    }
    
    // Ensure path is within app directory
    let app_dir = get_app_data_dir();
    let canonical_path = path_buf.canonicalize()
        .map_err(|_| "Invalid path: cannot resolve".to_string())?;
    
    if !canonical_path.starts_with(&app_dir) {
        return Err("Invalid path: outside app directory".to_string());
    }
    
    Ok(canonical_path)
}

// Secure temporary file handling
pub fn create_secure_temp_file(prefix: &str) -> io::Result<(PathBuf, fs::File)> {
    let temp_dir = std::env::temp_dir();
    let mut temp_path = temp_dir.join(format!("{}_", prefix));
    
    // Generate random suffix
    use rand::Rng;
    let suffix: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();
    
    temp_path.set_file_name(format!("{}_{}", prefix, suffix));
    
    // Create file with restrictive permissions
    let file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .read(true)
        .open(&temp_path)?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = file.metadata()?.permissions();
        perms.set_mode(0o600); // Owner read/write only
        file.set_permissions(perms)?;
    }
    
    Ok((temp_path, file))
}
```

### Data Encryption

```rust
// Simple encryption for sensitive data (placeholder for production encryption)
pub fn encrypt_sensitive_data(data: &str) -> Result<String, String> {
    // In production, use proper encryption like AES-256-GCM
    // This is a placeholder implementation
    use base64::{engine::general_purpose, Engine as _};
    
    let encoded = general_purpose::STANDARD.encode(data.as_bytes());
    Ok(encoded)
}

pub fn decrypt_sensitive_data(encrypted_data: &str) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let decoded = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    
    String::from_utf8(decoded)
        .map_err(|e| format!("Invalid UTF-8: {}", e))
}
```

## 📊 Performance Optimization

### Lazy Loading and Streaming

```rust
// Stream large files instead of loading entirely into memory
pub async fn stream_large_file(path: &PathBuf) -> Result<impl Stream<Item = io::Result<Bytes>>, String> {
    use tokio::fs::File;
    use tokio_util::codec::{BytesCodec, FramedRead};
    
    let file = File::open(path).await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let stream = FramedRead::new(file, BytesCodec::new())
        .map_ok(|bytes| bytes.freeze());
    
    Ok(stream)
}

// Chunked file processing
pub async fn process_file_in_chunks<F>(
    path: &PathBuf,
    chunk_size: usize,
    mut processor: F,
) -> Result<(), String>
where
    F: FnMut(&[u8]) -> Result<(), String>,
{
    use tokio::fs::File;
    use tokio::io::AsyncReadExt;
    
    let mut file = File::open(path).await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let mut buffer = vec![0u8; chunk_size];
    
    loop {
        let bytes_read = file.read(&mut buffer).await
            .map_err(|e| format!("Failed to read file: {}", e))?;
        
        if bytes_read == 0 {
            break; // EOF
        }
        
        processor(&buffer[..bytes_read])?;
    }
    
    Ok(())
}
```

### Cache Optimization

```typescript
// Advanced cache with size limits and LRU eviction
class AdvancedCache {
  private cache: Map<string, CacheItem<any>>;
  private accessOrder: string[];
  private maxSize: number;
  private currentSize: number;

  constructor(maxSize: number = 100 * 1024 * 1024) { // 100MB default
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = maxSize;
    this.currentSize = 0;
  }

  public set<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const serialized = JSON.stringify(data);
    const size = new Blob([serialized]).size;
    
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.delete(key);
    }
    
    // Evict items if necessary
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttlMinutes * 60 * 1000,
      size,
    });
    
    this.accessOrder.push(key);
    this.currentSize += size;
  }

  public get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiration
    if (Date.now() > item.timestamp) {
      this.delete(key);
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);
    return item.data as T;
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private delete(key: string): void {
    const item = this.cache.get(key);
    if (item) {
      this.cache.delete(key);
      this.currentSize -= item.size;
      
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }
}
```

## 🔮 Future Enhancements

### Planned Features

1. **Database Integration**
   - SQLite support for complex queries
   - Full-text search capabilities
   - Relationship management

2. **Advanced Encryption**
   - AES-256-GCM encryption for sensitive data
   - Key derivation from user credentials
   - Hardware security module integration

3. **Offline Capabilities**
   - Offline-first architecture
   - Conflict resolution for sync
   - Background synchronization

4. **Performance Improvements**
   - Memory-mapped files for large datasets
   - Compression for stored data
   - Incremental backups

### Implementation Roadmap

```rust
// Future database integration
#[tauri::command]
pub async fn init_database() -> Result<(), String> {
    // Initialize SQLite database
    todo!("Implement SQLite integration")
}

// Future encryption service
pub struct EncryptionService {
    key: [u8; 32],
}

impl EncryptionService {
    pub fn new(password: &str) -> Result<Self, String> {
        // Derive key from password using PBKDF2
        todo!("Implement proper key derivation")
    }
    
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>, String> {
        // AES-256-GCM encryption
        todo!("Implement AES encryption")
    }
    
    pub fn decrypt(&self, encrypted_data: &[u8]) -> Result<Vec<u8>, String> {
        // AES-256-GCM decryption
        todo!("Implement AES decryption")
    }
}
```

---

**Related Documentation:**
- [Backend Architecture](./README.md) - Overall Rust backend structure
- [Authentication System](./authentication.md) - Session and token management
- [Frontend Architecture](../frontend/README.md) - Frontend data integration
- [Theme System](../frontend/theme-system.md) - Settings and configuration 