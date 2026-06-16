# DesQTA ↔ Accounts: settings sync API (production spec)

**Accounts base URL:** `https://accounts.betterseqta.org` (use your deployment host if different.)

**Audience:** DesQTA client developers  
**Auth:** Same as existing settings APIs — JWT bearer token. The accounts user id must be sent on sync-init as `X-User-ID` and **must match** the user id in the JWT.  
**Setting keys & formats (exhaustive):** [cloud-settings-keys.md](./cloud-settings-keys.md)

---

## Authentication & headers

| Header | Required | Notes |
|--------|----------|--------|
| `Authorization: Bearer <jwt>` | Yes | Access token from accounts login / OAuth |
| `X-User-ID` | Yes on `sync-init` only | String user id (same id the accounts UI uses). Must equal JWT `id` / subject or the server returns **403** |
| `Content-Type: application/json` | Yes when sending a body | `application/json` |

**Error responses (JSON body where noted):**

| Status | When |
|--------|------|
| **401** | Missing/invalid JWT — `{"error":"Unauthorized"}` on `sync-init`; plain `Unauthorized` text may still be used on some older `GET/POST /api/settings` responses |
| **403** | `X-User-ID` does not match token (sync-init) — `{"error":"Forbidden","detail":"X-User-ID does not match token subject"}` |
| **400** | Malformed sync-init body or missing `X-User-ID` — body includes `error` / `detail` |
| **500** | Server or DB error — `{"error":"...","detail":"..."}`; if migrations are missing: hint to run `pnpm db:migrate:remote` |

**Rate limiting:** Same policy as other authenticated settings routes (lightweight; intended once per app session at startup).

---

## 1. `POST /api/settings/sync-init`

**Purpose:** One cheap round-trip to see if local settings are already aligned with the server. Does **not** return the full settings blob when up to date.

**Caching:** Response includes `Cache-Control: no-store` — do not cache at CDN or HTTP caches.

### Request body

```json
{
  "client": {
    "app": "desqta",
    "platform": "desktop",
    "app_version": "1.2.3"
  },
  "local": {
    "settings_revision": 42,
    "settings_updated_at": "2025-03-20T08:15:30.123Z",
    "device_timezone": "Australia/Sydney"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `client.app` | **Yes** | Must be the literal string `desqta` |
| `client.platform` | Recommended | e.g. `desktop`, `android`, `ios`, `web` |
| `client.app_version` | Recommended | Semver or build string |
| `local.settings_revision` | Recommended | Last **server** revision the client applied; omit or non-number → treated as **0** (unknown) |
| `local.settings_updated_at` | Optional | ISO 8601 UTC; informational / logging — **not** used as sole source of truth for equality |
| `local.device_timezone` | Optional | IANA timezone; informational only |

### Response envelope (always JSON, **200** for success paths below)

```json
{
  "status": "up_to_date" | "server_has_newer" | "no_remote_settings" | "client_ahead",
  "server": {
    "settings_revision": 42,
    "settings_updated_at": "2025-03-20T08:15:30.123Z"
  },
  "settings": null
}
```

| `status` | Meaning | `settings` |
|----------|---------|------------|
| `no_remote_settings` | No saved cloud settings for this user | `null` (empty). `server.settings_revision` is **0**; `server.settings_updated_at` is **null** |
| `server_has_newer` | Server revision is newer than the client’s known revision, or client revision unknown (**0**) but cloud data exists | **Full settings object** — same shape as `GET /api/settings` |
| `up_to_date` | Client revision **equals** server revision | `null` — **no** full blob |
| `client_ahead` | Client revision **greater than** server (offline edits, restore, etc.). Server does not push a full blob | `null` — client should **upload** via `POST /api/settings` (existing merge behavior) |

### Decision rules (normative summary)

Let `R_server` = `server.settings_revision` from `settings_metadata` (after migration / lazy repair), or **0** if there is no settings row.  
Let `R_client` = `local.settings_revision` if it is a non-negative integer, else **0**.

1. No row in `settings` for this user → **`no_remote_settings`**.
2. If `R_client === 0` and cloud settings exist → **`server_has_newer`** with full `settings` (bootstrap / legacy clients).
3. If `R_client === R_server` → **`up_to_date`**; `settings` null.
4. If `R_client < R_server` → **`server_has_newer`** with full `settings`.
5. If `R_client > R_server` → **`client_ahead`**; `settings` null (client should POST local state).

### Example: up to date

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "status": "up_to_date",
  "server": {
    "settings_revision": 12,
    "settings_updated_at": "2025-03-20T09:00:00.000Z"
  },
  "settings": null
}
```

### Example: server newer (full payload)

```json
{
  "status": "server_has_newer",
  "server": {
    "settings_revision": 13,
    "settings_updated_at": "2025-03-20T10:00:00.000Z"
  },
  "settings": {
    "theme": "dark",
    "accent_color": "#ff7e5f"
  }
}
```

### Example: client ahead (upload prompt)

```json
{
  "status": "client_ahead",
  "server": {
    "settings_revision": 10,
    "settings_updated_at": "2025-03-19T12:00:00.000Z"
  },
  "settings": null
}
```

---

## 2. `POST /api/settings` (updated response)

**Purpose:** Unchanged merge semantics — body is partial settings; server merges into existing JSON and stores.

**Response:** JSON object:

```json
{
  "ok": true,
  "server": {
    "settings_revision": 43,
    "settings_updated_at": "2025-03-20T09:00:00.000Z"
  }
}
```

**Plus** all merged setting keys are present at the **top level** (same names as before the sync-metadata change), so existing consumers that only read `theme`, `accent_color`, etc. keep working.

**Rules:**

- **`settings_revision`** and **`settings_updated_at`** advance only when the **merged** settings document **actually changes** (server compares **canonical JSON**: sorted keys recursively, so key order in the request does not matter). If the client POSTs the same logical data that is already stored, the row is not rewritten and revision/timestamp stay the same; the response still returns **`ok: true`** and the current **`server`** values from `settings_metadata`.
- On real changes, each save increments **`settings_revision`** by 1 and sets **`settings_updated_at`** to now (UTC).
- `server.settings_updated_at` always comes from the DB row — **`sync-init`** does not fabricate a new timestamp per request.
- `content_hash` is stored server-side (SHA-256 of **canonical** JSON) for diagnostics; clients should rely on **revision** for sync decisions.

**DesQTA client parsing recommendation:**

```typescript
const data = await res.json();
if (data.ok && data.server) {
  persistRevision(data.server.settings_revision, data.server.settings_updated_at);
  // apply merged settings from top-level keys excluding ok/server
  const { ok, server, ...settings } = data;
  applySettings(settings);
}
```

### Backward compatibility notes (POST vs GET)

| Endpoint | Compatible with older clients? |
|----------|--------------------------------|
| **`GET /api/settings`** | **Yes** — response body is unchanged (raw stored JSON only). |
| **`POST /api/settings`** | **Mostly** — merged settings still appear at the **top level**, but the response is **no longer** “settings keys only”. Two extra keys are always present after migration **`0010`**: `ok` and `server`. |

**Safe:** Clients that read **known setting keys** only, or that strip `ok` / `server` before persisting (as in the snippet above).

**Unsafe / needs a one-line fix:** Code that treats **`await res.json()`** as the entire settings document and saves **every** key to local state (e.g. `Object.assign(store, data)` without omitting `ok` / `server`), or strict schemas that reject unknown top-level properties.

**Deploy order:** Apply D1 migration **`0010_settings_sync_metadata.sql`** (e.g. `pnpm db:migrate:remote`) **before** deploying the worker that uses `settings_metadata`. A new worker against an unmigrated DB will return **500** on `POST /api/settings` until migrations run.

**`sync-init`:** New route; clients that do not call it are unaffected.

---

## 3. `GET /api/settings` (unchanged)

Still returns the raw stored JSON document (passwords / secrets are not in this document by design of your app). DesQTA should prefer **`sync-init`** for startup after this API is adopted; `GET` remains useful for debugging and legacy tools.

---

## 4. Database & migrations

**New table:** `settings_metadata`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | TEXT PK | Same as `settings.user_id` / JWT user id. **No foreign key** to `users` (matches `settings`; orphan rows possible from legacy deletes) |
| `settings_revision` | INTEGER NOT NULL | Starts at **1** when the row is created; **+1 only when a `POST /api/settings` changes the merged document** (canonical JSON compare; identical logical payloads do not bump). |
| `settings_updated_at` | TEXT NOT NULL | ISO 8601 UTC; **updated when revision bumps** (unchanged POST leaves the stored timestamp as-is). |
| `content_hash` | TEXT nullable | 64-char hex SHA-256 of canonical merged JSON |

**Migration file:** `migrations/0010_settings_sync_metadata.sql`

**Existing users:** On migrate, every row in `settings` gets a metadata row with **`settings_revision = 1`** and **`settings_updated_at = datetime('now')`** at migration time. Until clients learn that revision, they send `R_client = 0` and receive **`server_has_newer`** once with the full document, then store revision **1** locally.

**Deploy:** Apply D1 migrations (e.g. `pnpm db:migrate:remote`) before relying on the new fields.

**If migrate failed with `FOREIGN KEY constraint failed`:** An older `0010` script used a FK to `users`; some `settings.user_id` values may no longer exist in `users`. Pull the latest `0010` (no FK), then drop any partial table and re-apply:

```bash
npx wrangler d1 execute BS_SETTINGS --remote --command "DROP TABLE IF EXISTS settings_metadata;"
npx wrangler d1 migrations apply BS_SETTINGS --remote
```

(Or run the updated `0010` SQL file with `d1 execute --file=` if you are not using tracked migrations.)

---

## 5. Conflict / `client_ahead` behavior

| Situation | Server behavior |
|-----------|------------------|
| Client revision **>** server | **`client_ahead`**, HTTP 200, `settings: null` — **no** overwrite from server |
| Future merges | Not in this spec; clients should upload via `POST /api/settings` |

---

## 6. OpenAPI-style summary

```yaml
openapi: 3.0.3
info:
  title: BetterSEQTA Accounts – Settings sync
  version: 1.0.0
servers:
  - url: https://accounts.betterseqta.org
paths:
  /api/settings/sync-init:
    post:
      summary: Settings sync initialization
      parameters:
        - in: header
          name: X-User-ID
          required: true
          schema: { type: string }
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [client, local]
              properties:
                client:
                  type: object
                  required: [app]
                  properties:
                    app: { type: string, enum: [desqta] }
                    platform: { type: string }
                    app_version: { type: string }
                local:
                  type: object
                  properties:
                    settings_revision: { type: integer, minimum: 0 }
                    settings_updated_at: { type: string, format: date-time }
                    device_timezone: { type: string }
      responses:
        '200':
          description: Sync decision
          headers:
            Cache-Control:
              schema: { type: string, example: no-store }
        '400': { description: Bad request }
        '401': { description: Unauthorized }
        '403': { description: X-User-ID mismatch }
        '500': { description: Server error }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

---

## 7. Checklist for DesQTA

1. On startup (authenticated): `POST .../api/settings/sync-init` with `X-User-ID` and body above.
2. Handle all four `status` values; persist `server.settings_revision` + `server.settings_updated_at` after applying **`server_has_newer`**.
3. After **`POST /api/settings`**, read **`server`** from the response and persist (avoid an extra `sync-init`). The server may return the **same** revision/timestamp when the merged document is canonically unchanged — still persist so local state matches.
4. On **`client_ahead`**, trigger your existing upload / merge path with local state.
5. Run integration tests against staging before production cutover.
6. **Layout:** call **`runCloudSettingsStartupSync`** once per mount (see `src/lib/services/layoutCloudService.ts`) — **one** `sync-init` per load; **`server_has_newer`** applies merged settings then **reloads** so the shell reapplies theme/sidebar from disk. Avoid a second parallel `sync-init` on the same load (prevents duplicate `client_ahead` uploads).

---

*This document reflects the accounts worker implementation and migration `0010_settings_sync_metadata.sql`.*
