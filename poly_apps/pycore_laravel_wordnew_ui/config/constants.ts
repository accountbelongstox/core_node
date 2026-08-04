/**
 * Application Constants
 *
 * The SINGLE place for frontend configuration. All values are FIXED constants
 * written here in code. Runtime config that the host (pycore) controls, such as
 * language, is passed to the app via URL parameters instead.
 */

/**
 * Default API port for the Laravel backend (Octane). Fixed.
 */
export const DEFAULT_API_PORT = 9000;

/**
 * Frontend (Vite) dev-server port. Fixed; pyservice may override only via the
 * Vite `--port` CLI flag.
 */
export const DEFAULT_FRONTEND_PORT = 13054;

/** Unified UI build configuration. Runtime settings come from persisted user data. */
export const FRONTEND_BUILD_TARGET: string = 'web';
export const FRONTEND_APP_FLAVOR: string = 'shell';

/**
 * Default API timeout in milliseconds
 */
export const DEFAULT_API_TIMEOUT = 30000;

/**
 * Get default base URL for API.
 *
 * Derived purely at runtime — NO environment variables. The API runs on a fixed
 * port (9000), so we take the current origin's host/protocol and pin the port.
 * Priority:
 * 1. Current hostname with the fixed API port
 * 2. localhost with the fixed API port (non-browser fallback)
 */
export const getDefaultBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://localhost:${DEFAULT_API_PORT}`;
};

/**
 * Resolve a backend MEDIA URL to an absolute, fetchable URL.
 *
 * The API is CROSS-ORIGIN: the page is served on the frontend port (13054) but
 * the backend (audio / static images) lives on the API port (9000, see
 * getDefaultBaseURL). A relative path like `/api/app_qy_v1/.../audio` or
 * `/static/...` used in `new Audio(...)` / `<img src>` would otherwise resolve
 * against the PAGE origin and 404. This rebases relative paths onto the API
 * origin while leaving already-absolute URLs (external Bing images, `//cdn`,
 * `http(s)://`, `data:`/`blob:`) untouched.
 */
export const mediaUrl = (u?: string | null): string => {
  if (!u) return u ?? '';
  if (/^(https?:)?\/\//i.test(u) || /^(data|blob):/i.test(u)) return u; // absolute → as-is
  if (u.startsWith('/')) return getDefaultBaseURL() + u;                 // root-relative → API origin
  return u;                                                             // anything else → leave as-is
};

/**
 * Get current origin URL (frontend URL)
 */
export const getOriginUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return `http://localhost:${DEFAULT_FRONTEND_PORT}`;
};

