import { useEffect, useState } from 'react';

/** Tailwind `md` breakpoint: below 768px is treated as a phone layout. */
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/**
 * Reactive "is phone" flag shared by pycore-manager pages and shell chrome.
 * Listens to matchMedia so layout flips live when the viewport is resized
 * (or when a desktop window is snapped below the md breakpoint).
 */
export function useIsMobile(query: string = MOBILE_MEDIA_QUERY): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, [query]);

  return isMobile;
}
