import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Hook to access window.location.hash
 * Uses React Router's useLocation + useEffect instead of direct window access
 * 
 * React best practice: Use React Router for location, useEffect for window properties
 * 
 * @returns Current hash value (without #)
 * 
 * Usage:
 *   const hash = useWindowHash();
 *   // hash will be "/path" for "#/path"
 */
export function useWindowHash(): string {
  const routerLocation = useLocation();
  const [hash, setHash] = useState<string>('');

  // Use React's useEffect to access window.location.hash (only available on client)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      // Remove leading # if present
      const hashValue = window.location.hash.startsWith('#') 
        ? window.location.hash.substring(1) 
        : window.location.hash;
      setHash(hashValue);
    } else {
      setHash('');
    }
  }, [routerLocation.pathname, routerLocation.search]); // Update when route changes

  return hash;
}

