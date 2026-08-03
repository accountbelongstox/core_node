export const AUTH_LOGIN_REQUEST_EVENT = 'laravel-manager:login-request';
const AUTH_LOGIN_REQUEST_COOLDOWN_MS = 1000;

let lastAuthLoginRequestAt = 0;

export interface AuthLoginRequestContext {
  source?: string;
  reason?: string;
}

export interface AuthLoginRequestDetail extends AuthLoginRequestContext {
  requestedAt: number;
}

/** Ask the application shell to open its shared login window. */
export function requestAuthLogin(context: AuthLoginRequestContext = {}): void {
  const requestedAt = Date.now();
  if (typeof window === 'undefined') return;
  if (requestedAt - lastAuthLoginRequestAt < AUTH_LOGIN_REQUEST_COOLDOWN_MS) return;
  lastAuthLoginRequestAt = requestedAt;
  window.dispatchEvent(new CustomEvent<AuthLoginRequestDetail>(AUTH_LOGIN_REQUEST_EVENT, {
    detail: { ...context, requestedAt },
  }));
}

/** Subscribe once at the application shell that owns the shared login window. */
export function subscribeAuthLoginRequest(
  listener: (detail: AuthLoginRequestDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handleRequest = (event: Event): void => {
    listener((event as CustomEvent<AuthLoginRequestDetail>).detail);
  };
  window.addEventListener(AUTH_LOGIN_REQUEST_EVENT, handleRequest);
  return () => window.removeEventListener(AUTH_LOGIN_REQUEST_EVENT, handleRequest);
}
