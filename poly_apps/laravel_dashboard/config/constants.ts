/**
 * Application Constants
 * Centralized configuration constants to avoid duplication
 */

/**
 * Default API port for Laravel backend
 */
export const DEFAULT_API_PORT = 9000;

/**
 * Default frontend port (for Vite dev server)
 */
export const DEFAULT_FRONTEND_PORT = 8000;

/**
 * Default API timeout in milliseconds
 */
export const DEFAULT_API_TIMEOUT = 30000;

/**
 * Get default base URL for API
 * Priority:
 * 1. VITE_API_BASE_URL environment variable
 * 2. Current hostname with default API port
 * 3. localhost with default API port
 */
export const getDefaultBaseURL = (): string => {
  const envBaseURL = import.meta.env.VITE_API_BASE_URL;
  if (envBaseURL) {
    return envBaseURL;
  }

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

