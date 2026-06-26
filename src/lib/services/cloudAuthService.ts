import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { checkCloudSignOutAlert } from './cloudSignOutAlertService';
import { getDeviceName } from '$lib/utils/deviceName';

const API_URL = 'https://accounts.betterseqta.org';
const DESQTA_REDIRECT_URI = 'desqta://auth/callback';

/** Detects if a failed response indicates an expired/invalid reserved client_id. */
function isClientIdExpired(status: number, errMsg?: string): boolean {
  if (status === 404) return true;
  const msg = (errMsg ?? '').toLowerCase();
  return msg.includes('invalid client_id') || msg.includes('invalid client id');
}

function isUnauthorized(status: number): boolean {
  return status === 401;
}

interface ReservedClientResult {
  client_id: string;
  redirect_uri: string;
  api_url?: string;
  config_url?: string;
  refresh_url?: string;
  login_url?: string;
  discord_auth_url?: string;
}

export interface CloudUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  pfpUrl?: string | null;
  is_admin?: number | null;
}

interface CloudUserWithToken {
  user: CloudUser | null;
  token: string | null;
  refresh_token?: string | null;
}

interface DesqtaConfig {
  client_id: string;
  api_url: string;
  refresh_url: string;
  discord_auth_url: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: CloudUser;
}

interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: CloudUser;
}

export const cloudUserStore = writable<CloudUser | null>(null);

export const cloudAuthService = {
  /**
   * Ensures we have a reserved client_id. Calls reserve endpoint if not stored.
   * Returns { client_id, redirect_uri } for use in login, refresh, Discord OAuth.
   */
  async ensureClientId(): Promise<{ client_id: string; redirect_uri: string }> {
    const stored = await invoke<{ client_id: string; redirect_uri: string } | null>('get_reserved_client');
    if (stored?.client_id) {
      return { client_id: stored.client_id, redirect_uri: stored.redirect_uri };
    }

    const res = await fetch(`${API_URL}/api/desqta/client/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_uri: DESQTA_REDIRECT_URI }),
    });
    if (!res.ok) throw new Error('Failed to reserve client');
    const data = (await res.json()) as ReservedClientResult;

    await invoke('save_reserved_client', {
      clientId: data.client_id,
      redirectUri: data.redirect_uri,
    });
    return { client_id: data.client_id, redirect_uri: data.redirect_uri };
  },

  /**
   * Clears the stored reserved client (e.g. when expired). Next ensureClientId() will reserve a new one.
   */
  async clearReservedClient(): Promise<void> {
    await invoke('clear_reserved_client');
  },

  /**
   * Fetches config from the DesQTA config endpoint (optional, for dynamic URLs).
   * Retries with a fresh client_id if the stored one has expired.
   */
  async getConfig(): Promise<DesqtaConfig> {
    const { client_id } = await this.ensureClientId();
    const res = await fetch(`${API_URL}/api/desqta/config?client_id=${client_id}`);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = (errBody as { error?: string }).error ?? 'Failed to fetch config';
      if (isClientIdExpired(res.status, errMsg)) {
        await this.clearReservedClient();
        const { client_id: newId } = await this.ensureClientId();
        const retryRes = await fetch(`${API_URL}/api/desqta/config?client_id=${newId}`);
        if (!retryRes.ok) throw new Error('Failed to fetch config');
        return retryRes.json();
      }
      throw new Error(errMsg);
    }
    return res.json();
  },

  /**
   * Logs in the user via email/password using the DesQTA auth endpoint.
   * Returns access_token, refresh_token, and user for persistent sessions.
   * Retries with a fresh client_id if the stored one has expired.
   */
  async login(login: string, password: string) {
    const deviceName = await getDeviceName();

    const doLogin = async (clientId: string, redirectUri: string) => {
      const response = await fetch(`${API_URL}/api/desqta/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          login,
          password,
          device_name: deviceName,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errMsg = (err as { error?: string }).error || 'Login failed';
        return { ok: false as const, status: response.status, errMsg };
      }
      const data = (await response.json()) as LoginResponse;
      return { ok: true as const, data };
    };

    const { client_id, redirect_uri } = await this.ensureClientId();
    let result = await doLogin(client_id, redirect_uri);

    if (!result.ok && isClientIdExpired(result.status, result.errMsg)) {
      await this.clearReservedClient();
      const { client_id: newId, redirect_uri: newUri } = await this.ensureClientId();
      result = await doLogin(newId, newUri);
    }

    if (!result.ok) {
      throw new Error(result.errMsg);
    }

    const data = result.data;
    const user = await invoke<CloudUser>('save_cloud_token', {
      token: data.access_token,
      refreshToken: data.refresh_token ?? null,
      userJson: data.user ? JSON.stringify(normalizeUserForBackend(data.user)) : null,
    });

    cloudUserStore.set(user);
    return { ...data, user };
  },

  /**
   * Registers a new user.
   */
  async register(email: string, password: string, username: string, displayName: string) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, displayName }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Registration failed');
    }

    return await response.json();
  },

  /**
   * Logs out the user from the current profile.
   */
  async logout() {
    await invoke('clear_cloud_token');
    cloudUserStore.set(null);
  },

  /**
   * Clears tokens after accounts rejected them (401 / refresh failed).
   * Keeps `previously_signed_into_cloud` so `checkCloudSignOutAlert` can show the re-sign-in toast.
   */
  async invalidateCloudSessionAfterAuthError(): Promise<void> {
    try {
      await invoke('clear_expired_cloud_session');
    } catch {
      /* ignore disk errors */
    }
    cloudUserStore.set(null);
    await checkCloudSignOutAlert();
  },

  /**
   * Gets the stored access token for the current profile.
   */
  async getToken(): Promise<string | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.token;
  },

  /**
   * Gets the stored refresh token for the current profile.
   */
  async getRefreshToken(): Promise<string | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.refresh_token ?? null;
  },

  /**
   * Gets the stored user info for the current profile.
   */
  async getUser(): Promise<CloudUser | null> {
    const result = await invoke<CloudUserWithToken>('get_cloud_user');
    return result.user;
  },

  /**
   * Initializes the store from the current profile's cloud token.
   */
  async init(): Promise<CloudUser | null> {
    const user = await this.getUser();
    cloudUserStore.set(user);
    return user;
  },

  /**
   * Refreshes the access token using the refresh token (rolling sessions).
   * Reserved client state is only bootstrap metadata and must not be treated as
   * the authority for an existing durable BetterSEQTA Cloud session.
   */
  async refresh(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      await this.invalidateCloudSessionAfterAuthError();
      throw new Error('No refresh token');
    }

    const doRefresh = async (clientId?: string | null) => {
      const body: Record<string, string> = {
        refresh_token: refreshToken,
      };

      if (clientId) {
        body.client_id = clientId;
      }

      const res = await fetch(`${API_URL}/api/desqta/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = (err as { error?: string }).error || 'Refresh failed';
        return { ok: false as const, status: res.status, errMsg };
      }
      const data = (await res.json()) as RefreshResponse;
      return { ok: true as const, data };
    };

    const reservedClient = await invoke<{ client_id: string; redirect_uri: string } | null>('get_reserved_client').catch(
      () => null,
    );

    let result = await doRefresh(reservedClient?.client_id ?? null);

    if (!result.ok && isClientIdExpired(result.status, result.errMsg)) {
      await this.clearReservedClient();
      result = await doRefresh(null);
    }

    if (!result.ok && isUnauthorized(result.status)) {
      await this.invalidateCloudSessionAfterAuthError();
      throw new Error(result.errMsg);
    }

    if (!result.ok) {
      throw new Error(result.errMsg);
    }

    const data = result.data;
    const user = await invoke<CloudUser>('save_cloud_token', {
      token: data.access_token,
      refreshToken: data.refresh_token ?? null,
      userJson: data.user ? JSON.stringify(normalizeUserForBackend(data.user)) : null,
    });

    cloudUserStore.set(user);
    return data.access_token;
  },

  /**
   * Fetches the latest user profile from the server and updates the current profile.
   * If the access token expired, silently refreshes once before failing.
   */
  async getProfile(): Promise<CloudUser> {
    let token = await this.getToken();
    if (!token) {
      token = await this.refresh();
    }

    const doRequest = async (accessToken: string) =>
      fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

    let response = await doRequest(token);

    if (response.status === 401) {
      token = await this.refresh();
      response = await doRequest(token);
    }

    if (response.status === 401) {
      await this.invalidateCloudSessionAfterAuthError();
      throw new Error('Failed to fetch profile');
    }

    if (!response.ok) throw new Error('Failed to fetch profile');
    const data = (await response.json()) as CloudUser;

    // Update backend (profile-specific) with latest user data while preserving refresh state.
    await invoke<CloudUser>('save_cloud_token', {
      token,
      refreshToken: await this.getRefreshToken(),
      userJson: data ? JSON.stringify(normalizeUserForBackend(data)) : null,
    });

    cloudUserStore.set(data);
    return data;
  },

  /**
   * Initiates Discord OAuth flow for DesQTA.
   * Opens the user's browser to authenticate with Discord.
   * Validates client_id first (refreshes if expired) since we don't get a response from opening the URL.
   */
  async loginWithDiscord() {
    await this.getConfig();
    const { client_id, redirect_uri } = await this.ensureClientId();
    const authUrl = new URL(`${API_URL}/api/oauth/desqta/discord`);
    authUrl.searchParams.set('client_id', client_id);
    authUrl.searchParams.set('redirect_uri', redirect_uri);

    await openUrl(authUrl.toString());
  },

  /**
   * Handles the Discord OAuth callback.
   * Stores both access token and refresh_token when provided (rolling sessions).
   */
  async handleDiscordCallback(token: string, userId: string, refreshToken?: string | null) {
    const user = await this.getProfileWithToken(token);
    await invoke<CloudUser>('save_cloud_token', {
      token,
      refreshToken: refreshToken ?? null,
      userJson: user ? JSON.stringify(normalizeUserForBackend(user)) : null,
    });

    cloudUserStore.set(user);
    return user;
  },

  /**
   * Fetches user profile using a specific token (e.g. from OAuth callback).
   */
  async getProfileWithToken(token: string): Promise<CloudUser> {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch profile');
    return response.json();
  },
};

/**
 * Normalizes user object for backend (Rust expects displayName -> display_name, etc).
 */
function normalizeUserForBackend(user: CloudUser): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    pfpUrl: user.pfpUrl ?? null,
    is_admin: user.is_admin ?? null,
  };
}
