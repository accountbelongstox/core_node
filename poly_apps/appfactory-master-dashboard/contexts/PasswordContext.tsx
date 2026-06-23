import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { encryptedImageService } from '../services/encryptedImageService';
import { extractPasswordFromURL, getPasswordFromWindowLocation } from '../utils/passwordUtils';

/**
 * Password Context - React Context for managing decryption password
 * 
 * Architecture Design (React Router Official Best Practices):
 * 
 * Solution: Use BrowserRouter + useSearchParams hook (React Router v6 official way)
 * - BrowserRouter: Uses HTML5 History API, cleaner URLs without #
 * - useSearchParams: Official React Router hook for query parameters
 * - location.search: Contains query parameters (?pp=xxx) in BrowserRouter
 * 
 * React Official Approach:
 * 1. Use BrowserRouter instead of HashRouter (recommended by React Router)
 * 2. Use useSearchParams hook to get query parameters (official way)
 * 3. Extract password from searchParams (pp, pwd, or password)
 * 4. Update password state when searchParams change (with debounce)
 * 5. Sync password to encryptedImageService
 * 
 * Debounce Strategy:
 * - When password changes from non-empty to empty, wait before updating
 * - This prevents temporary empty states during URL transitions
 * - Only update to empty if it remains empty after debounce delay
 * 
 * Layered Loading Flow:
 * URL changes (/apps?pp=xxx or navigate())
 *   → React Router updates location.search
 *   → useSearchParams hook detects change
 *   → PasswordContext extracts password from searchParams (with debounce)
 *   → PasswordContext updates password state
 *   → encryptedImageService.setPassword() → clears cache
 *   → component useEffect([password]) detects change → reloads images
 * 
 * Benefits of BrowserRouter:
 * - Clean URLs: /apps?pp=xxx instead of /#/apps?pp=xxx
 * - Official support: useSearchParams hook works correctly
 * - Better SEO: Search engines can index routes
 * - Standard approach: Most React apps use BrowserRouter
 */ 

interface PasswordContextType {
  password: string;
}

export const PasswordContext = createContext<PasswordContextType>({ password: '' });

// Debounce delay for password updates (milliseconds)
const PASSWORD_DEBOUNCE_DELAY = 150;

export const PasswordProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use React Router's official useSearchParams hook
  // This is the recommended way to access query parameters in React Router v6
  const [searchParams] = useSearchParams();
  
  // Extract password from searchParams (supports pp, pwd, password)
  // Use common utility function for consistency
  const extractPassword = (params: URLSearchParams): string => {
    return extractPasswordFromURL(params);
  };
  
  // Initialize password from URL on mount
  // Use window.location as fallback to ensure we get password even if useSearchParams hasn't initialized yet
  const [password, setPassword] = useState<string>(() => {
    // First try from searchParams (React Router)
    const fromSearchParams = extractPassword(searchParams);
    if (fromSearchParams) {
      return fromSearchParams;
    }
    // Fallback to window.location (works on initial page load/refresh)
    return getPasswordFromWindowLocation();
  });
  
  // Initialize lastSyncedPasswordRef to empty string to ensure first sync happens
  const lastSyncedPasswordRef = useRef<string>('');
  const lastProcessedSearchRef = useRef<string>(searchParams.toString());
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPasswordRef = useRef<string | null>(null);
  
  // Update password when searchParams change (with debounce)
  // React Router's useSearchParams automatically triggers re-render when URL changes
  useEffect(() => {
    const currentSearch = searchParams.toString();
    const newPassword = extractPassword(searchParams);
    
    // Skip if we already processed this exact search string
    if (currentSearch === lastProcessedSearchRef.current) {
      return;
    }
    
    // If there's a pending debounce and we get a non-empty password, cancel the debounce
    // This handles the case where password temporarily becomes empty during URL transitions
    if (debounceTimeoutRef.current && newPassword) {
      console.log(`[PasswordContext] Password restored, canceling debounce: "${newPassword}"`);
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
      pendingPasswordRef.current = null;
      
      // Update immediately with restored password
      setPassword(newPassword);
      lastProcessedSearchRef.current = currentSearch;
      return;
    }
    
    // If password is changing from non-empty to empty, use debounce
    // This prevents temporary empty states during URL transitions
    if (!newPassword && password) {
      // Store pending password
      pendingPasswordRef.current = newPassword;
      
      // Set debounce timeout
      debounceTimeoutRef.current = setTimeout(() => {
        // Re-check URL after debounce delay using window.location (most reliable)
        // Don't use searchParams from closure as it may be stale
        const finalSearch = typeof window !== 'undefined' ? window.location.search : '';
        const finalSearchParams = new URLSearchParams(finalSearch);
        const finalPassword = extractPassword(finalSearchParams);
        
        // Only update to empty if it's still empty after debounce delay
        if (!finalPassword) {
          console.log('[PasswordContext] Password removed from URL (after debounce)');
          setPassword('');
          lastProcessedSearchRef.current = finalSearch;
        } else {
          // Password was restored during debounce, update to restored value
          console.log(`[PasswordContext] Password restored during debounce: "${finalPassword}" (search: "${finalSearch}")`);
          setPassword(finalPassword);
          lastProcessedSearchRef.current = finalSearch;
        }
        
        pendingPasswordRef.current = null;
        debounceTimeoutRef.current = null;
      }, PASSWORD_DEBOUNCE_DELAY);
      
      // Don't update immediately, wait for debounce
      return;
    }
    
    // For non-empty passwords or empty-to-empty transitions, update immediately
    if (newPassword !== password) {
      console.log(`[PasswordContext] Password extracted from URL: "${newPassword}" (search: "${window.location.search}")`);
      setPassword(newPassword);
      lastProcessedSearchRef.current = currentSearch;
    }
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
        pendingPasswordRef.current = null;
      }
    };
  }, [searchParams, password]); // searchParams changes when URL query parameters change
  
  // Sync password changes to encryptedImageService
  // Use React's useEffect to sync password changes - no manual event listeners needed
  // This effect runs on mount and whenever password changes
  useEffect(() => {
    // Always sync on mount (even if password is empty, to ensure encryptedImageService is initialized)
    // Also sync when password actually changes
    const shouldSync = password !== lastSyncedPasswordRef.current;
    
    if (shouldSync) {
      // Update encryptedImageService password
      // This triggers DynamicDecryptionManager to clear cache
      // Components using usePasswordChange hook will automatically re-render
      console.log(`[PasswordContext] Syncing password to encryptedImageService: "${password}"`);
      encryptedImageService.setPassword(password);

      // Update ref for next comparison
      lastSyncedPasswordRef.current = password;
    }
  }, [password]);
  
  // Force sync on mount to ensure password is set immediately on page load/refresh
  // This handles the case where password is initialized from URL but encryptedImageService
  // hasn't been initialized yet or was initialized with a different value
  // This ensures that even on direct page load/refresh, the password is immediately available
  useEffect(() => {
    // Get password from window.location (most reliable on initial load)
    const initialPassword = getPasswordFromWindowLocation();
    
    // If we have a password and it's different from what we've synced, sync it
    if (initialPassword && initialPassword !== lastSyncedPasswordRef.current) {
      console.log(`[PasswordContext] Initial sync on mount from window.location: "${initialPassword}"`);
      encryptedImageService.setPassword(initialPassword);
      lastSyncedPasswordRef.current = initialPassword;
      
      // Update state if it's different (this will trigger the password change effect above)
      if (initialPassword !== password) {
        setPassword(initialPassword);
      }
    } else if (password && password !== lastSyncedPasswordRef.current) {
      // If we have a password from state but haven't synced it yet, sync it
      console.log(`[PasswordContext] Initial sync on mount from state: "${password}"`);
      encryptedImageService.setPassword(password);
      lastSyncedPasswordRef.current = password;
    }
  }, []); // Run only on mount
  
  return (
    <PasswordContext.Provider value={{ password }}>
      {children}
    </PasswordContext.Provider>
  );
};

export const usePassword = (): string => {
  const context = useContext(PasswordContext);
  return context.password;
};

