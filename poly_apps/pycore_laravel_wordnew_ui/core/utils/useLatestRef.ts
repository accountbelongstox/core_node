import { useEffect, useRef, type MutableRefObject } from 'react';

/** Ref that always holds the latest `value` (updated after each commit) for long-lived callbacks. */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; }, [value]);
  return ref;
}
