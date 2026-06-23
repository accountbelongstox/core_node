import { useEffect, useRef } from 'react';

/**
 * React Hook for event listeners
 * Uses React's useEffect instead of direct window.addEventListener access
 * 
 * React best practice: Use useEffect for event listeners with proper cleanup
 * 
 * @param eventName - Event name (e.g., 'storage', 'resize', 'scroll')
 * @param handler - Event handler function
 * @param element - Element to attach listener to (default: window)
 * 
 * Usage:
 *   useEventListener('storage', handleStorageChange);
 *   useEventListener('resize', handleResize, window);
 */
export function useEventListener<T extends keyof WindowEventMap>(
  eventName: T,
  handler: (event: WindowEventMap[T]) => void,
  element: Window | Document | HTMLElement | null = typeof window !== 'undefined' ? window : null
): void {
  // Use React's useRef to persist handler without causing re-renders
  const handlerRef = useRef(handler);

  // Update handler ref when handler changes (React best practice)
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Use React's useEffect for event listener setup/cleanup
  useEffect(() => {
    // Check if element is available (React best practice: check in useEffect)
    if (!element || typeof window === 'undefined') {
      return;
    }

    // Create event listener that uses latest handler
    const eventListener = (event: Event) => {
      handlerRef.current(event as WindowEventMap[T]);
    };

    // Add event listener
    element.addEventListener(eventName, eventListener);

    // Cleanup: remove event listener (React best practice: cleanup in useEffect return)
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]); // Re-run if event name or element changes
}

