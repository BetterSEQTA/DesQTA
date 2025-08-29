import { invoke } from '@tauri-apps/api/core';
import { queueAdd, queueAll, queueDelete } from './idb';

// Queue partial settings patches when offline/errors, and flush on demand

export async function saveSettingsWithQueue(patch: Record<string, any>): Promise<void> {
  try {
    await invoke('save_settings_merge', { patch });
  } catch (e) {
    // Queue for later
    await queueAdd({ type: 'settings_patch', payload: patch });
  }
}

export async function flushSettingsQueue(): Promise<void> {
  const items = await queueAll();
  for (const item of items) {
    if (item.type !== 'settings_patch') continue;
    try {
      await invoke('save_settings_merge', { patch: item.payload });
      await queueDelete(item.id!);
    } catch {
      // stop if still failing to avoid spin
      break;
    }
  }
}

// Optional: flush on regain connectivity
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSettingsQueue().catch(() => {});
  });
}


