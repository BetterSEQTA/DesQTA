import { invoke } from '@tauri-apps/api/core';
import { isDevTauriPerformance } from '$lib/performance/devTauriContext';
import { devRecordMetric } from '$lib/performance/devPerfHelpers';
import { dispatchSessionInvalid, isSessionAuthError } from '$lib/utils/sessionAuth';

export type SeqtaRequestInit = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  params?: Record<string, string>;
  is_image?: boolean;
  return_url?: boolean;
  parse_html?: boolean;
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a random Dicebear avatar URL for sensitive content hider mode
export function getRandomDicebearAvatar(): string {
  const styles = [
    'adventurer',
    'avataaars',
    'big-ears',
    'bottts',
    'croodles',
    'fun-emoji',
    'micah',
    'miniavs',
    'personas',
  ];
  const style = getRandomItem(styles);
  const seed = Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

// Moved mock implementation to a separate module for clarity and reuse
import { mockApiResponse } from '../mock';

// Cache the dev_sensitive_info_hider flag to avoid spamming settings on every request
let devInfoHiderCache: { value: boolean; timestamp: number } | null = null;
let devInfoHiderInFlight: Promise<boolean> | null = null;
const DEV_INFO_HIDER_TTL_MS = 60_000; // 60s TTL; adjust if needed

// Singleflight for identical in-flight SEQTA requests.
// This prevents warmup + page load + search from duplicating the same heavy backend calls.
const seqtaFetchInFlight = new Map<string, Promise<any>>();

function keyPart(value: unknown): string {
  try {
    return value === undefined ? '' : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function getDevSensitiveInfoHider(): Promise<boolean> {
  const now = Date.now();
  if (devInfoHiderCache && now - devInfoHiderCache.timestamp < DEV_INFO_HIDER_TTL_MS) {
    return devInfoHiderCache.value;
  }
  if (devInfoHiderInFlight) {
    return devInfoHiderInFlight;
  }
  devInfoHiderInFlight = (async () => {
    try {
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['dev_sensitive_info_hider'],
      });
      const value = subset?.dev_sensitive_info_hider ?? false;
      devInfoHiderCache = { value, timestamp: Date.now() };
      return value;
    } catch {
      devInfoHiderCache = { value: false, timestamp: Date.now() };
      return false;
    } finally {
      devInfoHiderInFlight = null;
    }
  })();
  return devInfoHiderInFlight;
}

export function invalidateDevSensitiveInfoHiderCache(): void {
  devInfoHiderCache = null;
}

/** Clear all caches (memory + SQLite) when mock mode is enabled to prevent stale real data. */
export async function clearAllCachesForMockMode(): Promise<void> {
  const { cache } = await import('./cache');
  cache.clear();
  try {
    await invoke('db_cache_clear');
  } catch {
    // Ignore - cache may not exist in some contexts
  }
  invalidateDevSensitiveInfoHiderCache();
}

export async function seqtaFetch(input: string, init?: SeqtaRequestInit): Promise<any> {
  // Read once with memoization to prevent dozens of calls on startup
  const useMock = await getDevSensitiveInfoHider();

  if (useMock) {
    return mockApiResponse(input, init?.body);
  }

  const method = init?.method || 'GET';
  const signature = [
    method,
    input,
    keyPart(init?.headers),
    keyPart(init?.params),
    keyPart(init?.body),
    init?.is_image ? '1' : '0',
    init?.return_url ? '1' : '0',
    init?.parse_html ? '1' : '0',
  ].join('|');

  const existing = seqtaFetchInFlight.get(signature);
  if (existing) return existing;

  const promise = (async () => {
    const t0 = isDevTauriPerformance() ? performance.now() : 0;
    try {
      const response = await invoke('fetch_api_data', {
        url: input,
        method,
        headers: init?.headers || {},
        body: init?.body || {},
        parameters: init?.params || {},
        isImage: init?.is_image || false,
        returnUrl: init?.return_url || false,
        parseHtml: init?.parse_html || false,
      });

      if (isDevTauriPerformance()) {
        void devRecordMetric(
          'network_seqta_fetch',
          'seqtaFetch',
          'network',
          performance.now() - t0,
          'ms',
          {
            url: input.length > 220 ? `${input.slice(0, 220)}…` : input,
            method,
          },
        );
      }

      return response;
    } catch (error) {
      const message =
        typeof error === 'string' ? error : ((error as Error)?.message ?? 'Unknown fetch error');
      if (isSessionAuthError(message)) {
        dispatchSessionInvalid();
      }
      if (isDevTauriPerformance()) {
        void devRecordMetric(
          'network_seqta_fetch_failed',
          'seqtaFetch failed',
          'network',
          performance.now() - t0,
          'ms',
          {
            url: input.length > 220 ? `${input.slice(0, 220)}…` : input,
            err: (typeof error === 'string' ? error : (error as Error)?.message ?? '').slice(0, 160),
          },
        );
      }
      throw new Error(message);
    }
  })();

  seqtaFetchInFlight.set(signature, promise);
  promise.finally(() => {
    seqtaFetchInFlight.delete(signature);
  });

  return promise;
}

export async function getRSS(url: string): Promise<any> {
  const t0 = isDevTauriPerformance() ? performance.now() : 0;
  try {
    const response = await invoke('get_rss_feed', {
      feed: url,
    });
    if (isDevTauriPerformance()) {
      void devRecordMetric('network_get_rss', 'getRSS', 'network', performance.now() - t0, 'ms', {
        feed: url.slice(0, 200),
      });
    }
    return response;
  } catch (error) {
    console.error('getRSS error:', error);
    throw new Error(
      typeof error === 'string' ? error : ((error as Error)?.message ?? 'Unknown fetch error'),
    );
  }
}

export async function openURL(url: string): Promise<any> {
  const t0 = isDevTauriPerformance() ? performance.now() : 0;
  try {
    const response = await invoke('open_url', {
      url: url,
    });

    if (isDevTauriPerformance()) {
      void devRecordMetric('network_open_url', 'openURL', 'network', performance.now() - t0, 'ms', {
        url: url.slice(0, 200),
      });
    }

    return response;
  } catch (error) {
    console.error('openURL error:', error);
    throw new Error(
      typeof error === 'string' ? error : ((error as Error)?.message ?? 'Unknown fetch error'),
    );
  }
}

export async function uploadSeqtaFile(fileName: string, filePath: string): Promise<string> {
  const t0 = isDevTauriPerformance() ? performance.now() : 0;
  try {
    const response = await invoke<string>('upload_seqta_file', {
      fileName: fileName,
      filePath: filePath,
    });
    if (isDevTauriPerformance()) {
      void devRecordMetric(
        'network_upload_seqta_file',
        'uploadSeqtaFile',
        'network',
        performance.now() - t0,
        'ms',
        { fileName: fileName.slice(0, 120) },
      );
    }
    return response;
  } catch (error) {
    console.error('uploadSeqtaFile error:', error);
    throw new Error(
      typeof error === 'string' ? error : ((error as Error)?.message ?? 'Unknown fetch error'),
    );
  }
}
