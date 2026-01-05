/**
 * Password Utility Functions
 * 
 * Common utilities for extracting password from URL parameters
 * Supports both BrowserRouter (location.search) and HashRouter (location.hash)
 * 
 * Priority: pp > pwd > password
 */

/**
 * Extract password from URL search parameters
 * Supports BrowserRouter (location.search) and HashRouter (location.hash)
 * 
 * @param searchParams - URLSearchParams object or search string
 * @returns Password string or empty string
 */
export function extractPasswordFromURL(searchParams?: URLSearchParams | string): string {
  let params: URLSearchParams;
  
  if (typeof searchParams === 'string') {
    // If string, try to parse as search string
    if (searchParams.startsWith('?')) {
      params = new URLSearchParams(searchParams);
    } else if (searchParams.includes('?')) {
      // Extract query string from hash (e.g., "#/path?pp=xxx")
      const queryString = searchParams.split('?')[1] || '';
      params = new URLSearchParams(queryString);
    } else {
      // Treat as query string without ?
      params = new URLSearchParams(searchParams);
    }
  } else if (searchParams instanceof URLSearchParams) {
    params = searchParams;
  } else {
    // No params provided, try to get from window.location
    if (typeof window === 'undefined') {
      return '';
    }
    
    // Try BrowserRouter first (location.search)
    const search = window.location.search;
    if (search) {
      params = new URLSearchParams(search);
      const password = params.get('pp') || params.get('pwd') || params.get('password') || '';
      if (password) {
        return password;
      }
    }
    
    // Fallback to HashRouter (location.hash)
    const hash = window.location.hash;
    if (hash && hash.includes('?')) {
      const queryString = hash.split('?')[1] || '';
      params = new URLSearchParams(queryString);
    } else {
      return '';
    }
  }
  
  // Extract password with priority: pp > pwd > password
  return params.get('pp') || 
         params.get('pwd') || 
         params.get('password') || 
         '';
}

/**
 * Get password from current window location
 * Automatically detects BrowserRouter (search) or HashRouter (hash)
 * 
 * @returns Password string or empty string
 */
export function getPasswordFromWindowLocation(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  
  return extractPasswordFromURL();
}

