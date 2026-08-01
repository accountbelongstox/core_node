export const GLOBAL_LOGIN_REQUEST_EVENT = 'laravel-manager:login-request';
const LOGIN_REQUEST_COOLDOWN_MS = 1000;
let lastLoginRequestAt = 0;

export function requestGlobalLogin(): void {
  const now = Date.now();
  if (typeof window === 'undefined') return;
  if (now - lastLoginRequestAt < LOGIN_REQUEST_COOLDOWN_MS) return;
  lastLoginRequestAt = now;
  window.dispatchEvent(new CustomEvent(GLOBAL_LOGIN_REQUEST_EVENT));
}

export function subscribeGlobalLoginRequest(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(GLOBAL_LOGIN_REQUEST_EVENT, listener);
  return () => window.removeEventListener(GLOBAL_LOGIN_REQUEST_EVENT, listener);
}
