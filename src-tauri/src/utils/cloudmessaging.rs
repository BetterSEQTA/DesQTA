use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::io::Write;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Friend {
    pub id: String,
    pub username: String,
    #[serde(default)]
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(default)]
    #[serde(rename = "pfpUrl")]
    pub pfp_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupMember {
    pub id: String,
    #[serde(default)]
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Group {
    pub id: String,
    pub name: String,
    #[serde(default)]
    #[serde(rename = "iconUrl")]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub members: Vec<GroupMember>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: Option<String>,
    pub filename: Option<String>,
    #[serde(rename = "storedName")]
    pub stored_name: Option<String>,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub size: Option<i64>,
    pub url: Option<String>,
    #[serde(rename = "isPublic")]
    pub is_public: Option<bool>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    pub path: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageReply {
    pub id: String,
    pub content: String,
}

// Suppress non_snake_case warnings for compatibility with frontend naming
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize, Clone)]
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

const BASE_URL: &str = "https://accounts.betterseqta.adenmgb.com"; // Change if needed

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
pub async fn create_group(token: String, name: String, member_ids: Vec<String>) -> Result<Group, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/groups", BASE_URL);
    let body = serde_json::json!({
        "name": name,
        "memberIds": member_ids
    });
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to create group: {}", resp.status()));
    }
    let group = resp.json::<Group>().await.map_err(|e| e.to_string())?;
    Ok(group)
}

#[tauri::command]
pub async fn send_message(
    token: String,
    receiver_id: Option<String>,
    group_id: Option<String>,
    content: String,
    reply_to_id: Option<String>,
    attachment_id: Option<String>,
) -> Result<Message, String> {
    let client = get_auth_client(&token).await;
    
    // Determine the chat ID based on whether it's a DM or group message
    let chat_id = if let Some(ref gid) = group_id {
        gid.clone()
    } else if let Some(ref rid) = receiver_id {
        rid.clone()
    } else {
        return Err("No recipient specified".to_string());
    };
    
    let url = format!("{}/api/messages/{}", BASE_URL, chat_id);
    let mut body = serde_json::Map::new();
    body.insert("content".to_string(), serde_json::json!(content));
    if let Some(ref rid) = reply_to_id { body.insert("replyToId".to_string(), serde_json::json!(rid)); }
    if let Some(ref aid) = attachment_id { body.insert("attachmentId".to_string(), serde_json::json!(aid)); }
    
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let resp_text = resp.text().await.unwrap_or_else(|_| "<Failed to read response body>".to_string());
    if !status.is_success() {
        return Err(format!("Failed to send message: {}\nBody: {}", status, resp_text));
    }
    let mut msg: Message = serde_json::from_str(&resp_text).map_err(|e| e.to_string())?;
    if msg.receiverId.is_none() { msg.receiverId = receiver_id; }
    if msg.groupId.is_none() { msg.groupId = group_id; }
    if msg.replyToId.is_none() { msg.replyToId = reply_to_id; }
    if msg.attachmentId.is_none() { msg.attachmentId = attachment_id; }
    Ok(msg)
}

// Suppress non_snake_case warning for function parameter
#[allow(non_snake_case)]
#[tauri::command]
pub async fn get_messages(token: String, id: String, page: Option<i32>) -> Result<Vec<Message>, String> {
    let client = get_auth_client(&token).await;
    let mut url = format!("{}/api/messages/{}", BASE_URL, id);
    
    // Add page parameter if provided
    if let Some(page_num) = page {
        url = format!("{}?page={}", url, page_num);
    }
    
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to fetch messages: {}", resp.status()));
    }
    let raw = resp.text().await.map_err(|e| e.to_string())?;
    let messages = serde_json::from_str::<Vec<Message>>(&raw).map_err(|e| format!("Failed to decode messages: {}\nRaw: {}", e, raw))?;
    Ok(messages)
}

// Helper functions for temporary file handling
#[tauri::command]
pub async fn write_temp_file(file_name: String, data: Vec<u8>) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&file_name);
    
    let mut file = std::fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
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

// File upload endpoint
#[tauri::command]
pub async fn upload_attachment(token: String, file_path: String) -> Result<Attachment, String> {
    let client = get_auth_client(&token).await;
    let url = format!("{}/api/files/upload", BASE_URL);
    
    // Use temp directory for the full path
    let temp_dir = std::env::temp_dir();
    let full_path = temp_dir.join(&file_path);
    
    // Read the file
    let file_bytes = std::fs::read(&full_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    
    // Create multipart form
    let form = reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(file_bytes)
            .file_name(file_name.to_string()));
    
    let resp = client.post(&url).multipart(form).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Failed to upload file: {}", resp.status()));
    }
    
    let attachment = resp.json::<Attachment>().await.map_err(|e| e.to_string())?;
    Ok(attachment)
} 