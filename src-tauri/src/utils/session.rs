use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
};
use crate::logger;

/// Location: `$DATA_DIR/DesQTA/session.json`
#[allow(dead_code)]
pub fn session_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
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
        // e.g. %APPDATA%/DesQTA on Windows, ~/.local/share/DesQTA on Linux/macOS
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("session.json");
        dir
    }
}

/// Saved session state.
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

#[allow(dead_code)]
impl Session {
    /// Load from disk; returns empty/default if none.
    pub fn load() -> Self {
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "session",
                "load",
                "Loading session from disk",
                serde_json::json!({})
            );
        }
        
        let path = session_file();
        if let Ok(mut file) = fs::File::open(path) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                if let Ok(sess) = serde_json::from_str::<Session>(&contents) {
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::DEBUG,
                            "session",
                            "load",
                            "Session loaded successfully from disk",
                            serde_json::json!({"has_base_url": !sess.base_url.is_empty()})
                        );
                    }
                    return sess;
                }
            }
        }
        
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "session",
                "load",
                "No existing session found, creating default",
                serde_json::json!({})
            );
        }
        
        Session {
            base_url: String::new(),
            jsessionid: String::new(),
            additional_cookies: Vec::new(),
        }
    }

    /// Persist to disk.
    pub fn save(&self) -> io::Result<()> {
        let path = session_file();
        fs::write(path, serde_json::to_string(self).unwrap())
    }

    /// True if both URL and cookie are present.
    pub fn exists() -> bool {
        let s = Self::load();
        !(s.base_url.is_empty() || s.jsessionid.is_empty())
    }

    /// Clear the session data and remove the file
    pub fn clear_file() -> io::Result<()> {
        let path = session_file();
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}
