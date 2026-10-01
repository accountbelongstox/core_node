/** One keyset-cursor list model for every pycore list route (contract `keyset_page`): a cursor stack walks pages, newest first. */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface KeysetPage<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface KeysetPages<T, P extends KeysetPage<T>> {
  /** The last answer, including the route's summary fields (total, counts, stats). */
  page: P | null;
  items: T[];
  /** 1-based position in the cursor stack. */
  pageIndex: number;
  hasMore: boolean;
  loading: boolean;
  error: unknown;
  next: () => void;
  previous: () => void;
  /** Reloads the current page. */
  reload: () => Promise<void>;
  /** Back to the first page. */
  first: () => void;
  /** Changes the held items in place (a pushed row update) without a fetch. */
  patchItems: (update: (items: T[]) => T[]) => void;
}

/**
 * `fetchPage` must change identity whenever the filter changes; the stack then
 * restarts at the first page. `enabled` false pauses loading.
 */
export function useKeysetPages<T, P extends KeysetPage<T>>(
  fetchPage: (cursor: string | null) => Promise<P>,
  enabled = true,
  revision = 0,
): KeysetPages<T, P> {
  const [page, setPage] = useState<P | null>(null);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const sequence = useRef(0);
  const cursor = cursors[cursors.length - 1];

  const load = useCallback(async () => {
    const mine = sequence.current + 1;
    sequence.current = mine;
    setLoading(true);
    try {
      const answer = await fetchPage(cursor);
      if (mine !== sequence.current) return;
      setPage(answer);
      setError(null);
    } catch (reason) {
      if (mine === sequence.current) setError(reason);
    } finally {
      if (mine === sequence.current) setLoading(false);
    }
  }, [fetchPage, cursor]);

  useEffect(() => { setCursors([null]); }, [fetchPage]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load, revision]);

  const nextCursor = page?.next_cursor ?? null;
  return {
    page,
    items: page?.items ?? [],
    pageIndex: cursors.length,
    hasMore: Boolean(page?.has_more && nextCursor !== null),
    loading,
    error,
    next: () => { if (nextCursor !== null) setCursors((stack) => [...stack, nextCursor]); },
    previous: () => setCursors((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack)),
    reload: load,
    first: () => setCursors([null]),
    patchItems: (update) => setPage((held) => (held ? { ...held, items: update(held.items) } : held)),
  };
}
