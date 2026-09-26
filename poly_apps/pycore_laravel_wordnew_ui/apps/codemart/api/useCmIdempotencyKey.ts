import { useCallback, useRef } from 'react';

function createKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * One Idempotency-Key per user action: the same key is reused while the
 * action is retried and replaced once it succeeds or its inputs change.
 */
export function useCmIdempotencyKey(): { current: () => string; reset: () => void } {
  const keyRef = useRef<string | null>(null);
  const current = useCallback((): string => {
    if (keyRef.current === null) keyRef.current = createKey();
    return keyRef.current;
  }, []);
  const reset = useCallback((): void => {
    keyRef.current = null;
  }, []);
  return { current, reset };
}
