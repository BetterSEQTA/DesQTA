use reqwest::{self, RequestBuilder};
use reqwest::Client;
use rss::Channel;
use serde::{Deserialize, Serialize};
use xmltree::{Element, XMLNode};
use serde_json::{json, Value};
use std::{io::Cursor, sync::OnceLock, fs};
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use url::Url;
use url::form_urlencoded;

use base64::{engine::general_purpose, Engine as _};
// opens a file using the default program:

use crate::session;
use crate::logger;

static GLOBAL_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize)]
pub struct HomeworkItem {
    pub meta: i32,
    pub id: i32,
    pub title: String,
    pub items: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HomeworkResponse {
    pub payload: Vec<HomeworkItem>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RequestMethod {
    GET,
    POST,
}

/// Build an HTTP client with headers based on the saved session.
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
            session.additional_cookies.retain(|cookie| cookie.name != "JSESSIONID");
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
            headers.insert(
                reqwest::header::COOKIE,
                cookie_header.parse().unwrap(),
            );
        }

        if !session.base_url.is_empty() {
            headers.insert(reqwest::header::ORIGIN, session.base_url.parse().unwrap());
            headers.insert(reqwest::header::REFERER, session.base_url.parse().unwrap());
        }
    }
    
    req.headers(headers)
}

#[tauri::command]
pub async fn fetch_api_data(
    url: &str,
    method: RequestMethod,
    headers: Option<HashMap<String, String>>,
    body: Option<Value>,
    parameters: Option<HashMap<String, String>>,
    is_image: bool,
    return_url: bool
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
                "return_url": return_url
            })
        );
    }
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

    match request.send().await {
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
                                session.additional_cookies.retain(|cookie| cookie.name != "JSESSIONID");
                                
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
        
        let result = if is_image == true {
            // Get the bytes (await and ? to bubble up errors)
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
            // Encode to base64
            let base64_str = general_purpose::STANDARD.encode(&bytes);
            Ok(base64_str)
        }
        else if return_url == true {
            let url = String::from(resp.url().as_str());
            Ok(url)
        }
        else {
            let text = resp.text().await.map_err(|e| e.to_string())?;
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
                })
            );
        }
        result
    }
    Err(e) => {
        // Log error
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::ERROR,
                "netgrab",
                "fetch_api_data",
                &format!("HTTP request failed: {}", e),
                serde_json::json!({
                    "url": url,
                    "method": format!("{:?}", method),
                    "error": e.to_string()
                })
            );
        }
        Err(format!("HTTP request failed: {e}"))
    },
}
}

#[tauri::command]
pub async fn get_api_data(
    url: &str,
    parameters: HashMap<String, String>,
) -> Result<String, String> {
    // Log API call
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "netgrab",
            "get_api_data",
            &format!("GET API call to {}", url),
            serde_json::json!({"url": url, "parameters": parameters})
        );
    }
    fetch_api_data(url, RequestMethod::GET, None, None, Some(parameters), false, false).await
}

#[tauri::command]
pub async fn get_seqta_file(file_type: &str, uuid: &str) -> Result<String, String> {
    let mut params = HashMap::new();
    params.insert(String::from("type"), String::from(file_type));
    params.insert(String::from("file"), String::from(uuid));
    fetch_api_data("/seqta/student/load/file", RequestMethod::GET, None, None, Some(params), false, true).await
}

#[tauri::command]
pub async fn upload_seqta_file(file_name: String, file_path: String) -> Result<String, String> {
    
    let client = create_client();
    let session = session::Session::load();

    // Read the file content
    let file_content = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let url = format!("{}/seqta/student/file/upload/xhr2", session.base_url.parse::<String>().unwrap());
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
        },
        Err(e) => Err(format!("File upload failed: {e}")),
    }
}

#[derive(Serialize)]
pub struct FeedItem {
    title: Option<String>,
    link: Option<String>,
    description: Option<String>,
    pub_date: Option<String>,
}
#[derive(Serialize)]
pub struct FeedResponse {
    title: String,
    items: Vec<FeedItem>,
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

    let json = channel_to_json(&channel)
        .map_err(|e| format!("Failed to convert to JSON: {}", e))?;

    Ok(json)
}
pub fn channel_to_json(channel: &Channel) -> Result<Value> {
    fn xml_to_json(elem: &Element) -> Value {
        let text = elem.get_text();
        let has_text = text.as_ref().map(|t| !t.trim().is_empty()).unwrap_or(false);

        let has_attrs = !elem.attributes.is_empty();
        let has_children = elem.children.iter().any(|c| matches!(c, XMLNode::Element(_)));

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
    let root = Element::parse(Cursor::new(xml_str))
        .map_err(|e| anyhow!("Failed to parse XML: {}", e))?;

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
pub async fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String>{
    // Log URL opening
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "netgrab",
            "open_url",
            &format!("Opening URL: {}", url),
            serde_json::json!({"url": url})
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
            Err(e) => return Err(format!("Invalid URL: {}", e))
        };

        let full_url: Url = match Url::parse(&format!("{}", parsed_url)) {
            Ok(u) => u,
            Err(e) => return Err(format!("Invalid URL: {}", e))// Nothing

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
                serde_json::json!({"window_id": "seqta_login"})
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
                serde_json::json!({"platform": "mobile"})
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
) -> Result<String, String> {
    // Log API call
    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::DEBUG,
            "netgrab",
            "post_api_data",
            &format!("POST API call to {}", url),
            serde_json::json!({"url": url, "parameters": parameters, "has_body": !data.is_null()})
        );
    }
    fetch_api_data(url, RequestMethod::POST, None, Some(data), Some(parameters), false, false).await
}

/// Clear the session data with API call and remove the session file
#[tauri::command]
pub async fn clear_session() -> Result<(), String> {
    // Send logout request first
    let _ = get_api_data("/saml2?logout", HashMap::new()).await;
    
    // Then clear the session file
    session::Session::clear_file().map_err(|e| e.to_string())
}