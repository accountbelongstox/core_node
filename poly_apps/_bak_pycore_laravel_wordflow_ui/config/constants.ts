/**
 * Application Constants
 *
 * The SINGLE place for frontend configuration. All values are FIXED constants
 * written here in code — the frontend never reads environment variables
 * (no `import.meta.env` / `process.env`). Runtime config that the host (pycore)
 * controls, such as language, is passed to the app via URL parameters instead.
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

/**
 * pycore RPC backend port (the `/pyapi` dev reverse-proxy target). Fixed.
 */
export const PYCORE_RPC_PORT = 59000;

/**
 * pycore backend base URL used by the dev `/pyapi` reverse proxy.
 */
export const PYCORE_DEV_PROXY_TARGET = `http://localhost:${PYCORE_RPC_PORT}`;

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
 * Get current origin URL (frontend URL)
 */
export const getOriginUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return `http://localhost:${DEFAULT_FRONTEND_PORT}`;
};

