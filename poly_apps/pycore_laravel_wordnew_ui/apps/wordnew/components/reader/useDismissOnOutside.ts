import { useEffect, useRef } from 'react';

/** Calls `onDismiss` on a pointer press outside `ref` or on Escape while `open`. */
export function useDismissOnOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void): void {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) dismissRef.current();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismissRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open]);
}
