import { useEffect, useRef, RefObject } from 'react';

/**
 * React Hook for detecting clicks outside an element
 * Uses React's useEffect and refs instead of manual addEventListener
 * 
 * @param handler - Callback function to execute when click outside occurs
 * @returns Ref object to attach to the element
 * 
 * Usage:
 *   const ref = useClickOutside(() => setIsOpen(false));
 *   <div ref={ref}>...</div>
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };

    // Use React's event system - attach listener in useEffect
    document.addEventListener('mousedown', handleClickOutside);
    
    // React automatically cleans up on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handler]);

  return ref;
}

