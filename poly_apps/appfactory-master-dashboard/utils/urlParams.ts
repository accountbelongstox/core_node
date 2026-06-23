/**
 * URL Parameters Utility Library
 * 
 * React Router HashRouter Support:
 * HashRouter stores query parameters in the hash portion (#/path?param=value), not in search
 * This utility provides consistent parameter extraction for HashRouter
 * 
 * React Official Approach:
 * - Use location.hash from useLocation hook to get full hash including query params
 * - Parse query string from hash using URLSearchParams (browser native API)
 */

/**
 * Extract query string from HashRouter's hash
 * HashRouter format: #/path?param1=value1&param2=value2
 */
function extractQueryStringFromHash(hash?: string): string {
  const hashToUse = hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  const hashParts = hashToUse.split('?');
  return hashParts.length > 1 ? hashParts[1] : '';
}

/**
 * Extract path portion from HashRouter's hash
 * HashRouter format: #/path?param1=value1&param2=value2
 */
export function extractPathFromHash(): string {
  const hashParts = window.location.hash.split('?');
  return hashParts[0] ?? '';
}

/**
 * Get URL parameter (supports HashRouter)
 * @param paramName Parameter name
 * @param defaultValue Default value if parameter doesn't exist
 * @param hash Optional hash string (defaults to window.location.hash)
 * @returns Parameter value or default value
 */
export function getUrlParam(paramName: string, defaultValue: string = '', hash?: string): string {
  const queryString = extractQueryStringFromHash(hash);
  const urlParams = new URLSearchParams(queryString);
  const value = urlParams.get(paramName);
  return value ?? defaultValue;
}

/**
 * Get URL parameter (supports HashRouter), returns null if not found
 * @param paramName Parameter name
 * @param hash Optional hash string (defaults to window.location.hash)
 * @returns Parameter value or null
 */
export function getUrlParamOrNull(paramName: string, hash?: string): string | null {
  const queryString = extractQueryStringFromHash(hash);
  const urlParams = new URLSearchParams(queryString);
  return urlParams.get(paramName);
}

/**
 * Get all URL parameters (supports HashRouter)
 * @param hash Optional hash string (defaults to window.location.hash)
 * @returns Parameter object
 */
export function getAllUrlParams(hash?: string): Record<string, string> {
  const queryString = extractQueryStringFromHash(hash);
  const urlParams = new URLSearchParams(queryString);
  const params: Record<string, string> = {};
  
  urlParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return params;
}

/**
 * Check if specified parameter exists in URL
 * @param paramName Parameter name
 * @param hash Optional hash string (defaults to window.location.hash)
 * @returns Whether parameter exists
 */
export function hasUrlParam(paramName: string, hash?: string): boolean {
  const queryString = extractQueryStringFromHash(hash);
  const urlParams = new URLSearchParams(queryString);
  return urlParams.has(paramName);
}

