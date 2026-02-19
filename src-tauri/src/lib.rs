#[path = "auth/login.rs"]
mod login;

#[path = "utils/analytics.rs"]
mod analytics;
#[path = "utils/assessments.rs"]
mod assessments;
#[path = "utils/courses.rs"]
mod courses;
#[path = "utils/database.rs"]
mod database;
mod global_search;
#[path = "utils/logger.rs"]
mod logger;
#[path = "utils/messages.rs"]
mod messages;
#[path = "utils/netgrab.rs"]
mod netgrab;
#[path = "utils/news.rs"]
mod news;
#[path = "utils/notes_filesystem.rs"]
mod notes_filesystem;
#[path = "utils/performance_testing.rs"]
mod performance_testing;
#[path = "utils/system_monitor.rs"]
mod system_monitor;
#[path = "utils/profile_picture.rs"]
mod profile_picture;
#[path = "utils/sanitization.rs"]
mod sanitization;
#[path = "utils/html_parser.rs"]
mod html_parser;
#[path = "utils/seqta_config.rs"]
mod seqta_config;
#[path = "services/seqta_mentions.rs"]
mod seqta_mentions;
#[path = "services/theme_store.rs"]
mod theme_store;
#[path = "utils/session.rs"]
mod session;
#[path = "utils/settings.rs"]
mod settings;
#[path = "utils/profiles.rs"]
mod profiles;
#[path = "utils/migration.rs"]
mod migration;
#[path = "utils/theme_manager.rs"]
mod theme_manager;
#[path = "utils/todolist.rs"]
mod todolist;
#[path = "utils/pdf_extract.rs"]
mod pdf_extract;
#[path = "utils/forum_photos.rs"]
mod forum_photos;

#[cfg(any(target_os = "android", target_os = "ios"))]
use serde_json;
use std::cell::Cell;
use std::fs;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
#[cfg(desktop)]
use tauri::tray::TrayIconBuilder;
#[cfg(any(target_os = "android", target_os = "ios"))]
use tauri::Listener;
use tauri::{AppHandle, Window, WindowEvent};
use tauri::{Emitter, Manager};
#[cfg(desktop)]
use tauri_plugin_autostart;
#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog;
use tauri_plugin_notification;
#[cfg(desktop)]
use tauri_plugin_single_instance;

#[cfg(desktop)]
use url::form_urlencoded::parse;

/// Boilerplate example command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

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

/// Get the SEQTA base URL from the current session
#[tauri::command]
fn get_seqta_base_url() -> String {
    let session = session::Session::load();
    session.base_url
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec!["--minimize"]),
            ));
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            println!("[Desqta] Single instance event: {:?}", argv);
            
            // Show and focus the main window when app is launched again
            if let Some(window) = app.webview_windows().get("main") {
                let _ = window.show();
                let _ = window.set_focus();
                println!("[Desqta] Brought main window to focus");
            }
            
            // Handle deep link in single instance
            if let Some(url) = argv.get(1) {
                println!("[Desqta] Processing deep link in single instance: {}", url);
                if url.starts_with("desqta://auth/callback") {
                    // Handle Discord OAuth callback
                    let mut token = None;
                    let mut user_id = None;
                    
                    let mut refresh_token = None;

                    // Parse URL parameters
                    if let Some(query) = url.split('?').nth(1) {
                        println!("[Desqta] Discord OAuth callback query string: {}", query);
                        for param in query.split('&') {
                            if let Some((key, value)) = param.split_once('=') {
                                match key {
                                    "token" => {
                                        // URL decode the token
                                        let decoded = urlencoding::decode(value)
                                            .map(|s| s.to_string())
                                            .unwrap_or_else(|_| value.to_string());
                                        token = Some(decoded);
                                        println!("[Desqta] Found Discord OAuth token");
                                    },
                                    "user_id" => {
                                        let decoded = urlencoding::decode(value)
                                            .map(|s| s.to_string())
                                            .unwrap_or_else(|_| value.to_string());
                                        user_id = Some(decoded);
                                        println!("[Desqta] Found Discord OAuth user_id");
                                    },
                                    "refresh_token" => {
                                        let decoded = urlencoding::decode(value)
                                            .map(|s| s.to_string())
                                            .unwrap_or_else(|_| value.to_string());
                                        refresh_token = Some(decoded);
                                        println!("[Desqta] Found Discord OAuth refresh_token");
                                    },
                                    _ => {
                                        println!("[Desqta] Unknown Discord OAuth parameter: {}", key);
                                    }
                                }
                            }
                        }
                    }
                    
                    // Emit event to frontend with token, user_id, and optional refresh_token
                    if let (Some(token_val), Some(user_id_val)) = (token, user_id) {
                        println!("[Desqta] Emitting Discord OAuth callback event");
                        if let Some(window) = app.webview_windows().get("main") {
                            let mut payload = serde_json::json!({
                                "token": token_val,
                                "user_id": user_id_val
                            });
                            if let Some(rt) = refresh_token {
                                if let Some(obj) = payload.as_object_mut() {
                                    obj.insert("refresh_token".to_string(), serde_json::json!(rt));
                                }
                            }
                            let _ = window.emit("discord-oauth-callback", payload);
                        }
                    } else {
                        eprintln!("[Desqta] Missing required Discord OAuth parameters. Need both token and user_id.");
                    }
                } else if url.starts_with("desqta://auth") {
                    // Extract cookie and URL from the deep link (legacy SEQTA auth)
                    let mut cookie = None;
                    let mut base_url = None;
                    
                    // Parse URL parameters
                    if let Some(query) = url.split('?').nth(1) {
                        println!("[Desqta] Query string: {}", query);
                        for param in query.split('&') {
                            println!("[Desqta] Processing parameter: {}", param);
                            if let Some((key, value)) = param.split_once('=') {
                                println!("[Desqta] Found parameter - key: {}, value: {}", key, value);
                                match key {
                                    "cookie" => {
                                        let decoded: String = parse(value.as_bytes()).map(|(key, val)| [key, val].concat()).collect();
                                        if !decoded.is_empty() {
                                            cookie = Some(decoded.to_string());
                                            println!("[Desqta] Decoded cookie: {}", decoded);
                                        } else {
                                            println!("[Desqta] Failed to decode cookie value: {}", value);
                                        }
                                    },
                                    "url" => {
                                        let decoded: String = parse(value.as_bytes()).map(|(key, val)| [key, val].concat()).collect();
                                        if !decoded.is_empty() {
                                            base_url = Some(decoded.to_string());
                                            println!("[Desqta] Decoded URL: {}", decoded);
                                        } else {
                                            println!("[Desqta] Failed to decode URL value: {}", value);
                                        }
                                    },
                                    _ => {
                                        println!("[Desqta] Unknown parameter: {}", key);
                                    }
                                }
                            } else {
                                println!("[Desqta] Invalid parameter format: {}", param);
                            }
                        }
                    } else {
                        println!("[Desqta] No query string found in URL");
                    }
                    
                    // Check if we have both required parameters
                    if let (Some(cookie), Some(base_url)) = (cookie, base_url) {
                        println!("[Desqta] Using base_url: {}", base_url);
                        match login::save_session(base_url, cookie) {
                            Ok(_) => {
                                println!("[Desqta] Successfully saved session from deep link. Check session.json for update.");
                                login::force_reload(app.app_handle().clone());
                            },
                            Err(e) => {
                                eprintln!("[Desqta] Failed to save session from deep link: {}", e);
                            }
                        }
                    } else {
                        eprintln!("[Desqta] Missing required parameters. Need both cookie and URL.");
                    }
                }
            }
        }));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            greet,
            quit,
            enable_autostart,
            disable_autostart,
            is_autostart_enabled,
            netgrab::get_api_data,
            netgrab::open_url,
            netgrab::get_rss_feed,
            netgrab::post_api_data,
            netgrab::fetch_api_data,
            netgrab::proxy_request,
            netgrab::get_seqta_file,
            netgrab::upload_seqta_file,
            login::check_session_exists,
            login::save_session,
            login::create_login_window,
            login::logout,
            login::force_reload,
            login::cleanup_login_windows,
            login::has_login_windows,
            login::clear_webview_data,
            login::direct_login,
            login::reauthenticate,
            get_seqta_base_url,
            profiles::get_current_profile,
            profiles::list_profiles,
            profiles::switch_profile,
            profiles::delete_profile,
            settings::get_settings,
            settings::save_settings,
            settings::get_settings_json,
            settings::save_settings_from_json,
            settings::get_settings_subset,
            settings::save_settings_merge,
            settings::save_cloud_token,
            settings::get_cloud_user,
            settings::clear_cloud_token,
            settings::get_cloud_state,
            settings::set_cloud_state_previously_signed,
            settings::get_reserved_client,
            settings::clear_reserved_client,
            settings::save_reserved_client,
            settings::get_cloud_base_url,
            settings::set_cloud_base_url,
            settings::upload_settings_to_cloud,
            settings::download_settings_from_cloud,
            settings::check_cloud_settings,
            analytics::save_analytics,
            analytics::load_analytics,
            analytics::delete_analytics,
            analytics::sync_analytics_data,
            seqta_config::load_seqta_config,
            seqta_config::save_seqta_config,
            seqta_config::is_seqta_config_different,
            global_search::get_global_search_data,
            global_search::save_global_search_data,
            global_search::clear_search_history,
            global_search::clear_recent_items,
            global_search::add_custom_shortcut,
            global_search::remove_custom_shortcut,
            global_search::update_search_preferences,
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
            global_search::get_app_data_dir,
            logger::get_log_file_path_command,
            logger::get_logs_for_troubleshooting,
            logger::clear_logs,
            logger::set_log_level_command,
            logger::export_logs_for_support,
            logger::logger_log_from_frontend,
            theme_manager::get_available_themes,
            theme_manager::get_custom_themes,
            theme_manager::load_theme_manifest,
            theme_manager::save_custom_theme,
            theme_manager::delete_custom_theme,
            theme_manager::import_theme_from_file,
            theme_manager::get_themes_directory_path,
            theme_manager::export_theme_to_file,
            theme_manager::read_theme_css,
            theme_manager::download_and_install_theme,
            theme_manager::download_theme_to_temp,
            theme_manager::cleanup_temp_theme,
            theme_manager::cache_theme_image,
            theme_manager::get_cached_image_path,
            theme_manager::get_cached_image_url,
            theme_manager::invalidate_theme_image_cache,
            theme_store::theme_store_request,
            theme_store::theme_store_list_themes,
            theme_store::theme_store_get_theme,
            theme_store::theme_store_search_themes,
            theme_store::theme_store_get_collections,
            theme_store::theme_store_get_collection,
            theme_store::theme_store_get_spotlight,
            theme_store::theme_store_download_theme,
            theme_store::theme_store_favorite_theme,
            theme_store::theme_store_unfavorite_theme,
            theme_store::theme_store_get_favorites,
            theme_store::theme_store_get_user_status,
            theme_store::theme_store_rate_theme,
            news::get_news_australia,
            todolist::load_todos,
            todolist::save_todos,
            notes_filesystem::load_notes_filesystem,
            notes_filesystem::save_note_filesystem,
            notes_filesystem::delete_note_filesystem,
            notes_filesystem::get_note_filesystem,
            notes_filesystem::search_notes_filesystem,
            notes_filesystem::search_notes_advanced_filesystem,
            notes_filesystem::load_folders_filesystem,
            notes_filesystem::create_folder_filesystem,
            notes_filesystem::delete_folder_filesystem,
            notes_filesystem::rename_folder_filesystem,
            notes_filesystem::move_note_filesystem,
            notes_filesystem::get_notes_stats_filesystem,
            notes_filesystem::backup_notes_filesystem,
            notes_filesystem::restore_notes_from_backup_filesystem,
            notes_filesystem::save_image_from_base64_filesystem,
            notes_filesystem::get_image_path_filesystem,
            notes_filesystem::get_image_as_base64_filesystem,
            notes_filesystem::delete_note_images_filesystem,
            notes_filesystem::cleanup_unused_images_filesystem,
            notes_filesystem::get_file_tree,
            profile_picture::save_profile_picture,
            profile_picture::get_profile_picture_path_cmd,
            profile_picture::delete_profile_picture,
            profile_picture::has_custom_profile_picture,
            profile_picture::get_profile_picture_data_url,
            forum_photos::save_forum_photo,
            forum_photos::get_forum_photo_path,
            forum_photos::get_forum_photo_data_url,
            forum_photos::get_forum_photo_uuid_by_name,
            performance_testing::save_performance_test_results,
            performance_testing::get_performance_test_results,
            performance_testing::load_performance_test_result,
            performance_testing::delete_performance_test_result,
            performance_testing::get_performance_tests_directory,
            performance_testing::clear_all_performance_tests,
            system_monitor::get_system_metrics,
            system_monitor::get_detailed_system_info,
            system_monitor::start_system_monitoring,
            database::db_cache_get,
            database::db_cache_set,
            database::db_cache_delete,
            database::db_cache_clear,
            database::db_cache_cleanup_expired,
            database::db_queue_add,
            database::db_queue_all,
            database::db_queue_delete,
            database::db_queue_clear,
            database::db_get_assessments_by_year,
            database::db_search_history_get,
            database::db_search_history_add,
            database::db_search_history_clear,
            database::db_search_favorites_get,
            database::db_search_favorites_add,
            database::db_search_favorites_remove,
            database::db_search_recent_get,
            database::db_search_recent_add,
            database::db_search_recent_clear,
            database::db_search_usage_track,
            database::db_search_assessments,
            database::db_search_courses,
            database::db_notification_schedule,
            database::db_notification_get_due,
            database::db_notification_mark_sent,
            database::db_notification_get_by_assessment,
            database::db_notification_cleanup_old,
            database::db_notification_delete_by_assessment,
            database::db_widget_layout_save,
            database::db_widget_layout_load,
            assessments::get_processed_assessments,
            courses::get_courses_subjects,
            courses::get_course_content,
            messages::fetch_messages,
            messages::fetch_message_content,
            messages::star_messages,
            messages::delete_messages,
            messages::restore_messages,
            seqta_mentions::search_seqta_mentions,
            seqta_mentions::search_seqta_mentions_with_context,
            seqta_mentions::update_seqta_mention_data,
            seqta_mentions::get_weekly_schedule_for_class_cmd,
            seqta_mentions::fetch_lesson_content_cmd,
            html_parser::sanitize_html_command,
            html_parser::parse_html_command,
            html_parser::extract_iframe_src_command,
            html_parser::extract_text_content_command,
            pdf_extract::get_assessment_weighting
        ])
        .setup(|app| {
            // --- START: Auto-Clear Cache on Update ---
            use dirs_next;
            use std::path::PathBuf;

            // Get the app data directory (consistent with rest of codebase: AppData/Roaming/DesQTA)
            let app_data_dir = if cfg!(target_os = "android") {
                let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
                dir.push("DesQTA");
                dir
            } else {
                let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
                dir.push("DesQTA");
                dir
            };

            let version_file = app_data_dir.join("last_run_version");
            let current_version = app.package_info().version.to_string();

            // Ensure app data directory exists
            if !app_data_dir.exists() {
                let _ = fs::create_dir_all(&app_data_dir);
            }

            // Read the previous version
            let last_version = fs::read_to_string(&version_file).unwrap_or_default();

            // If versions differ, clear the cache
            if current_version != last_version {
                println!(
                    "[DesQTA] Version changed from '{}' to '{}'. Clearing webview cache...",
                    last_version, current_version
                );

                // Get the main window and clear data
                if let Some(window) = app.webview_windows().get("main") {
                    // clear_all_browsing_data() is available in Tauri v2
                    // This wipes cache, cookies, and localStorage to ensure clean loading
                    if let Err(e) = window.clear_all_browsing_data() {
                        eprintln!("[DesQTA] Failed to clear webview data: {}", e);
                    } else {
                        println!("[DesQTA] Webview data cleared successfully.");
                    }
                }

                // Update the version file
                let _ = fs::write(&version_file, &current_version);
            }
            // --- END: Auto-Clear Cache on Update ---

            // Initialize logger first
            if let Err(e) = logger::init_logger() {
                eprintln!("Failed to initialize logger: {}", e);
            }
            
            // Run migration before database initialization
            if let Err(e) = migration::migrate_to_profiles_system() {
                eprintln!("Failed to run migration: {}", e);
            }
            
            // Initialize database (after migration and profile setup)
            if let Err(e) = database::init_database(app.app_handle()) {
                eprintln!("Failed to initialize database: {}", e);
            }

            // Listen for deep link events (mobile only - desktop uses single instance handler)
            #[cfg(any(target_os = "android", target_os = "ios"))]
            {
                let app_handle = app.app_handle().clone();
                let app_handle_for_listener = app_handle.clone();
                app_handle_for_listener.listen("deep-link://new-url", move |event| {
                    println!("[Desqta] Deep link event received: {:?}", event);
                    
                    // Extract URL from event - the data field contains a JSON array string
                    // Based on logs: Event { id: 0, data: "[\"seqtalearn://sso/...\"]" }
                    // event.payload() returns &str directly
                    let payload_str = event.payload();
                    println!("[Desqta] Event payload: {}", payload_str);
                    
                    // Try to parse as JSON array
                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(payload_str) {
                        for url in urls {
                            println!("[Desqta] Processing URL from deep link: {}", url);
                            
                            if url.starts_with("desqta://auth/callback") {
                                // Handle Discord OAuth callback on mobile
                                let mut token = None;
                                let mut user_id = None;
                                let mut refresh_token = None;

                                if let Some(query) = url.split('?').nth(1) {
                                    println!("[Desqta] Discord OAuth callback query string: {}", query);
                                    for param in query.split('&') {
                                        if let Some((key, value)) = param.split_once('=') {
                                            match key {
                                                "token" => {
                                                    let decoded = urlencoding::decode(value)
                                                        .map(|s| s.to_string())
                                                        .unwrap_or_else(|_| value.to_string());
                                                    token = Some(decoded);
                                                },
                                                "user_id" => {
                                                    let decoded = urlencoding::decode(value)
                                                        .map(|s| s.to_string())
                                                        .unwrap_or_else(|_| value.to_string());
                                                    user_id = Some(decoded);
                                                },
                                                "refresh_token" => {
                                                    let decoded = urlencoding::decode(value)
                                                        .map(|s| s.to_string())
                                                        .unwrap_or_else(|_| value.to_string());
                                                    refresh_token = Some(decoded);
                                                },
                                                _ => {}
                                            }
                                        }
                                    }
                                }

                                // Emit event to frontend
                                if let (Some(token_val), Some(user_id_val)) = (token, user_id) {
                                    println!("[Desqta] Emitting Discord OAuth callback event (mobile)");
                                    if let Some(window) = app_handle.webview_windows().get("main") {
                                        let mut payload = serde_json::json!({
                                            "token": token_val,
                                            "user_id": user_id_val
                                        });
                                        if let Some(rt) = refresh_token {
                                            if let Some(obj) = payload.as_object_mut() {
                                                obj.insert("refresh_token".to_string(), serde_json::json!(rt));
                                            }
                                        }
                                        let _ = window.emit("discord-oauth-callback", payload);
                                    }
                                }
                            } else if url.starts_with("seqtalearn://") {
                                println!("[Desqta] Processing SEQTA Learn SSO deeplink: {}", url);
                                let app_handle_clone = app_handle.clone();
                                tauri::async_runtime::spawn(async move {
                                    match login::create_login_window(app_handle_clone, url.clone()).await {
                                        Ok(_) => {
                                            println!("[Desqta] Successfully processed SEQTA Learn SSO deeplink");
                                        },
                                        Err(e) => {
                                            eprintln!("[Desqta] Failed to process SEQTA Learn SSO deeplink: {}", e);
                                        }
                                    }
                                });
                            }
                        }
                    } else {
                        println!("[Desqta] Failed to parse event payload as JSON array: {}", payload_str);
                    }
                });
            }

            #[cfg(desktop)]
            {
                // Configure the existing main window
                if let Some(window) = app.webview_windows().get("main") {
                    let _ = window.set_title("DesQTA");
                    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize::new(900.0, 700.0))));
                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(900.0, 700.0)));
                    let _ = window.set_decorations(false);
                    let _ = window.center();
                    
                    let window_clone = window.clone();
                    let current_fullscreen = Cell::new(window.is_fullscreen().unwrap_or(false));
                    let current_maximized = Cell::new(window.is_maximized().unwrap_or(false));
                    
                    // Helper function to check and emit window state changes
                    let check_and_emit_state = {
                        let window_ref = window_clone.clone();
                        move || {
                            let is_fullscreen = window_ref.is_fullscreen().unwrap_or(false);
                            let is_maximized = window_ref.is_maximized().unwrap_or(false);
                            let should_remove_corners = is_fullscreen || is_maximized;
                            
                            let fullscreen_changed = is_fullscreen != current_fullscreen.get();
                            let maximized_changed = is_maximized != current_maximized.get();
                            
                            if fullscreen_changed || maximized_changed {
                                current_fullscreen.set(is_fullscreen);
                                current_maximized.set(is_maximized);
                                println!("[DesQTA] Window state changed: fullscreen={}, maximized={}, remove_corners={}", 
                                    is_fullscreen, is_maximized, should_remove_corners);
                                let _ = window_ref.emit("fullscreen-changed", should_remove_corners);
                            }
                        }
                    };
                    
                    window.on_window_event(move |event| {
                        match event {
                            WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
                                check_and_emit_state();
                            }
                            _ => {}
                        }
                    });
                }
                
                // Create tray menu
                let menu = Menu::with_items(
                    app,
                    &[
                        &MenuItem::with_id(app, "open", "Open DesQTA", true, None::<&str>)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?,
                    ],
                )?;

                // Setup tray icon
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
                        _ => {
                            println!("Menu event not handled: {:?}", event.id);
                        }
                    })
                    .build(app)
                    .expect("Error while setting up tray menu");
            }

            Ok(())
        })
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
