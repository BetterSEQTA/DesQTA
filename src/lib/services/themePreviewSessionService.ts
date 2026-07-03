import { get, writable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { themeService } from '$lib/services/themeService';
import {
  isDesqtaStoreTheme,
  themeStoreService,
} from '$lib/services/themeStoreService';
import {
  applyPreviewTheme,
  cancelThemePreview,
  previewingTheme,
  startThemePreview,
} from '$lib/stores/theme';
import { logger } from '../../utils/logger';

export type ThemePreviewSource = 'store' | 'deeplink';

export interface ThemePreviewSession {
  displayName: string;
  cloudThemeId: string | null;
  tempSlug: string | null;
  source: ThemePreviewSource;
}

export const themePreviewSession = writable<ThemePreviewSession | null>(null);

const handlingThemeIds = new Set<string>();

export async function clearThemePreviewSession(): Promise<void> {
  const session = get(themePreviewSession);
  if (get(previewingTheme)) {
    await cancelThemePreview();
  }
  if (session?.tempSlug) {
    await themeService.cleanupTempTheme(session.tempSlug);
  }
  themePreviewSession.set(null);
}

async function startCloudPreviewSession(
  themeId: string,
  displayName: string,
  source: ThemePreviewSource,
): Promise<void> {
  const detail = await themeStoreService.getTheme(themeId);
  const theme = detail?.theme;
  if (!theme?.slug) {
    throw new Error('Theme not found');
  }
  if (!isDesqtaStoreTheme(theme)) {
    throw new Error('This theme is not available for DesQTA');
  }

  const tempThemeName = await themeService.previewCloudTheme(themeId);
  const tempSlug = tempThemeName.replace(/^\.temp\//, '');

  await startThemePreview(tempThemeName);

  themePreviewSession.set({
    displayName: displayName || theme.name,
    cloudThemeId: themeId,
    tempSlug,
    source,
  });
}

/** Preview a cloud theme from the theme store (toggle off if already previewing). */
export async function previewCloudThemeFromStore(
  themeId: string,
  displayName: string,
): Promise<void> {
  const current = get(themePreviewSession);
  if (current?.cloudThemeId === themeId && get(previewingTheme)) {
    await dismissThemePreviewSession();
    return;
  }

  if (handlingThemeIds.has(themeId)) return;
  handlingThemeIds.add(themeId);

  try {
    await clearThemePreviewSession();
    await startCloudPreviewSession(themeId, displayName, 'store');
  } catch (error) {
    logger.error('themePreviewSession', 'previewCloudThemeFromStore', 'Preview failed', {
      error,
      themeId,
    });
    await clearThemePreviewSession();
    throw error;
  } finally {
    handlingThemeIds.delete(themeId);
  }
}

/** Preview a cloud theme opened from a shared deeplink. */
export async function previewCloudThemeFromDeeplink(themeId: string): Promise<void> {
  if (handlingThemeIds.has(themeId)) return;
  handlingThemeIds.add(themeId);

  const toastId = toast.loading('Loading theme preview…', { id: `theme-deeplink-${themeId}` });

  try {
    await clearThemePreviewSession();
    await startCloudPreviewSession(themeId, '', 'deeplink');
    toast.dismiss(toastId);
  } catch (error) {
    logger.error('themePreviewSession', 'previewCloudThemeFromDeeplink', 'Preview failed', {
      error,
      themeId,
    });
    toast.error('Could not open this theme link. It may be unavailable or for another app.', {
      id: toastId,
    });
    await clearThemePreviewSession();
  } finally {
    handlingThemeIds.delete(themeId);
  }
}

/** Install or apply the active preview. */
export async function applyThemePreviewSession(): Promise<void> {
  const session = get(themePreviewSession);
  if (!session) return;

  if (session.cloudThemeId && session.tempSlug) {
    const toastId = toast.loading('Installing theme…', {
      id: `theme-install-${session.cloudThemeId}`,
    });
    try {
      await cancelThemePreview();
      await themeService.loadCloudTheme(session.cloudThemeId);
      await themeService.cleanupTempTheme(session.tempSlug);
      themePreviewSession.set(null);
      toast.success(`${session.displayName} installed`, { id: toastId });
    } catch (error) {
      logger.error('themePreviewSession', 'applyThemePreviewSession', 'Install failed', {
        error,
        themeId: session.cloudThemeId,
      });
      toast.error('Could not install theme. Check your connection and try again.', {
        id: toastId,
      });
    }
    return;
  }

  try {
    await applyPreviewTheme();
    themePreviewSession.set(null);
  } catch (error) {
    logger.error('themePreviewSession', 'applyThemePreviewSession', 'Apply failed', { error });
  }
}

/** Cancel preview and discard temp files. */
export async function dismissThemePreviewSession(): Promise<void> {
  await clearThemePreviewSession();
}
