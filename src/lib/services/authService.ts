import { invoke } from '@tauri-apps/api/core';
import { seqtaFetch, getRandomDicebearAvatar } from '../../utils/netUtil';
import { cache } from '../../utils/cache';
import { logger, logFunction, logPerformance } from '../../utils/logger';

export interface UserInfo {
  clientIP: string;
  email: string;
  id: number;
  lastAccessedTime: number;
  meta: {
    code: string;
    governmentID: string;
  };
  personUUID: string;
  saml: [
    {
      autologin: boolean;
      label: string;
      method: string;
      request: string;
      sigalg: URL;
      signature: string;
      slo: boolean;
      url: URL;
    },
  ];
  status: string;
  type: string;
  userCode: string;
  userDesc: string;
  userName: string;
  displayName?: string;
  profilePicture?: string;
}

function binaryStringToBase64(binaryStr: string): string {
  let bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i) & 0xff;
  }

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export const authService = {
  async checkSession(): Promise<boolean> {
    logger.logFunctionEntry('authService', 'checkSession');
    logger.info('authService', 'checkSession', 'Checking session existence');
    
    try {
      const result = await invoke<boolean>('check_session_exists');
      logger.info('authService', 'checkSession', `Session exists: ${result}`, { result });
      logger.logFunctionExit('authService', 'checkSession', result);
      return result;
    } catch (error) {
      logger.error('authService', 'checkSession', `Failed to check session: ${error}`, { error });
      throw error;
    }
  },

  async startLogin(seqtaUrl: string): Promise<void> {
    console.log('[AUTH_SERVICE] Starting login with URL:', seqtaUrl);
    if (!seqtaUrl) {
      console.log('[AUTH_SERVICE] No URL provided, skipping login');
      return;
    }
    
    // Clean up any existing login windows before starting new login
    try {
      await invoke('cleanup_login_windows');
      console.log('[AUTH_SERVICE] Cleaned up existing login windows');
    } catch (e) {
      console.warn('[AUTH_SERVICE] Failed to cleanup login windows:', e);
    }
    
    console.log('[AUTH_SERVICE] Calling create_login_window backend command');
    await invoke('create_login_window', { url: seqtaUrl });
    console.log('[AUTH_SERVICE] create_login_window command completed');
  },

  async logout(): Promise<boolean> {
    console.log('[AUTH_SERVICE] Logging out');
    // Clear user info cache on logout
    cache.delete('userInfo');
    
    // Clean up any lingering login windows
    try {
      await invoke('cleanup_login_windows');
    } catch (e) {
      console.warn('[AUTH_SERVICE] Failed to cleanup login windows:', e);
    }
    
    const result = await invoke<boolean>('logout');
    console.log('[AUTH_SERVICE] Logout result:', result);
    return result;
  },

  async loadUserInfo(options?: { disableSchoolPicture?: boolean }): Promise<UserInfo | undefined> {
    logger.logFunctionEntry('authService', 'loadUserInfo', { options });
    
    try {
      if (options?.disableSchoolPicture) {
        logger.debug('authService', 'loadUserInfo', 'Disabling school picture, clearing cache');
        cache.delete('userInfo');
      }
      
      const cachedUserInfo = cache.get<UserInfo>('userInfo');
      if (cachedUserInfo) {
        logger.debug('authService', 'loadUserInfo', 'Returning cached user info');
        logger.logFunctionExit('authService', 'loadUserInfo', { cached: true });
        return cachedUserInfo;
      }

      const res = await seqtaFetch('/seqta/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });

      const trwen = await seqtaFetch('/seqta/student/load/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: {},
      });

      console.log(trwen);

      const userInfo: UserInfo = JSON.parse(res).payload;

      // Check if sensitive content hider mode is enabled
      let devSensitiveInfoHider = false;
      try {
        const settings = await invoke<{ dev_sensitive_info_hider?: boolean }>('get_settings');
        devSensitiveInfoHider = settings.dev_sensitive_info_hider ?? false;
      } catch (e) {
        devSensitiveInfoHider = false;
      }

      if (devSensitiveInfoHider) {
        // Use random Dicebear avatar in sensitive content hider mode
        userInfo.profilePicture = getRandomDicebearAvatar();
      } else if (!options?.disableSchoolPicture) {
        const profileImage = await seqtaFetch(`/seqta/student/photo/get`, {
          params: { uuid: userInfo.personUUID, format: 'low' },
          is_image: true,
        });
        userInfo.profilePicture = `data:image/png;base64,${profileImage}`;
      }

      logger.debug('authService', 'loadUserInfo', 'Caching user info');
      cache.set('userInfo', userInfo);
      logger.logFunctionExit('authService', 'loadUserInfo', { success: true });
      return userInfo;
    } catch (e) {
      logger.error('authService', 'loadUserInfo', `Failed to load user info: ${e}`, { error: e });
      return undefined;
    }
  },

  async getAPIData(url: string, parameters: Map<string, string>): Promise<any> {
    return await invoke('get_api_data', {
      url,
      parameters: Object.fromEntries(parameters),
    });
  },

  async postAPIData(url: string, data: Map<string, string>): Promise<any> {
    return await invoke('post_api_data', {
      url,
      data: Object.fromEntries(data),
    });
  },
};