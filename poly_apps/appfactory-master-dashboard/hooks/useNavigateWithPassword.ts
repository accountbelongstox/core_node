import { useCallback } from 'react';
import { useNavigate as useReactRouterNavigate } from 'react-router-dom';
import { HARDCODED_PASSWORD, PASSWORD_PARAM_NAME } from '../services/passwordService';

/**
 * React Hook for navigation with automatic password parameter
 * Wraps React Router's useNavigate to automatically add password parameter
 * 
 * React best practice: Use useCallback for event handlers
 * 
 * @returns navigate function that automatically adds password parameter
 * 
 * Usage:
 *   const navigate = useNavigateWithPassword();
 *   navigate('/dashboard'); // Automatically becomes /dashboard?pp=BuildFactoryEncryptionKey2025
 */
export function useNavigateWithPassword() {
  const navigate = useReactRouterNavigate();

  // Use React's useCallback for navigation handler
  const navigateWithPassword = useCallback((to: string | number, options?: { replace?: boolean; state?: any }) => {
    if (typeof to === 'number') {
      // If it's a number, it's a history navigation (go back/forward)
      navigate(to);
      return;
    }

    // Parse the path and existing parameters
    const [path, existingParams] = to.split('?');
    const params = new URLSearchParams(existingParams || '');
    
    // Add password parameter
    params.set(PASSWORD_PARAM_NAME, HARDCODED_PASSWORD);
    
    // Build new path with password parameter
    const newPath = `${path}?${params.toString()}`;
    
    // Navigate with password parameter
    navigate(newPath, options);
  }, [navigate]);

  return navigateWithPassword;
}

