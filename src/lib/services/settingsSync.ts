import { invoke } from '@tauri-apps/api/core';
import { queueAdd, queueAll, queueDelete } from './idb';
import { cloudAuthService } from './cloudAuthService';
import {
  cloudSettingsService,
  persistCloudSettingsServerMeta,
  type SettingsSyncInitResponse,
} from './cloudSettingsService';
import { logger } from '../../utils/logger';

/** Keys uploaded on auto-sync and on `client_ahead` full push (excludes local-only cloud metadata). */
export const CLOUD_SYNC_SUBSET_KEYS = [
  'shortcuts',
  'feeds',
  'weather_enabled',
  'weather_city',
  'weather_country',
  'reminders_enabled',
  'force_use_location',
  'accent_color',
  'theme',
  'current_theme',
  'disable_school_picture',
  'enhanced_animations',
  'gemini_api_key',
  'ai_integrations_enabled',
  'grade_analyser_enabled',
  'lesson_summary_analyser_enabled',
  'quiz_generator_enabled',
  'auto_collapse_sidebar',
  'auto_expand_sidebar_hover',
  'global_search_enabled',
  'dev_sensitive_info_hider',
  'dev_force_offline_mode',
  'accepted_cloud_eula',
  'send_anonymous_usage_statistics',
  'sync_cloud_pfp',
  'language',
  'zoom_level',
  'biometric_enabled',
  'dashboard_today_schedule_fit_width',
] as const;

/** Patch-tier keys also persisted and included in full cloud upload (see Rust `CLOUD_SYNC_STORAGE_KEYS`). */
export const CLOUD_SYNC_PATCH_KEYS = [
  'auto_dismiss_message_notifications',
  'cerebras_api_key',
  'ai_provider',
  'minimize_to_tray',
  'separate_rss_feed',
  'menu_order',
  'sidebar_folders',
  'sidebar_favorites',
  'disabled_sidebar_pages',
  'downloaded_theme_ids',
  'downloaded_theme_metadata',
  'custom_background_enabled',
  'custom_background_fit',
  'custom_background_opacity',
  'custom_background_dim',
  'has_been_through_onboarding',
  'has_completed_setup_assistant',
  'has_completed_post_login_prompts',
] as const;

/** Full upload schema — canonical list lives in Rust (`get_cloud_sync_settings`). */
async function getCloudSyncSettingsSnapshot(): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>('get_cloud_sync_settings');
}

/** Never uploaded to accounts API. */
const CLOUD_UPLOAD_BLOCKLIST = new Set([
  'cloud_settings_server_revision',
  'cloud_settings_server_updated_at',
  'last_synced_cloud_pfp_url',
  'dashboard_widgets_layout',
  'sidebar_recent_activity',
  'ok',
  'server',
  'patch',
]);

const CLOUD_UPLOAD_ALLOWLIST = new Set<string>([
  ...CLOUD_SYNC_SUBSET_KEYS,
  ...CLOUD_SYNC_PATCH_KEYS,
]);

/** Strip local-only keys; auto-save POST sends only changed cloud-sync keys. */
function prepareSparseCloudUpload(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (CLOUD_UPLOAD_BLOCKLIST.has(k)) continue;
    if (!CLOUD_UPLOAD_ALLOWLIST.has(k)) continue;
    out[k] = v;
  }
  return out;
}

// Queue partial settings patches when offline/errors, and flush on demand

/**
 * Upload current local subset to cloud (e.g. after `client_ahead` from sync-init).
 */
export async function pushFullCloudSettingsSync(): Promise<void> {
  const cloudUser = await cloudAuthService.getUser();
  if (!cloudUser) return;
  const currentSettings = await getCloudSyncSettingsSnapshot();
  await cloudSettingsService.syncSettings({ ...currentSettings });
}

/**
 * Auto-syncs settings to cloud if user is logged in
 * This runs in the background and doesn't block the save operation
 */
async function autoSyncToCloud(patch: Record<string, unknown>): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (!cloudUser) return;

    const settingsToSync = prepareSparseCloudUpload(patch);
    if (Object.keys(settingsToSync).length === 0) return;

    await cloudSettingsService.syncSettings(settingsToSync);
    logger.debug('settingsSync', 'autoSyncToCloud', 'Auto-synced sparse patch to cloud', {
      keys: Object.keys(settingsToSync),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'Session expired') {
      logger.debug('settingsSync', 'autoSyncToCloud', 'Cloud session expired (signed out)');
    } else {
      logger.debug('settingsSync', 'autoSyncToCloud', 'Auto-sync failed', { error: e });
    }
  }
}

export async function saveSettingsWithQueue(patch: Record<string, unknown>): Promise<void> {
  if (patch.dashboard_widgets_layout) {
    try {
      const layout = JSON.parse(patch.dashboard_widgets_layout as string);
      const widgets = layout?.widgets || [];
      if (widgets.length === 1 && widgets[0]?.id === 'timetable-page-widget') {
        console.log('Skipping cloud sync for temporary timetable page widget');
        await invoke('save_settings_merge', { patch });
        return;
      }
    } catch {
      // If parsing fails, continue with normal flow
    }
  }

  try {
    await invoke('save_settings_merge', { patch });

    autoSyncToCloud(patch).catch(() => {});
  } catch (e) {
    await queueAdd({ type: 'settings_patch', payload: patch });
  }
}

export async function flushSettingsQueue(): Promise<void> {
  const items = await queueAll();
  for (const item of items) {
    if (item.type !== 'settings_patch') continue;
    try {
      await invoke('save_settings_merge', { patch: item.payload });
      await queueDelete(item.id!);
    } catch {
      break;
    }
  }
}

function compareSettings(local: Record<string, unknown>, cloud: Record<string, unknown>): boolean {
  const allKeysSet = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);

  for (const key of allKeysSet) {
    const localValue = local?.[key];
    const cloudValue = cloud?.[key];

    const normalizeValue = (val: unknown): unknown => {
      if (val === undefined || val === null) return null;
      if (Array.isArray(val) && val.length === 0) return [];
      if (typeof val === 'object' && val !== null && Object.keys(val as object).length === 0) return {};
      return val;
    };

    if (JSON.stringify(normalizeValue(localValue)) !== JSON.stringify(normalizeValue(cloudValue))) {
      return true;
    }
  }

  return false;
}

/**
 * Legacy: full GET /api/settings + compare (pre sync-init).
 */
async function legacyAutoDownloadSettingsFromGet(): Promise<void> {
  const lastSyncedHash = sessionStorage.getItem('settings_last_synced_hash');
  const now = Date.now();

  const cloudSettings = await cloudSettingsService.getSettings();
  if (!cloudSettings) {
    logger.debug('settingsSync', 'legacyAutoDownload', 'No cloud settings found');
    return;
  }

  const allKeys = Object.keys(cloudSettings);
  const localSettings = await invoke<Record<string, unknown>>('get_settings_subset', {
    keys: allKeys,
  });

  const cloudSettingsHash = btoa(JSON.stringify(cloudSettings)).slice(0, 32);

  if (lastSyncedHash === cloudSettingsHash) {
    logger.debug('settingsSync', 'legacyAutoDownload', 'Already synced (hash match)');
    return;
  }

  if (!compareSettings(localSettings || {}, cloudSettings)) {
    logger.debug('settingsSync', 'legacyAutoDownload', 'Settings identical');
    sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
    return;
  }

  logger.info('settingsSync', 'legacyAutoDownload', 'Cloud settings differ, applying...');

  await invoke('save_settings_merge', {
    patch: cloudSettings,
  });

  sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
  sessionStorage.setItem('settings_last_reload', now.toString());

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        } else if (typeof location !== 'undefined') {
          location.reload();
        }
      } catch (reloadError) {
        logger.error('settingsSync', 'legacyAutoDownload', 'Reload failed', { error: reloadError });
      }
    }, 300);
  });
}

function reloadAfterCloudApply(): void {
  const now = Date.now();
  sessionStorage.setItem('settings_last_reload', now.toString());

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        } else if (typeof location !== 'undefined') {
          location.reload();
        }
      } catch (reloadError) {
        logger.error('settingsSync', 'autoDownloadSettingsFromCloud', 'Error during reload', {
          error: reloadError,
        });
      }
    }, 300);
  });
}

export interface SyncInitApplyOptions {
  /** Manual download: treat no_remote_settings as empty cloud (no bootstrap upload). */
  rejectNoRemoteSettings?: boolean;
  /** Manual download: return client_ahead without uploading. */
  manualDownloadMode?: boolean;
}

export interface SyncInitApplyResult {
  reload: boolean;
  language?: string;
  mergedPayload?: Record<string, unknown> | null;
  doneWithoutReload?: boolean;
  alreadyInSync?: boolean;
  clientAhead?: boolean;
  noRemoteSettings?: boolean;
}

/**
 * Apply sync-init response: persist metadata, sparse/full merge, bootstrap or recovery uploads.
 */
export async function applySyncInitResult(
  result: SettingsSyncInitResponse,
  options: SyncInitApplyOptions = {},
): Promise<SyncInitApplyResult> {
  const rev = result.server?.settings_revision;
  const at = result.server?.settings_updated_at ?? null;

  if (typeof rev !== 'number' || !Number.isFinite(rev)) {
    logger.warn('settingsSync', 'applySyncInitResult', 'sync-init missing server revision');
    return { reload: false };
  }

  const revisionMarker = `rev:${rev}`;

  switch (result.status) {
    case 'no_remote_settings': {
      await persistCloudSettingsServerMeta(rev, at);
      sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
      if (options.rejectNoRemoteSettings) {
        return { reload: false, noRemoteSettings: true };
      }
      logger.info('settingsSync', 'applySyncInitResult', 'no_remote_settings — bootstrapping full upload');
      await pushFullCloudSettingsSync();
      return { reload: false };
    }
    case 'up_to_date': {
      await persistCloudSettingsServerMeta(rev, at);
      sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
      if (options.manualDownloadMode) {
        return { reload: false, doneWithoutReload: true, alreadyInSync: true };
      }
      return { reload: false };
    }
    case 'client_ahead': {
      if (options.manualDownloadMode) {
        return { reload: false, doneWithoutReload: true, clientAhead: true };
      }
      logger.info('settingsSync', 'applySyncInitResult', 'client_ahead — uploading local settings');
      await pushFullCloudSettingsSync();
      return { reload: false };
    }
    case 'server_has_newer': {
      const settings = result.settings;
      const format = result.settings_format ?? 'full';
      logger.debug('settingsSync', 'applySyncInitResult', 'server_has_newer', { format });

      if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
        await persistCloudSettingsServerMeta(rev, at);
        sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
        return { reload: false };
      }

      await invoke('save_settings_merge', {
        patch: {
          ...settings,
          cloud_settings_server_revision: rev,
          cloud_settings_server_updated_at: at,
        },
      });
      sessionStorage.setItem('settings_last_synced_hash', revisionMarker);
      const language = typeof settings.language === 'string' ? settings.language : undefined;
      return { reload: true, language, mergedPayload: settings };
    }
    default: {
      logger.warn('settingsSync', 'applySyncInitResult', 'Unknown sync-init status', {
        status: (result as { status?: string }).status,
      });
      return { reload: false };
    }
  }
}

async function handleSyncInitResult(result: SettingsSyncInitResponse): Promise<void> {
  const applied = await applySyncInitResult(result);
  if (applied.reload) {
    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Applied newer cloud settings, reloading...');
    reloadAfterCloudApply();
  }
}

/**
 * Auto-downloads settings from cloud on app launch if user is logged in.
 * Uses POST /api/settings/sync-init; falls back to GET /api/settings if sync-init fails.
 */
export async function autoDownloadSettingsFromCloud(): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (!cloudUser) {
      return;
    }

    const { isOfflineMode } = await import('../utils/offlineMode');
    const offline = await isOfflineMode();
    if (offline) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Skipping download (offline mode)');
      return;
    }

    const lastReloadTime = sessionStorage.getItem('settings_last_reload');
    const now = Date.now();
    if (lastReloadTime && now - parseInt(lastReloadTime, 10) < 5000) {
      logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Skipping download (recently reloaded)');
      return;
    }

    logger.info('settingsSync', 'autoDownloadSettingsFromCloud', 'Checking cloud settings (sync-init)...');

    try {
      const body = await cloudSettingsService.buildSyncInitBody();
      const result = await cloudSettingsService.syncInit(body);
      if (result) {
        await handleSyncInitResult(result);
      }
    } catch (e) {
      logger.warn('settingsSync', 'autoDownloadSettingsFromCloud', 'sync-init failed, falling back to GET', {
        error: e,
      });
      await legacyAutoDownloadSettingsFromGet();
    }
  } catch (e) {
    logger.debug('settingsSync', 'autoDownloadSettingsFromCloud', 'Failed (non-critical)', {
      error: e,
    });
  }
}
