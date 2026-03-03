use anyhow::{anyhow, Result, Context};
use reqwest::Client;
use reqwest::{self, RequestBuilder};
use rss::Channel;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::{fs, io::Cursor, io::Read, sync::OnceLock, time::Duration, path::PathBuf};
use std::{io::Error, io::ErrorKind};
use url::form_urlencoded;
use url::Url;
use xmltree::{Element, XMLNode};

use base64::{engine::general_purpose, Engine as _};
// opens a file using the default program:

use crate::logger;
use crate::session;

type Patches = HashMap<String, Value>;
const NOT_MODIFIED: &str = "Not modified";

static GLOBAL_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize)]
pub enum RequestMethod {
    GET,
    POST,
}

/// Create an HTTP client builder with school network-friendly configuration:
/// - Timeouts to prevent hanging requests
/// - SSL certificate validation that handles MITM proxies
/// - Automatic proxy detection
pub fn create_client_builder() -> reqwest::ClientBuilder {
        let builder = reqwest::Client::builder()
        // Set timeouts to prevent hanging requests on slow/unreliable networks
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(30))
        // For school networks with MITM proxies/content filters, we need to be more lenient
        // with SSL certificate validation. Many school networks use proxies with self-signed certs.
        // Note: This is a security trade-off but necessary for school network compatibility.
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true);

    // reqwest automatically uses system proxies and environment variables (HTTP_PROXY, HTTPS_PROXY, etc.)
    // No explicit configuration needed - reqwest handles this automatically

    builder
}

/// Build an HTTP client with headers based on the saved session.
/// This client is configured to work on school networks with:
/// - Timeouts to prevent hanging requests
/// - Proxy support (automatic detection)
/// - SSL certificate validation that can handle MITM proxies
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

        create_client_builder()
            .default_headers(headers)
            .build()
            .expect("Failed to create HTTP client")
    })
}

fn patches_file() -> PathBuf {
    let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
    dir.push("DesQTA");
    dir.push("dev");
    dir.push("requestPatches.json");
    dir
}

fn ensure_patches_dir() -> Result<()> {
    if let Some(parent) = patches_file().parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn read_patches() -> Result<Patches> {
    let path = patches_file();

    let contents = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(e) => return Err(e).context("failed to read requestPatches.json"),
    };

    serde_json::from_str(&contents)
        .context("requestPatches.json contained invalid JSON")
}

fn write_patches(patches: &Patches) -> Result<()> {
    ensure_patches_dir()?;
    let path = patches_file();
    let tmp = path.with_extension("tmp");

    let json = serde_json::to_string_pretty(patches)?;
    fs::write(&tmp, json)?;
    fs::rename(tmp, path)?;
    Ok(())
}

fn remove_patch(request_id: &str) -> Result<()> {
    let mut patches = read_patches()?;
    patches.remove(request_id);
    write_patches(&patches)
}

fn append_patch(
    patch_key: impl Into<String>,
    patch: Value,
) -> Result<()> {
    let mut patches = read_patches()?;

    patches.insert(patch_key.into(), patch);

    write_patches(&patches)
}

/// Recursively replaces every leaf value (anything that is not a JSON object)
/// with the NOT_MODIFIED sentinel, preserving all keys and nesting structure.
/// Arrays are treated as opaque leaves — their contents are not walked.
fn to_skeleton(val: &Value) -> Value {
    match val {
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (k, v) in map {
                out.insert(k.clone(), to_skeleton(v));
            }
            Value::Object(out)
        }
        _ => Value::String(NOT_MODIFIED.to_string()),
    }
}

/// Merges keys from `incoming` into `existing` using the NOT_MODIFIED pattern:
/// - Keys absent from `existing` are inserted as to_skeleton(incoming_value).
/// - Keys already present are NEVER touched (preserves user overrides).
/// - Recurses into nested object pairs so inner keys follow the same rules.
fn merge_skeleton(existing: &mut Value, incoming: &Value) {
    match (existing, incoming) {
        (Value::Object(ex_map), Value::Object(in_map)) => {
            for (k, in_val) in in_map {
                if let Some(ex_val) = ex_map.get_mut(k) {
                    if ex_val.is_object() && in_val.is_object() {
                        merge_skeleton(ex_val, in_val);
                    }
                    // Otherwise leave existing value completely alone
                } else {
                    ex_map.insert(k.clone(), to_skeleton(in_val));
                }
            }
        }
        _ => {}
    }
}

/// Walks `patch` and writes every value that is NOT the NOT_MODIFIED sentinel
/// into the corresponding position in `target`. Recurses into nested objects.
fn apply_overrides(patch: &Value, target: &mut Value) {
    match (patch, target) {
        (Value::Object(patch_map), Value::Object(target_map)) => {
            for (k, patch_val) in patch_map {
                if patch_val.as_str() == Some(NOT_MODIFIED) {
                    continue;
                }
                match patch_val {
                    Value::Object(_) => {
                        let child = target_map.entry(k.clone()).or_insert_with(|| json!({}));
                        apply_overrides(patch_val, child);
                    }
                    _ => {
                        target_map.insert(k.clone(), patch_val.clone());
                    }
                }
            }
        }
        (patch_val, target) if patch_val.as_str() != Some(NOT_MODIFIED) => {
            *target = patch_val.clone();
        }
        _ => {}
    }
}

/// Records a successful text response into the patch file for `full_url`.
/// Uses merge_skeleton so the first response populates with NOT_MODIFIED leaves
/// and subsequent calls only add newly-seen keys without touching existing values.
fn record_response_patch(full_url: &str, response_text: &str) {
    if let Ok(response_json) = serde_json::from_str::<Value>(response_text) {
        if let Ok(mut patches) = read_patches() {
            if let Some(entry) = patches.get_mut(full_url) {
                if let Some(resp_section) = entry.get_mut("response") {
                    merge_skeleton(resp_section, &response_json);
                    let _ = write_patches(&patches);
                }
            }
        }
    }
}

async fn append_default_headers(req: RequestBuilder) -> RequestBuilder {
    let mut session = session::Session::load();
    let mut headers = reqwest::header::HeaderMap::new();

    // Check if we're using JWT-based authentication (QR code login)
    if session.jsessionid.starts_with("eyJ") {
        // Check if we have JSESSIONID cookies from previous responses
        let mut has_jsessionid_cookie = false;
        let mut jsessionid_cookies: Vec<String> = Vec::new();
        for cookie in &session.additional_cookies {
            if cookie.name == "JSESSIONID" {
                has_jsessionid_cookie = true;
                jsessionid_cookies.push(cookie.value.clone());
            }
        }

        if jsessionid_cookies.len() > 1 {
            // Clear duplicate JSESSIONID cookies to prevent errors
            session
                .additional_cookies
                .retain(|cookie| cookie.name != "JSESSIONID");
            let _ = session.save();
            has_jsessionid_cookie = false;
        }

        if has_jsessionid_cookie {
            // Use both JWT Bearer token and JSESSIONID cookie
            headers.insert(
                reqwest::header::AUTHORIZATION,
                format!("Bearer {}", session.jsessionid).parse().unwrap(),
            );

            // Add JSESSIONID cookie
            let mut cookie_parts = Vec::new();
            for cookie in &session.additional_cookies {
                if cookie.name == "JSESSIONID" {
                    cookie_parts.push(format!("JSESSIONID={}", cookie.value));
                }
            }

            if !cookie_parts.is_empty() {
                headers.insert(
                    reqwest::header::COOKIE,
                    cookie_parts.join("; ").parse().unwrap(),
                );
            }
        } else {
            // This is a JWT token, use Bearer authentication only
            headers.insert(
                reqwest::header::AUTHORIZATION,
                format!("Bearer {}", session.jsessionid).parse().unwrap(),
            );
        }

        if !session.base_url.is_empty() {
            headers.insert(reqwest::header::ORIGIN, session.base_url.parse().unwrap());
            headers.insert(reqwest::header::REFERER, session.base_url.parse().unwrap());
        }
    } else {
        // Traditional cookie-based authentication
        let mut cookie_parts = Vec::new();

        // Add JSESSIONID first if it exists
        if !session.jsessionid.is_empty() {
            cookie_parts.push(format!("JSESSIONID={}", session.jsessionid));
        }

        // Add all additional cookies
        for cookie in session.additional_cookies {
            cookie_parts.push(format!("{}={}", cookie.name, cookie.value));
        }

        // Set the combined cookie header if we have any cookies
        if !cookie_parts.is_empty() {
            let cookie_header = cookie_parts.join("; ");
            headers.insert(reqwest::header::COOKIE, cookie_header.parse().unwrap());
        }

        if !session.base_url.is_empty() {
            headers.insert(reqwest::header::ORIGIN, session.base_url.parse().unwrap());
            headers.insert(reqwest::header::REFERER, session.base_url.parse().unwrap());
        }
    }

    req.headers(headers)
}

/// Re-authenticate inline without app handle (for use in netgrab)
async fn reauthenticate_inline(
    base_url: &str,
    username: &str,
    password: &str,
) -> Result<String, String> {
    use serde_json::json;
    
    // Normalize base_url
    let http_url = if base_url.starts_with("https://") {
        base_url.to_string()
    } else {
        format!("https://{}", base_url)
    };

    let login_url = format!("{}/seqta/student/login", http_url);

    // Create HTTP client with cookie store enabled and school network-friendly config
    let client = create_client_builder()
        .cookie_store(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Prepare login request body
    let login_body = json!({
        "username": username,
        "password": password,
        "mode": "normal",
        "query": null
    });

    // Make login request
    let response = client
        .post(&login_url)
        .header("Content-Type", "application/json; charset=utf-8")
        .json(&login_body)
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err("Invalid username or password".to_string());
        }
        return Err(format!("Login failed with status: {}", status));
    }

    // Extract JSESSIONID from Set-Cookie header
    let jsessionid = response
        .headers()
        .get("Set-Cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_str| {
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
        })
        .ok_or("Could not get JSESSIONID from response headers")?;

    // Validate session with a heartbeat request
    let heartbeat_url = format!("{}/seqta/student/heartbeat", http_url);
    let heartbeat_body = json!({ "heartbeat": true });

    let heartbeat_response = client
        .post(&heartbeat_url)
        .header("Cookie", format!("JSESSIONID={}", jsessionid))
        .header("Content-Type", "application/json; charset=utf-8")
        .json(&heartbeat_body)
        .send()
        .await
        .map_err(|e| format!("Heartbeat request failed: {}", e))?;

    if !heartbeat_response.status().is_success() {
        return Err("Session validation failed".to_string());
    }

    Ok(jsessionid)
}

#[tauri::command]
pub async fn fetch_api_data(
    url: &str,
    method: RequestMethod,
    headers: Option<HashMap<String, String>>,
    body: Option<Value>,
    parameters: Option<HashMap<String, String>>,
    is_image: bool,
    return_url: bool,
    parse_html: Option<bool>,
) -> Result<String, String> {
    // Log function entry
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "netgrab",
            "fetch_api_data",
            &format!("Starting {} {}", format!("{:?}", method), url),
            serde_json::json!({
                "url": url,
                "method": format!("{:?}", method),
                "is_image": is_image,
                "return_url": return_url,
                "parse_html": parse_html.unwrap_or(false)
            }),
        );
    }
    let _parse_html = parse_html; // Use parse_html later in the function
    let client = create_client();
    let mut session = session::Session::load();
    
    // Validate session has required data
    if session.jsessionid.is_empty() && session.base_url.is_empty() {
        return Err("No active session found. Please log in again.".to_string());
    }

    let full_url = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("{}{}", session.base_url.parse::<String>().unwrap(), url)
    };

    // Mutable clones — patch overrides may be applied into these before any request
    // is sent. The retry loop and re-auth retry both read exclusively from these.
    let mut headers_clone: Option<HashMap<String, String>> = headers.clone();
    let mut parameters_clone: Option<HashMap<String, String>> = parameters.clone();
    let mut body_clone: Option<Value> = body.clone();

    // -------------------------------------------------------------------------
    // Patch system
    //
    // Disk shape:
    //   {
    //     "<full_url>": {
    //       "request":  { <mirrors incoming; every leaf value = NOT_MODIFIED or user override> },
    //       "response": { <mirrors first JSON response; same sentinel pattern> }
    //     }
    //   }
    //
    // Request-side rules (runs once, before the retry loop):
    //   • No entry yet → create with to_skeleton(incoming), empty response object.
    //   • Entry exists → merge_skeleton to register any newly-seen keys as NOT_MODIFIED.
    //                    Then apply_overrides to replay non-NOT_MODIFIED values back onto
    //                    headers_clone / parameters_clone / body_clone.
    //
    // Response-side rules (applied after every successful text response):
    //   • merge_skeleton into entry.response — first response populates it, later ones
    //     only add new keys. Existing values (user overrides) are never overwritten.
    // -------------------------------------------------------------------------
    {
        let incoming_request = json!({
            "body":       body_clone.clone().unwrap_or(json!({})),
            "headers":    headers_clone.clone().unwrap_or_default(),
            "parameters": parameters_clone.clone().unwrap_or_default(),
            "method":     format!("{:?}", method),
            "is_image":   is_image,
            "return_url": return_url,
            "parse_html": parse_html.unwrap_or(false)
        });

        let mut patches = read_patches()
            .map_err(|e| format!("Failed to read request patches: {}", e))?;

        let entry = patches.entry(full_url.clone()).or_insert_with(|| json!({
            "request":  to_skeleton(&incoming_request),
            "response": {}
        }));

        // Merge any newly-seen request keys (no-op on first call — entry was just created)
        if let Some(req_section) = entry.get_mut("request") {
            merge_skeleton(req_section, &incoming_request);
        }

        // Apply developer overrides back onto the live clones
        if let Some(req_patch) = entry.get("request").cloned() {
            // body — may be nested so use recursive apply_overrides
            if let Some(body_patch) = req_patch.get("body") {
                if body_patch.as_str() != Some(NOT_MODIFIED) {
                    let mut current = body_clone.clone().unwrap_or(json!({}));
                    apply_overrides(body_patch, &mut current);
                    body_clone = Some(current);
                }
            }

            // headers — flat HashMap<String,String>; only plain string values apply
            if let Some(Value::Object(headers_patch)) = req_patch.get("headers") {
                let mut h = headers_clone.clone().unwrap_or_default();
                for (k, v) in headers_patch {
                    if v.as_str() != Some(NOT_MODIFIED) {
                        if let Some(s) = v.as_str() {
                            h.insert(k.clone(), s.to_string());
                        }
                    }
                }
                headers_clone = Some(h);
            }

            // parameters — same flat shape
            if let Some(Value::Object(params_patch)) = req_patch.get("parameters") {
                let mut p = parameters_clone.clone().unwrap_or_default();
                for (k, v) in params_patch {
                    if v.as_str() != Some(NOT_MODIFIED) {
                        if let Some(s) = v.as_str() {
                            p.insert(k.clone(), s.to_string());
                        }
                    }
                }
                parameters_clone = Some(p);
            }

            // method / is_image / return_url / parse_html are function-level parameters;
            // they cannot be mutated post-call and are stored for observability only.
        }

        write_patches(&patches)
            .map_err(|e| format!("Failed to write request patches: {}", e))?;
    }

    // Retry logic for transient network failures (common on school WiFi)
    let max_retries = 3;
    let mut last_error: Option<String> = None;
    
    for attempt in 0..=max_retries {
        // Reload session at start of each attempt to ensure we have the latest session state
        // This is critical because append_default_headers also loads the session fresh,
        // and we need both to use the same session state
        session = session::Session::load();
        
        // Validate session is still valid after reload
        if session.jsessionid.is_empty() && session.base_url.is_empty() {
            return Err("Session expired or cleared. Please log in again.".to_string());
        }
        
        // Build request for this attempt
        let mut request_to_send = match method {
            RequestMethod::GET => client.get(&full_url),
            RequestMethod::POST => client.post(&full_url),
        };
        
        request_to_send = append_default_headers(request_to_send).await;

        // was: if let Some(headers) = &headers {
        if let Some(ref h) = headers_clone {
            for (key, value) in h {
                request_to_send = request_to_send.header(key, value);
            }
        }

        // was: if let Some(params) = &parameters {
        if let Some(ref params) = parameters_clone {
            request_to_send = request_to_send.query(params);
        }
        
        if let RequestMethod::POST = method {
            let mut final_body = body_clone.as_ref().cloned().unwrap_or_else(|| json!({}));
            if session.jsessionid.starts_with("eyJ") {
                if let Some(body_obj) = final_body.as_object_mut() {
                    body_obj.insert("jwt".to_string(), json!(session.jsessionid));
                }
            }
            request_to_send = request_to_send.json(&final_body);
        }
        
        match request_to_send.send().await {
            Ok(resp) => {
            // Check for JSESSIONID cookie in response headers for JWT-based sessions
            if session.jsessionid.starts_with("eyJ") {
                if let Some(set_cookie_header) = resp.headers().get("set-cookie") {
                    let set_cookie_str = set_cookie_header.to_str().unwrap_or("");

                    if set_cookie_str.contains("JSESSIONID=") {
                        // Extract JSESSIONID value
                        if let Some(jsessionid_start) = set_cookie_str.find("JSESSIONID=") {
                            let jsessionid_part = &set_cookie_str[jsessionid_start..];
                            if let Some(jsessionid_end) = jsessionid_part.find(';') {
                                let jsessionid_value = &jsessionid_part[11..jsessionid_end]; // Skip "JSESSIONID="

                                // Update session in memory and save to disk
                                if session.jsessionid.starts_with("eyJ") {
                                    // Remove any existing JSESSIONID cookies first
                                    session
                                        .additional_cookies
                                        .retain(|cookie| cookie.name != "JSESSIONID");

                                    // Add the new JSESSIONID cookie
                                    session.additional_cookies.push(session::Cookie {
                                        name: "JSESSIONID".to_string(),
                                        value: jsessionid_value.to_string(),
                                        domain: None,
                                        path: None,
                                    });

                                    let _ = session.save();
                                }
                            }
                        }
                    }
                }
            }

            // Capture status before consuming response
            let status = resp.status();
            
            // Check for HTTP-level authentication failures (only 401/403, not 404)
            // 404 (NOT_FOUND) is not an auth failure and should not trigger re-auth
            let is_http_auth_failure = status == reqwest::StatusCode::UNAUTHORIZED 
                || status == reqwest::StatusCode::FORBIDDEN;
            
            // For non-image, non-URL responses, check the body for authentication failures
            // SEQTA APIs can return HTTP 200 with {"status":"401"} in the body
            if !is_image && !return_url {
                // Read the response text to check for auth failures
                let response_text = resp.text().await.map_err(|e| e.to_string())?;
                
                // Try to parse as JSON and check for status: "401"
                let mut is_body_auth_failure = false;
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                    if let Some(status_str) = json.get("status").and_then(|s| s.as_str()) {
                        if status_str == "401" || status_str == "failed" {
                            is_body_auth_failure = true;
                        }
                    }
                }
                
                // If we detected auth failure (either HTTP status or body status), attempt re-auth
                if (is_http_auth_failure || is_body_auth_failure) 
                    && session.stored_username.is_some() 
                    && session.stored_password.is_some() 
                {
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::INFO,
                            "netgrab",
                            "fetch_api_data",
                            "Authentication failed, attempting re-authentication",
                            serde_json::json!({
                                "url": url,
                                "http_status": status.as_u16(),
                                "body_auth_failure": is_body_auth_failure
                            }),
                        );
                    }
                    
                    // Attempt re-authentication inline using stored credentials
                    let username = session.stored_username.clone().unwrap();
                    let password = session.stored_password.clone().unwrap();
                    let base_url = session.base_url.clone();
                    
                    // Perform re-authentication directly
                    match reauthenticate_inline(&base_url, &username, &password).await {
                        Ok(new_jsessionid) => {
                            // Update session with new JSESSIONID
                            let mut updated_session = session::Session::load();
                            updated_session.jsessionid = new_jsessionid;
                            if let Err(e) = updated_session.save() {
                                if let Some(logger) = logger::get_logger() {
                                    let _ = logger.log(
                                        logger::LogLevel::ERROR,
                                        "netgrab",
                                        "fetch_api_data",
                                        &format!("Failed to save updated session: {}", e),
                                        serde_json::json!({}),
                                    );
                                }
                            }
                            
                            // Reload session and retry the original request
                            let retry_session = session::Session::load();
                            let mut retry_request = match method {
                                RequestMethod::GET => client.get(&full_url),
                                RequestMethod::POST => client.post(&full_url),
                            };
                            
                            retry_request = append_default_headers(retry_request).await;
                            
                            // Add custom headers if provided
                            if let Some(headers) = &headers_clone {
                                for (key, value) in headers {
                                    retry_request = retry_request.header(key, value);
                                }
                            }
                            
                            // Add query parameters if provided
                            if let Some(params) = &parameters_clone {
                                retry_request = retry_request.query(params);
                            }
                            
                            // Add body for POST requests if provided
                            if let RequestMethod::POST = method {
                                let mut final_body = body_clone.clone().unwrap_or_else(|| json!({}));
                                if let Some(body_obj) = final_body.as_object_mut() {
                                    if retry_session.jsessionid.starts_with("eyJ") {
                                        body_obj.insert("jwt".to_string(), json!(retry_session.jsessionid));
                                    }
                                }
                                retry_request = retry_request.json(&final_body);
                            }
                            
                            // Retry the request
                            match retry_request.send().await {
                                Ok(retry_resp) => {
                                    let retry_status = retry_resp.status();
                                    if retry_status.is_success() {
                                        let retry_text = retry_resp.text().await.map_err(|e| e.to_string())?;
                                        record_response_patch(&full_url, &retry_text);
                                        return Ok(retry_text);
                                    } else {
                                        return Err(format!("Request failed after re-authentication: {}", retry_status));
                                    }
                                }
                                Err(e) => {
                                    return Err(format!("Request failed after re-authentication: {}", e));
                                }
                            }
                        }
                        Err(e) => {
                            // Re-authentication failed
                            return Err(format!("Re-authentication failed: {}", e));
                        }
                    }
                } else if is_body_auth_failure || is_http_auth_failure {
                    // Auth failure but no stored credentials - try reloading session and retrying once
                    // This handles cases where the session might be refreshed by another process
                    // or where there's a temporary session invalidation
                    let reloaded_session = session::Session::load();
                    
                    // If reloaded session is empty, this likely means session was cleared (e.g., during login)
                    // Don't retry with empty session - return a clear error
                    if reloaded_session.jsessionid.is_empty() || reloaded_session.base_url.is_empty() {
                        return Err("Session was cleared. This may happen during login. Please try again after login completes.".to_string());
                    }
                    
                    if reloaded_session.jsessionid != session.jsessionid {
                        // Session was reloaded and is different - try one more time with reloaded session
                        // This handles race conditions where session was updated between calls

                        // Wait a brief moment in case session is being refreshed
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        
                        // Reload session one more time to catch any updates
                        let final_session = session::Session::load();
                        if !final_session.jsessionid.is_empty() && !final_session.base_url.is_empty() {
                            // Update session and retry in the outer loop
                            session = final_session;
                            continue;
                        }
                    }

                    // No stored credentials and session reload didn't help (same session or empty)
                    return Err(format!("Authentication failed: {}", response_text));
                }
                
                // Return the response text (no auth failure detected)
                record_response_patch(&full_url, &response_text);
                return Ok(response_text);
            }
            
            // For HTTP-level auth failures on image/URL requests
            if is_http_auth_failure 
                && session.stored_username.is_some() 
                && session.stored_password.is_some() 
            {
                if let Some(logger) = logger::get_logger() {
                    let _ = logger.log(
                        logger::LogLevel::INFO,
                        "netgrab",
                        "fetch_api_data",
                        "Authentication failed (HTTP), attempting re-authentication",
                        serde_json::json!({
                            "url": url,
                            "http_status": status.as_u16()
                        }),
                    );
                }
                
                let username = session.stored_username.clone().unwrap();
                let password = session.stored_password.clone().unwrap();
                let base_url = session.base_url.clone();
                
                match reauthenticate_inline(&base_url, &username, &password).await {
                    Ok(_) => {
                        // Retry logic would go here for image/URL requests if needed
                        return Err(format!("AUTH_REQUIRED: Session expired, re-authentication completed. Please retry request."));
                    }
                    Err(e) => {
                        return Err(format!("Re-authentication failed: {}", e));
                    }
                }
            }

            let result = if is_image == true {
                // Get the bytes (await and ? to bubble up errors)
                let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
                // Encode to base64
                let base64_str = general_purpose::STANDARD.encode(&bytes);
                Ok(base64_str)
            } else if return_url == true {
                let url = String::from(resp.url().as_str());
                Ok(url)
            } else {
                // This should not be reached due to the check above, but keeping for safety
                let text = resp.text().await.map_err(|e| e.to_string())?;
                record_response_patch(&full_url, &text);
                Ok(text)
            };

            // Log successful response
            if let Some(logger) = logger::get_logger() {
                let _ = logger.log(
                    logger::LogLevel::DEBUG,
                    "netgrab",
                    "fetch_api_data",
                    &format!("HTTP {} {} -> {}", format!("{:?}", method), url, status),
                    serde_json::json!({
                        "url": url,
                        "method": format!("{:?}", method),
                        "status": status.as_u16(),
                        "status_text": status.canonical_reason().unwrap_or("Unknown")
                    }),
                );
            }
                return result;
            }
            Err(e) => {
                last_error = Some(e.to_string());
                
                // Check if this is a retryable error (network/timeout issues)
                let is_retryable = last_error.as_ref().map(|err_str| {
                    let err_lower = err_str.to_lowercase();
                    err_lower.contains("timeout") 
                        || err_lower.contains("connection")
                        || err_lower.contains("network")
                        || err_lower.contains("dns")
                        || err_lower.contains("tls")
                        || err_lower.contains("certificate")
                }).unwrap_or(false);
                
                // If this is the last attempt or error is not retryable, return error
                if attempt >= max_retries || !is_retryable {
                    // Log error
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::ERROR,
                            "netgrab",
                            "fetch_api_data",
                            &format!("HTTP request failed after {} attempts: {}", attempt + 1, last_error.as_ref().unwrap()),
                            serde_json::json!({
                                "url": url,
                                "method": format!("{:?}", method),
                                "error": last_error.as_ref().unwrap().to_string(),
                                "attempts": attempt + 1
                            }),
                        );
                    }
                    return Err(format!("HTTP request failed: {}", last_error.as_ref().unwrap()));
                }
                
                // Exponential backoff: wait before retrying (1s, 2s, 4s)
                let delay_ms = 1000 * (1 << attempt);
                if let Some(logger) = logger::get_logger() {
                    let _ = logger.log(
                        logger::LogLevel::DEBUG,
                        "netgrab",
                        "fetch_api_data",
                        &format!("Retrying request (attempt {}/{}) after {}ms", attempt + 1, max_retries + 1, delay_ms),
                        serde_json::json!({
                            "url": url,
                            "attempt": attempt + 1,
                            "max_retries": max_retries + 1,
                            "delay_ms": delay_ms
                        }),
                    );
                }
                
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                
                // Session will be reloaded at the start of the next loop iteration
            }
        }
    }
    
    // This should never be reached, but handle it just in case
    Err(format!("HTTP request failed: {}", last_error.unwrap_or_else(|| "Unknown error".to_string())))
}

#[tauri::command]
pub async fn get_api_data(
    url: &str,
    parameters: HashMap<String, String>,
    parse_html: Option<bool>,
) -> Result<String, String> {
    // Log API call
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "netgrab",
            "get_api_data",
            &format!("GET API call to {}", url),
            serde_json::json!({"url": url, "parameters": parameters}),
        );
    }
    fetch_api_data(
        url,
        RequestMethod::GET,
        None,
        None,
        Some(parameters),
        false,
        false,
        parse_html,
    )
    .await
}

#[tauri::command]
pub async fn get_seqta_file(file_type: &str, uuid: &str) -> Result<String, String> {
    let mut params = HashMap::new();
    params.insert(String::from("type"), String::from(file_type));
    params.insert(String::from("file"), String::from(uuid));
    fetch_api_data(
        "/seqta/student/load/file",
        RequestMethod::GET,
        None,
        None,
        Some(params),
        false,
        true,
        None,
    )
    .await
}

/// Helper function to get file size limit from seqtaConfig.json
fn get_file_size_limit_from_config() -> Option<u64> {

    // Get the config file path
    let config_path = if cfg!(target_os = "android") {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        dir.push("seqtaConfig.json");
        dir
    } else {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        dir.push("seqtaConfig.json");
        dir
    };

    // Read and parse the config file
    if let Ok(mut file) = fs::File::open(&config_path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(config_value) = serde_json::from_str::<Value>(&contents) {
                if let Some(coneqt_s) = config_value.get("coneqt-s") {
                    if let Some(filesize) = coneqt_s.get("filesize") {
                        if let Some(limit) = filesize.get("limit") {
                            if let Some(value) = limit.get("value") {
                                if let Some(size_str) = value.as_str() {
                                    if let Ok(size_mb) = size_str.parse::<u64>() {
                                        return Some(size_mb);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn upload_seqta_file(file_name: String, file_path: String) -> Result<String, String> {
    let client = create_client();
    let session = session::Session::load();

    // Check file size limit from seqtaConfig.json
    let file_size_limit_mb = get_file_size_limit_from_config();
    if let Some(limit_mb) = file_size_limit_mb {
        let file_metadata =
            fs::metadata(&file_path).map_err(|e| format!("Failed to read file metadata: {}", e))?;

        let file_size_mb = file_metadata.len() / (1024 * 1024); // Convert bytes to MB
        if file_size_mb > limit_mb {
            return Err(format!(
                "File size ({:.1} MB) exceeds the limit of {} MB",
                file_size_mb as f64, limit_mb
            ));
        }
    }

    // Read the file content
    let file_content = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    let url = format!(
        "{}/seqta/student/file/upload/xhr2",
        session.base_url.parse::<String>().unwrap()
    );
    let mut request = client.post(&url);
    request = append_default_headers(request).await;

    let url_filename: String = form_urlencoded::byte_serialize(&file_name.as_bytes()).collect();

    // Set headers exactly like the web UI
    request = request.header("X-File-Name", url_filename);
    request = request.header("X-Accept-Mimes", "null");
    request = request.header("X-Requested-With", "XMLHttpRequest");

    match request.body(file_content).send().await {
        Ok(resp) => {
            let text = resp.text().await.map_err(|e| e.to_string())?;
            Ok(text)
        }
        Err(e) => Err(format!("File upload failed: {e}")),
    }
}

#[tauri::command]
pub async fn get_rss_feed(feed: &str) -> Result<Value, String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let res = client
        .get(feed)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = res.status();
    let content = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "Request failed with status {}. Response body:\n{}",
            status, content
        ));
    }

    let channel = Channel::read_from(content.as_bytes())
        .map_err(|e| format!("Failed to parse RSS feed: {}", e))?;

    let json =
        channel_to_json(&channel).map_err(|e| format!("Failed to convert to JSON: {}", e))?;

    Ok(json)
}
pub fn channel_to_json(channel: &Channel) -> Result<Value> {
    fn xml_to_json(elem: &Element) -> Value {
        let text = elem.get_text();
        let has_text = text.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false);

        let has_attrs = !elem.attributes.is_empty();
        let has_children = elem
            .children
            .iter()
            .any(|c| matches!(c, XMLNode::Element(_)));

        if !has_attrs && !has_children && has_text {
            return Value::String(text.unwrap().to_string());
        }

        let mut map = serde_json::Map::new();

        if has_attrs {
            map.insert("@attributes".into(), json!(elem.attributes));
        }

        for child in &elem.children {
            if let XMLNode::Element(child_elem) = child {
                let child_json = xml_to_json(child_elem);
                map.entry(child_elem.name.clone())
                    .and_modify(|v| {
                        if let Value::Array(arr) = v {
                            arr.push(child_json.clone());
                        } else {
                            *v = Value::Array(vec![v.take(), child_json.clone()]);
                        }
                    })
                    .or_insert(child_json);
            }
        }

        if has_text {
            map.insert("text".into(), Value::String(text.unwrap().to_string()));
        }

        Value::Object(map)
    }

    let xml_str = channel.to_string();
    let root =
        Element::parse(Cursor::new(xml_str)).map_err(|e| anyhow!("Failed to parse XML: {}", e))?;

    let mut root_json = xml_to_json(&root);

    // Parse item elements into feeds array using flexible xml_to_json
    let feeds: Vec<Value> = root
        .get_child("channel")
        .map(|channel_elem| {
            channel_elem
                .children
                .iter()
                .filter_map(|node| {
                    if let XMLNode::Element(child) = node {
                        if child.name == "item" {
                            Some(xml_to_json(child))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    if let Value::Object(ref mut map) = root_json {
        map.insert("feeds".to_string(), Value::Array(feeds));
    }

    Ok(root_json)
}

/// Open a login window and harvest the cookie once the user signs in.
#[tauri::command]
pub async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // Log URL opening
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "netgrab",
            "open_url",
            &format!("Opening URL: {}", url),
            serde_json::json!({"url": url}),
        );
    }

    #[cfg(desktop)]
    {
        use tauri::{WebviewUrl, WebviewWindowBuilder};

        let http_url;

        match url.starts_with("https://") {
            true => http_url = url.clone(),
            false => {
                http_url = format!("https://{}", url.clone());
            }
        }

        let parsed_url = match Url::parse(&http_url) {
            Ok(u) => u,
            Err(e) => return Err(format!("Invalid URL: {}", e)),
        };

        let full_url: Url = match Url::parse(&format!("{}", parsed_url)) {
            Ok(u) => u,
            Err(e) => return Err(format!("Invalid URL: {}", e)), // Nothing
        };

        // Spawn the login window
        WebviewWindowBuilder::new(&app, "seqta_login", WebviewUrl::External(full_url.clone()))
            .title("SEQTA Login")
            .inner_size(900.0, 700.0)
            .build()
            .map_err(|e| format!("Failed to build window: {}", e))?;

        // Log successful window creation
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "netgrab",
                "open_url",
                "SEQTA login window created successfully",
                serde_json::json!({"window_id": "seqta_login"}),
            );
        }
    }
    #[cfg(not(desktop))]
    {
        // Log platform limitation
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::WARN,
                "netgrab",
                "open_url",
                "Webview windows not supported on mobile platforms",
                serde_json::json!({"platform": "mobile"}),
            );
        }
        return Err("Webview windows not supported on mobile platforms".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn post_api_data(
    url: &str,
    data: Value,
    parameters: HashMap<String, String>,
    parse_html: Option<bool>,
) -> Result<String, String> {
    // Log API call
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "netgrab",
            "post_api_data",
            &format!("POST API call to {}", url),
            serde_json::json!({"url": url, "parameters": parameters, "has_body": !data.is_null()}),
        );
    }
    fetch_api_data(
        url,
        RequestMethod::POST,
        None,
        Some(data),
        Some(parameters),
        false,
        false,
        parse_html,
    )
    .await
}

/// Clear the session data with API call and remove the session file
#[tauri::command]
pub async fn proxy_request(
    url: &str,
    method: String,
    headers: Option<HashMap<String, String>>,
    body: Option<Value>,
) -> Result<Value, String> {
    let client = create_client();
    
    let mut request = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        "PUT" => client.put(url),
        "DELETE" => client.delete(url),
        "PATCH" => client.patch(url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(&key, value);
        }
    }

    if let Some(body) = body {
        request = request.json(&body);
    }

    match request.send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.map_err(|e| e.to_string())?;
            
            // Try to parse as JSON, fallback to string if fails
            let json_body = serde_json::from_str(&text).unwrap_or(Value::String(text));

            Ok(json!({
                "status": status.as_u16(),
                "statusText": status.canonical_reason().unwrap_or(""),
                "data": json_body
            }))
        }
        Err(e) => Err(format!("Request failed: {}", e)),
    }
}

#[tauri::command]
pub async fn clear_session() -> Result<(), String> {
    // Send logout request first
    let _ = get_api_data("/saml2?logout", HashMap::new(), None).await;

    // Then clear the session file
    session::Session::clear_file().map_err(|e| e.to_string())
}
