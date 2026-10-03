import { authNamespaceOf } from './AuthSession';

export const AUTH_LOGIN_REQUEST_EVENT = 'app-auth:login-request';
export const AUTH_LOGIN_DISMISS_EVENT = 'app-auth:login-dismiss';
export const AUTH_LOGIN_SUCCESS_EVENT = 'app-auth:login-success';
export const AUTH_SESSION_CHANGED_EVENT = 'UnifiedUser-session-changed';
const AUTH_LOGIN_REQUEST_COOLDOWN_MS = 1000;

const lastAuthLoginRequestAt = new Map<string, number>();

export interface AuthLoginRequestContext {
  source?: string;
  reason?: string;
  /** Laravel API the login is for (default: the active one); its namespace is the session key. */
  baseUrl?: string;
}

export interface AuthLoginRequestDetail extends AuthLoginRequestContext {
  requestedAt: number;
}

export interface AuthLoginSuccessDetail {
  user: unknown;
  request: AuthLoginRequestDetail | null;
  /** Namespace of the Laravel API that was logged in to. */
  namespace?: string;
}

/** Ask the application shell to open its shared login window. */
export function requestAuthLogin(context: AuthLoginRequestContext = {}): void {
  const requestedAt = Date.now();
  if (typeof window === 'undefined') return;
  const cooldownKey = context.baseUrl ? authNamespaceOf(context.baseUrl) : '';
  if (requestedAt - (lastAuthLoginRequestAt.get(cooldownKey) ?? 0) < AUTH_LOGIN_REQUEST_COOLDOWN_MS) return;
  lastAuthLoginRequestAt.set(cooldownKey, requestedAt);
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

/** Close the shared login window when authentication is no longer required. */
export function dismissAuthLogin(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_LOGIN_DISMISS_EVENT));
}

export function subscribeAuthLoginDismiss(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(AUTH_LOGIN_DISMISS_EVENT, listener);
  return () => window.removeEventListener(AUTH_LOGIN_DISMISS_EVENT, listener);
}

/** Publish a successful shared login so every mounted application can refresh. */
export function notifyAuthLoginSuccess(
  user: unknown,
  request: AuthLoginRequestDetail | null,
  namespace?: string,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AuthLoginSuccessDetail>(AUTH_LOGIN_SUCCESS_EVENT, {
    detail: { user, request, namespace },
  }));
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
}

export function subscribeAuthLoginSuccess(
  listener: (detail: AuthLoginSuccessDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handleSuccess = (event: Event): void => {
    listener((event as CustomEvent<AuthLoginSuccessDetail>).detail);
  };
  window.addEventListener(AUTH_LOGIN_SUCCESS_EVENT, handleSuccess);
  return () => window.removeEventListener(AUTH_LOGIN_SUCCESS_EVENT, handleSuccess);
}
