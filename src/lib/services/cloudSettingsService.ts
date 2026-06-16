import { invoke } from '@tauri-apps/api/core';
import { cloudAuthService } from './cloudAuthService';
import { logger } from '../../utils/logger';

const API_URL = 'https://accounts.betterseqta.org';

export type SettingsSyncInitStatus =
  | 'up_to_date'
  | 'server_has_newer'
  | 'no_remote_settings'
  | 'client_ahead';

export interface SettingsSyncInitServerMeta {
  settings_revision: number;
  settings_updated_at: string | null;
}

export type SettingsSyncInitFormat = 'patch' | 'full';

export interface SettingsSyncInitResponse {
  status: SettingsSyncInitStatus;
  server: SettingsSyncInitServerMeta;
  settings: Record<string, unknown> | null;
  /** `patch` = sparse delta; `full` or absent = legacy full document. */
  settings_format?: SettingsSyncInitFormat;
}

/**
 * Performs an authenticated API request with 401 retry.
 * When the access token is expired (401), refreshes and retries once.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { body?: string } = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  let token = await cloudAuthService.getToken();
  const user = await cloudAuthService.getUser();

  if (!token || !user) return null as T;

  const doRequest = (t: string) =>
    fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        ...extraHeaders,
        Authorization: `Bearer ${t}`,
        'X-User-ID': user.id,
      },
    });

  let response = await doRequest(token);

  if (response.status === 401) {
    try {
      token = await cloudAuthService.refresh();
      response = await doRequest(token);
    } catch {
      throw new Error('Session expired');
    }
  }

  if (response.status === 401) {
    await cloudAuthService.invalidateCloudSessionAfterAuthError();
    throw new Error('Session expired');
  }

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response as unknown as T;
}

function syncInitPlatform(): string {
  const p = import.meta.env.TAURI_ENV_PLATFORM as string | undefined;
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  if (typeof p === 'string' && p.length > 0) return 'desktop';
  return 'desktop';
}

async function getAppVersionForSync(): Promise<string> {
  try {
    return await invoke<string>('get_app_version');
  } catch {
    return 'unknown';
  }
}

/**
 * Persist server metadata from accounts (local-only keys; not synced in cloud payload whitelist).
 * Safe when revision/timestamp are unchanged (e.g. no-op POST per canonical compare on server).
 */
export async function persistCloudSettingsServerMeta(
  revision: number,
  updatedAt: string | null,
): Promise<void> {
  await invoke('save_settings_merge', {
    patch: {
      cloud_settings_server_revision: revision,
      cloud_settings_server_updated_at: updatedAt === null ? null : updatedAt,
    },
  });
}

/**
 * Apply POST /api/settings response: persist revision, return merged settings keys only.
 * When the server skips a DB write (canonically identical merge), `server` still reflects current metadata.
 */
async function normalizePostSettingsResponse(raw: unknown): Promise<Record<string, unknown> | null> {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.ok === true && o.server && typeof o.server === 'object') {
    const server = o.server as { settings_revision?: number; settings_updated_at?: string };
    const rev = server.settings_revision;
    const at = server.settings_updated_at;
    if (typeof rev === 'number' && Number.isFinite(rev)) {
      await persistCloudSettingsServerMeta(rev, at ?? null);
    }
    const { ok: _ok, server: _server, patch: _patch, ...settings } = o;
    return settings as Record<string, unknown>;
  }
  return o as Record<string, unknown>;
}

export const cloudSettingsService = {
  /**
   * Fetches the user's settings from the cloud.
   */
  async getSettings() {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();

    if (!token || !user) return null;

    try {
      const data = await apiRequest<Record<string, unknown>>('/api/settings', {
        method: 'GET',
      });
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'Session expired') {
        logger.debug('cloudSettingsService', 'getSettings', 'Session expired');
      } else {
        logger.debug('cloudSettingsService', 'getSettings', 'Request failed', { error: e });
      }
      return null;
    }
  },

  /**
   * POST /api/settings/sync-init — requires X-User-ID (sent on all our requests).
   */
  async syncInit(body: {
    client: { app: string; platform: string; app_version: string };
    local: {
      settings_revision: number;
      settings_updated_at?: string | null;
      device_timezone?: string;
      settings: Record<string, unknown>;
    };
  }): Promise<SettingsSyncInitResponse | null> {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();
    if (!token || !user) return null;

    let t = token;
    const doRequest = () =>
      fetch(`${API_URL}/api/settings/sync-init`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
          'X-User-ID': user.id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    let response = await doRequest();
    if (response.status === 401) {
      try {
        t = await cloudAuthService.refresh();
        response = await doRequest();
      } catch {
        throw new Error('Session expired');
      }
    }

    if (response.status === 401) {
      await cloudAuthService.invalidateCloudSessionAfterAuthError();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`sync-init failed: ${response.status} ${errText}`);
    }

    return response.json() as Promise<SettingsSyncInitResponse>;
  },

  /**
   * Build default sync-init body from local persisted metadata.
   */
  async buildSyncInitBody(): Promise<{
    client: { app: string; platform: string; app_version: string };
    local: {
      settings_revision: number;
      settings_updated_at?: string | null;
      device_timezone?: string;
      settings: Record<string, unknown>;
    };
  }> {
    const [subset, settings] = await Promise.all([
      invoke<Record<string, unknown>>('get_settings_subset', {
        keys: ['cloud_settings_server_revision', 'cloud_settings_server_updated_at'],
      }),
      invoke<Record<string, unknown>>('get_cloud_sync_settings'),
    ]);
    const revRaw = subset.cloud_settings_server_revision;
    const rev =
      typeof revRaw === 'number' && Number.isFinite(revRaw) && revRaw >= 0
        ? Math.floor(revRaw)
        : 0;
    const atRaw = subset.cloud_settings_server_updated_at;
    const settings_updated_at =
      typeof atRaw === 'string' && atRaw.length > 0 ? atRaw : undefined;

    let device_timezone: string | undefined;
    try {
      device_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      device_timezone = undefined;
    }

    return {
      client: {
        app: 'desqta',
        platform: syncInitPlatform(),
        app_version: await getAppVersionForSync(),
      },
      local: {
        settings_revision: rev,
        ...(settings_updated_at !== undefined ? { settings_updated_at } : {}),
        ...(device_timezone ? { device_timezone } : {}),
        settings,
      },
    };
  },

  /**
   * Syncs (merges) local settings to the cloud.
   * Persists server revision from response when `ok` + `server` are present.
   */
  async syncSettings(settings: Record<string, unknown>) {
    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();
    if (!token || !user) return;

    try {
      const raw = await apiRequest<unknown>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const normalized = await normalizePostSettingsResponse(raw);
      logger.debug('cloudSettingsService', 'syncSettings', 'Settings synced successfully');
      return normalized;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'Session expired') {
        logger.debug('cloudSettingsService', 'syncSettings', 'Session expired');
      } else {
        logger.warn('cloudSettingsService', 'syncSettings', 'Sync failed', { error: e });
      }
      throw e;
    }
  },
};
