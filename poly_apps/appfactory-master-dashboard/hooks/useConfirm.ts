import { useCallback } from 'react';

/**
 * React Hook for confirmation dialogs
 * Uses React's useCallback instead of direct window.confirm access
 * 
 * React best practice: Wrap browser APIs in hooks with proper error handling
 * 
 * @returns confirm function that returns Promise<boolean>
 * 
 * Usage:
 *   const confirm = useConfirm();
 *   const handleDelete = async () => {
 *     if (await confirm('Are you sure?')) {
 *       // Delete
 *     }
 *   };
 */
export function useConfirm(): (message: string) => Promise<boolean> {
  // Use React's useCallback for event handlers
  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Check if window.confirm is available (React best practice: check in callback)
      if (typeof window !== 'undefined' && window.confirm) {
        const result = window.confirm(message);
        resolve(result);
      } else {
        // Fallback: resolve with false if confirm is not available
        console.warn('[useConfirm] window.confirm is not available');
        resolve(false);
      }
    });
  }, []);

  return confirm;
}

