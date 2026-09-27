import { getAuthToken, setAuthToken } from '../../../core/auth/AuthSession';
import { StorageManager } from '../../../core/persistence';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE, CM_ROUTE_BASE } from '../components/public-home/cmPublicRoutes';

const RETURN_PATH_KEY = 'codemart_auth_return_path';
const SESSION_EXPIRED_KEY = 'codemart_auth_session_expired';
const REDIRECT_PARAM = 'redirect';
const ADMIN_HOME = '/codemart/admin';
const AUTH_ENTRY_PATHS: readonly string[] = [
  CM_PUBLIC_ROUTE.login,
  CM_PUBLIC_ROUTE.register,
  CM_PUBLIC_ROUTE.forgotPassword,
  CM_PUBLIC_ROUTE.passwordReset,
];

export const CM_LOGIN_REDIRECT_PARAM = REDIRECT_PARAM;

/** A same-app CodeMart path that is safe to return to after sign-in, or null. */
export function cmSafeReturnPath(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith(CM_ROUTE_BASE) || candidate.startsWith('//')) return null;
  const path = candidate.split(/[?#]/)[0].replace(/\/+$/, '');
  if (path !== CM_ROUTE_BASE && !path.startsWith(`${CM_ROUTE_BASE}/`)) return null;
  if (AUTH_ENTRY_PATHS.some((entry) => path === entry || path.startsWith(`${entry}/`))) return null;
  return candidate;
}

export function cmRememberReturnPath(path: string | null): void {
  const safe = cmSafeReturnPath(path);
  if (safe) StorageManager.setSession(RETURN_PATH_KEY, safe);
  else StorageManager.removeSession(RETURN_PATH_KEY);
}

export function cmStoredReturnPath(): string | null {
  return cmSafeReturnPath(StorageManager.getSession<string | null>(RETURN_PATH_KEY, null));
}

export function cmClearReturnPath(): void {
  StorageManager.removeSession(RETURN_PATH_KEY);
}

/** Sign-in URL carrying the return path; the path is also kept for this tab. */
export function cmLoginHref(returnPath: string | null = null): string {
  const safe = cmSafeReturnPath(returnPath);
  if (safe) cmRememberReturnPath(safe);
  return safe ? `${CM_PUBLIC_ROUTE.login}?${REDIRECT_PARAM}=${encodeURIComponent(safe)}` : CM_PUBLIC_ROUTE.login;
}

export function cmDefaultLandingPath(isAdmin: boolean): string {
  return isAdmin ? ADMIN_HOME : CM_PROTECTED_ROUTE.dashboard;
}

export function cmSessionExpired(): boolean {
  return StorageManager.getSession<boolean>(SESSION_EXPIRED_KEY, false) === true;
}

export function cmClearSessionExpired(): void {
  StorageManager.removeSession(SESSION_EXPIRED_KEY);
}

/**
 * 401 from the CodeMart API: drop the stale bearer token and keep the current
 * path; the access gate then sends the visitor to the CodeMart sign-in page.
 */
export function cmHandleUnauthorized(): void {
  if (typeof window === 'undefined' || !getAuthToken()) return;
  const { pathname, search, hash } = window.location;
  cmRememberReturnPath(`${pathname}${search}${hash}`);
  StorageManager.setSession(SESSION_EXPIRED_KEY, true);
  setAuthToken(null);
}
