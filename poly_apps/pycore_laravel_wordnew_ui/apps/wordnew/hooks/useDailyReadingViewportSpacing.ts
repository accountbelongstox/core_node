import { useEffect, useState, type RefObject } from 'react';

export type DailyReadingViewportMode = 'words' | 'article';

export function useDailyReadingViewportSpacing<T extends HTMLElement>(
  ref: RefObject<T | null>,
  mode: DailyReadingViewportMode,
): number {
  const [halfHeight, setHalfHeight] = useState(0);

  useEffect(() => {
    const container = ref.current;
    if (!container || mode === 'words') {
      setHalfHeight(0);
      return;
    }
    const update = () => setHalfHeight(container.clientHeight / 2);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, ref]);

  return mode === 'article' ? halfHeight : 0;
}
