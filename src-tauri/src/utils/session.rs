use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
};
use std::collections::HashMap;

/// Location: `$DATA_DIR/TauriSEQTA/session.json`
fn session_file() -> PathBuf {
    // e.g. %APPDATA%/TauriSEQTA on Windows, ~/.local/share/TauriSEQTA on Linux/macOS
    let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
    dir.push("TauriSEQTA");
    if !dir.exists() {
        fs::create_dir_all(&dir).expect("Unable to create data dir");
    }
    dir.push("session.json");
    dir
}

/// Saved session state.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Session {
    pub base_url: String,
    pub cookies: HashMap<String, String>,
}

impl Session {
    /// Load from disk; returns empty/default if none.
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

    /// Persist to disk.
    pub fn save(&self) -> io::Result<()> {
        let path = session_file();
        fs::write(path, serde_json::to_string(self).unwrap())
    }

    /// True if both URL and cookie are present.
    pub fn exists() -> bool {
        let s = Self::load();
        !(s.base_url.is_empty() || s.cookies.is_empty())
    }

    /// Clear the session data and remove the file
    pub fn clear() -> io::Result<()> {
        let path = session_file();
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}