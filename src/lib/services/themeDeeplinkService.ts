import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { previewCloudThemeFromDeeplink } from '$lib/services/themePreviewSessionService';
import { logger } from '../../utils/logger';

export interface ThemeInstallDeeplinkPayload {
  themeId: string;
  apply?: boolean;
}

/** Register deeplink listeners and process any pending link from app startup. */
export async function initThemeDeeplinkHandler(): Promise<() => void> {
  const unlisten = await listen<ThemeInstallDeeplinkPayload>(
    'theme-install-deeplink',
    (event) => {
      void previewCloudThemeFromDeeplink(event.payload.themeId);
    },
  );

  try {
    const pending = await invoke<ThemeInstallDeeplinkPayload | null>('take_pending_theme_install');
    if (pending?.themeId) {
      void previewCloudThemeFromDeeplink(pending.themeId);
    }
  } catch (error) {
    logger.debug('themeDeeplinkService', 'initThemeDeeplinkHandler', 'No pending deeplink', {
      error,
    });
  }

  return unlisten;
}
