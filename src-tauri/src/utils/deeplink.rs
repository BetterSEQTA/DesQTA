use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeInstallPayload {
    pub theme_id: String,
    pub apply: bool,
}

static PENDING_THEME_INSTALL: Lazy<Mutex<Option<ThemeInstallPayload>>> =
    Lazy::new(|| Mutex::new(None));

fn is_valid_theme_id(value: &str) -> bool {
    Uuid::parse_str(value).is_ok()
}

fn parse_apply_flag(value: Option<&str>) -> bool {
    match value.map(|v| v.trim().to_lowercase()) {
        Some(v) if v == "0" || v == "false" || v == "no" => false,
        Some(_) => true,
        None => true,
    }
}

/// Parse theme install deeplinks from DesQTA or BetterSEQTA web URLs.
pub fn parse_theme_install_deeplink(url: &str) -> Option<ThemeInstallPayload> {
    let trimmed = url.trim();

    if let Some(rest) = trimmed.strip_prefix("desqta://theme/install/") {
        let theme_id = rest.split(['?', '#']).next()?.trim();
        if is_valid_theme_id(theme_id) {
            return Some(ThemeInstallPayload {
                theme_id: theme_id.to_string(),
                apply: true,
            });
        }
    }

    if let Some(rest) = trimmed.strip_prefix("desqta://theme/") {
        let segment = rest.split(['?', '#']).next()?.trim();
        if segment != "install" && is_valid_theme_id(segment) {
            return Some(ThemeInstallPayload {
                theme_id: segment.to_string(),
                apply: true,
            });
        }
    }

    for prefix in [
        "desqta://theme/install?",
        "desqta://theme/install/?",
        "https://betterseqta.org/desqta/theme/install?",
        "https://www.betterseqta.org/desqta/theme/install?",
        "http://betterseqta.org/desqta/theme/install?",
        "http://www.betterseqta.org/desqta/theme/install?",
    ] {
        if let Some(query) = trimmed.strip_prefix(prefix) {
            let mut theme_id: Option<String> = None;
            let mut apply = true;

            for param in query.split('&') {
                if let Some((key, value)) = param.split_once('=') {
                    match key {
                        "id" | "theme_id" | "themeId" => theme_id = Some(value.to_string()),
                        "apply" => apply = parse_apply_flag(Some(value)),
                        _ => {}
                    }
                }
            }

            if let Some(id) = theme_id {
                if is_valid_theme_id(&id) {
                    return Some(ThemeInstallPayload {
                        theme_id: id,
                        apply,
                    });
                }
            }
        }
    }

    for prefix in [
        "https://betterseqta.org/desqta/theme/",
        "https://www.betterseqta.org/desqta/theme/",
        "http://betterseqta.org/desqta/theme/",
        "http://www.betterseqta.org/desqta/theme/",
    ] {
        if let Some(rest) = trimmed.strip_prefix(prefix) {
            let segment = rest.split(['?', '#']).next()?.trim();
            if segment != "install" && is_valid_theme_id(segment) {
                return Some(ThemeInstallPayload {
                    theme_id: segment.to_string(),
                    apply: true,
                });
            }
        }
    }

    None
}

fn store_pending(payload: ThemeInstallPayload) {
    if let Ok(mut pending) = PENDING_THEME_INSTALL.lock() {
        *pending = Some(payload);
    }
}

pub fn emit_theme_install_deeplink(app: &AppHandle, payload: ThemeInstallPayload) {
    store_pending(payload.clone());

    if let Some(window) = app.webview_windows().get("main") {
        let _ = window.emit("theme-install-deeplink", payload);
    }
}

/// Handle a theme install deeplink. Returns true when the URL was recognized.
pub fn try_handle_theme_install(app: &AppHandle, url: &str) -> bool {
    if let Some(payload) = parse_theme_install_deeplink(url) {
        println!(
            "[Desqta] Theme install deeplink: theme_id={}, apply={}",
            payload.theme_id, payload.apply
        );
        emit_theme_install_deeplink(app, payload);
        true
    } else {
        false
    }
}

#[tauri::command]
pub fn take_pending_theme_install() -> Option<ThemeInstallPayload> {
    PENDING_THEME_INSTALL
        .lock()
        .ok()
        .and_then(|mut pending| pending.take())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_desqta_query_link() {
        let payload = parse_theme_install_deeplink(
            "desqta://theme/install?id=550e8400-e29b-41d4-a716-446655440000",
        )
        .unwrap();
        assert_eq!(payload.theme_id, "550e8400-e29b-41d4-a716-446655440000");
        assert!(payload.apply);
    }

    #[test]
    fn parses_desqta_path_link() {
        let payload = parse_theme_install_deeplink(
            "desqta://theme/install/550e8400-e29b-41d4-a716-446655440000",
        )
        .unwrap();
        assert_eq!(payload.theme_id, "550e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn parses_https_web_link() {
        let payload = parse_theme_install_deeplink(
            "https://betterseqta.org/desqta/theme/install?id=550e8400-e29b-41d4-a716-446655440000&apply=1",
        )
        .unwrap();
        assert_eq!(payload.theme_id, "550e8400-e29b-41d4-a716-446655440000");
        assert!(payload.apply);
    }

    #[test]
    fn ignores_invalid_urls() {
        assert!(parse_theme_install_deeplink("desqta://connect/foo").is_none());
        assert!(parse_theme_install_deeplink("desqta://theme/install?id=not-a-uuid").is_none());
    }
}
