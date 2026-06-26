import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';

interface DetailedSystemInfo {
  hostname: string;
  os_name: string;
}

let cachedDeviceName: string | null = null;

function normalizeHostname(hostname: string): string {
  let h = hostname.trim();
  if (!h || h.toLowerCase() === 'unknown') return '';
  if (h.endsWith('.local')) {
    h = h.slice(0, -'.local'.length);
  }
  return h;
}

/**
 * Returns a human-recognizable device label for BetterSEQTA Cloud login.
 * Prefers the machine hostname (e.g. "DESKTOP-ABC123"); falls back to OS name.
 */
export async function getDeviceName(): Promise<string> {
  if (cachedDeviceName) return cachedDeviceName;

  try {
    const info = await invoke<DetailedSystemInfo>('get_detailed_system_info');
    const hostname = normalizeHostname(info.hostname);
    if (hostname) {
      cachedDeviceName = hostname;
      return cachedDeviceName;
    }

    const os = info.os_name?.trim();
    cachedDeviceName = os && os.toLowerCase() !== 'unknown' ? `DesQTA on ${os}` : 'DesQTA';
    return cachedDeviceName;
  } catch (e) {
    logger.warn('deviceName', 'getDeviceName', 'Failed to resolve device name', {
      error: e instanceof Error ? e.message : String(e),
    });
    cachedDeviceName = 'DesQTA';
    return cachedDeviceName;
  }
}
