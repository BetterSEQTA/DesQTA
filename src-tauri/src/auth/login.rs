use reqwest::header;
use tauri::{Emitter, Manager};
use time::OffsetDateTime;
use url::Url;
use serde::Deserialize;
use serde_json::json;
use base64::{Engine as _, engine::general_purpose};

use std::sync::Arc;

use reqwest::{cookie::Jar};

use crate::netgrab;
use crate::session;

#[derive(Debug, Deserialize, Clone)]
struct SeqtaSSOPayload {
    t: String, // JWT token
    u: String, // Server URL
    n: String, // User number
}

#[derive(Deserialize)]
struct AppLinkPayload {}

#[derive(Deserialize)]
struct AppLinkResponse {}

#[derive(Debug, Deserialize)]
struct SeqtaJWT {
    exp: i64,       // Expiration timestamp
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
pub async fn logout() -> bool {
    if let Ok(_) = netgrab::clear_session().await {
        true
    } else {
        false
    }
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
    let url_decoded = urlencoding::decode(encoded_payload)
        .map_err(|e| format!("Failed to URL decode: {}", e))?;
    
    // Then decode the base64
    let decoded_payload = general_purpose::STANDARD
        .decode(url_decoded.as_bytes())
        .map_err(|e| format!("Failed to base64 decode: {}", e))?;
    
    let payload_str = String::from_utf8(decoded_payload)
        .map_err(|e| format!("Failed to convert to string: {}", e))?;
    
    let result = serde_json::from_str(&payload_str)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
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
    
    // Step 1: First login request (empty body)
    let first_login_url = format!("{}/seqta/student/login", base_url);

    let first_login_body = json!({
        "token": &token
    });
    
    let first_response = client.post(&first_login_url)
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
    
    let second_response = client.post(&first_login_url)
        .json(&second_login_body)
        .send()
        .await
        .map_err(|e| format!("Second login request failed: {}", e))?;
    
    if !second_response.status().is_success() {
        let status = second_response.status();
        return Err(format!("Second login failed with status: {}", status));
    }

    // Step 3 - get cookie (which should be stored here)
    let jsessionid = second_response.headers().get("Set-Cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_str| {
            // Extract just the JSESSIONID value from "JSESSIONID=value; Path=/; HttpOnly"
            cookie_str.split(';')
                .find(|part| part.trim().starts_with("JSESSIONID="))
                .map(|jsession_part| jsession_part.trim().strip_prefix("JSESSIONID=").unwrap_or("").to_string())
        });


    // Step 4: Send a heartbeat - Defib. Check if the JSESSIONID/JWT is valid
    let heartbeat_url = format!("{}/seqta/student/heartbeat", base_url);

    let heartbeat_body = json!({
        "heartbeat": true
    });

    let heartbeat_response = client.post(&heartbeat_url)
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
        
        // Save the session
        session.save().map_err(|e| format!("Failed to save session: {}", e))?;
        
        // Force reload the app
        force_reload(app);
        return Ok(());
    }

    // For regular URL-based login, handle differently for desktop vs mobile
    #[cfg(desktop)]
    {
        use tauri::{WebviewUrl, WebviewWindowBuilder};
        use tokio::time::{sleep, Duration};
        use std::sync::atomic::{AtomicU64, Ordering};
        
        // Generate unique window ID to prevent conflicts
        static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(0);
        let window_id = format!("seqta_login_{}", WINDOW_COUNTER.fetch_add(1, Ordering::SeqCst));

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

        let full_url: Url = match Url::parse(&format!("{}/#?page=/welcome", parsed_url)) {
            Ok(u) => u,
            Err(e) => {
                return Err(format!("Parsing error: {}", e));
            }
        };

        // Close any existing login windows first
        if let Some(existing_window) = app.get_webview_window("seqta_login") {
            let _ = existing_window.destroy();
        }

        // Spawn the login window with unique ID
        let _webview_window = WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::External(full_url.clone()))
            .title("SEQTA Login")
            .inner_size(900.0, 700.0)
            .build()
            .map_err(|e| format!("Failed to build window: {}", e))?;

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
                        // Check if the auth has finished through url
                        match webview.url() {
                            Ok(current_url) => {
                                if !(current_url.to_string().contains("#?page=/welcome")) {
                                    continue;
                                }
                            }
                            Err(_) => {
                                // URL retrieval failed, continue polling
                            }
                        }

                        match webview.cookies() {
                            Ok(cookies) => {
                                for cookie in cookies.clone() {
                                    if cookie.name() == "JSESSIONID"
                                        && cookie.domain().unwrap_or("None") == parsed_url.host_str().unwrap_or("None")
                                    {
                                        if let Some(expire_time) = cookie.expires_datetime() {
                                            let now = OffsetDateTime::now_utc();
                                            if expire_time > now {

                                                let value = cookie.value().to_string();
                                                let base_url = http_url.clone();

                                                // Convert all cookies to our storage format
                                                let additional_cookies = cookies
                                                    .iter()
                                                    .filter(|c| c.name() != "JSESSIONID") // Skip JSESSIONID as it's stored separately
                                                    .filter(|c| {
                                                        if let Some(cookie_domain) = c.domain() {
                                                            if let Some(host) = parsed_url.host_str() {
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
                                                    base_url,
                                                    jsessionid: value,
                                                    additional_cookies,
                                                };

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
