use std::fs::{File, OpenOptions};
use std::io::{Write, BufWriter};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use chrono::Local;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    TRACE,
    DEBUG,
    INFO,
    WARN,
    ERROR,
    FATAL,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::TRACE => write!(f, "TRACE"),
            LogLevel::DEBUG => write!(f, "DEBUG"),
            LogLevel::INFO => write!(f, "INFO"),
            LogLevel::WARN => write!(f, "WARN"),
            LogLevel::ERROR => write!(f, "ERROR"),
            LogLevel::FATAL => write!(f, "FATAL"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: LogLevel,
    pub module: String,
    pub function: String,
    pub message: String,
    pub file: String,
    pub line: u32,
    pub thread_id: String,
    pub session_id: String,
    pub metadata: serde_json::Value,
}

pub struct Logger {
    writer: Arc<Mutex<BufWriter<File>>>,
    session_id: String,
    log_level: LogLevel,
}

impl Logger {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let log_path = get_log_file_path()?;
        
        // Ensure directory exists
        if let Some(parent) = log_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Clear the log file on each app start (create new or truncate existing)
        let _clear_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true) // This clears the file content
            .open(&log_path)?;
        
        // Now open for appending during the session
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        
        let writer = Arc::new(Mutex::new(BufWriter::new(file)));
        let session_id = generate_session_id();

        let logger = Logger {
            writer,
            session_id: session_id.clone(),
            log_level: LogLevel::DEBUG,
        };

        // Log session start
        logger.log_internal(
            LogLevel::INFO,
            "logger",
            "new",
            &format!("=== NEW SESSION STARTED: {} ===", session_id),
            file!(),
            line!(),
            serde_json::json!({"app_version": env!("CARGO_PKG_VERSION")}),
        )?;

        Ok(logger)
    }

    pub fn log(&self, level: LogLevel, module: &str, function: &str, message: &str, metadata: serde_json::Value) -> Result<(), Box<dyn std::error::Error>> {
        self.log_internal(level, module, function, message, "", 0, metadata)
    }

    fn log_internal(&self, level: LogLevel, module: &str, function: &str, message: &str, file: &str, line: u32, metadata: serde_json::Value) -> Result<(), Box<dyn std::error::Error>> {
        // Check if we should log this level
        if !self.should_log(&level) {
            return Ok(());
        }

        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        let thread_id = format!("{:?}", std::thread::current().id());

        let entry = LogEntry {
            timestamp,
            level: level.clone(),
            module: module.to_string(),
            function: function.to_string(),
            message: message.to_string(),
            file: file.to_string(),
            line,
            thread_id,
            session_id: self.session_id.clone(),
            metadata,
        };

        // Format log line
        let log_line = format!(
            "[{}] [{}] [{}::{}] [{}:{}] [{}] {} | {}\n",
            entry.timestamp,
            entry.level,
            entry.module,
            entry.function,
            entry.file.split('/').last().unwrap_or(&entry.file),
            entry.line,
            entry.thread_id,
            entry.message,
            if entry.metadata.is_null() { String::new() } else { entry.metadata.to_string() }
        );

        // Write to file
        if let Ok(mut writer) = self.writer.lock() {
            writer.write_all(log_line.as_bytes())?;
            writer.flush()?;
        }

        // Also print to console in debug builds
        #[cfg(debug_assertions)]
        {
            match level {
                LogLevel::ERROR | LogLevel::FATAL => eprintln!("{}", log_line.trim()),
                _ => println!("{}", log_line.trim()),
            }
        }

        Ok(())
    }

    fn should_log(&self, level: &LogLevel) -> bool {
        match (&self.log_level, level) {
            (LogLevel::TRACE, _) => true,
            (LogLevel::DEBUG, LogLevel::TRACE) => false,
            (LogLevel::DEBUG, _) => true,
            (LogLevel::INFO, LogLevel::TRACE | LogLevel::DEBUG) => false,
            (LogLevel::INFO, _) => true,
            (LogLevel::WARN, LogLevel::TRACE | LogLevel::DEBUG | LogLevel::INFO) => false,
            (LogLevel::WARN, _) => true,
            (LogLevel::ERROR, LogLevel::FATAL | LogLevel::ERROR) => true,
            (LogLevel::ERROR, _) => false,
            (LogLevel::FATAL, LogLevel::FATAL) => true,
            (LogLevel::FATAL, _) => false,
        }
    }

    #[allow(dead_code)]
    pub fn set_log_level(&mut self, level: LogLevel) {
        self.log_level = level;
    }

    #[allow(dead_code)]
    pub fn flush(&self) -> Result<(), Box<dyn std::error::Error>> {
        if let Ok(mut writer) = self.writer.lock() {
            writer.flush()?;
        }
        Ok(())
    }
}

// Global logger instance
static mut LOGGER: Option<Logger> = None;
static INIT: std::sync::Once = std::sync::Once::new();

pub fn init_logger() -> Result<(), Box<dyn std::error::Error>> {
    INIT.call_once(|| {
        unsafe {
            match Logger::new() {
                Ok(logger) => LOGGER = Some(logger),
                Err(e) => eprintln!("Failed to initialize logger: {}", e),
            }
        }
    });
    Ok(())
}

pub fn get_logger() -> Option<&'static Logger> {
    unsafe { 
        #[allow(static_mut_refs)]
        LOGGER.as_ref() 
    }
}

// Convenience macros for logging
#[macro_export]
macro_rules! log_trace {
    ($module:expr, $function:expr, $message:expr) => {
        log_trace!($module, $function, $message, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = crate::logger::get_logger() {
            let _ = logger.log_internal(
                crate::logger::LogLevel::TRACE,
                $module,
                $function,
                $message,
                file!(),
                line!(),
                $metadata,
            );
        }
    };
}

#[macro_export]
macro_rules! log_debug {
    ($module:expr, $function:expr, $message:expr) => {
        log_debug!($module, $function, $message, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = crate::logger::get_logger() {
            let _ = logger.log_internal(
                crate::logger::LogLevel::DEBUG,
                $module,
                $function,
                $message,
                file!(),
                line!(),
                $metadata,
            );
        }
    };
}

#[macro_export]
macro_rules! log_info {
    ($module:expr, $function:expr, $message:expr) => {
        log_info!($module, $function, $message, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = crate::logger::get_logger() {
            let _ = logger.log_internal(
                crate::logger::LogLevel::INFO,
                $module,
                $function,
                $message,
                file!(),
                line!(),
                $metadata,
            );
        }
    };
}

#[macro_export]
macro_rules! log_warn {
    ($module:expr, $function:expr, $message:expr) => {
        log_warn!($module, $function, $message, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = $crate::utils::logger::get_logger() {
            let _ = logger.log_internal(
                $crate::utils::logger::LogLevel::WARN,
                $module,
                $function,
                $message,
                file!(),
                line!(),
                $metadata,
            );
        }
    };
}

#[macro_export]
macro_rules! log_error {
    ($module:expr, $function:expr, $message:expr) => {
        log_error!($module, $function, $message, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = $crate::utils::logger::get_logger() {
            let _ = logger.log_internal(
                $crate::utils::logger::LogLevel::ERROR,
                $module,
                $function,
                $message,
                file!(),
                line!(),
                $metadata,
            );
        }
    };
}

#[macro_export]
macro_rules! log_fatal {
    ($module:expr, $function:expr, $message:expr) => {
        log_fatal!($module, $function, $message, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $message:expr, $metadata:expr) => {
        if let Some(logger) = $crate::utils::logger::get_logger() {
            let _ = logger.log_internal(
                $crate::utils::logger::LogLevel::FATAL,
                $module,
                $function,
                $message,
                file!(),
                line!(),
                $metadata,
            );
        }
    };
}

// Function entry/exit logging macros
#[macro_export]
macro_rules! log_function_entry {
    ($module:expr, $function:expr) => {
        log_function_entry!($module, $function, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $args:expr) => {
        log_trace!($module, $function, &format!("ENTRY"), serde_json::json!({"args": $args}))
    };
}

#[macro_export]
macro_rules! log_function_exit {
    ($module:expr, $function:expr) => {
        log_function_exit!($module, $function, serde_json::json!({}))
    };
    ($module:expr, $function:expr, $result:expr) => {
        log_trace!($module, $function, &format!("EXIT"), serde_json::json!({"result": $result}))
    };
}

// Utility functions
fn get_log_file_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        dir.push("logs");
        dir.push("latest.log");
        Ok(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().ok_or("Unable to determine data dir")?;
        dir.push("DesQTA");
        dir.push("logs");
        dir.push("latest.log");
        Ok(dir)
    }
}

fn generate_session_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let random: u32 = rand::random();
    format!("session_{}_{:x}", timestamp, random)
}

// Tauri commands for log management
#[tauri::command]
pub fn get_log_file_path_command() -> Result<String, String> {
    get_log_file_path()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_logs_for_troubleshooting() -> Result<String, String> {
    let log_path = get_log_file_path().map_err(|e| e.to_string())?;
    
    if !log_path.exists() {
        return Ok("No log file found".to_string());
    }

    // Read last 1000 lines or 1MB, whichever is smaller
    let content = std::fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();
    
    let start = if lines.len() > 1000 { lines.len() - 1000 } else { 0 };
    let recent_logs = lines[start..].join("\n");
    
    // Limit to 1MB
    if recent_logs.len() > 1024 * 1024 {
        let truncated = &recent_logs[recent_logs.len() - 1024 * 1024..];
        Ok(format!("... (truncated) ...\n{}", truncated))
    } else {
        Ok(recent_logs)
    }
}

#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    let log_path = get_log_file_path().map_err(|e| e.to_string())?;
    
    if log_path.exists() {
        std::fs::remove_file(&log_path).map_err(|e| e.to_string())?;
    }
    
    // Reinitialize logger
    init_logger().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn set_log_level_command(level: String) -> Result<(), String> {
    let _log_level = match level.to_uppercase().as_str() {
        "TRACE" => LogLevel::TRACE,
        "DEBUG" => LogLevel::DEBUG,
        "INFO" => LogLevel::INFO,
        "WARN" => LogLevel::WARN,
        "ERROR" => LogLevel::ERROR,
        "FATAL" => LogLevel::FATAL,
        _ => return Err("Invalid log level".to_string()),
    };

    // Note: This would require making the logger mutable, which is complex with the current design
    // For now, we'll just log the change request
    log_info!("logger", "set_log_level_command", &format!("Log level change requested: {}", level));
    
    Ok(())
}

// Command to receive logs from frontend
#[tauri::command]
pub fn logger_log_from_frontend(
    level: String,
    module: String,
    function: String,
    message: String,
    metadata: String,
) -> Result<(), String> {
    let log_level = match level.as_str() {
        "TRACE" => LogLevel::TRACE,
        "DEBUG" => LogLevel::DEBUG,
        "INFO" => LogLevel::INFO,
        "WARN" => LogLevel::WARN,
        "ERROR" => LogLevel::ERROR,
        "FATAL" => LogLevel::FATAL,
        _ => LogLevel::INFO,
    };

    if let Some(logger) = get_logger() {
        let metadata_json: serde_json::Value = serde_json::from_str(&metadata)
            .unwrap_or_else(|_| serde_json::json!({"raw_metadata": metadata}));
        
        let _ = logger.log(log_level, &module, &function, &message, metadata_json);
    }

    Ok(())
}

// Export log file for troubleshooting
#[tauri::command]
pub async fn export_logs_for_support() -> Result<String, String> {

    
    let log_path = get_log_file_path().map_err(|e| e.to_string())?;
    
    if !log_path.exists() {
        return Err("No log file found".to_string());
    }

    // Create a comprehensive support package
    let mut support_data = String::new();
    
    // Add system info
    support_data.push_str("=== DESQTA SUPPORT LOG EXPORT ===\n");
    support_data.push_str(&format!("Export Time: {}\n", Local::now().format("%Y-%m-%d %H:%M:%S")));
    support_data.push_str(&format!("App Version: {}\n", env!("CARGO_PKG_VERSION")));
    support_data.push_str(&format!("OS: {}\n", std::env::consts::OS));
    support_data.push_str(&format!("Arch: {}\n", std::env::consts::ARCH));
    support_data.push_str("=====================================\n\n");
    
    // Add recent logs
    let log_content = std::fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
    support_data.push_str("=== APPLICATION LOGS ===\n");
    support_data.push_str(&log_content);
    
    Ok(support_data)
} 