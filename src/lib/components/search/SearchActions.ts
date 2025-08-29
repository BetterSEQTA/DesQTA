import { invoke } from '@tauri-apps/api/core';
import { goto } from '$app/navigation';
import type { SearchItem } from './SearchData';

export async function toggleSetting(settingKey: string, inverted: boolean = false) {
  try {
    const subset = await invoke<any>('get_settings_subset', { keys: [settingKey] });
    const currentValue = subset?.[settingKey] ?? false;
    const newValue = inverted ? !currentValue : !currentValue;
    await invoke('save_settings_merge', { patch: { [settingKey]: newValue } });
    
    if (settingKey === 'dev_sensitive_info_hider') {
      const mod = await import('../../../utils/netUtil');
      mod.invalidateDevSensitiveInfoHiderCache?.();
    }
    
    console.log(`${settingKey} toggled to:`, newValue);
  } catch (e) {
    console.warn(`Failed to toggle ${settingKey}:`, e);
  }
}

export async function handleAction(item: SearchItem) {
  switch (item.id) {
    case 'action-theme':
      document.documentElement.classList.toggle('dark');
      break;
    case 'action-focus':
      goto('/?widget=focus_timer');
      break;
    case 'action-refresh':
      window.location.reload();
      break;
    case 'action-fullscreen':
      await invoke('toggle_fullscreen').catch(console.warn);
      break;
    case 'action-minimize':
      await invoke('minimize_window').catch(console.warn);
      break;
    case 'action-close':
      await invoke('quit').catch(console.warn);
      break;
    case 'action-sidebar-toggle':
      // This should be handled by the parent component
      break;
    // Settings toggles
    case 'toggle-animations':
      await toggleSetting('enhanced_animations');
      break;
    case 'toggle-sidebar-collapse':
      await toggleSetting('auto_collapse_sidebar');
      break;
    case 'toggle-weather':
      await toggleSetting('weather_enabled');
      break;
    case 'toggle-notifications':
      await toggleSetting('reminders_enabled');
      break;
    case 'toggle-school-picture':
      await toggleSetting('disable_school_picture', true);
      break;
    case 'toggle-global-search':
      await toggleSetting('global_search_enabled');
      break;
    default:
      goto(item.path);
  }
}

// Fuzzy search implementation
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (textLower.includes(queryLower)) {
    return 1 - (textLower.indexOf(queryLower) / text.length);
  }
  
  let score = 0;
  let queryIndex = 0;
  
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score += 1;
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length ? score / query.length : 0;
}
