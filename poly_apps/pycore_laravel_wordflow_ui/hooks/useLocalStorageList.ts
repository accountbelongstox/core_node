import { useState, useCallback } from 'react';

/**
 * useLocalStorageList — localStorage-backed list (favorites / recent ids / history)
 * with dedup, promote-on-add (LRU), and an optional max cap. Replaces the raw
 * getItem/setItem/JSON.parse + manual toggle/prepend scattered across the tool UIs.
 */
export function useLocalStorageList<T = string>(key: string, opts: { max?: number } = {}) {
  const { max } = opts;
  const [items, setItems] = useState<T[]>(() => {
    try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T[]) : []; } catch { return []; }
  });

  const persist = useCallback((next: T[]) => {
    setItems(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota / private mode */ }
  }, [key]);

  const has = useCallback((v: T) => items.includes(v), [items]);
  const toggle = useCallback((v: T) => persist(items.includes(v) ? items.filter(i => i !== v) : [...items, v]), [items, persist]);
  const add = useCallback((v: T) => {
    // prepend, dedup, cap (most-recent-first)
    let next = [v, ...items.filter(i => i !== v)];
    if (max && next.length > max) next = next.slice(0, max);
    persist(next);
  }, [items, persist, max]);
  const remove = useCallback((v: T) => persist(items.filter(i => i !== v)), [items, persist]);
  const clear = useCallback(() => persist([]), [persist]);

  return { items, has, toggle, add, remove, clear, setItems: persist };
}

export default useLocalStorageList;
