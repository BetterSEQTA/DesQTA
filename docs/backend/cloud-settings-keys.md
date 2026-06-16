# Cloud settings sync — complete key & format reference

**Audience:** DesQTA client developers, accounts API maintainers, debugging  
**Related:** [Settings sync API spec](./api-settings-sync-desqta.md) (HTTP protocol, revisions, `sync-init` decision tree)

This document is the exhaustive reference for **what** travels in cloud settings sync, **how** each value is serialized, **where** it is written locally, and **which** code paths upload or download it.

| Source of truth | Location |
|-----------------|----------|
| Full upload schema (46 keys) | `CLOUD_SYNC_STORAGE_KEYS` + `get_cloud_sync_settings` in `src-tauri/src/utils/settings.rs` |
| Client tier-1 list (legacy name) | `CLOUD_SYNC_SUBSET_KEYS` in `src/lib/services/settingsSync.ts` |
| Client tier-2 list | `CLOUD_SYNC_PATCH_KEYS` in `src/lib/services/settingsSync.ts` |
| Rust schema & defaults | `Settings` in `src-tauri/src/utils/settings.rs` |
| Local file | `$DATA_DIR/DesQTA/profiles/{profile_id}/settings.json` |
| Cloud API | `https://accounts.betterseqta.org/api/settings` |

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Local persistence](#2-local-persistence)
3. [Wire format & HTTP](#3-wire-format--http)
4. [Client sync flows](#4-client-sync-flows)
5. [Serialization rules](#5-serialization-rules)
6. [Tier 1 — canonical whitelist keys](#6-tier-1--canonical-whitelist-keys)
7. [Tier 2 — patch-tier keys](#7-tier-2--patch-tier-keys)
8. [Tier 3 — local-only keys](#8-tier-3--local-only-keys)
9. [Nested object schemas](#9-nested-object-schemas)
10. [Related data not in settings JSON](#10-related-data-not-in-settings-json)
11. [Full example payloads](#11-full-example-payloads)
12. [Gaps, bugs, and footguns](#12-gaps-bugs-and-footguns)
13. [UI accessibility map](#13-ui-accessibility-map)
14. [Code index](#14-code-index)

---

## 1. Architecture overview

Cloud settings sync keeps a **flat JSON document** per BetterSEQTA Plus user on `accounts.betterseqta.org`. DesQTA:

1. Persists settings locally in `settings.json` (per SEQTA profile).
2. On change (when signed in), POSTs a merged snapshot to the server.
3. On startup (when signed in), calls `sync-init` to compare revision numbers and optionally download or upload.

```
┌─────────────────┐     saveSettingsWithQueue      ┌──────────────────┐
│  Svelte UI /    │ ─────────────────────────────► │  settings.json   │
│  theme store    │         save_settings_merge      │  (per profile)   │
└────────┬────────┘                                  └────────┬─────────┘
         │                                                    │
         │ autoSyncToCloud (if cloud user)                     │ get_cloud_sync_settings
         ▼                                                    ▼
┌─────────────────┐     POST /api/settings         ┌──────────────────┐
│ cloudSettings   │ ◄──────────────────────────► │ accounts worker  │
│ Service         │     POST /api/settings/sync-init│ + D1 settings  │
└─────────────────┘                                └──────────────────┘
```

**Important:** Uploads send the **full cloud-sync schema** (46 keys: tier 1 + tier 2) via `get_cloud_sync_settings`. Local-only fields (`cloud_settings_server_*`, widget layout, etc.) never leave the device.

---

## 2. Local persistence

### File location

```
$DATA_DIR/DesQTA/profiles/{profile_id}/settings.json
```

- `{profile_id}` comes from `ProfileManager::get_current_profile()` (default: `"default"`).
- On Android, `$DATA_DIR` resolves to the app-scoped data directory via Tauri.

### Full schema materialization on load

`Settings::load()` ensures every cloud-sync key can exist in `settings.json` without breaking existing data:

| Scenario | Behavior |
|----------|----------|
| **No file / empty file** | Write full defaults (new install) |
| **Valid `Settings` parse, missing cloud keys** | **Insert only missing keys** into the existing JSON; never overwrite present values; preserve unknown top-level keys (e.g. legacy extras) |
| **Legacy JSON (Settings parse fails, Value parse OK)** | `merge_with_existing`, then merge Settings fields into original JSON while preserving unknown keys |
| **Corrupt JSON (both parses fail)** | Use in-memory defaults; **do not overwrite disk** (logged as error) |

Keys present with `null` count as existent and are not replaced.

**Upload snapshot:** `get_cloud_sync_settings` returns all 46 keys from the loaded `Settings` struct, filling from `Settings::default()` only if a value is missing in memory.

**Frontend lists:** `CLOUD_SYNC_SUBSET_KEYS` (29) + `CLOUD_SYNC_PATCH_KEYS` (17) in `settingsSync.ts` mirror `CLOUD_SYNC_STORAGE_KEYS` in Rust — keep them in sync when adding keys.

### Merge semantics (`save_settings_merge`)

Rust command shallow-merges a **patch** into the loaded `Settings` object:

```rust
// Top-level keys from patch overwrite current keys.
// Keys "ok" and "server" from API responses are NEVER persisted.
for (k, v) in patch { obj_curr.insert(k, v); }
// Full struct deserialized from merged JSON, then saved to disk.
```

- **Arrays and objects are replaced wholesale** — there is no deep merge per key.
- Uploading `shortcuts: [...]` replaces the entire shortcuts array, not individual items.
- Invalid JSON for the merged struct causes `save_settings_merge` to return an error.

### Offline queue

If `save_settings_merge` fails (e.g. disk error), `saveSettingsWithQueue` queues the patch in IndexedDB (`type: 'settings_patch'`). `flushSettingsQueue()` replays queued patches on next successful save. **Queued patches do not trigger cloud upload** until a later successful `saveSettingsWithQueue` call.

---

## 3. Wire format & HTTP

### Base URL

```
https://accounts.betterseqta.org
```

Override possible via `cloud_token.json` → `base_url` (dev/staging).

### Authentication (all settings routes)

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | Yes | `Bearer <JWT access token>` |
| `X-User-ID` | Yes on `sync-init` | Cloud user id string; **must match** JWT subject or **403** |
| `Content-Type` | Yes (bodies) | `application/json` |

### Document shape

**Request and stored document:** a single JSON **object** with setting keys at the **top level**. There is no `settings` wrapper key.

```json
{
  "theme": "dark",
  "accent_color": "#3b82f6",
  "shortcuts": []
}
```

**Key naming:** `snake_case` only, matching Rust field names.

**Canonical comparison (server):** Keys sorted recursively; revision bumps only when canonical JSON changes. Client key order in POST body does not matter.

### `POST /api/settings` — upload / merge

**Request body:** Partial or full settings object (any subset of keys).

**Response (post-migration `0010`):**

```json
{
  "ok": true,
  "server": {
    "settings_revision": 43,
    "settings_updated_at": "2026-06-09T12:00:00.000Z"
  },
  "theme": "dark",
  "accent_color": "#3b82f6"
}
```

- `ok` + `server` are envelope keys; DesQTA strips them before persisting (`normalizePostSettingsResponse`, `save_settings_merge` filter).
- All other top-level keys are the **merged** settings document.
- Client must persist `server.settings_revision` and `server.settings_updated_at` locally after every successful POST.

### `POST /api/settings/sync-init` — startup decision

**Request:**

```json
{
  "client": {
    "app": "desqta",
    "platform": "desktop",
    "app_version": "1.0.0"
  },
  "local": {
    "settings_revision": 42,
    "settings_updated_at": "2026-06-09T10:00:00.000Z",
    "device_timezone": "Australia/Perth"
  }
}
```

| Field | Type | Rules |
|-------|------|-------|
| `client.app` | `string` | **Must** be literal `"desqta"` |
| `client.platform` | `string` | `"desktop"` \| `"ios"` \| `"android"` (from `TAURI_ENV_PLATFORM`) |
| `client.app_version` | `string` | From Tauri `get_app_version`; fallback `"unknown"` |
| `local.settings_revision` | `integer ≥ 0` | From local `cloud_settings_server_revision`; non-number → `0` |
| `local.settings_updated_at` | `string?` | ISO-8601 UTC; omitted if empty locally |
| `local.device_timezone` | `string?` | IANA tz from `Intl.DateTimeFormat().resolvedOptions().timeZone` |

**Response `status` values:**

| Status | `settings` in response | Client action |
|--------|------------------------|---------------|
| `no_remote_settings` | `null` | Persist `server` metadata only |
| `up_to_date` | `null` | Persist `server` metadata only |
| `server_has_newer` | **Full settings object** | `save_settings_merge` + reload |
| `client_ahead` | `null` | `pushFullCloudSettingsSync()` (full 46-key schema) |

### `GET /api/settings` — legacy fallback

Returns raw stored JSON (no `ok`/`server` envelope). Used when `sync-init` fails.

---

## 4. Client sync flows

### 4.1 Auto-upload on change

**Entry point:** `saveSettingsWithQueue(patch)`

```
1. Special case: dashboard_widgets_layout with single timetable-page-widget → local save only, NO cloud sync
2. invoke('save_settings_merge', { patch })
3. If cloud user logged in:
     current = get_cloud_sync_settings()   // all 46 sync keys with defaults
     upload = { ...current, ...patch }
     cloudSettingsService.syncSettings(upload)
```

**Logged-in check:** `cloudAuthService.getUser()` must return a user. Failures are logged at debug level; they do not block local save.

**Patch keys outside the 46-key schema** are still merged into the upload when present in `patch`.

### 4.2 Full push (`client_ahead`)

**Entry point:** `pushFullCloudSettingsSync()`

Uploads the full **`CLOUD_SYNC_STORAGE_KEYS`** schema (tier 1 + tier 2, 46 keys) via `get_cloud_sync_settings`.

### 4.3 Startup download

**Entry point:** `runCloudSettingsStartupSync()` in `layoutCloudService.ts` (once per layout mount)

```
1. Skip if no cloud user or offline mode (dev_force_offline_mode)
2. POST sync-init
3. On server_has_newer: merge settings + revision metadata → reload page
4. On client_ahead: pushFullCloudSettingsSync
5. On up_to_date / no_remote_settings: persist revision metadata
6. If sync-init throws: GET /api/settings fallback → merge (no revision metadata from envelope)
7. If no reload: apply theme, accent, language, sidebar loaders in-process
```

**Reload guard:** `sessionStorage.settings_last_reload` — skips download if reloaded within 5 seconds.

**Dedup:** `sessionStorage.settings_last_synced_hash` set to `rev:{revision}` after successful sync-init paths.

### 4.4 Manual Cloud Sync modal

- **Upload (normal):** Calls parent `onSave()` → settings page `saveSettings()` → `saveSettingsWithQueue(patch)` (settings page patch only).
- **Upload (fallback):** `get_cloud_sync_settings` (full 46-key schema).
- **Download:** `sync-init` with same contract as startup; may reload.

### 4.5 Paths that save locally but do **not** cloud-sync

| Action | Mechanism | Cloud sync? |
|--------|-----------|-------------|
| Global search zoom in/out/reset | `save_settings_merge({ zoom_level })` | **No** |
| Widget layout save | `db_widget_layout_save` → `settings.save()` | **No** |
| Cloud PFP dedup URL | `save_settings_merge({ last_synced_cloud_pfp_url })` | **No** |
| EULA accept from modal | `save_settings_merge({ accepted_cloud_eula: true })` | **No** (unless followed by saveSettingsWithQueue elsewhere) |

---

## 5. Serialization rules

### JSON types

| Rust type | JSON | Notes |
|-----------|------|-------|
| `bool` | `boolean` | Never `0`/`1` |
| `String` | `string` | UTF-8; may be `""` |
| `Option<String>` | `string` or `null` | UI often sends `""` instead of `null` for cleared API keys |
| `Option<bool>` | `boolean` or `null` | Absent key → default on load |
| `Option<f64>` | `number` or `null` | `zoom_level` |
| `Option<Vec<T>>` | `array` or `null` | `null` and `[]` compared differently in legacy hash compare |
| `Vec<T>` | `array` | May be `[]` |
| `i64` | `number` | `cloud_settings_server_revision` (integer) |
| `serde_json::Value` | any JSON | `downloaded_theme_metadata` |

### Client-side comparison normalization (legacy GET path)

`compareSettings` in `settingsSync.ts`:

- `undefined` and `null` → treated as equal (`null`)
- Empty arrays stay `[]`; empty objects stay `{}`
- Otherwise `JSON.stringify` equality

### Server-side canonical merge

Server sorts keys recursively for equality. Identical logical documents do **not** bump `settings_revision`.

---

## 6. Tier 1 — canonical whitelist keys

These 29 keys are in `CLOUD_SYNC_SUBSET_KEYS` (tier 1). They are always included in `get_cloud_sync_settings` / full uploads alongside tier 2 keys.

---

### `shortcuts`

| Property | Value |
|----------|-------|
| **Rust type** | `Vec<Shortcut>` |
| **JSON type** | `array` |
| **Default** | `[]` |
| **Sync tier** | 1 (whitelist) |
| **Written by** | Settings page Save |
| **UI section** | Settings → Shortcuts |

**Element schema (`Shortcut`):**

```json
{
  "name": "School Portal",
  "icon": "🏫",
  "url": "https://portal.example.edu"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | `string` | Yes | Display label |
| `icon` | `string` | Yes | Emoji or short text; not a file path |
| `url` | `string` | Yes | Opened in default browser; should be `http://` or `https://` |

**Example array:**

```json
"shortcuts": [
  { "name": "SEQTA", "icon": "📚", "url": "https://seqta.example.com" },
  { "name": "Teams", "icon": "💬", "url": "https://teams.microsoft.com" }
]
```

**Merge behavior:** Entire array replaced on save. Order in array = display order on dashboard Shortcuts widget.

---

### `feeds`

| Property | Value |
|----------|-------|
| **Rust type** | `Vec<Feed>` |
| **JSON type** | `array` |
| **Default** | `[]` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |
| **UI section** | Settings → RSS Feeds |

**Element schema (`Feed`):**

```json
{ "url": "https://example.com/feed.xml" }
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `url` | `string` | Yes | RSS/Atom URL |

**Client filter on save:** Entries with empty/whitespace `url` are **stripped** before persist:

```typescript
feeds.filter((f) => f.url?.trim())
```

---

### `weather_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |
| **UI section** | Settings → Homepage |

Controls visibility of the dashboard Weather widget and weather fetches.

---

### `weather_city`

| Property | Value |
|----------|-------|
| **Rust type** | `String` |
| **JSON type** | `string` |
| **Default** | `""` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

Free-text city name used when `force_use_location` is `true` or geolocation unavailable.

**Example:** `"Perth"`, `"Sydney"`

---

### `weather_country`

| Property | Value |
|----------|-------|
| **Rust type** | `String` |
| **JSON type** | `string` |
| **Default** | `""` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

Country code or name for fallback weather lookup.

**Example:** `"AU"`, `"Australia"`

---

### `reminders_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |
| **UI section** | Settings → Notifications |

Enables OS notifications for assessment reminders (3-day, 1-day, due, overdue).

---

### `force_use_location`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

When `true`, uses `weather_city` + `weather_country` instead of device GPS for weather.

---

### `accent_color`

| Property | Value |
|----------|-------|
| **Rust type** | `String` |
| **JSON type** | `string` |
| **Default** | `"#3b82f6"` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, `theme.ts` (`updateAccentColor`, theme apply) |

**Format:** CSS hex color, typically `#RRGGBB`.

**Examples:** `"#3b82f6"`, `"#ff7e5f"`

Applied via CSS variable `--accent` on `document.documentElement`.

---

### `theme`

| Property | Value |
|----------|-------|
| **Rust type** | `String` |
| **JSON type** | `string` |
| **Default** | `"dark"` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, `theme.ts` |

**Semantic:** Application **color mode** (light/dark/system), **not** the named theme pack.

| Value | Meaning |
|-------|---------|
| `"light"` | Force light mode |
| `"dark"` | Force dark mode |
| `"system"` | Follow `prefers-color-scheme` |

**Legacy:** Stored value `"default"` is normalized to `"dark"` on load in `loadTheme()`.

**DOM effect:** Sets/removes `html.dark` class and `data-theme` attribute.

---

### `current_theme`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<String>` |
| **JSON type** | `string` \| `null` |
| **Default** | `"default"` |
| **Sync tier** | 1 |
| **Written by** | `theme.ts`, `themeService.ts` — **not** settings page Save |

**Semantic:** Active **named theme pack** (bundled, custom, or downloaded).

| Value | Meaning |
|-------|---------|
| `"default"` | Built-in default theme manifest |
| `"my-custom-theme"` | Slug/name of a local or downloaded theme folder |
| `null` | Treated as default on merge |

Distinct from `theme` (color mode). Changing theme in Theme Store updates `current_theme`, `accent_color`, and often `theme` together.

---

### `disable_school_picture`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |
| **UI section** | Settings → Display |

Hides SEQTA-provided school profile photo in header when `true`.

---

### `enhanced_animations`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `true` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |
| **UI section** | Settings → Performance |

Enables premium/refined motion and transitions app-wide.

---

### `gemini_api_key`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<String>` |
| **JSON type** | `string` \| `null` |
| **Default** | `null` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |
| **UI section** | Settings → AI Integrations |

Google Gemini API key for AI features.

**Wire format:** Settings page sends empty string `""` when cleared (UI state), not `null`. Server may store either.

**Security:** Synced to user's private cloud account; treat as secret in logs and UI.

---

### `ai_integrations_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<bool>` |
| **JSON type** | `boolean` \| `null` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, `StudyToolsContainer` (Cerebras setup) |

Master toggle for AI-powered features.

---

### `grade_analyser_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<bool>` |
| **JSON type** | `boolean` \| `null` |
| **Default** | `true` |
| **Sync tier** | 1 |
| **Written by** | **No settings UI save path** — only read on Assessments page |
| **Consumed by** | `GradePredictions.svelte`, assessments page |

Included in whitelist and cloud downloads but **not** in settings page Save patch. Value changes only via cloud download or manual JSON edit unless a future UI is added.

---

### `lesson_summary_analyser_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<bool>` |
| **JSON type** | `boolean` \| `null` |
| **Default** | `true` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, `StudyToolsContainer` |

Lesson summary AI in Study tools.

---

### `quiz_generator_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<bool>` |
| **JSON type** | `boolean` \| `null` |
| **Default** | `true` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, `StudyToolsContainer` |

Quiz generator AI in Study tools.

---

### `auto_collapse_sidebar`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, global search action `toggleSetting` |

Sidebar starts collapsed when `true`.

---

### `auto_expand_sidebar_hover`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, global search action |

Sidebar expands on mouse hover when `true`.

---

### `global_search_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` in Rust default; settings page load uses `?? true` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

Enables global search overlay (Ctrl/Cmd+K style).

---

### `dev_sensitive_info_hider`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save (Dev Settings section) |

Masks PII in UI for demos/recordings.

---

### `dev_force_offline_mode`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

When `true`, skips cloud download and treats app as offline.

---

### `accepted_cloud_eula`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save; EULA modal may use `save_settings_merge` directly |

User accepted BetterSEQTA Plus cloud sync EULA.

---

### `send_anonymous_usage_statistics`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save, `PostLoginPrompts.svelte` |

Opt-in to anonymous daily session counts sent to `betterseqta.org/api/analytics/usage`.

---

### `sync_cloud_pfp`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

When `true`, downloads cloud account profile picture to local `profile_picture.png` if `pfpUrl` changed (see [§10](#10-related-data-not-in-settings-json)).

---

### `language`

| Property | Value |
|----------|-------|
| **Rust type** | `String` |
| **JSON type** | `string` |
| **Default** | `"en"` |
| **Sync tier** | 1 |
| **Written by** | `LanguageSelector.svelte`, `+layout.svelte` `changeLanguage` — **not** settings page Save |

**Allowed values** (registered in `src/lib/i18n/index.ts`):

| Code | Display name |
|------|----------------|
| `en` | English |
| `es` | Español |
| `fr` | Français |
| `de` | Deutsch |
| `zh` | 中文 |
| `ja` | 日本語 |
| `en-pirate` | English Pirate |
| `pt` | Português |
| `ru` | Русский |
| `it` | Italiano |
| `ko` | 한국어 |
| `ar` | العربية |
| `nl` | Nederlands |
| `pl` | Polski |
| `tr` | Türkçe |

**Runtime:** Sets `svelte-i18n` `locale` store. On cloud download with reload, language applied after reload from disk.

---

### `zoom_level`

| Property | Value |
|----------|-------|
| **Rust type** | `Option<f64>` |
| **JSON type** | `number` \| `null` |
| **Default** | `null` (UI treats as `1.0`) |
| **Sync tier** | 1 |
| **Written by** | Settings page Save (`0.5`–`2.0`, step `0.1`) |

**Format:** Multiplier applied to `document.documentElement.style.zoom`.

| Constraint | Value |
|------------|-------|
| Min | `0.5` |
| Max | `2.0` |
| Step (settings UI) | `0.1` |
| Display | Percentage = `round(zoom_level * 100)` |

**Also mirrored in** `localStorage` key `desqta-zoom` for runtime zoom (not cloud-synced separately).

**Footgun:** Global search zoom actions save via `save_settings_merge` only — **no cloud upload** until settings page Save or another `saveSettingsWithQueue` call.

---

### `biometric_enabled`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `false` |
| **Sync tier** | 1 |
| **Written by** | Settings page, `PostLoginPrompts`, `+layout` (disable on failure) |

Mobile: require Face ID / fingerprint to unlock app.

---

### `dashboard_today_schedule_fit_width`

| Property | Value |
|----------|-------|
| **Rust type** | `bool` |
| **JSON type** | `boolean` |
| **Default** | `true` |
| **Sync tier** | 1 |
| **Written by** | Settings page Save |

When `true`, Today's Schedule dashboard widget fits all lessons in tile width (no horizontal scroll).

---

## 7. Tier 2 — patch-tier keys

These 17 keys are in `CLOUD_SYNC_PATCH_KEYS` / `CLOUD_SYNC_STORAGE_KEYS` (tier 2). They are **persisted with defaults on load** and **included in every full upload** via `get_cloud_sync_settings`. They are also sent when changed via `saveSettingsWithQueue` patch merge.

---

### `auto_dismiss_message_notifications`

| Rust | `bool` | Default `false` | Settings page Save |

---

### `cerebras_api_key`

| Rust | `Option<String>` | Default `null` | Settings page, Study tools |

Cerebras API key. Same empty-string vs `null` behavior as `gemini_api_key`.

---

### `ai_provider`

| Rust | `Option<String>` | Default `"gemini"` |

| Value | Meaning |
|-------|---------|
| `"gemini"` | Use Gemini API |
| `"cerebras"` | Use Cerebras API |

---

### `minimize_to_tray`

| Rust | `bool` | Default `true` | Settings page Save |

Desktop: `true` = close hides to tray; `false` = close quits.

---

### `separate_rss_feed`

| Rust | `bool` | Default `false` | Settings page Save |

Shows dedicated `/rss-feeds` sidebar entry when `true`.

---

### `menu_order`

| Rust | `Option<Vec<String>>` | Default `null` |

**Format:** Ordered list of sidebar entries.

| Entry pattern | Meaning |
|---------------|---------|
| `"/courses"` | Route path from `DEFAULT_MENU` |
| `"folder:<uuid>"` | Reference to `sidebar_folders[].id` |

**Known route paths** (`+layout.svelte` `DEFAULT_MENU`):

```
/  /courses  /assessments  /timetable  /study  /goals  /forums  /folios
/direqt-messages  /rss-feeds  /portals  /notices  /news  /directory
/documents  /reports  /analytics  /settings
```

`/settings` should remain reachable (sidebar customization enforces this in UI).

**Example:**

```json
"menu_order": [
  "/",
  "/courses",
  "folder:a1b2c3d4",
  "/assessments",
  "/settings"
]
```

**Written by:** `SidebarSettingsDialog.svelte` Save / reset.

---

### `sidebar_folders`

| Rust | `Option<Vec<SidebarFolder>>` | See [§9.1](#91-sidebarfolder) |

**Written by:** `SidebarSettingsDialog`, `AppSidebar` (collapse state only).

---

### `sidebar_favorites`

| Rust | `Option<Vec<String>>` | Array of route paths |

**Example:** `["/courses", "/analytics"]`

---

### `disabled_sidebar_pages`

| Rust | `Option<Vec<String>>` | Hidden route paths |

**Example:** `["/forums", "/folios"]`

`/settings` must not be disabled in UI.

---

### `downloaded_theme_ids`

| Rust | `Option<Vec<String>>` | Theme Store UUID strings |

**Example:**

```json
"downloaded_theme_ids": [
  "550e8400-e29b-41d4-a716-446655440000",
  "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
]
```

**Written by:** `themeService.saveDownloadedThemeId` / `removeDownloadedThemeId`.

Theme **files** are local; only IDs sync for cross-device re-download detection.

---

### `downloaded_theme_metadata`

| Rust | `Option<serde_json::Value>` | Map keyed by theme UUID | See [§9.2](#92-theme-metadata-map) |

---

### `custom_background_enabled`

| Rust | `bool` | Default `false` |

`true` only effective when a background image file exists locally.

---

### `custom_background_fit`

| Rust | `String` | Default `"cover"` |

| Value | CSS-like behavior |
|-------|-------------------|
| `"cover"` | Fill viewport, crop |
| `"contain"` | Fit inside viewport |
| `"fill"` | Stretch to fill |

Invalid values normalized to `"cover"` on load.

---

### `custom_background_opacity`

| Rust | `f64` | Default `1.0` | Range `0.2`–`1.0` (clamped in UI) |

---

### `custom_background_dim`

| Rust | `f64` | Default `0.0` | Range `0.0`–`0.8` (dark overlay for readability) |

**Written by:** `CustomBackgroundSettings.svelte`. Image binary is **not** synced.

---

### `has_been_through_onboarding`

| Rust | `bool` | Default `false` | `Onboarding.svelte` |

---

### `has_completed_setup_assistant`

| Rust | `bool` | Default `false` | `SetupAssistant.svelte` |

---

### `has_completed_post_login_prompts`

| Rust | `bool` | Default `false` | `PostLoginPrompts.svelte` |

---

## 8. Tier 3 — local-only keys

Never uploaded by current client sync paths.

| Key | Rust type | Default | Purpose |
|-----|-----------|---------|---------|
| `cloud_settings_server_revision` | `i64` | `0` | Last known server revision |
| `cloud_settings_server_updated_at` | `Option<String>` | `null` | Server timestamp (ISO-8601) |
| `last_synced_cloud_pfp_url` | `Option<String>` | `null` | Dedup for cloud PFP download |
| `dashboard_widgets_layout` | `Option<String>` | `null` | Widget layout JSON **string** |
| `sidebar_recent_activity` | `Option<Vec<RecentActivity>>` | `null` | Schema only; unused in UI |

### `dashboard_widgets_layout` (local reference)

Stored as a **string containing JSON**, not a nested object in `settings.json`:

```json
"dashboard_widgets_layout": "{\"widgets\":[...],\"version\":1,\"lastModified\":\"2026-06-09T12:00:00.000Z\"}"
```

**Parsed layout object** (see `src/lib/types/widgets.ts`, `database.rs`):

```json
{
  "widgets": [
    {
      "id": "upcoming_assessments",
      "type": "upcoming_assessments",
      "enabled": true,
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "settings": {},
      "title": "Optional override"
    }
  ],
  "version": 1,
  "lastModified": "2026-06-09T12:00:00.000Z"
}
```

**Widget `type` enum values:**

`upcoming_assessments`, `messages_preview`, `today_schedule`, `shortcuts`, `notices`, `news`, `welcome_portal`, `homework`, `todo_list`, `focus_timer`, `grade_trends`, `study_time_tracker`, `deadlines_calendar`, `quick_notes`, `weather`, `timetable`

**Position fields:** `x`, `y`, `w`, `h` (integers, grid units); optional `minW`, `minH`, `maxW`, `maxH`.

**Save path:** `db_widget_layout_save` → direct `settings.save()` — **no** `saveSettingsWithQueue`, **no** cloud sync.

### `sidebar_recent_activity` (schema only)

```json
[
  { "path": "/courses", "visited_at": 1717934400 }
]
```

`visited_at`: Unix timestamp seconds (`i64`).

---

## 9. Nested object schemas

### 9.1 `SidebarFolder`

```json
{
  "id": "f7a3c2e1-4b5d-4e9a-8c1f-2d3e4f5a6b7c",
  "name": "School",
  "icon": "AcademicCap",
  "items": ["/courses", "/assessments", "/timetable"],
  "collapsed": false,
  "order": 0
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | `string` | Yes | Unique folder id; referenced as `folder:{id}` in `menu_order` |
| `name` | `string` | Yes | Display name |
| `icon` | `string` | No | Icon identifier (hero icon name) |
| `items` | `string[]` | Yes | Route paths inside folder |
| `collapsed` | `boolean` | Yes | Default expanded state in sidebar |
| `order` | `number` (int) | Yes | Sort order among folders |

Folders sorted by `order` ascending on load.

### 9.2 Theme metadata map

```json
"downloaded_theme_metadata": {
  "550e8400-e29b-41d4-a716-446655440000": {
    "version": "2.1.0",
    "checksum": "sha256-or-hash-from-store",
    "updated_at": 1717934400000
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `version` | `string` | Theme Store version string |
| `checksum` | `string` | From download API |
| `updated_at` | `number` | Milliseconds since epoch |

---

## 10. Related data not in settings JSON

### Profile picture (custom)

| Storage | Path |
|---------|------|
| File | `$DATA_DIR/.../profile_picture.png` |
| API | `save_profile_picture`, `get_profile_picture_data_url` |

**Not** a settings key. User-uploaded crop from Settings → Personal.

### Cloud profile picture sync

Controlled by `sync_cloud_pfp: true`.

1. Read cloud user `pfpUrl` from `cloud_token.json` user object.
2. URL forms: absolute `https://...`, or relative `/pfp/...`, `/api/files/public/...` (prefixed with `https://accounts.betterseqta.org`).
3. Download via `save_profile_picture_from_url`.
4. Update `last_synced_cloud_pfp_url` locally (not cloud-synced).

### Theme pack files

Stored in app theme directories (bundled + downloaded). Cloud sync carries `current_theme` + `downloaded_theme_ids` + `downloaded_theme_metadata` only.

### Background image file

Stored via `save_background_image` (base64). Only `custom_background_*` booleans/strings/numbers sync.

### Cloud auth (separate files)

| File | Contents |
|------|----------|
| `cloud_token.json` | `{ token, refresh_token, user, base_url }` |
| `cloud_state.json` | `{ previously_signed_into_cloud }` |

Never part of settings sync payload.

---

## 11. Full example payloads

### Minimal first-time upload (defaults)

```json
{
  "shortcuts": [],
  "feeds": [],
  "weather_enabled": false,
  "weather_city": "",
  "weather_country": "",
  "reminders_enabled": false,
  "force_use_location": false,
  "accent_color": "#3b82f6",
  "theme": "dark",
  "current_theme": "default",
  "disable_school_picture": false,
  "enhanced_animations": true,
  "gemini_api_key": null,
  "ai_integrations_enabled": false,
  "grade_analyser_enabled": true,
  "lesson_summary_analyser_enabled": true,
  "quiz_generator_enabled": true,
  "auto_collapse_sidebar": false,
  "auto_expand_sidebar_hover": false,
  "global_search_enabled": false,
  "dev_sensitive_info_hider": false,
  "dev_force_offline_mode": false,
  "accepted_cloud_eula": false,
  "send_anonymous_usage_statistics": false,
  "sync_cloud_pfp": false,
  "language": "en",
  "zoom_level": null,
  "biometric_enabled": false,
  "dashboard_today_schedule_fit_width": true
}
```

### Rich real-world document (whitelist + common patch keys)

```json
{
  "shortcuts": [
    { "name": "Portal", "icon": "🏫", "url": "https://portal.school.edu" }
  ],
  "feeds": [
    { "url": "https://www.school.edu/news/rss" }
  ],
  "weather_enabled": true,
  "weather_city": "Perth",
  "weather_country": "AU",
  "reminders_enabled": true,
  "force_use_location": false,
  "accent_color": "#6366f1",
  "theme": "system",
  "current_theme": "midnight-blue",
  "disable_school_picture": false,
  "enhanced_animations": true,
  "gemini_api_key": "AIza...",
  "ai_integrations_enabled": true,
  "grade_analyser_enabled": true,
  "lesson_summary_analyser_enabled": true,
  "quiz_generator_enabled": true,
  "auto_collapse_sidebar": true,
  "auto_expand_sidebar_hover": true,
  "global_search_enabled": true,
  "dev_sensitive_info_hider": false,
  "dev_force_offline_mode": false,
  "accepted_cloud_eula": true,
  "send_anonymous_usage_statistics": true,
  "sync_cloud_pfp": true,
  "language": "en",
  "zoom_level": 1.1,
  "biometric_enabled": false,
  "dashboard_today_schedule_fit_width": true,
  "auto_dismiss_message_notifications": true,
  "cerebras_api_key": null,
  "ai_provider": "gemini",
  "minimize_to_tray": true,
  "separate_rss_feed": false,
  "menu_order": ["/", "/courses", "folder:abc123", "/settings"],
  "sidebar_folders": [
    {
      "id": "abc123",
      "name": "Learning",
      "icon": "BookOpen",
      "items": ["/study", "/assessments"],
      "collapsed": false,
      "order": 0
    }
  ],
  "sidebar_favorites": ["/analytics"],
  "disabled_sidebar_pages": ["/forums"],
  "downloaded_theme_ids": ["550e8400-e29b-41d4-a716-446655440000"],
  "downloaded_theme_metadata": {
    "550e8400-e29b-41d4-a716-446655440000": {
      "version": "1.0.0",
      "checksum": "abc123def456",
      "updated_at": 1717934400000
    }
  },
  "custom_background_enabled": true,
  "custom_background_fit": "cover",
  "custom_background_opacity": 0.9,
  "custom_background_dim": 0.2,
  "has_been_through_onboarding": true,
  "has_completed_setup_assistant": true,
  "has_completed_post_login_prompts": true
}
```

### Settings page Save patch only (what manual Save uploads merge)

Keys from `saveSettings()` in `settings/+page.svelte`:

```
shortcuts, feeds, weather_enabled, weather_city, weather_country,
reminders_enabled, auto_dismiss_message_notifications, force_use_location,
accent_color, theme, disable_school_picture, enhanced_animations,
gemini_api_key, cerebras_api_key, ai_provider, ai_integrations_enabled,
lesson_summary_analyser_enabled, quiz_generator_enabled,
auto_collapse_sidebar, auto_expand_sidebar_hover, global_search_enabled,
minimize_to_tray, dev_sensitive_info_hider, dev_force_offline_mode,
accepted_cloud_eula, sync_cloud_pfp, send_anonymous_usage_statistics,
separate_rss_feed, dashboard_today_schedule_fit_width, zoom_level,
biometric_enabled
```

**Not in settings page Save:** `language`, `current_theme`, `grade_analyser_enabled`, sidebar keys, theme download keys, custom background, onboarding flags.

---

## 12. Gaps, bugs, and footguns

1. **`dashboard_widgets_layout` does not sync** despite user documentation implying widget configs sync.

2. **Zoom via global search** uses `save_settings_merge` only — no cloud upload until Settings Save or another `saveSettingsWithQueue` call.

3. **`grade_analyser_enabled`** in whitelist but no UI to change it locally.

4. **API keys:** UI sends `""`; Rust type is `Option<String>` — cloud may store empty string vs `null` inconsistently.

5. **`theme` legacy value `"default"`** normalized to `"dark"` on load only in `loadTheme()`, not on every code path.

6. **EULA accept** via `save_settings_merge` in modal may not trigger cloud sync until next `saveSettingsWithQueue`.

7. **Legacy `upload_settings_to_cloud` / `download_settings_from_cloud`** (Rust) uploads entire `Settings` struct as file `desqta-settings.json` to `/files/upload` — separate from modern `/api/settings` merge API.

8. **Shallow merge:** Partial POST from another device replaces entire arrays (e.g. `shortcuts`) — no per-item merge.

9. **Keep lists in sync:** When adding a cloud-synced key, update `Settings` struct, `CLOUD_SYNC_STORAGE_KEYS` (Rust), `CLOUD_SYNC_SUBSET_KEYS` or `CLOUD_SYNC_PATCH_KEYS` (TS), and this document.

**Resolved (2026-06):**

- ~~`CloudSyncModal` fallback used a different key list~~ → fallback now uses `get_cloud_sync_settings`.
- ~~`client_ahead` dropped tier 2 keys~~ → full push uploads all 46 keys.
- ~~Sparse `settings.json` missing keys on upload~~ → `Settings::load()` inserts missing sync keys without overwriting existing values.

---

## 13. UI accessibility map

Which cloud-relevant settings have a **direct UI control**, where it lives, and whether changes **save immediately** or need **Settings → Save Changes**.

**Legend**

| Save behavior | Meaning |
|---------------|---------|
| **Immediate** | `saveSettingsWithQueue` (or equivalent) runs on control change |
| **Save button** | Bound on `/settings` but persisted only when user clicks **Save Changes** |
| **Dialog save** | Saved when user confirms a modal/dialog |
| **No UI** | Synced only via cloud download, defaults, or other devices |

---

### 13.1 On `/settings` — direct controls

| Key | Settings section | Control | Save behavior |
|-----|------------------|---------|---------------|
| `accepted_cloud_eula` | Cloud Sync | Checkbox (logged out) + EULA modal **Read & Accept** | EULA modal: local merge only; checkbox: **Save button** |
| `sync_cloud_pfp` | Cloud Sync | Checkbox (logged in) | **Immediate** (`saveSettings({ skipReload: true })`) |
| `send_anonymous_usage_statistics` | Cloud Sync | Checkbox | **Immediate** (`onchange` → `saveSettings`) |
| `language` | Personal Settings | `LanguageSelector` dropdown | **Immediate** (not in Save patch) |
| `weather_enabled` | Homepage | Checkbox | **Save button** |
| `force_use_location` | Homepage | Checkbox (if weather on) | **Save button** |
| `weather_city` | Homepage | Text input | **Save button** |
| `weather_country` | Homepage | Text input | **Save button** |
| `dashboard_today_schedule_fit_width` | Homepage → Dashboard | Checkbox | **Save button** |
| `shortcuts` | Shortcuts | Add / edit / delete rows (name, icon, URL) | **Save button** |
| `accent_color` | Appearance → Theme | Color picker + hex field | **Save button** |
| `theme` | Appearance → Theme | Light / Dark / System buttons | **Immediate** (`updateTheme()` → `saveSettingsWithQueue`) |
| `custom_background_enabled` | Appearance → Custom background | Toggle | **Immediate** (`CustomBackgroundSettings.persistSettings`) |
| `custom_background_fit` | Appearance → Custom background | Fit selector | **Immediate** |
| `custom_background_opacity` | Appearance → Custom background | Slider | **Immediate** |
| `custom_background_dim` | Appearance → Custom background | Slider | **Immediate** |
| `auto_collapse_sidebar` | Appearance → Layout | Checkbox | **Save button** |
| `auto_expand_sidebar_hover` | Appearance → Layout | Checkbox | **Save button** |
| `global_search_enabled` | Appearance → Layout | Checkbox | **Save button** |
| `minimize_to_tray` | Appearance → Layout | Checkbox (desktop only) | **Save button** |
| `disable_school_picture` | Appearance | Checkbox | **Save button** |
| `enhanced_animations` | Appearance | Checkbox | **Save button** |
| `biometric_enabled` | Security | Toggle (if platform supports biometrics) | **Immediate** (`handleBiometricToggle`) |
| `zoom_level` | Interface Zoom | − / + / Reset (50%–200%) | **Save button** |
| `reminders_enabled` | Notifications | Checkbox | **Save button** |
| `auto_dismiss_message_notifications` | Notifications | Checkbox | **Save button** |
| `separate_rss_feed` | RSS Feeds | Toggle | **Save button** |
| `feeds` | RSS Feeds | URL list add/edit/remove | **Save button** |
| `ai_integrations_enabled` | AI Integrations | Master toggle | **Save button** |
| `lesson_summary_analyser_enabled` | AI Integrations | Checkbox | **Save button** |
| `quiz_generator_enabled` | AI Integrations | Checkbox | **Save button** |
| `ai_provider` | AI Integrations | Gemini / Cerebras selector | **Save button** |
| `gemini_api_key` | AI Integrations | Password-style input | **Save button** |
| `cerebras_api_key` | AI Integrations | Password-style input | **Save button** |
| `dev_sensitive_info_hider` | Dev Settings (type `dev` on keyboard) | Checkbox | **Save button** |
| `dev_force_offline_mode` | Dev Settings | Checkbox | **Save button** |
| `has_been_through_onboarding` | Dev Settings | “Redo onboarding” action | **Immediate** (sets `false` to re-trigger) |

**Cloud Sync modal** (opened from Cloud Sync → Manage / Login): manual upload & download only — does not expose individual keys.

**Custom profile picture** (Personal Settings): local file upload — **not** a cloud settings key.

---

### 13.2 Settings area — sub-routes & dialogs

| Key | Location | Control | Save behavior |
|-----|----------|---------|---------------|
| `current_theme` | `/settings/theme-store` | Apply / preview theme | **Immediate** (`theme.ts` / `themeService`) |
| `accent_color` | `/settings/theme-store` | Applied with theme manifest | **Immediate** (with theme apply) |
| `theme` | `/settings/theme-store` | Applied with theme manifest (color mode) | **Immediate** (with theme apply) |
| `downloaded_theme_ids` | `/settings/theme-store` | Download theme | **Immediate** |
| `downloaded_theme_metadata` | `/settings/theme-store` | Download theme | **Immediate** |
| `menu_order` | Appearance → **Customize Sidebar** dialog | Drag-and-drop order | **Dialog save** |
| `sidebar_folders` | Customize Sidebar dialog | Folder CRUD + items | **Dialog save**; folder collapse also **Immediate** from sidebar |
| `sidebar_favorites` | Customize Sidebar dialog | Favorites toggles | **Dialog save** |
| `disabled_sidebar_pages` | Customize Sidebar dialog | Page visibility toggles | **Dialog save** |

Theme Builder (sidebar from theme store) may also change `current_theme` / colors when saving a custom theme.

---

### 13.3 Elsewhere in the app (not `/settings`)

| Key | Location | Save behavior |
|-----|----------|---------------|
| `language` | Setup assistant (`LanguageSelector`) | **Immediate** |
| `has_completed_setup_assistant` | Setup assistant completion | **Immediate** |
| `has_been_through_onboarding` | Onboarding completion overlay | **Immediate** |
| `has_completed_post_login_prompts` | Post-login prompts flow | **Immediate** |
| `biometric_enabled` | Post-login prompts | **Immediate** |
| `send_anonymous_usage_statistics` | Post-login prompts | **Immediate** |
| `cerebras_api_key` | Study → Study tools (API key entry) | **Immediate** (also sets `ai_provider`, enables AI flags) |
| `ai_integrations_enabled` | Study tools (with Cerebras key) | **Immediate** |
| `lesson_summary_analyser_enabled` | Study tools (with Cerebras key) | **Immediate** |
| `quiz_generator_enabled` | Study tools (with Cerebras key) | **Immediate** |
| `zoom_level` | Global search actions (zoom in/out/reset) | Local merge only — **does not cloud-sync** |
| `auto_collapse_sidebar` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `auto_expand_sidebar_hover` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `enhanced_animations` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `weather_enabled` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `reminders_enabled` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `disable_school_picture` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `global_search_enabled` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `separate_rss_feed` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `dev_force_offline_mode` | Global search toggle action | Local merge only — **does not cloud-sync** |
| `dev_sensitive_info_hider` | Global search toggle action; login screen dev toggle | Local merge only — **does not cloud-sync** |

---

### 13.4 Synced keys with **no** user-facing control

| Key | Notes |
|-----|-------|
| `grade_analyser_enabled` | **Read only** — consumed on Assessments page (`GradePredictions`); no toggle in Settings or Assessments UI |
| `has_been_through_onboarding` | Set by onboarding overlay; reset only via dev “redo onboarding” |
| `has_completed_setup_assistant` | Set once by setup assistant |
| `has_completed_post_login_prompts` | Set once by post-login prompts |
| `downloaded_theme_ids` / `downloaded_theme_metadata` | Written by theme store download; no manual JSON editor |

---

### 13.5 Not cloud-synced — UI still exists

| Key / data | UI location |
|------------|-------------|
| `dashboard_widgets_layout` | Dashboard edit mode (widget add/remove/reorder) — **local only** |
| Custom profile picture | Settings → Personal Settings |
| `last_synced_cloud_pfp_url` | No UI (internal cache) |
| `cloud_settings_server_revision` | No UI (internal sync metadata) |

---

### 13.6 Quick summary counts

| Category | Count |
|----------|-------|
| Tier 1 whitelist keys with control on `/settings` | **26 / 29** (missing: `current_theme`, `grade_analyser_enabled`; `language` on page but not Save patch) |
| Tier 1 only in settings sub-routes / theme store | **1** (`current_theme`) |
| Tier 1 with no UI | **1** (`grade_analyser_enabled`) |
| Tier 2 with control on `/settings` or dialogs | **15** (all except onboarding flags set elsewhere) |
| Tier 2 set only outside settings page | **3** onboarding/prompt flags |

---

## 14. Code index

| File | Responsibility |
|------|----------------|
| `src/lib/services/settingsSync.ts` | `CLOUD_SYNC_SUBSET_KEYS`, `CLOUD_SYNC_PATCH_KEYS`, `saveSettingsWithQueue`, `pushFullCloudSettingsSync`, download handlers |
| `src/lib/services/cloudSettingsService.ts` | HTTP client, `syncInit`, `syncSettings`, `buildSyncInitBody`, revision persistence |
| `src/lib/services/layoutCloudService.ts` | `runCloudSettingsStartupSync` |
| `src/lib/services/cloudPfpSyncService.ts` | Profile picture pull |
| `src/lib/services/themeService.ts` | `downloaded_theme_ids`, `downloaded_theme_metadata`, `current_theme` |
| `src/lib/stores/theme.ts` | `accent_color`, `theme`, `current_theme` |
| `src/lib/components/CloudSyncModal.svelte` | Manual upload/download UI |
| `src/lib/components/SidebarSettingsDialog.svelte` | Sidebar tier-2 keys |
| `src/routes/settings/+page.svelte` | Primary settings Save patch |
| `src-tauri/src/utils/settings.rs` | `Settings`, `CLOUD_SYNC_STORAGE_KEYS`, `get_cloud_sync_settings`, `get_settings_subset`, `save_settings_merge`, load-time schema materialization |
| `src-tauri/src/utils/database.rs` | `db_widget_layout_save` (local-only layout) |

---

*Last aligned with codebase: `CLOUD_SYNC_STORAGE_KEYS` (46 keys), `get_cloud_sync_settings`, `Settings::load()` schema materialization, accounts migration `0010_settings_sync_metadata.sql`.*
