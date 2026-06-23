import { useState, useCallback } from 'react';

/**
 * React Hook for handling image load errors
 * Uses React state instead of direct DOM manipulation
 * 
 * @returns [hasError, handleError] - Error state and error handler
 * 
 * Usage:
 *   const [hasError, handleError] = useImageError();
 *   <img src={url} onError={handleError} style={{ display: hasError ? 'none' : 'block' }} />
 */
export function useImageError(): [boolean, () => void] {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  return [hasError, handleError];
}

