import { useEffect, useRef } from 'react';

/**
 * React Hook for setInterval using useEffect
 * Uses React's lifecycle management instead of manual setInterval
 * 
 * @param callback - Function to call on each interval
 * @param delay - Delay in milliseconds (null to pause)
 * 
 * Usage:
 *   useInterval(() => {
 *     // Your interval logic
 *   }, 1000);
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval using React's useEffect
  useEffect(() => {
    function tick() {
      savedCallback.current?.();
    }
    
    if (delay !== null) {
      const id = setInterval(tick, delay);
      // React automatically cleans up on unmount or when delay changes
      return () => clearInterval(id);
    }
  }, [delay]);
}

