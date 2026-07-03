export const SESSION_INVALID_EVENT = 'desqta-session-invalid';

/** True when a backend/network error indicates the SEQTA session is no longer valid. */
export function isSessionAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('please log in') ||
    m.includes('no active session') ||
    m.includes('session expired or cleared') ||
    m.includes('authentication failed') ||
    m.includes('"status":"401"') ||
    m.includes('"status":401') ||
    m.includes('unauthorized')
  );
}

/** Notify the app shell to clear the session and show the login screen. */
export function dispatchSessionInvalid(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_INVALID_EVENT));
}
