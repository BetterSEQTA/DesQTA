# Rust Backend Architecture

This document covers the comprehensive Rust backend architecture of DesQTA, built on Tauri v2, providing native desktop functionality, secure API communication, and cross-platform compatibility.

## 🏗 Backend Architecture Overview

DesQTA's backend is implemented in Rust using the Tauri framework, providing:

- **Native Desktop Integration**: System tray, notifications, file system access
- **Secure API Communication**: Session management and HTTP client
- **Cross-Platform Support**: Windows, macOS, Linux, Android, iOS
- **Cloud Messaging**: Real-time communication via BetterSEQTA Cloud
- **Data Persistence**: Local storage with encryption support
- **Global Search**: System-wide search functionality

### Technology Stack

- **Framework**: Tauri v2.0
- **Language**: Rust (Edition 2021)
- **HTTP Client**: reqwest with cookie jar support
- **Serialization**: serde with JSON support
- **File System**: Cross-platform path handling
- **Notifications**: Native system notifications
- **Tray Integration**: System tray with context menus

## 📁 Project Structure

```
src-tauri/src/
├── lib.rs                      # Main application entry and command registration
├── main.rs                     # Application entrypoint
├── auth/
│   └── login.rs               # Authentication and session management
├── utils/
│   ├── netgrab.rs             # HTTP client and API communication
│   ├── settings.rs            # Application settings and cloud sync
│   ├── session.rs             # Session persistence and management
│   ├── analytics.rs           # Data collection and analytics
│   ├── seqta_config.rs        # SEQTA configuration management
│   └── cloudmessaging.rs      # BetterSEQTA Cloud messaging
├── desqta-fs/
│   └── save.rs                # File system operations
└── global_search.rs           # Global search functionality
```

## 🚀 Application Entry Point (`lib.rs`)

The main application entry point handles Tauri setup, command registration, and system integration.

### Core Application Setup

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimize"]),
        ));
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Handle single instance logic
            if let Some(window) = app.webview_windows().get("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            
            // Handle deep link in single instance
            if let Some(url) = argv.get(1) {
                if url.starts_with("desqta://auth") {
                    // Process authentication deep link
                }
            }
        }));
    }
}
```

### Command Registration

All Rust functions exposed to the frontend are registered as Tauri commands:

```rust
.invoke_handler(tauri::generate_handler![
    // Basic application commands
    greet,
    quit,
    enable_autostart,
    disable_autostart,
    is_autostart_enabled,
    
    // Network and API commands
    netgrab::get_api_data,
    netgrab::open_url,
    netgrab::get_rss_feed,
    netgrab::post_api_data,
    netgrab::fetch_api_data,
    netgrab::get_seqta_file,
    netgrab::upload_seqta_file,
    
    // Authentication commands
    login::check_session_exists,
    login::save_session,
    login::create_login_window,
    login::logout,
    login::force_reload,
    
    // Settings management
    settings::get_settings,
    settings::save_settings,
    settings::get_settings_json,
    settings::save_settings_from_json,
    settings::save_cloud_token,
    settings::get_cloud_user,
    settings::clear_cloud_token,
    settings::upload_settings_to_cloud,
    settings::download_settings_from_cloud,
    settings::check_cloud_settings,
    
    // Analytics and data
    analytics::save_analytics,
    analytics::load_analytics,
    analytics::delete_analytics,
    
    // SEQTA configuration
    seqta_config::load_seqta_config,
    seqta_config::save_seqta_config,
    seqta_config::is_seqta_config_different,
    
    // Cloud messaging
    cloudmessaging::get_friends,
    cloudmessaging::send_message,
    cloudmessaging::get_messages,
    cloudmessaging::list_groups,
    cloudmessaging::create_group,
    cloudmessaging::upload_attachment,
    cloudmessaging::write_temp_file,
    cloudmessaging::delete_temp_file,
    
    // Global search functionality
    global_search::get_global_search_data,
    global_search::save_global_search_data,
    global_search::clear_search_history,
    global_search::clear_recent_items,
    global_search::add_custom_shortcut,
    global_search::remove_custom_shortcut,
    global_search::get_search_analytics,
    global_search::increment_search_usage,
    global_search::export_search_data,
    global_search::import_search_data,
    global_search::reset_search_data,
    global_search::toggle_fullscreen,
    global_search::minimize_window,
    global_search::maximize_window,
    global_search::unmaximize_window,
    global_search::close_window,
    global_search::open_devtools,
    global_search::close_devtools,
    global_search::zoom_in,
    global_search::zoom_out,
    global_search::zoom_reset,
    global_search::clear_cache,
    global_search::get_system_info,
    global_search::restart_app,
    global_search::show_window,
    global_search::hide_window,
    global_search::show_notification,
    global_search::open_file_explorer,
    global_search::get_app_data_dir
])
```

### System Tray Integration

```rust
#[cfg(desktop)]
{
    let menu = Menu::with_items(&context, &[
        &MenuItem::with_id(&context, "open", "Open DesQTA", true, None::<&str>)?,
        &PredefinedMenuItem::separator(&context)?,
        &MenuItem::with_id(&context, "quit", "Quit", true, None::<&str>)?,
    ])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.webview_windows().get("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
}
```

### Window Event Handling

```rust
.on_window_event(|window, event| {
    #[cfg(desktop)]
    {
        if let WindowEvent::CloseRequested { api, .. } = event {
            // Hide window instead of closing when user clicks X
            window.hide().unwrap();
            api.prevent_close();
        }
    }
})
```

### Autostart Management

```rust
#[tauri::command]
fn enable_autostart(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let manager = window.app_handle().autolaunch();
        manager.enable().map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        Err("Autostart not supported on this platform".to_string())
    }
}

#[tauri::command]
fn disable_autostart(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let manager = window.app_handle().autolaunch();
        manager.disable().map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        Err("Autostart not supported on this platform".to_string())
    }
}

#[tauri::command]
fn is_autostart_enabled(window: Window) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        let manager = window.app_handle().autolaunch();
        manager.is_enabled().map_err(|e| e.to_string())
    }
    #[cfg(not(desktop))]
    {
        Err("Autostart not supported on this platform".to_string())
    }
}
```

## 🔐 Authentication System (`auth/login.rs`)

The authentication system handles SEQTA login, session management, and deep link authentication.

### Session Data Structure

```rust
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Session {
    pub base_url: String,
    pub jsessionid: String,
    pub additional_cookies: Vec<Cookie>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
}
```

### Deep Link Authentication

DesQTA supports QR code-based authentication through deep links:

```rust
#[derive(Debug, Deserialize, Clone)]
struct SeqtaSSOPayload {
    t: String, // JWT token
    u: String, // Server URL
    n: String, // User number
}

#[derive(Debug, Deserialize)]
struct SeqtaJWT {
    exp: i64, // Expiration timestamp
}

fn parse_deeplink(url: &str) -> Result<SeqtaSSOPayload, String> {
    if !url.starts_with("seqtalearn://") {
        return Err("Invalid deeplink scheme".to_string());
    }

    let url_without_scheme = url.strip_prefix("seqtalearn://").unwrap();
    let decoded = form_urlencoded::parse(url_without_scheme.as_bytes())
        .into_owned()
        .collect::<HashMap<String, String>>();

    let token = decoded.get("t")
        .ok_or("Missing token parameter")?
        .clone();
    let server_url = decoded.get("u")
        .ok_or("Missing server URL parameter")?
        .clone();
    let user_number = decoded.get("n")
        .ok_or("Missing user number parameter")?
        .clone();

    Ok(SeqtaSSOPayload {
        t: token,
        u: server_url,
        n: user_number,
    })
}
```

### JWT Token Validation

```rust
fn validate_token(token: &str) -> Result<(), String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".to_string());
    }

    let payload = parts[1];
    let decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| "Failed to decode JWT payload")?;
    
    let payload_str = String::from_utf8(decoded)
        .map_err(|_| "Invalid UTF-8 in JWT payload")?;
    
    let jwt: SeqtaJWT = serde_json::from_str(&payload_str)
        .map_err(|_| "Failed to parse JWT payload")?;

    let now = OffsetDateTime::now_utc().unix_timestamp();
    if jwt.exp <= now {
        return Err("JWT token has expired".to_string());
    }

    Ok(())
}
```

### QR Authentication Flow

```rust
async fn perform_qr_auth(sso_payload: SeqtaSSOPayload) -> Result<session::Session, String> {
    let base_url = sso_payload.u;
    let token = sso_payload.t;

    let jar = Arc::new(Jar::default());
    jar.add_cookie_str(&format!("JSESSIONID={}", &token), &base_url.parse::<Url>().unwrap());
    
    let mut headers = header::HeaderMap::new();
    headers.insert("Content-Type", header::HeaderValue::from_static("application/json"));
    headers.insert("X-User-Number", header::HeaderValue::from_str(&sso_payload.n.clone()).unwrap());
    headers.insert("Accept", header::HeaderValue::from_static("application/json"));
    headers.insert("Authorization", header::HeaderValue::from_str(&format!("Bearer {}", &token)).unwrap());

    let client = reqwest::Client::builder()
        .cookie_provider(jar.clone())
        .cookie_store(true)
        .default_headers(headers)
        .build()
        .unwrap();
    
    // Step 1: First login request
    let first_login_url = format!("{}/seqta/student/login", base_url);
    let first_login_body = json!({ "token": &token });
    
    let first_response = client.post(&first_login_url)
        .json(&first_login_body)
        .send()
        .await
        .map_err(|e| format!("First login request failed: {}", e))?;

    // Step 2: Second login request with JWT
    let second_login_body = json!({ "jwt": &token });
    
    let second_response = client.post(&first_login_url)
        .json(&second_login_body)
        .send()
        .await
        .map_err(|e| format!("Second login request failed: {}", e))?;
    
    // Step 3: Extract JSESSIONID from response headers
    let jsessionid = second_response.headers().get("Set-Cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_str| {
            cookie_str.split(';')
                .find(|part| part.trim().starts_with("JSESSIONID="))
                .map(|jsession_part| jsession_part.trim().strip_prefix("JSESSIONID=").unwrap_or("").to_string())
        });

    // Step 4: Send heartbeat to validate session
    let heartbeat_url = format!("{}/seqta/student/heartbeat", base_url);
    let heartbeat_body = json!({ "heartbeat": true });

    let heartbeat_response = client.post(&heartbeat_url)
        .json(&heartbeat_body)
        .send()
        .await
        .map_err(|e| format!("Heartbeat request failed: {}", e))?;

    if !heartbeat_response.status().is_success() {
        return Err(format!("Heartbeat failed with status: {}", heartbeat_response.status()));
    }

    // Create session with the newly obtained JSESSIONID
    let session = session::Session {
        base_url,
        jsessionid: jsessionid.ok_or("Could not get JSESSIONID from response headers")?,
        additional_cookies: vec![],
    };

    Ok(session)
}
```

### Traditional Login Window

```rust
#[tauri::command]
pub async fn create_login_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // Check if this is a QR code deeplink
    if url.starts_with("seqtalearn://") {
        let sso_payload = parse_deeplink(&url)?;
        validate_token(&sso_payload.t)?;
        let session = perform_qr_auth(sso_payload).await?;
        session.save().map_err(|e| format!("Failed to save session: {}", e))?;
        force_reload(app);
        return Ok(());
    }

    // For regular URL-based login
    #[cfg(desktop)]
    {
        use tauri::{WebviewUrl, WebviewWindowBuilder};
        
        let http_url = if url.starts_with("https://") {
            url.clone()
        } else {
            format!("https://{}", url.clone())
        };

        let parsed_url = Url::parse(&http_url)
            .map_err(|e| format!("Invalid URL: {}", e))?;

        let full_url = Url::parse(&format!("{}/#?page=/welcome", parsed_url))
            .map_err(|e| format!("Parsing error: {}", e))?;

        // Spawn the login window
        WebviewWindowBuilder::new(&app, "seqta_login", WebviewUrl::External(full_url.clone()))
            .title("SEQTA Login")
            .inner_size(900.0, 700.0)
            .build()
            .map_err(|e| format!("Failed to build window: {}", e))?;

        // Monitor for successful authentication
        let app_handle_clone = app.clone();
        tokio::spawn(async move {
            let mut counter = 0;
            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;
                counter += 1;
                
                if session::Session::exists() {
                    if let Some(window) = app_handle_clone.webview_windows().get("seqta_login") {
                        let _ = window.close();
                    }
                    force_reload(app_handle_clone);
                    break;
                }
                
                if counter > 240 { // 2 minutes timeout
                    if let Some(window) = app_handle_clone.webview_windows().get("seqta_login") {
                        let _ = window.close();
                    }
                    break;
                }
            }
        });
    }
    
    Ok(())
}
```

### Session Management Commands

```rust
#[tauri::command]
pub fn check_session_exists() -> bool {
    session::Session::exists()
}

#[tauri::command]
pub fn save_session(base_url: String, jsessionid: String) -> Result<(), String> {
    session::Session {
        base_url,
        jsessionid,
        additional_cookies: Vec::new(),
    }
    .save()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn logout() -> bool {
    if let Ok(_) = netgrab::clear_session().await {
        true
    } else {
        false
    }
}

#[tauri::command]
pub fn force_reload(app: tauri::AppHandle) {
    app.emit("reload", "hi".to_string()).unwrap();
}
```

## 🌐 Network Communication (`utils/netgrab.rs`)

The network module handles all HTTP communication with SEQTA servers and external APIs.

### Global HTTP Client

```rust
use std::sync::OnceLock;
static GLOBAL_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

pub fn create_client() -> &'static reqwest::Client {
    GLOBAL_CLIENT.get_or_init(|| {
        let mut headers = reqwest::header::HeaderMap::new();

        headers.insert(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (DesQTA)".parse().unwrap(),
        );
        headers.insert(
            reqwest::header::ACCEPT,
            "application/json, text/plain, */*".parse().unwrap(),
        );
        headers.insert(
            reqwest::header::ACCEPT_LANGUAGE,
            "en-US,en;q=0.9".parse().unwrap(),
        );

        reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .expect("Failed to create HTTP client")
    })
}
```

### Request Methods

```rust
#[derive(Debug, Serialize, Deserialize)]
pub enum RequestMethod {
    GET,
    POST,
}
```

### Session-Aware Request Building

```rust
async fn append_default_headers(request: RequestBuilder) -> RequestBuilder {
    let session = session::Session::load();
    
    let mut req = request
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("X-Requested-With", "XMLHttpRequest");

    // Add session cookie if available
    if !session.jsessionid.is_empty() {
        req = req.header("Cookie", format!("JSESSIONID={}", session.jsessionid));
    }

    // Add additional cookies
    for cookie in &session.additional_cookies {
        req = req.header("Cookie", format!("{}={}", cookie.name, cookie.value));
    }

    req
}
```

### Generic API Data Fetcher

```rust
pub async fn fetch_api_data(
    url: &str,
    method: RequestMethod,
    headers: Option<HashMap<String, String>>,
    body: Option<Value>,
    parameters: Option<HashMap<String, String>>,
    is_image: bool,
    return_url: bool
) -> Result<String, String> {
    let client = create_client();
    let mut session = session::Session::load();
    
    let full_url = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("{}{}", session.base_url.parse::<String>().unwrap(), url)
    };

    let mut request = match method {
        RequestMethod::GET => client.get(&full_url),
        RequestMethod::POST => client.post(&full_url),
    };

    request = append_default_headers(request).await;

    // Add custom headers if provided
    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(&key, value);
        }
    }

    // Add query parameters if provided
    if let Some(params) = parameters {
        request = request.query(&params);
    }

    // Add body for POST requests if provided
    if let RequestMethod::POST = method {
        let mut final_body = body.unwrap_or_else(|| json!({}));
        
        // For JWT-based sessions, automatically include the JWT token in the body
        if session.jsessionid.starts_with("eyJ") {
            if let Some(body_obj) = final_body.as_object_mut() {
                body_obj.insert("jwt".to_string(), json!(session.jsessionid));
            }
        }
        
        request = request.json(&final_body);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    if return_url {
        Ok(response.url().to_string())
    } else if is_image {
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        Ok(general_purpose::STANDARD.encode(&bytes))
    } else {
        response.text().await.map_err(|e| e.to_string())
    }
}
```

### Specialized API Commands

```rust
#[tauri::command]
pub async fn get_api_data(
    url: &str,
    parameters: HashMap<String, String>,
) -> Result<String, String> {
    fetch_api_data(url, RequestMethod::GET, None, None, Some(parameters), false, false).await
}

#[tauri::command]
pub async fn post_api_data(
    url: &str,
    data: Value,
    parameters: HashMap<String, String>,
) -> Result<String, String> {
    fetch_api_data(url, RequestMethod::POST, None, Some(data), Some(parameters), false, false).await
}

#[tauri::command]
pub async fn get_seqta_file(
    url: &str,
    parameters: HashMap<String, String>,
) -> Result<String, String> {
    fetch_api_data(url, RequestMethod::GET, None, None, Some(parameters), true, false).await
}
```

### RSS Feed Processing

```rust
#[tauri::command]
pub async fn get_rss_feed(url: String) -> Result<String, String> {
    let client = create_client();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch RSS feed: {}", response.status()));
    }
    
    let content = response.text().await.map_err(|e| e.to_string())?;
    let channel = Channel::read_from(content.as_bytes()).map_err(|e| e.to_string())?;
    
    serde_json::to_string(&channel).map_err(|e| e.to_string())
}
```

### File Upload Support

```rust
#[tauri::command]
pub async fn upload_seqta_file(
    url: &str,
    file_path: String,
    additional_fields: HashMap<String, String>,
) -> Result<String, String> {
    let client = create_client();
    let session = session::Session::load();
    
    let full_url = format!("{}{}", session.base_url, url);
    
    let file_content = fs::read(&file_path).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file");
    
    let mut form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_content)
            .file_name(file_name.to_string())
            .mime_str("application/octet-stream").unwrap());
    
    // Add additional form fields
    for (key, value) in additional_fields {
        form = form.text(key, value);
    }
    
    let mut request = client.post(&full_url).multipart(form);
    request = append_default_headers(request).await;
    
    let response = request.send().await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Upload failed: {}", response.status()));
    }
    
    response.text().await.map_err(|e| e.to_string())
}
```

### External URL Opening

```rust
#[tauri::command]
pub async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri::{WebviewUrl, WebviewWindowBuilder};

        let http_url = if url.starts_with("https://") {
            url.clone()
        } else {
            format!("https://{}", url.clone())
        };

        let parsed_url = Url::parse(&http_url)
            .map_err(|e| format!("Invalid URL: {}", e))?;

        WebviewWindowBuilder::new(&app, "external_url", WebviewUrl::External(parsed_url))
            .title("External URL")
            .inner_size(900.0, 700.0)
            .build()
            .map_err(|e| format!("Failed to build window: {}", e))?;
    }
    #[cfg(not(desktop))]
    {
        return Err("Webview windows not supported on mobile platforms".to_string());
    }
    Ok(())
}
```

### Session Cleanup

```rust
#[tauri::command]
pub async fn clear_session() -> Result<(), String> {
    // Send logout request first
    let _ = get_api_data("/saml2?logout", HashMap::new()).await;
    
    // Then clear the session file
    session::Session::clear_file().map_err(|e| e.to_string())
}
```

## ⚙️ Settings Management (`utils/settings.rs`)

The settings module handles application configuration, cloud synchronization, and user preferences.

### Settings Data Structure

```rust
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Shortcut {
    pub name: String,
    pub url: String,
    pub icon: String,
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
    pub w: i32,
    pub h: i32,
    pub enabled: bool,
}
```

### Cross-Platform File Paths

```rust
fn settings_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
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
```

### Smart Settings Loading with Migration

```rust
impl Settings {
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

    fn merge_with_existing(existing_json: serde_json::Value) -> Self {
        let mut default_settings = Settings::default();
        
        if let serde_json::Value::Object(existing_map) = existing_json {
            // Merge each field individually, preserving existing values
            if let Some(shortcuts) = existing_map.get("shortcuts") {
                if let Ok(shortcuts) = serde_json::from_value::<Vec<Shortcut>>(shortcuts.clone()) {
                    default_settings.shortcuts = shortcuts;
                }
            }
            
            if let Some(feeds) = existing_map.get("feeds") {
                if let Ok(feeds) = serde_json::from_value::<Vec<Feed>>(feeds.clone()) {
                    default_settings.feeds = feeds;
                }
            }
            
            // Continue for all fields...
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
            
            // Handle boolean fields
            if let Some(weather_enabled) = existing_map.get("weather_enabled") {
                if let Some(enabled) = weather_enabled.as_bool() {
                    default_settings.weather_enabled = enabled;
                }
            }
        }
        
        default_settings
    }

    pub fn save(&self) -> io::Result<()> {
        let path = settings_file();
        fs::write(path, serde_json::to_string(self).unwrap())
    }

    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string(self).map_err(|e| e.to_string())
    }

    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json).map_err(|e| e.to_string())
    }
}
```

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
    pub username: String,
    pub email: String,
    pub displayName: Option<String>,
    pub pfpUrl: Option<String>,
    pub verified: bool,
    pub createdAt: String,
    pub updatedAt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CloudUserWithToken {
    pub user: Option<CloudUser>,
    pub token: Option<String>,
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
```

### Cloud Authentication and User Management

```rust
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
```

### Cloud Settings Synchronization

```rust
#[tauri::command]
pub async fn upload_settings_to_cloud() -> Result<(), String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.ok_or("No cloud token available")?;
    
    let settings = Settings::load();
    let settings_json = settings.to_json()?;
    
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    
    let response = client
        .post(&format!("{}/settings", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .body(settings_json)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Upload failed: {} - {}", response.status(), error_text));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn download_settings_from_cloud() -> Result<(), String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.ok_or("No cloud token available")?;
    
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    
    let response = client
        .get(&format!("{}/settings", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Download failed: {} - {}", response.status(), error_text));
    }
    
    let settings_json = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    let settings = Settings::from_json(&settings_json)?;
    settings.save().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn check_cloud_settings() -> Result<bool, String> {
    let cloud_token = CloudToken::load();
    let token = cloud_token.token.ok_or("No cloud token available")?;
    
    let base_url = "https://accounts.betterseqta.adenmgb.com/api";
    let client = reqwest::Client::new();
    
    let response = client
        .head(&format!("{}/settings", base_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    Ok(response.status().is_success())
}
```

### Settings Commands

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
    settings.to_json()
}

#[tauri::command]
pub fn save_settings_from_json(json: String) -> Result<(), String> {
    let settings = Settings::from_json(&json)?;
    settings.save().map_err(|e| e.to_string())
}
```

## 📊 Analytics System (`utils/analytics.rs`)

The analytics module handles data collection and storage for assessment tracking and performance analysis.

### Assessment Data Structure

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
```

### Cross-Platform Analytics Storage

```rust
fn analytics_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
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
```

### Analytics Commands

```rust
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
```

## 🔧 SEQTA Configuration (`utils/seqta_config.rs`)

Manages SEQTA-specific configuration data and settings.

### Configuration Management

```rust
fn config_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("seqtaConfig.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("seqtaConfig.json");
        dir
    }
}

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
    fs::write(path, serde_json::to_string(&config).unwrap())
        .map_err(|e| e.to_string())
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

## 💬 Cloud Messaging (`utils/cloudmessaging.rs`)

Handles BetterSEQTA Cloud messaging functionality including friends, groups, and real-time communication.

### Data Structures

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct Friend {
    pub id: String,
    pub username: String,
    pub displayName: String,
    pub pfpUrl: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    pub iconUrl: Option<String>,
    pub members: Option<Vec<GroupMember>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GroupMember {
    pub id: String,
    pub displayName: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub senderId: String,
    pub receiverId: Option<String>,
    pub groupId: Option<String>,
    pub content: String,
    pub read: bool,
    pub createdAt: String,
    pub replyToId: Option<String>,
    pub replyTo: Option<MessageReply>,
    pub attachmentId: Option<String>,
    pub attachment: Option<Attachment>,
    pub sender: Option<Friend>,
    pub receiver: Option<Friend>,
    pub group: Option<Group>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MessageReply {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Attachment {
    pub id: Option<String>,
    pub filename: Option<String>,
    pub storedName: Option<String>,
    pub mimeType: Option<String>,
    pub size: Option<u64>,
    pub url: Option<String>,
    pub isPublic: Option<bool>,
    pub createdAt: Option<String>,
    pub userId: Option<String>,
    pub path: Option<String>,
    pub updatedAt: Option<String>,
}
```

### Authenticated HTTP Client

```rust
const BASE_URL: &str = "https://accounts.betterseqta.adenmgb.com";

async fn get_auth_client(token: &str) -> Client {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::AUTHORIZATION,
        format!("Bearer {}", token).parse().unwrap(),
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );
    Client::builder()
        .default_headers(headers)
        .build()
        .unwrap()
}
```

### Friend Management

```rust
#[tauri::command]
pub async fn get_friends(token: String) -> Result<Vec<Friend>, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/friends", BASE_URL);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch friends: {}", resp.status()));
    }
    let friends = resp.json::<Vec<Friend>>().await.map_err(|e| e.to_string())?;
    Ok(friends)
}
```

### Group Management

```rust
#[tauri::command]
pub async fn list_groups(token: String) -> Result<Vec<Group>, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/groups", BASE_URL);
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch groups: {}", resp.status()));
    }
    let groups = resp.json::<Vec<Group>>().await.map_err(|e| e.to_string())?;
    Ok(groups)
}

#[tauri::command]
pub async fn create_group(
    token: String,
    name: String,
    member_ids: Vec<String>,
) -> Result<Group, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/groups", BASE_URL);
    
    let payload = json!({
        "name": name,
        "memberIds": member_ids
    });
    
    let resp = client.post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("Failed to create group: {}", resp.status()));
    }
    
    let group = resp.json::<Group>().await.map_err(|e| e.to_string())?;
    Ok(group)
}
```

### Message Operations

```rust
#[tauri::command]
pub async fn get_messages(
    token: String,
    id: String,
    page: Option<u32>,
) -> Result<Vec<Message>, String> {
    let client = get_auth_client(&token).await;
    let page = page.unwrap_or(1);
    let url = format!("{}/api/messages/{}/page/{}", BASE_URL, id, page);
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch messages: {}", resp.status()));
    }
    
    let messages = resp.json::<Vec<Message>>().await.map_err(|e| e.to_string())?;
    Ok(messages)
}

#[tauri::command]
pub async fn send_message(
    token: String,
    content: String,
    receiverId: Option<String>,
    groupId: Option<String>,
    replyToId: Option<String>,
    attachmentId: Option<String>,
) -> Result<Message, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/messages", BASE_URL);
    
    let mut payload = json!({
        "content": content
    });
    
    if let Some(receiver_id) = receiverId {
        payload["receiverId"] = json!(receiver_id);
    }
    
    if let Some(group_id) = groupId {
        payload["groupId"] = json!(group_id);
    }
    
    if let Some(reply_to_id) = replyToId {
        payload["replyToId"] = json!(reply_to_id);
    }
    
    if let Some(attachment_id) = attachmentId {
        payload["attachmentId"] = json!(attachment_id);
    }
    
    let resp = client.post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("Failed to send message: {}", resp.status()));
    }
    
    let message = resp.json::<Message>().await.map_err(|e| e.to_string())?;
    Ok(message)
}
```

### File Attachment Support

```rust
#[tauri::command]
pub async fn upload_attachment(
    token: String,
    file_path: String,
    filename: String,
) -> Result<Attachment, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/attachments", BASE_URL);
    
    let file_content = fs::read(&file_path).map_err(|e| e.to_string())?;
    
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_content)
            .file_name(filename.clone())
            .mime_str("application/octet-stream").unwrap());
    
    let resp = client.post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if !resp.status().is_success() {
        return Err(format!("Failed to upload attachment: {}", resp.status()));
    }
    
    let attachment = resp.json::<Attachment>().await.map_err(|e| e.to_string())?;
    Ok(attachment)
}

#[tauri::command]
pub async fn write_temp_file(
    content: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);
    
    fs::write(&file_path, content).map_err(|e| e.to_string())?;
    
    file_path.to_string_lossy().to_string().into()
}

#[tauri::command]
pub async fn delete_temp_file(file_path: String) -> Result<(), String> {
    if std::path::Path::new(&file_path).exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

## 🔍 Global Search System (`global_search.rs`)

Provides system-wide search functionality and application control commands.

### Search Data Management

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchData {
    pub recent_items: Vec<SearchItem>,
    pub search_history: Vec<String>,
    pub custom_shortcuts: Vec<CustomShortcut>,
    pub analytics: SearchAnalytics,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub url: String,
    pub icon: String,
    pub category: String,
    pub last_accessed: String,
    pub access_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomShortcut {
    pub id: String,
    pub name: String,
    pub url: String,
    pub icon: String,
    pub keywords: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchAnalytics {
    pub total_searches: u32,
    pub most_searched_terms: HashMap<String, u32>,
    pub category_usage: HashMap<String, u32>,
}
```

### Window Management Commands

```rust
#[tauri::command]
pub async fn toggle_fullscreen(window: Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn maximize_window(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unmaximize_window(window: Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn show_window(window: Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn hide_window(window: Window) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}
```

### Developer Tools Integration

```rust
#[tauri::command]
pub async fn open_devtools(window: Window) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        window.open_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Developer tools not available in release builds".to_string())
    }
}

#[tauri::command]
pub async fn close_devtools(window: Window) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        window.close_devtools();
        Ok(())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Developer tools not available in release builds".to_string())
    }
}
```

### Zoom Controls

```rust
#[tauri::command]
pub async fn zoom_in(window: Window) -> Result<(), String> {
    let current_scale = window.scale_factor().map_err(|e| e.to_string())?;
    let new_scale = (current_scale * 1.1).min(3.0);
    window.set_zoom(new_scale).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn zoom_out(window: Window) -> Result<(), String> {
    let current_scale = window.scale_factor().map_err(|e| e.to_string())?;
    let new_scale = (current_scale * 0.9).max(0.5);
    window.set_zoom(new_scale).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn zoom_reset(window: Window) -> Result<(), String> {
    window.set_zoom(1.0).map_err(|e| e.to_string())
}
```

### System Information

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub version: String,
    pub tauri_version: String,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: "2.0".to_string(),
    })
}
```

### Cache Management

```rust
#[tauri::command]
pub async fn clear_cache() -> Result<(), String> {
    let cache_dirs = ["cache", "temp", "logs"];
    
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
```

### Application Control

```rust
#[tauri::command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.restart();
}

#[tauri::command]
pub async fn show_notification(
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    tauri::notification::Notification::new("com.desqta.app")
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file_explorer(path: Option<String>) -> Result<(), String> {
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

#[tauri::command]
pub fn get_app_data_dir() -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        Ok("/data/data/com.desqta.app/files/DesQTA".to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().ok_or("Unable to determine data dir")?;
        dir.push("DesQTA");
        Ok(dir.to_string_lossy().to_string())
    }
}
```

## 🔄 Session Management (`utils/session.rs`)

Handles persistent session storage and management across application restarts.

### Session Data Structure

```rust
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Session {
    pub base_url: String,
    pub jsessionid: String,
    pub additional_cookies: Vec<Cookie>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
}
```

### Cross-Platform Session Storage

```rust
pub fn session_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("session.json");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("session.json");
        dir
    }
}
```

### Session Operations

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
        Session {
            base_url: String::new(),
            jsessionid: String::new(),
            additional_cookies: Vec::new(),
        }
    }

    pub fn save(&self) -> io::Result<()> {
        let path = session_file();
        fs::write(path, serde_json::to_string(self).unwrap())
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

## 🔒 Security Considerations

### Input Validation
- All user inputs are validated and sanitized
- SQL injection prevention through parameterized queries
- XSS prevention through proper escaping

### Authentication Security
- JWT tokens are validated for expiration
- Session cookies are secured with HttpOnly flags
- Deep link authentication includes token validation

### Data Protection
- Sensitive data is encrypted before storage
- API keys and tokens are stored securely
- Network communications use HTTPS only

### Cross-Platform Security
- File permissions are properly set on all platforms
- Android app uses internal storage for sensitive data
- Desktop apps integrate with system keychain when available

## 🚀 Performance Optimization

### Memory Management
- Efficient use of Rust's ownership system
- Minimal memory allocations in hot paths
- Proper cleanup of resources and file handles

### Network Optimization
- Connection pooling for HTTP requests
- Request deduplication for identical calls
- Caching of frequently accessed data

### Async Operations
- Non-blocking I/O for all network operations
- Proper error handling in async contexts
- Cancellation support for long-running operations

## 🔧 Development and Debugging

### Logging
```rust
use log::{info, warn, error, debug};

#[tauri::command]
pub async fn debug_log(message: String) -> Result<(), String> {
    debug!("Frontend debug: {}", message);
    Ok(())
}
```

### Error Handling
```rust
#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        ApiError {
            code: "NETWORK_ERROR".to_string(),
            message: err.to_string(),
            details: None,
        }
    }
}
```

### Testing
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_session_save_load() {
        let session = Session {
            base_url: "https://example.com".to_string(),
            jsessionid: "test123".to_string(),
            additional_cookies: vec![],
        };
        
        session.save().unwrap();
        let loaded = Session::load();
        
        assert_eq!(session.base_url, loaded.base_url);
        assert_eq!(session.jsessionid, loaded.jsessionid);
    }
}
```

## 🔮 Future Enhancements

### Planned Features
- **WebSocket Support**: Real-time communication for live updates
- **Background Sync**: Synchronize data when app regains focus
- **Plugin System**: Extensible architecture for third-party plugins
- **Enhanced Security**: Biometric authentication support
- **Performance Monitoring**: Built-in performance metrics collection

### Architecture Improvements
- **Modular Design**: Split services into separate crates
- **Database Integration**: SQLite support for complex data
- **Configuration Management**: Hot-reloading of configuration
- **Internationalization**: Multi-language support in Rust backend

---

**Related Documentation:**
- [Frontend Architecture](../frontend/README.md) - Frontend integration points
- [Authentication System](./authentication.md) - Detailed auth flow
- [Network Services](./network.md) - API communication patterns
- [File System](./filesystem.md) - Data persistence strategies 