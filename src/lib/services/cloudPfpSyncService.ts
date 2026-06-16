import { invoke } from '@tauri-apps/api/core';
import { cloudAuthService } from './cloudAuthService';
import { clearCloudPfpCache, resolveCloudPfp } from './cloudPfpCache';
import {
  blobToDataUrl,
  CLOUD_ACCOUNTS_BASE,
  dataUrlToBlob,
  downscaleForUpload,
  getFullPfpUrl,
} from './cloudPfpUtils';
import { logger } from '../../utils/logger';

function syncRevisionKey(pfpUrl: string | null | undefined, hash: string | null | undefined): string {
  return `${pfpUrl ?? ''}|${hash ?? ''}`;
}

/** Same-tab refresh for header/settings after local PFP changes. */
export function notifyProfilePictureChanged(): void {
  window.dispatchEvent(new Event('profile-picture-updated'));
}

/**
 * After a local upload/remove: refresh UI and optionally push to cloud when sync is enabled.
 */
export async function afterProfilePictureChange(options?: { syncToCloud?: boolean }): Promise<void> {
  notifyProfilePictureChanged();
  if (options?.syncToCloud !== false) {
    await syncLocalProfilePictureToCloud();
  }
}

async function isSyncCloudPfpEnabled(): Promise<boolean> {
  const settings = await invoke<{ sync_cloud_pfp?: boolean }>('get_settings_subset', {
    keys: ['sync_cloud_pfp'],
  });
  return settings?.sync_cloud_pfp === true;
}

/**
 * Upload local profile picture to BetterSEQTA cloud (or clear cloud avatar if local is missing).
 */
export async function syncLocalProfilePictureToCloud(): Promise<void> {
  try {
    if (!(await isSyncCloudPfpEnabled())) return;

    const token = await cloudAuthService.getToken();
    const user = await cloudAuthService.getUser();
    if (!token || !user?.id) return;

    const localDataUrl = await invoke<string | null>('get_profile_picture_data_url');

    if (!localDataUrl) {
      const res = await fetch(`${CLOUD_ACCOUNTS_BASE}/api/user/pfp/clear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Clear failed: HTTP ${res.status}`);
      }

      await cloudAuthService.updateStoredUser({ pfpUrl: null, pfpHash: null });
      await clearCloudPfpCache(user.id);
      await invoke('save_settings_merge', { patch: { last_synced_cloud_pfp_url: null } });
      logger.info('cloudPfpSync', 'syncLocalProfilePictureToCloud', 'Cleared cloud avatar');
      return;
    }

    const localBlob = await dataUrlToBlob(localDataUrl);
    if (!localBlob.type.startsWith('image/')) {
      throw new Error('Local profile picture is not an image');
    }

    const uploadBlob = await downscaleForUpload(localBlob);
    const form = new FormData();
    form.append('file', uploadBlob, 'profile-picture.jpg');

    const res = await fetch(`${CLOUD_ACCOUNTS_BASE}/api/user/pfp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `Upload failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { pfpUrl?: string; pfpHash?: string | null };
    if (!data.pfpUrl) {
      throw new Error('Upload response missing pfpUrl');
    }

    await cloudAuthService.updateStoredUser({
      pfpUrl: data.pfpUrl,
      pfpHash: data.pfpHash ?? null,
    });
    await clearCloudPfpCache(user.id);

    await invoke('save_settings_merge', {
      patch: {
        last_synced_cloud_pfp_url: syncRevisionKey(data.pfpUrl, data.pfpHash ?? null),
      },
    });

    logger.info('cloudPfpSync', 'syncLocalProfilePictureToCloud', 'Uploaded local PFP to cloud');
  } catch (error) {
    logger.warn('cloudPfpSync', 'syncLocalProfilePictureToCloud', 'Cloud PFP upload failed', {
      error,
    });
  }
}

/**
 * Download cloud avatar into local profile picture storage when sync_cloud_pfp is enabled.
 */
export async function syncCloudPfpToLocal(): Promise<void> {
  try {
    const [cloudUser, settings] = await Promise.all([
      cloudAuthService.getUser(),
      invoke<{ sync_cloud_pfp?: boolean; last_synced_cloud_pfp_url?: string | null }>(
        'get_settings_subset',
        { keys: ['sync_cloud_pfp', 'last_synced_cloud_pfp_url'] },
      ),
    ]);

    if (!settings?.sync_cloud_pfp || !cloudUser?.id) return;

    if (!cloudUser.pfpUrl) {
      await invoke('delete_profile_picture').catch(() => {});
      await invoke('save_settings_merge', { patch: { last_synced_cloud_pfp_url: null } });
      notifyProfilePictureChanged();
      return;
    }

    const revision = syncRevisionKey(cloudUser.pfpUrl, cloudUser.pfpHash ?? null);
    const lastSynced = settings.last_synced_cloud_pfp_url ?? '';
    if (lastSynced === revision) {
      logger.debug('cloudPfpSync', 'syncCloudPfpToLocal', 'Cloud PFP unchanged, skipping');
      return;
    }

    const resolved = await resolveCloudPfp(cloudUser.id, cloudUser.pfpUrl, cloudUser.pfpHash ?? null);
    if (!resolved?.blob) {
      const fullUrl = getFullPfpUrl(cloudUser.pfpUrl);
      if (!fullUrl) return;
      await invoke<string>('save_profile_picture_from_url', { url: fullUrl });
    } else {
      const dataUrl = await blobToDataUrl(resolved.blob);
      await invoke('save_profile_picture', { base64Data: dataUrl });
    }

    await invoke('save_settings_merge', {
      patch: { last_synced_cloud_pfp_url: revision },
    });

    logger.info('cloudPfpSync', 'syncCloudPfpToLocal', 'Synced cloud PFP to local');
    notifyProfilePictureChanged();
  } catch (error) {
    logger.debug('cloudPfpSync', 'syncCloudPfpToLocal', 'Failed to sync cloud PFP (non-critical)', {
      error,
    });
  }
}

export { getFullPfpUrl };
