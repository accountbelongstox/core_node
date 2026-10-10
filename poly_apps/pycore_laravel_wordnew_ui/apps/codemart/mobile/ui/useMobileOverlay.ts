import { useEffect, useRef } from 'react';

const overlayStack: Array<() => void> = [];

/** Close the topmost open overlay (sheet, drawer); true when one was open. Used by the Android back button. */
export function closeTopMobileOverlay(): boolean {
  const close = overlayStack[overlayStack.length - 1];
  if (!close) return false;
  close();
  return true;
}

/** Registers an open overlay for back-button and Escape handling while `open` is true. */
export function useMobileOverlay(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const close = (): void => closeRef.current();
    overlayStack.push(close);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && overlayStack[overlayStack.length - 1] === close) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      const index = overlayStack.lastIndexOf(close);
      if (index >= 0) overlayStack.splice(index, 1);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
}
