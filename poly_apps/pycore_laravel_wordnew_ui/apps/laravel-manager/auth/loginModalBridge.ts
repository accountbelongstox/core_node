export const GLOBAL_LOGIN_REQUEST_EVENT = 'laravel-manager:login-request';

export function requestGlobalLogin(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GLOBAL_LOGIN_REQUEST_EVENT));
}

export function subscribeGlobalLoginRequest(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(GLOBAL_LOGIN_REQUEST_EVENT, listener);
  return () => window.removeEventListener(GLOBAL_LOGIN_REQUEST_EVENT, listener);
}
