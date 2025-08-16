DesQTA: Deep-Dive, Current State, Constraints, and Ideas
## Major Features (Current)
1) Authentication
   - Traditional SEQTA web login via spawned login webview, cookie harvesting, single-instance deep linking
   - QR/deeplink login path with JWT validation; heartbeat verification; session persisted locally
2) Assessments
   - List, board (kanban), calendar views; status badges; submissions (upload + link); details/overview with teacher feedback; upcoming widget
3) Timetable
   - Weekly grid (overlap handling), Today widget, exports (CSV/PDF/iCal), PDF viewer, responsive navigation
4) Messaging
   - SEQTA mail-like messaging (folders, message load, content caching);
   - BetterSEQTA Cloud chat (friends/groups, attachments, pagination, reply threading)
5) Dashboard widgets
   - Upcoming assessments, Today’s schedule, Portals embed, Notices, News, Shortcuts, Focus timer
6) Global Search (Rust-backed)
   - Search history, recent items, custom shortcuts, usage analytics; import/export/reset
7) Theme System
   - Theme packs with manifest-driven settings, custom properties, fonts; Theme Builder sidebar; dynamic accent color
8) Settings and Cloud Sync
   - App settings JSON (migration-aware); BetterSEQTA Cloud token; upload/download/check cloud settings
9) Notes and Todo (Rust modules present)
   - Storage and utilities exposed as Tauri commands
10) Error and Logging
   - Centralized error service, error boundary component; Rust logger, export/support utilities

## Platform & Delivery Considerations
- SSG only (no SSR); everything runs in the client/Tauri webview
- Tauri v2 plugin set is used for desktop behaviors (tray, autostart, notifications, dialog)
- Mobile scaffolding exists (android/ios gen), but many desktop-only flows (login webview, windows) are not mobile-ready

## Data & Integration Flow
- Frontend services call Tauri commands → Rust network layer → SEQTA or BetterSEQTA Cloud APIs
- Caching
  - Frontend: in-memory LRU-like with TTL; message content long-TTL
  - Backend: file-based JSON storage for settings, analytics, session, search; some global cache examples
- Security
  - JWT expiry checks; cookies persisted; local JSON files; basic obfuscation placeholders for secrets (improveable)

## Known Constraints / Limitations
- No SSR; SEO irrelevant for desktop, but some pre-render-only assumptions remain
- WebSocket real-time not implemented (polling/refresh patterns used)
- Offline-first not implemented (no service worker; caches are in-memory and simple JSON, not robust for offline)
- Local data encryption is minimal (base64 placeholder in some flows); secrets-at-rest not strongly protected
- Window management APIs: several are placeholders/no-ops on mobile; zoom handled in-frontend, not native
- Charting: chart.js dependency exists but design guidance prefers custom SVG charts → potential duplication
- Error reporting is console/analytics only; no Sentry-equivalent upstream
- SEQTA API coupling: endpoint shapes and auth are brittle; changes upstream can break flows

## Quality/Performance Observations
- Good: route-based code splitting; theme and accent propagation via CSS vars; cache TTLs; careful message content caching
- Opportunities:
  - Virtualized lists (messages, assessments) for large datasets
  - Background prefetch/warm caches for dashboard widgets
  - Consolidate settings fetches; batch invokes where possible
  - More robust LRU with size caps unified across app
  - Lazy-load heavy modules (pdfjs, TipTap extensions) on demand

## Developer Ergonomics
- Clear service boundaries, but mixed concerns (e.g., some UI-logic in pages) can be teased apart into services/stores
- Logging is present; add structured levels in frontend and wire to backend analytics consistently
- Testing: few visible automated tests; add unit tests for services, and E2E smoke with `tauri dev`

## Security & Privacy
- Strengthen at-rest encryption (settings/session/cloud token) with a real cipher (e.g., AES-256-GCM) and OS keychain/KMS binding where available
- Harden deeplink parsing; rate-limit auth retries; consistent CSRF-like defenses for critical invokes
- Sanitize all rendered HTML (DOMPurify used for messages – good); audit other injection points (marked/md rendering)

## Short-Term Ideas (Low Effort, High Impact)
1) Consolidate caching utilities
   - Single AdvancedCache with size tracking and LRU, shared across services; metrics hooks for hit/miss
2) ~~Virtualized rendering~~
   - ~~Add virtualization for large message lists and assessment lists to reduce DOM cost~~
3) ~~Background warm-up~~
   - ~~After login, parallel prefetch: upcoming assessments, timetable of today, notices/news, weather; hydrate caches~~
4) Robust error UX
   - Normalize error boundary placement per route; add retry/backoff and user-friendly explanations
5) Security polish
   - Replace base64 “encryption” with a simple, audited crate in Rust; store secrets via platform keychain when possible
6) Unify charting
   - Remove or gate chart.js; migrate to consistent custom SVG graphs matching theme tokens
7) ~~<u>Invoke batching</u>~~
   - ~~Coalesce multiple `get_settings`/`save_settings` calls; offer composite commands for frequent multi-reads~~

## Medium-Term Ideas
1) Real-time data
   - WebSocket bridge for messages, notifications, and presence; frontend event bus; fallbacks to polling
2) Offline-first
   - Service worker for static assets; IndexedDB for caches; sync queue for settings and drafts (messages/notes)
3) Local DB layer
   - SQLite via Tauri for persistent structured data (messages cache, notes, analytics); queryable search
4) Plugin architecture (frontend + backend)
   - Declarative registration for new features (e.g., integrations); scoped permissions; runtime enable/disable
5) Search 2.0
   - Fuzzy search in Rust over local datasets (assessments, notes, messages); result ranking and facets
6) Theming marketplace
   - Import/export themes; gallery with validation; semantic theme tokens beyond colors (spacing, radii, shadows)
7) Attachment pipeline
   - Background upload with progress, resumable uploads where API supports; thumbnail generation; virus-scan hooks

## Long-Term Ideas
1) Security hardening
   - Biometric unlock (Windows Hello/macOS Touch ID), hardware key/WebAuthn for cloud features
   - End-to-end encryption for BetterSEQTA Cloud messaging
2) Analytics & Insights
   - Rich local analytics timeline, performance monitoring, feature usage; opt-in telemetry
3) Multi-account / multi-tenant
   - Switch schools/tenants; per-tenant session separation and settings profiles
4) Collaboration features
   - Shared notes, study groups, presence, live cursors (if appropriate)
5) Internationalization
   - i18n for UI and date/time formatting; theme-aware typography

## UX/Theming Consistency (quick wins)
- Ensure all interactive elements use standard transitions and focus rings (accent ring classes)
- Standardize subtle hover scale inside tight containers vs larger scale elsewhere
- Keep dark-mode white typography across charts/axes/labels
- Button variants: accent text/border on transparent backgrounds for visual consistency

## Risk Register (selected)
- Upstream SEQTA API change: Mitigate by isolating request/shape mapping in Rust; feature-flags; robust error mapping
- Local file corruption: Atomic writes with backups for all JSON files (some already use temp/rename; extend everywhere)
- Security incident (token leak): Encrypt-at-rest, minimize lifetime, rotate; add “panic” clear-cache-and-exit
- Desktop/mobile divergence: Guard window APIs; design alternate flows for mobile (system browser auth, no tray)

## Suggested Roadmap
- Sprint 1–2 (stability & polish)
  - Consolidated cache, remove chart.js usages, virtualized lists, error UX, encryption upgrade
- Sprint 3–4 (capability)
  - Real-time bridge for messages/notifications; background warm-up; composite settings commands
- Sprint 5–6 (resilience & offline)
  - Service worker, IndexedDB caches, sync queue; partial offline for messages, assessments, timetable
- Sprint 7+ (platform & extensibility)
  - Local SQLite store; plugin system alpha; theme marketplace; i18n groundwork

## Implementation Notes (to align with current code)
- Tauri v2: continue using `@tauri-apps/api/core` for invoke; use `@tauri-apps/plugin-*` packages for platform features
- Keep SSG adapter-static; avoid SSR assumptions in new pages
- Theme packs: prefer adding new accent scales/tokens in Tailwind config rather than ad-hoc conversions
- When adding graphs, prefer custom SVG with accent color tokens and dark-friendly axes

## Quick Candidate Tasks
- Replace placeholder encryption for settings/cloud token; add OS keychain where supported
- Add websocket client (feature-flagged) for BetterSEQTA Cloud; fallback to polling
- Introduce `AdvancedCache` with shared instance, size caps, and metrics across services
- Virtualize message and assessment lists; lazy-load message bodies on demand with cache TTL 24h
- Build “Diagnostics” panel (logs export, settings export, environment info, cache clear)
- Add E2E smoke test (login mock, open pages, send command) for CI sanity


## Completed
- Background warm-up: Implemented via `src/lib/services/warmupService.ts` and wired in `src/routes/+layout.svelte` to run on app load. Primes caches for timetable and assessments (keys: `lesson_colours`, `timetable_*`, `upcoming_assessments_data`, `assessments_overview_data`).

- <u>Settings invoke batching</u>: Implemented backend composite commands and frontend migration
- <u>Offline-first foundations</u>:
  - Service Worker: `static/sw.js` (cache-first for static assets/app shell) and registration in `src/routes/+layout.svelte`
  - IndexedDB: `src/lib/services/idb.ts` (stores: `cache`, `syncQueue`)
  - Settings Sync Queue: `src/lib/services/settingsSync.ts` with auto-flush on `online` and explicit flush in header
  - Message Drafts Queue: queue compose drafts offline and flush when back online (`src/routes/direqt-messages/components/ComposeModal.svelte`, `src/lib/services/syncService.ts`)

  - Backend: `get_settings_subset(keys: Vec<String>)`, `save_settings_merge(patch: serde_json::Value)` registered in `src-tauri/src/lib.rs`
  - Frontend: replaced reads/writes across stores, services, and pages to use subset/merge
    - Files: `src/lib/stores/theme.ts`, `src/routes/+page.svelte`, `src/lib/services/themeService.ts`, `src/routes/+layout.svelte`, `src/routes/settings/+page.svelte`, `src/routes/direqt-messages/components/Sidebar.svelte`, `src/routes/directory/+page.svelte`, `src/routes/courses/components/CourseContent.svelte`, `src/lib/components/AppHeader.svelte`, `src/lib/components/UserDropdown.svelte`, `src/lib/services/geminiService.ts`, `src/lib/services/authService.ts`, `src/lib/services/weatherService.ts`
  - Performance: added memoization in `src/utils/netUtil.ts` to avoid spamming `get_settings_subset` on startup; exposes `invalidateDevSensitiveInfoHiderCache()` and invalidates on toggle from Global Search


