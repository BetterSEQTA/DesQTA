use serde_json::Value;
use std::{fs, io::{Read}, path::PathBuf};
use tauri::command;

/// Returns the path to seqtaConfig.json in the app data directory.
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

/// Loads the seqtaConfig.json as serde_json::Value. Returns None if not found.
#[command]
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

/// Saves the given serde_json::Value to seqtaConfig.json.
#[command]
pub fn save_seqta_config(config: Value) -> Result<(), String> {
    let path = config_file();
    fs::write(path, serde_json::to_string(&config).unwrap())
        .map_err(|e| e.to_string())
}

/// Checks if the current config is different from the given value.
#[command]
pub fn is_seqta_config_different(new_config: Value) -> bool {
    let current = load_seqta_config();
    match current {
        Some(existing) => existing != new_config,
        None => true,
    }
} 