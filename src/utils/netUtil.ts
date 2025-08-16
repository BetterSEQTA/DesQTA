import { invoke } from '@tauri-apps/api/core';

export type SeqtaRequestInit = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, any>;
  params?: Record<string, string>;
  is_image?: boolean;
  return_url?: boolean;
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate a random Dicebear avatar URL for sensitive content hider mode
export function getRandomDicebearAvatar(): string {
  const styles = ['adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles', 'fun-emoji', 'micah', 'miniavs', 'personas'];
  const style = getRandomItem(styles);
  const seed = Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
}

// Moved mock implementation to a separate module for clarity and reuse
import { mockApiResponse } from './mockApi';

// Cache the dev_sensitive_info_hider flag to avoid spamming settings on every request
let devInfoHiderCache: { value: boolean; timestamp: number } | null = null;
let devInfoHiderInFlight: Promise<boolean> | null = null;
const DEV_INFO_HIDER_TTL_MS = 60_000; // 60s TTL; adjust if needed

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
      const subset = await invoke<any>('get_settings_subset', { keys: ['dev_sensitive_info_hider'] });
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

export async function seqtaFetch(input: string, init?: SeqtaRequestInit): Promise<any> {
  // Read once with memoization to prevent dozens of calls on startup
  const useMock = await getDevSensitiveInfoHider();
  
  if (useMock) {
    return mockApiResponse(input);
  }
  
  try {
    const response = await invoke('fetch_api_data', {
      url: input,
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body || {},
      parameters: init?.params || {},
      isImage: init?.is_image || false,
      returnUrl: init?.return_url || false,
    });
    
    return response;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}

export async function getRSS(url: string): Promise<any> {
  try {
    const response = await invoke('get_rss_feed', {
      feed: url,
    });
    return response;
  } catch (error) {
    console.error('getRSS error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}

export async function openURL(url: string): Promise<any> {
  try {
    const response = await invoke('open_url', {
      url: url,
    });
  } catch (error) {
    console.error('openURL error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}

export async function uploadSeqtaFile(fileName: string, filePath: string): Promise<string> {
  try {
    const response = await invoke<string>('upload_seqta_file', {
      fileName: fileName,
      filePath: filePath,
    });
    return response;
  } catch (error) {
    console.error('uploadSeqtaFile error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown upload error');
  }
}