import { useContext } from 'react';
import { PasswordContext } from '../contexts/PasswordContext';

/**
 * Hook to get password from URL hash parameters using React Context
 * Uses React Router's useLocation hook via PasswordContext
 * React Router automatically re-renders components when location changes
 * 
 * Usage:
 *   const password = usePasswordChange();
 *   useEffect(() => {
 *     // Reload images when password changes
 *   }, [password]);
 */
export function usePasswordChange(): string {
  const context = useContext(PasswordContext);
  if (!context) {
    throw new Error('usePasswordChange must be used within PasswordProvider');
  }
  return context.password;
}

