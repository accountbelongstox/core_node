import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { HARDCODED_PASSWORD, PASSWORD_PARAM_NAME } from '../services/passwordService';

/**
 * React Hook to automatically add password parameter to all routes
 * Uses React Router's official useSearchParams hook (BrowserRouter)
 * 
 * React Router Official Approach:
 * - Use BrowserRouter instead of HashRouter
 * - Use useSearchParams hook to access query parameters
 * - location.search contains query parameters (?pp=xxx)
 * 
 * Usage:
 *   Add this hook to your root router component
 *   It will automatically add ?pp=BuildFactoryEncryptionKey2025 to all routes
 */
export function useAutoPassword(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Use React's useRef to track if we're currently updating the URL
  // This prevents infinite loops when navigate triggers location changes
  const isUpdatingRef = useRef(false);
  const lastCheckedPathRef = useRef<string>('');

  // Use React's useEffect to check and add password parameter
  useEffect(() => {
    // Skip if we're currently updating (prevents infinite loop)
    if (isUpdatingRef.current) {
      return;
    }

    // Get current path and search (BrowserRouter format: /path?existing=params)
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const currentPathWithSearch = `${currentPath}${currentSearch}`;
    
    // Skip if we already checked this exact path (prevents unnecessary re-checks)
    if (currentPathWithSearch === lastCheckedPathRef.current) {
      return;
    }
    
    lastCheckedPathRef.current = currentPathWithSearch;

    // Check if password parameter already exists in URL (BrowserRouter format: /path?pp=xxx)
    const currentPassword = searchParams.get(PASSWORD_PARAM_NAME);
    
    // If password is missing or different, add it
    if (currentPassword !== HARDCODED_PASSWORD) {
      // Set flag to prevent re-entry during navigation
      isUpdatingRef.current = true;
      
      // Create new searchParams with password parameter
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set(PASSWORD_PARAM_NAME, HARDCODED_PASSWORD);
      
      // Use React Router's official setSearchParams to update URL
      // This is the recommended way in React Router v6
      setSearchParams(newSearchParams, { replace: true });
      
      // Reset flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false;
        lastCheckedPathRef.current = `${location.pathname}?${newSearchParams.toString()}`;
      }, 50);
    } else {
      // Password is correct, ensure flag is reset
      isUpdatingRef.current = false;
    }
  }, [location.pathname, location.search, searchParams, setSearchParams]); // React Router will trigger when route changes
}

