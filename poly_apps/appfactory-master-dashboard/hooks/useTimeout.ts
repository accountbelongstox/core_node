import { useEffect, useRef } from 'react';

/**
 * React Hook for setTimeout using useEffect
 * Uses React's lifecycle management instead of manual setTimeout
 * 
 * @param callback - Function to call after delay
 * @param delay - Delay in milliseconds (null to cancel)
 * 
 * Usage:
 *   useTimeout(() => {
 *     // Your timeout logic
 *   }, 1000);
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout using React's useEffect
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    
    if (delay !== null) {
      const id = setTimeout(tick, delay);
      // React automatically cleans up on unmount or when delay changes
      return () => clearTimeout(id);
    }
  }, [delay]);
}

