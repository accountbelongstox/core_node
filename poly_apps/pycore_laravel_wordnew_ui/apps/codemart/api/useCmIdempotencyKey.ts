import { useCallback, useRef } from 'react';
import { createIdempotencyKey } from '../../../core/integrations/laravel/transport/BaseAPI';

/**
 * One Idempotency-Key per user action: the same key is reused while the
 * action is retried and replaced once it succeeds or its inputs change.
 */
export function useCmIdempotencyKey(): { current: () => string; reset: () => void } {
  const keyRef = useRef<string | null>(null);
  const current = useCallback((): string => {
    if (keyRef.current === null) keyRef.current = createIdempotencyKey();
    return keyRef.current;
  }, []);
  const reset = useCallback((): void => {
    keyRef.current = null;
  }, []);
  return { current, reset };
}
