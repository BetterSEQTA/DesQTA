import { invoke } from '@tauri-apps/api/core';
import { cloudAuthService } from './cloudAuthService';
import { cloudSettingsService } from './cloudSettingsService';
import {
  loadAccentColor,
  loadTheme,
  loadCurrentTheme,
} from '$lib/stores/theme';
import { get } from 'svelte/store';
import { locale } from '$lib/i18n';
import { logger } from '../../utils/logger';

/**
 * Auto-download settings from cloud when they differ from local.
 * Reloads the page after applying cloud settings.
 */
export async function autoDownloadSettingsFromCloud(): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (!cloudUser) return;

    const { isOfflineMode } = await import('$lib/utils/offlineMode');
    const offline = await isOfflineMode();
    if (offline) {
      logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'Skipping download (offline mode)');
      return;
    }

    const lastReloadTime = sessionStorage.getItem('settings_last_reload');
    const now = Date.now();
    if (lastReloadTime && now - parseInt(lastReloadTime) < 5000) {
      logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'Skipping download (recently reloaded)');
      return;
    }

    const cloudSettings = await cloudSettingsService.getSettings();
    if (!cloudSettings) {
      logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'No cloud settings found');
      return;
    }

    const allKeys = Object.keys(cloudSettings);
    const localSettings = await invoke<Record<string, unknown>>('get_settings_subset', {
      keys: allKeys,
    });

    const compareSettings = (local: Record<string, unknown>, cloud: Record<string, unknown>): boolean => {
      const allKeysSet = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
      const differences: string[] = [];

      for (const key of allKeysSet) {
        const localValue = local?.[key];
        const cloudValue = cloud?.[key];

        const normalizeValue = (val: unknown): unknown => {
          if (val === undefined || val === null) return null;
          if (Array.isArray(val) && val.length === 0) return [];
          if (typeof val === 'object' && val !== null && Object.keys(val).length === 0) return {};
          return val;
        };

        const normalizedLocal = normalizeValue(localValue);
        const normalizedCloud = normalizeValue(cloudValue);
        if (JSON.stringify(normalizedLocal) !== JSON.stringify(normalizedCloud)) {
          differences.push(key);
        }
      }

      if (differences.length > 0) {
        logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'Settings differ', {
          differentKeys: differences,
        });
        return true;
      }
      return false;
    };

    const cloudSettingsHash = btoa(JSON.stringify(cloudSettings)).slice(0, 32);
    const lastSyncedHash = sessionStorage.getItem('settings_last_synced_hash');

    if (lastSyncedHash === cloudSettingsHash) {
      logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'Settings already synced (hash match)');
      return;
    }

    if (!compareSettings(localSettings || {}, cloudSettings as Record<string, unknown>)) {
      logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'Settings are identical');
      sessionStorage.setItem('settings_last_synced_hash', cloudSettingsHash);
      return;
    }

    logger.info('layoutCloud', 'autoDownloadSettingsFromCloud', 'Cloud settings differ, downloading...');

    await invoke('save_settings_merge', { patch: cloudSettings });

    logger.info('layoutCloud', 'autoDownloadSettingsFromCloud', 'Settings downloaded and applied');
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
          logger.error('layoutCloud', 'autoDownloadSettingsFromCloud', 'Error during reload', {
            error: reloadError,
          });
        }
      }, 300);
    });
  } catch (e) {
    logger.debug('layoutCloud', 'autoDownloadSettingsFromCloud', 'Failed to download (non-critical)', {
      error: e,
    });
  }
}

/**
 * Sync cloud settings on app startup when user is logged in.
 */
/**
 * Check if user was previously signed into cloud but is now signed out (e.g. token expired).
 * If so, show a toast and clear the flag.
 */
export async function checkCloudSignOutAlert(): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.getUser();
    if (cloudUser) return; // Still signed in

    const state = await invoke<{ previously_signed_into_cloud: boolean }>('get_cloud_state');
    if (!state?.previously_signed_into_cloud) return;

    const { toastStore } = await import('$lib/stores/toast');
    toastStore.warning(
      'You have been signed out of BetterSEQTA Plus. Sign in again in Settings to sync your data.',
    );
    await invoke('set_cloud_state_previously_signed', { value: false });
  } catch (e) {
    logger.debug('layoutCloud', 'checkCloudSignOutAlert', 'Check failed (non-critical)', { error: e });
  }
}

export async function syncCloudSettings(options: {
  loadWeatherSettings: () => Promise<void>;
  loadEnhancedAnimationsSetting: () => Promise<void>;
  reloadSidebarSettings: () => Promise<void>;
}): Promise<void> {
  try {
    const cloudUser = await cloudAuthService.init();
    if (!cloudUser) {
      await checkCloudSignOutAlert();
      return;
    }

    logger.info('layoutCloud', 'syncCloudSettings', 'Cloud user found, fetching settings');
    const settings = await cloudSettingsService.getSettings();
    if (!settings) return;

    logger.info('layoutCloud', 'syncCloudSettings', 'Applying cloud settings');
    await invoke('save_settings_merge', { patch: settings });

    await Promise.all([
      loadAccentColor(),
      loadTheme(),
      loadCurrentTheme(),
      (async () => {
        if (settings.language && settings.language !== get(locale)) {
          locale.set(settings.language);
        }
      })(),
      options.loadWeatherSettings(),
      options.loadEnhancedAnimationsSetting(),
      options.reloadSidebarSettings(),
    ]);
  } catch (e) {
    logger.error('layoutCloud', 'syncCloudSettings', 'Failed to sync cloud settings', { error: e });
  }
}
