import { authService, type UserInfo } from './authService';
import { logger } from '../../utils/logger';
import { seqtaFetch } from '../../utils/netUtil';
import { isSessionAuthError } from '$lib/utils/sessionAuth';

export type SeqtaSessionValidation = 'valid' | 'invalid' | 'unknown';

/**
 * Verify the saved session is accepted by SEQTA (not just present on disk).
 * Returns `unknown` on network/ambiguous errors so offline cached use can continue.
 */
export async function validateSeqtaSession(seqtaUrl = ''): Promise<SeqtaSessionValidation> {
  try {
    const response = await seqtaFetch('/seqta/student/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { mode: 'normal', query: null, redirect_url: seqtaUrl },
    });

    const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
    if (responseStr.includes('site.name.abbrev')) {
      return 'valid';
    }

    const isAuthFailure =
      responseStr.includes('"status":"401"') ||
      responseStr.includes('"status": "401"') ||
      responseStr.includes('unauthorized') ||
      responseStr.toLowerCase().includes('authentication failed');

    return isAuthFailure ? 'invalid' : 'unknown';
  } catch (error) {
    const message = typeof error === 'string' ? error : ((error as Error)?.message ?? '');
    if (isSessionAuthError(message)) {
      return 'invalid';
    }
    return 'unknown';
  }
}

export interface LayoutAuthCheckSessionOptions {
  devMockEnabled: boolean;
  needsSetupSet: (value: boolean) => void;
  loadUserInfo: () => Promise<void>;
  loadSeqtaConfigAndMenu: () => Promise<void>;
}

/**
 * Check if a session exists and load user data if authenticated.
 */
export async function checkSession(options: LayoutAuthCheckSessionOptions): Promise<void> {
  const { devMockEnabled, needsSetupSet, loadUserInfo, loadSeqtaConfigAndMenu } = options;
  logger.logFunctionEntry('layoutAuth', 'checkSession');

  try {
    if (devMockEnabled) {
      needsSetupSet(false);
      logger.info('layoutAuth', 'checkSession', 'Dev mock enabled; bypassing login');
      await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      logger.logFunctionExit('layoutAuth', 'checkSession', { sessionExists: true });
      return;
    }

    const sessionExists = await authService.checkSession();
    logger.info('layoutAuth', 'checkSession', `Session exists: ${sessionExists}`, {
      sessionExists,
    });

    if (!sessionExists) {
      needsSetupSet(true);
      logger.logFunctionExit('layoutAuth', 'checkSession', { sessionExists: false });
      return;
    }

    const validation = await validateSeqtaSession();
    if (validation === 'invalid') {
      logger.warn('layoutAuth', 'checkSession', 'Saved session rejected by SEQTA, redirecting to login');
      await invalidateSession({ onSessionInvalid: () => needsSetupSet(true) });
      logger.logFunctionExit('layoutAuth', 'checkSession', { sessionExists: false, invalidated: true });
      return;
    }

    needsSetupSet(false);
    await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
    logger.logFunctionExit('layoutAuth', 'checkSession', { sessionExists: true, validation });
  } catch (error) {
    logger.error('layoutAuth', 'checkSession', `Failed to check session: ${error}`, { error });
  }
}

export interface LayoutAuthLoadUserInfoOptions {
  loadSettings: (keys: string[]) => Promise<Record<string, unknown>>;
  onDisableSchoolPicture: (value: boolean) => void;
  onUserInfo: (info: UserInfo | undefined) => void;
  /** When true, skip stale-session invalidation (dev mock mode). */
  devMockEnabled?: boolean;
  /** Called when session cookies exist but SEQTA rejects auth — redirect to login. */
  onSessionInvalid?: () => void;
}

/**
 * Load user info and sync disable_school_picture setting.
 */
export async function loadUserInfo(options: LayoutAuthLoadUserInfoOptions): Promise<void> {
  const { loadSettings, onDisableSchoolPicture, onUserInfo, devMockEnabled, onSessionInvalid } =
    options;

  const settings = await loadSettings(['disable_school_picture']);
  const disableSchoolPicture = settings.disable_school_picture === true;
  onDisableSchoolPicture(disableSchoolPicture);

  const info = await authService.loadUserInfo({ disableSchoolPicture });
  onUserInfo(info);

  // Session file may still exist while SEQTA has expired the session — send user to login.
  if (!devMockEnabled && !info) {
    try {
      const sessionExists = await authService.checkSession();
      if (sessionExists) {
        logger.warn('layoutAuth', 'loadUserInfo', 'Stale session detected, redirecting to login');
        await invalidateSession({ onSessionInvalid: onSessionInvalid ?? (() => {}) });
      } else if (onSessionInvalid) {
        logger.warn(
          'layoutAuth',
          'loadUserInfo',
          'User info unavailable with no session, redirecting to login',
        );
        onSessionInvalid();
      }
    } catch (error) {
      logger.error('layoutAuth', 'loadUserInfo', `Stale session check failed: ${error}`, { error });
    }
  }
}

export interface LayoutAuthInvalidateSessionOptions {
  onSessionInvalid: () => void;
  onClearUser?: () => void;
  onCloseDropdown?: () => void;
}

/**
 * Clear an expired/invalid SEQTA session and show the login screen.
 */
export async function invalidateSession(options: LayoutAuthInvalidateSessionOptions): Promise<void> {
  const { onSessionInvalid, onClearUser, onCloseDropdown } = options;
  logger.logFunctionEntry('layoutAuth', 'invalidateSession');

  try {
    await authService.logout();
  } catch (error) {
    logger.warn('layoutAuth', 'invalidateSession', `Logout during invalidation failed: ${error}`, {
      error,
    });
  }

  onClearUser?.();
  onCloseDropdown?.();
  onSessionInvalid();
  logger.logFunctionExit('layoutAuth', 'invalidateSession');
}

export interface LayoutAuthHandleLogoutOptions {
  onClearUser: () => void;
  onCloseDropdown: () => void;
  checkSession: () => Promise<void>;
}

/**
 * Log out the user and reset layout state.
 */
export async function handleLogout(options: LayoutAuthHandleLogoutOptions): Promise<void> {
  const { onClearUser, onCloseDropdown, checkSession } = options;

  const success = await authService.logout();
  if (success) {
    onClearUser();
    onCloseDropdown();
    await checkSession();
  }
}

export interface LayoutAuthStartLoginOptions {
  seqtaUrl: string;
  needsSetupSet: (value: boolean) => void;
  loadUserInfo: () => Promise<void>;
  loadSeqtaConfigAndMenu: () => Promise<void>;
}

/**
 * Start the login flow and poll for session creation.
 */
export async function startLogin(options: LayoutAuthStartLoginOptions): Promise<void> {
  const { seqtaUrl, needsSetupSet, loadUserInfo, loadSeqtaConfigAndMenu } = options;

  if (!seqtaUrl) {
    logger.error('layoutAuth', 'startLogin', 'No valid SEQTA URL found');
    return;
  }

  logger.info('layoutAuth', 'startLogin', 'Starting authentication', { url: seqtaUrl });
  await authService.startLogin(seqtaUrl);

  const timer = setInterval(async () => {
    const sessionExists = await authService.checkSession();
    if (sessionExists) {
      clearInterval(timer);
      needsSetupSet(false);
      await Promise.all([loadUserInfo(), loadSeqtaConfigAndMenu()]);
      const { triggerBackgroundSync } = await import('$lib/services/startupService');
      triggerBackgroundSync();
    }
  }, 1000);

  setTimeout(() => clearInterval(timer), 5 * 60 * 1000);
}
