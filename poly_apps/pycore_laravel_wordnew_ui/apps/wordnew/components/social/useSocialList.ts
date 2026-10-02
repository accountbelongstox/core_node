import { useEffect, useState, type Dispatch, type DependencyList, type SetStateAction } from 'react';

/** Loads a list while `enabled` (logged in); resets to an empty settled list otherwise or on failure. */
export function useSocialList<T>(
  enabled: boolean,
  load: () => Promise<T[] | null | undefined>,
  deps: DependencyList,
): { items: T[]; setItems: Dispatch<SetStateAction<T[]>>; loading: boolean } {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return () => { alive = false; };
    }
    setLoading(true);
    load()
      .then((rows) => { if (alive) setItems(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { items, setItems, loading };
}
