import { idbCacheGet, idbCacheSet } from './idb';
import { logger } from '../../utils/logger';

export async function getWithIdbFallback<T>(memKey: string, idbKey: string, memGet: () => T | null): Promise<T | null> {
  const mem = memGet();
  if (mem) return mem;
  const idb = await idbCacheGet<T>(idbKey);
  logger.info('idbCache', 'getWithIdbFallback', 'IDB fallback read', { memKey, idbKey, hit: !!idb });
  return idb ?? null;
}

export async function setIdb<T>(idbKey: string, value: T): Promise<void> {
  try {
    // Ensure plain JSON-serializable data (avoid Svelte proxies/DataCloneError)
    const plain = JSON.parse(JSON.stringify(value));
    await idbCacheSet(idbKey, plain);
    logger.info('idbCache', 'setIdb', 'IDB write', { idbKey, size: JSON.stringify(plain)?.length });
  } catch (e) {
    logger.warn('idbCache', 'setIdb', 'IDB write failed', { idbKey, error: String(e) });
  }
}


