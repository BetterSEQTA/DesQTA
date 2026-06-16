import { idbCacheDelete, idbCacheGet, idbCacheSet } from './idb';
import { logger } from '../../utils/logger';
import {
  CLOUD_ACCOUNTS_BASE,
  getFullPfpUrl,
  isAccountsHostedPfpUrl,
  pfpUrlWithHash,
} from './cloudPfpUtils';

const CACHE_PREFIX = 'cloud-pfp';

function blobKey(userId: string): string {
  return `${CACHE_PREFIX}:blob:${userId}`;
}

function hashKey(userId: string): string {
  return `${CACHE_PREFIX}:hash:${userId}`;
}

interface CachedPfpBlob {
  /** base64-encoded bytes */
  data: string;
  mimeType: string;
}

export async function clearCloudPfpCache(userId: string): Promise<void> {
  await Promise.all([idbCacheDelete(blobKey(userId)), idbCacheDelete(hashKey(userId))]);
}

async function readCachedBlob(userId: string): Promise<Blob | null> {
  const entry = await idbCacheGet<CachedPfpBlob>(blobKey(userId));
  if (!entry?.data) return null;
  const binary = atob(entry.data);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: entry.mimeType || 'image/jpeg' });
}

async function writeCachedBlob(userId: string, blob: Blob, hash: string): Promise<void> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  await idbCacheSet(
    blobKey(userId),
    { data: btoa(binary), mimeType: blob.type || 'image/jpeg' } satisfies CachedPfpBlob,
    null,
  );
  await idbCacheSet(hashKey(userId), hash, null);
}

async function fetchMetaHash(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${CLOUD_ACCOUNTS_BASE}/api/user/pfp/${userId}/meta`);
    if (!res.ok) return null;
    const json = (await res.json()) as { pfpHash?: string | null };
    return json.pfpHash ?? null;
  } catch (error) {
    logger.debug('cloudPfpCache', 'fetchMetaHash', 'Meta fetch failed', { error, userId });
    return null;
  }
}

export interface ResolvedCloudPfp {
  src: string;
  fromCache: boolean;
  blob?: Blob;
}

/**
 * Resolve a cloud avatar for display. Returns an object URL when cached/downloaded locally.
 */
export async function resolveCloudPfp(
  userId: string,
  pfpUrl: string | null | undefined,
  sessionHash?: string | null,
): Promise<ResolvedCloudPfp | null> {
  if (!userId || !pfpUrl) return null;

  const fullUrl = getFullPfpUrl(pfpUrl);
  if (!fullUrl) return null;

  if (!isAccountsHostedPfpUrl(fullUrl)) {
    return { src: fullUrl, fromCache: false };
  }

  const localHash = (await idbCacheGet<string>(hashKey(userId))) ?? null;
  const session = sessionHash ?? null;

  if (session && session === localHash) {
    const cached = await readCachedBlob(userId);
    if (cached) {
      return { src: URL.createObjectURL(cached), fromCache: true, blob: cached };
    }
  }

  let serverHash = session;
  if (!serverHash) {
    serverHash = await fetchMetaHash(userId);
  }

  if (!serverHash) {
    await clearCloudPfpCache(userId);
    return null;
  }

  if (serverHash === localHash) {
    const cached = await readCachedBlob(userId);
    if (cached) {
      return { src: URL.createObjectURL(cached), fromCache: true, blob: cached };
    }
  }

  const fetchUrl = pfpUrlWithHash(pfpUrl, serverHash);
  const headers: HeadersInit = {};
  if (localHash) {
    headers['If-None-Match'] = `"${localHash}"`;
  }

  try {
    const res = await fetch(fetchUrl, { headers });
    if (res.status === 304) {
      const cached = await readCachedBlob(userId);
      if (cached) {
        return { src: URL.createObjectURL(cached), fromCache: true, blob: cached };
      }
    }

    if (!res.ok) {
      if (serverHash !== localHash) {
        await clearCloudPfpCache(userId);
      }
      logger.debug('cloudPfpCache', 'resolveCloudPfp', 'Image fetch failed', {
        status: res.status,
        userId,
      });
      return null;
    }

    const blob = await res.blob();
    await writeCachedBlob(userId, blob, serverHash);
    return { src: URL.createObjectURL(blob), fromCache: false, blob };
  } catch (error) {
    logger.debug('cloudPfpCache', 'resolveCloudPfp', 'Image fetch error', { error, userId });
    return null;
  }
}
