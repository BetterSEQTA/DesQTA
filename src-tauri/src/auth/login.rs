use base64::{engine::general_purpose, Engine as _};
use reqwest::header;
use serde::Deserialize;
use serde_json::json;
use tauri::{Emitter, Manager};
use time::OffsetDateTime;
use url::Url;

use std::sync::Arc;

use reqwest::cookie::Jar;

use crate::netgrab;
use crate::session;
use crate::profiles;

#[derive(Debug, Deserialize, Clone)]
struct SeqtaSSOPayload {
    t: String, // JWT token
    u: String, // Server URL
    n: String, // User number
}

#[derive(Debug, Deserialize)]
struct UserInfoResponse {
    payload: UserInfoPayload,
}

#[derive(Debug, Deserialize)]
struct UserInfoPayload {
    id: i32,
    #[serde(rename = "userName")]
    user_name: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "userDesc")]
    user_desc: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SeqtaJWT {
    exp: i64, // Expiration timestamp
}

#[tauri::command]
pub fn force_reload(app: tauri::AppHandle) {
    app.emit("reload", "hi".to_string()).unwrap();
}

/// True if a saved login session exists.
#[tauri::command]
pub fn check_session_exists() -> bool {
    session::Session::exists()
}

/// Persist the SEQTA `base_url` and `JSESSIONID`.
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
pub async fn logout(app: tauri::AppHandle) -> bool {
    // Clear webview data first (cache, cookies, etc.)
    if let Err(e) = clear_webview_data(app).await {
        println!(
            "[AUTH] Warning: Failed to clear webview data during logout: {}",
            e
        );
        // Continue with logout even if cache clearing fails
    }

    // Note: We no longer delete analytics or other files on logout
    // Files are preserved per profile for data retention

    // Clear session (but keep files)
    if let Ok(_) = netgrab::clear_session().await {
        true
    } else {
        false
    }
}

/// Clear webview cache, cookies, and other browsing data
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub async fn clear_webview_data(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    // Create a temporary webview window to clear its data
    // This ensures we can clear data even if no login window is currently open
    let temp_window_id = "temp_clear_data_window";

    // Try to create a temporary hidden webview to clear data from
    match WebviewWindowBuilder::new(&app, temp_window_id, WebviewUrl::App("about:blank".into()))
        .title("Clearing Data")
        .inner_size(1.0, 1.0) // Minimal size
        .visible(false) // Keep it hidden
        .build()
    {
        Ok(webview) => {
            // Clear all browsing data including cache, cookies, etc.
            match webview.clear_all_browsing_data() {
                Ok(_) => {
                    println!("[AUTH] Successfully cleared webview browsing data");
                    // Clean up the temporary window
                    let _ = webview.destroy();
                    Ok(())
                }
                Err(e) => {
                    println!("[AUTH] Failed to clear webview browsing data: {}", e);
                    let _ = webview.destroy();
                    Err(format!("Failed to clear browsing data: {}", e))
                }
            }
        }
        Err(e) => {
            println!(
                "[AUTH] Failed to create temporary webview for clearing data: {}",
                e
            );
            Err(format!("Failed to create temporary webview: {}", e))
        }
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn clear_webview_data(_app: tauri::AppHandle) -> Result<(), String> {
    // Mobile platforms would need platform-specific implementations
    println!("[AUTH] Webview data clearing not implemented for mobile platforms");
    Ok(())
}

/// Clean up any existing login windows
#[cfg(not(any(target_os = "android", target_os = "ios")))]
#[tauri::command]
pub fn cleanup_login_windows(app: tauri::AppHandle) {
    // Clean up the old static window ID
    if let Some(window) = app.get_webview_window("seqta_login") {
        let _ = window.destroy();
    }

    // Clean up any numbered login windows (in case of multiple attempts)
    for i in 0..10 {
        let window_id = format!("seqta_login_{}", i);
        if let Some(window) = app.get_webview_window(&window_id) {
            let _ = window.destroy();
        }
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub fn cleanup_login_windows(_app: tauri::AppHandle) {
    // No-op on mobile platforms
}

/// Parse and validate a Seqta Learn SSO deeplink
fn parse_deeplink(deeplink: &str) -> Result<SeqtaSSOPayload, String> {
    const DEEPLINK_PREFIX: &str = "seqtalearn://sso/";

    if !deeplink.starts_with(DEEPLINK_PREFIX) {
        return Err("Invalid Seqta Learn deeplink format".to_string());
    }

    let encoded_payload = &deeplink[DEEPLINK_PREFIX.len()..];

    // First decode the URL encoding
    let url_decoded =
        urlencoding::decode(encoded_payload).map_err(|e| format!("Failed to URL decode: {}", e))?;

    // Then decode the base64
    let decoded_payload = general_purpose::STANDARD
        .decode(url_decoded.as_bytes())
        .map_err(|e| format!("Failed to base64 decode: {}", e))?;

    let payload_str = String::from_utf8(decoded_payload)
        .map_err(|e| format!("Failed to convert to string: {}", e))?;

    let result =
        serde_json::from_str(&payload_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(result)
}

/// Decode and validate a JWT token
fn decode_jwt(token: &str) -> Result<SeqtaJWT, String> {
    // For now, we'll decode without verification since we don't have the secret
    // In production, you'd want to verify the signature
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".to_string());
    }

    let payload = parts[1];

    // Fix base64 padding if needed
    let mut padded_payload = payload.to_string();
    while padded_payload.len() % 4 != 0 {
        padded_payload.push('=');
    }

    let decoded_payload = general_purpose::STANDARD
        .decode(&padded_payload)
        .map_err(|e| format!("Failed to decode JWT payload: {}", e))?;

    let payload_str = String::from_utf8(decoded_payload)
        .map_err(|e| format!("Failed to convert JWT payload to string: {}", e))?;

    let result = serde_json::from_str(&payload_str)
        .map_err(|e| format!("Failed to parse JWT payload: {}", e))?;

    Ok(result)
}

/// Fetch user info from SEQTA API
async fn fetch_user_info(base_url: &str, jsessionid: &str) -> Result<UserInfoPayload, String> {
    let login_url = format!("{}/seqta/student/login", base_url);
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let cookie_header = format!("JSESSIONID={}", jsessionid);
    let response = client
        .post(&login_url)
        .header("Cookie", cookie_header)
        .header("Content-Type", "application/json; charset=utf-8")
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user info: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch user info: HTTP {}", response.status()));
    }
    
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    let user_response: UserInfoResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse user info: {}", e))?;
    
    Ok(user_response.payload)
}

/// Validate a JWT token
fn validate_token(token: &str) -> Result<bool, String> {
    let decoded = decode_jwt(token)?;
    let now = chrono::Utc::now().timestamp();
    let is_valid = decoded.exp > now;

    if !is_valid {
        return Err("JWT token has expired".to_string());
    }

    Ok(is_valid)
}

/// Perform the QR code authentication flow
async fn perform_qr_auth(sso_payload: SeqtaSSOPayload) -> Result<session::Session, String> {
    let base_url = sso_payload.u;
    let token = sso_payload.t;

    let jar = Arc::new(Jar::default());
    jar.add_cookie_str(
        &format!("JSESSIONID={}", &token),
        &base_url.parse::<Url>().unwrap(),
    );

    let mut headers = header::HeaderMap::new();
    headers.insert(
        "Content-Type",
        header::HeaderValue::from_static("application/json"),
    );
    headers.insert(
        "X-User-Number",
        header::HeaderValue::from_str(&sso_payload.n.clone()).unwrap(),
    );
    headers.insert(
        "Accept",
        header::HeaderValue::from_static("application/json"),
    );
    headers.insert(
        "Authorization",
        header::HeaderValue::from_str(&format!("Bearer {}", &token)).unwrap(),
    );

    let client = reqwest::Client::builder()
        .cookie_provider(jar.clone())
        .cookie_store(true)
        .default_headers(headers)
        .build()
        .unwrap();

    // Step 1: First login request (empty body)
    let first_login_url = format!("{}/seqta/student/login", base_url);

    let first_login_body = json!({
        "token": &token
    });

    let first_response = client
        .post(&first_login_url)
        .json(&first_login_body)
        .send()
        .await
        .map_err(|e| format!("First login request failed: {}", e))?;

    if !first_response.status().is_success() {
        let status = first_response.status();
        return Err(format!("First login failed with status: {}", status));
    }

    // Step 2: Second login request with JWT (this is where we get the user data and JSESSIONID)
    let second_login_body = json!({
        "jwt": &token
    });

    let second_response = client
        .post(&first_login_url)
        .json(&second_login_body)
        .send()
        .await
        .map_err(|e| format!("Second login request failed: {}", e))?;

    if !second_response.status().is_success() {
        let status = second_response.status();
        return Err(format!("Second login failed with status: {}", status));
    }

    // Step 3 - get cookie (which should be stored here)
    let jsessionid = second_response
        .headers()
        .get("Set-Cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_str| {
            // Extract just the JSESSIONID value from "JSESSIONID=value; Path=/; HttpOnly"
            cookie_str
                .split(';')
                .find(|part| part.trim().starts_with("JSESSIONID="))
                .map(|jsession_part| {
                    jsession_part
                        .trim()
                        .strip_prefix("JSESSIONID=")
                        .unwrap_or("")
                        .to_string()
                })
        });

    // Step 4: Send a heartbeat - Defib. Check if the JSESSIONID/JWT is valid
    let heartbeat_url = format!("{}/seqta/student/heartbeat", base_url);

    let heartbeat_body = json!({
        "heartbeat": true
    });

    let heartbeat_response = client
        .post(&heartbeat_url)
        .json(&heartbeat_body)
        .send()
        .await
        .map_err(|e| format!("Heartbeat request failed: {}", e))?;

    if !heartbeat_response.status().is_success() {
        let status = heartbeat_response.status();
        return Err(format!("Heartbeat failed with status: {}", status));
    }

    // Create session with the newly obtained JSESSIONID as the token
    let session = session::Session {
        base_url,
        jsessionid: jsessionid.ok_or("Could not get JSESSIONID from response headers")?,
        additional_cookies: vec![], // No additional cookies given by QR auth (same as SSO and normal login now)
    };

    Ok(session)
}

/// Open a login window and harvest the cookie once the user signs in.
#[tauri::command]
pub async fn create_login_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // Check if this is a QR code deeplink
    if url.starts_with("seqtalearn://") {
        // Parse the deeplink
        let sso_payload = parse_deeplink(&url)?;

        // Validate the JWT token
        validate_token(&sso_payload.t)?;

        // Perform the QR authentication flow
        let session = perform_qr_auth(sso_payload).await?;

        // Fetch user info to create/get profile
        let user_info = fetch_user_info(&session.base_url, &session.jsessionid).await?;
        
        // Create or get profile
        let profile = profiles::ProfileManager::get_or_create_profile(
            session.base_url.clone(),
            user_info.id,
            user_info.user_desc.or(user_info.display_name).or(Some(user_info.user_name.clone())),
        ).map_err(|e| format!("Failed to create/get profile: {}", e))?;
        
        // Set as current profile
        profiles::ProfileManager::set_current_profile(profile.id.clone())
            .map_err(|e| format!("Failed to set current profile: {}", e))?;

        // Save the session (now in profile directory)
        session
            .save()
            .map_err(|e| format!("Failed to save session: {}", e))?;

        // Force reload the app
        force_reload(app);
        return Ok(());
    }

    // For regular URL-based login, handle differently for desktop vs mobile
    #[cfg(desktop)]
    {
        use std::sync::atomic::{AtomicU64, Ordering};
        use tauri::{WebviewUrl, WebviewWindowBuilder};
        use tokio::time::{sleep, Duration};

        // Generate unique window ID to prevent conflicts
        static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);
        let window_id = format!(
            "seqta_login_{}",
            WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst)
        );

        let http_url = if url.starts_with("https://") {
            url.clone()
        } else {
            format!("https://{}", url.clone())
        };

        let parsed_url = match Url::parse(&http_url) {
            Ok(u) => u,
            Err(e) => {
                return Err(format!("Invalid URL: {}", e));
            }
        };

        // Close any existing login windows first
        if let Some(existing_window) = app.get_webview_window("seqta_login") {
            let _ = existing_window.destroy();
        }

        // Spawn the login window with unique ID
        // Start with about:blank to allow clearing data before loading the actual login page
        let webview_window =
            WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::External("about:blank".parse().unwrap()))
                .title("SEQTA Login")
                .inner_size(900.0, 700.0)
                .build()
                .map_err(|e| format!("Failed to build window: {}", e))?;

        // Clear all browsing data (cookies, cache, etc.) to ensure a fresh login session
        // This effectively logs the user out if they were previously logged in
        if let Err(e) = webview_window.clear_all_browsing_data() {
            println!("[AUTH] Warning: Failed to clear browsing data: {}", e);
        }

        // Navigate to the login URL
        let url_clone = parsed_url.clone();
        webview_window
            .navigate(url_clone)
            .map_err(|e| format!("Failed to navigate: {}", e))?;

        // Clone handles for async block
        let app_handle_clone = app.clone();
        let window_id_clone = window_id.clone();

        let mut counter = 0; // Creates a counter so that we don't quit authentication upon the first request (which redirects)
                             // Start polling in a background task
        tauri::async_runtime::spawn(async move {
            // Helper function to properly destroy the window
            let destroy_login_window = || {
                if let Some(window) = app_handle_clone.get_webview_window(&window_id_clone) {
                    let _ = window.destroy(); // Use destroy() instead of close() for complete cleanup
                }
            };

            for _ in 0..1920 {
                // Poll for 1920 seconds max
                // Wait 1 second between polls
                sleep(Duration::from_secs(1)).await;

                // Try to get cookies from the login window
                if let Some(webview) = app_handle_clone.get_webview_window(&window_id_clone) {
                    if counter > 5 {

                        match webview.cookies() {
                            Ok(cookies) => {
                                for cookie in cookies.clone() {
                                    if cookie.name() == "JSESSIONID"
                                        && cookie.domain().unwrap_or("None")
                                            == parsed_url.host_str().unwrap_or("None")
                                    {
                                        if let Some(expire_time) = cookie.expires_datetime() {
                                            let now = OffsetDateTime::now_utc();
                                            if expire_time > now {
                                                let value = cookie.value().to_string();
                                                let base_url = http_url.clone();

                                                // Validate the session with a subjects request before accepting it
                                                // This prevents capturing invalid/pre-login sessions
                                                let subjects_url = format!("{}/seqta/student/load/subjects", base_url);
                                                let client = reqwest::Client::builder()
                                                    .cookie_store(true)
                                                    .build()
                                                    .unwrap_or_default();

                                                // Manually construct the cookie header since we're not using a jar here for this quick check
                                                let cookie_header = format!("JSESSIONID={}", value);
                                                
                                                let check_res = client
                                                    .post(&subjects_url)
                                                    .header("Cookie", cookie_header)
                                                    .header("Content-Type", "application/json; charset=utf-8")
                                                    .json(&serde_json::json!({}))
                                                    .send()
                                                    .await;

                                                // Check for both HTTP success and API payload success
                                                let is_valid_session = match check_res {
                                                    Ok(res) => {
                                                        if res.status().is_success() {
                                                            // Check the body for application-level errors (like status: "failed")
                                                            match res.json::<serde_json::Value>().await {
                                                                Ok(json) => {
                                                                    // SEQTA APIs might return 200 OK but with { "status": "failed" } or similar
                                                                    // Only accept if payload exists or status is not explicitly failed/401
                                                                    let status_str = json.get("status").and_then(|s| s.as_str());
                                                                    status_str != Some("failed") && status_str != Some("401")
                                                                },
                                                                Err(_) => false // Failed to parse JSON
                                                            }
                                                        } else {
                                                            false
                                                        }
                                                    },
                                                    Err(_) => false,
                                                };

                                                if !is_valid_session {
                                                    // Session exists but is not valid (e.g. pre-login or expired)
                                                    // Continue polling...
                                                    continue;
                                                }

                                                // Convert all cookies to our storage format
                                                let additional_cookies = cookies
                                                    .iter()
                                                    .filter(|c| c.name() != "JSESSIONID") // Skip JSESSIONID as it's stored separately
                                                    .filter(|c| {
                                                        if let Some(cookie_domain) = c.domain() {
                                                            if let Some(host) =
                                                                parsed_url.host_str()
                                                            {
                                                                host.ends_with(
                                                                    cookie_domain
                                                                        .trim_start_matches('.'),
                                                                )
                                                            } else {
                                                                false
                                                            }
                                                        } else {
                                                            false
                                                        }
                                                    }) // only include cookies for the same domain
                                                    .map(|c| session::Cookie {
                                                        name: c.name().to_string(),
                                                        value: c.value().to_string(),
                                                        domain: c.domain().map(|s| s.to_string()),
                                                        path: c.path().map(|s| s.to_string()),
                                                    })
                                                    .collect();

                                                // Save session with all cookies
                                                let session = session::Session {
                                                    base_url: base_url.clone(),
                                                    jsessionid: value.clone(),
                                                    additional_cookies,
                                                };

                                                // Fetch user info to create/get profile
                                                match fetch_user_info(&base_url, &value).await {
                                                    Ok(user_info) => {
                                                        // Create or get profile
                                                        if let Ok(profile) = profiles::ProfileManager::get_or_create_profile(
                                                            base_url.clone(),
                                                            user_info.id,
                                                            user_info.user_desc.or(user_info.display_name).or(Some(user_info.user_name.clone())),
                                                        ) {
                                                            // Set as current profile
                                                            let _ = profiles::ProfileManager::set_current_profile(profile.id.clone());
                                                        }
                                                    }
                                                    Err(e) => {
                                                        println!("[AUTH] Warning: Failed to fetch user info for profile creation: {}", e);
                                                        // Continue anyway - profile will be created on next login
                                                    }
                                                }

                                                let _ = session.save();

                                                // Properly destroy the window to ensure complete cleanup
                                                destroy_login_window();

                                                // Small delay to ensure window is fully destroyed before reload
                                                sleep(Duration::from_millis(100)).await;

                                                force_reload(app_handle_clone);
                                                return; // Stop polling once found
                                            }
                                        }
                                    }
                                }
                            }
                            Err(_) => {
                                // Cookie retrieval failed, continue polling
                            }
                        }
                    }
                } else {
                    // Window was closed by user, exit polling
                    return;
                }
                counter += 1; // increment the counter at the end of the loop
            }

            // Timeout reached - destroy window if it still exists
            destroy_login_window();
        });
    }

    #[cfg(not(desktop))]
    {
        // For mobile, we'll use the system browser for authentication
        // since webview windows aren't supported on mobile
        let http_url = if url.starts_with("https://") {
            url.clone()
        } else {
            format!("https://{}", url.clone())
        };

        let parsed_url = match Url::parse(&http_url) {
            Ok(u) => u,
            Err(e) => {
                return Err(format!("Invalid URL: {}", e));
            }
        };

        let full_url = match Url::parse(&format!("{}/#?page=/welcome", parsed_url)) {
            Ok(u) => u,
            Err(e) => {
                return Err(format!("Parsing error: {}", e));
            }
        };

        // On mobile, we'll use the system browser for authentication
        // This is a simplified approach - in a real app, you might want to
        // implement a more sophisticated mobile authentication flow
        println!("Opening URL in system browser: {}", full_url);

        // For now, we'll return an error indicating that manual authentication is needed
        // In a production app, you might want to implement deep linking back to the app
        return Err("Mobile authentication requires manual login through the system browser. Please implement a proper mobile authentication flow.".to_string());
    }

    Ok(())
}
