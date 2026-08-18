/**
 * usePersistentTask — the generic adoption hook for the global task layer.
 *
 *   usePersistentTask<T>(key, {
 *     poll:      () => Promise<T | null>,   // runs every intervalMs while running
 *     reattach?: (saved) => Promise<T | null>, // restore from backend on reload
 *     intervalMs?: number,                  // default 2000
 *   }): {
 *     data:    T | null,                    // latest polled/pushed snapshot
 *     running: boolean,                     // is a session live for this key
 *     begin:   (saved?) => void,            // register + persist + start polling
 *     end:     () => void,                  // stop + clear persistence
 *     set:     (data: T) => void,           // push a value from an HTTP event
 *     saved:   any,                         // the persisted re-attach payload
 *   }
 *
 * The hook is a thin VIEW binding over the provider registry: the actual session
 * (data + poll timer + persistence) lives in <TaskPersistenceProvider> above the
 * router, so the session survives this component unmounting (navigation) and a
 * full reload reconnects to the backend via `reattach`. The component re-renders
 * only when ITS key's session changes (per-session subscription).
 *
 * No try/catch — async work is delegated to the provider, which guards with
 * `.catch`.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  useTaskPersistence, type TaskRegistration,
} from './TaskPersistenceProvider';

export interface PersistentTaskOptions<T, S = any> {
  poll: () => Promise<T | null>;
  reattach?: (saved: S) => Promise<T | null>;
  intervalMs?: number;
}

export interface PersistentTask<T, S = any> {
  data: T | null;
  running: boolean;
  begin: (saved?: S) => void;
  end: () => void;
  set: (data: T) => void;
  saved: S;
}

export function usePersistentTask<T, S = any>(
  key: string,
  opts: PersistentTaskOptions<T, S>,
): PersistentTask<T, S> {
  const store = useTaskPersistence();

  // Keep the latest opts in a ref so the registration always uses fresh
  // closures without re-registering (and resetting the timer) every render.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Register a stable poll/reattach that reads through the ref. This runs on
  // every render but `register` is idempotent and only (re)starts a timer if the
  // session is already running with no timer (re-attach / kept-alive recovery).
  const reg: TaskRegistration<T, S> = {
    poll: () => optsRef.current.poll(),
    reattach: opts.reattach ? (saved: S) => optsRef.current.reattach!(saved) : undefined,
    intervalMs: opts.intervalMs,
  };
  store.register<T, S>(key, reg);

  // Subscribe this component to its session's changes.
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [store, key]);
  const getSnapshot = useCallback(() => {
    const s = store.read<T, S>(key);
    // Identity-stable enough: useSyncExternalStore compares by reference, and the
    // provider mutates+notifies, so we return a fresh object only via the cache.
    return s;
  }, [store, key]);

  // useSyncExternalStore needs a referentially-stable snapshot between unrelated
  // renders; cache it and only swap when the underlying values change.
  const cacheRef = useRef<{ data: T | null; running: boolean; saved: S | undefined } | null>(null);
  const stableSnapshot = useCallback(() => {
    const next = getSnapshot();
    const prev = cacheRef.current;
    if (prev && prev.data === next.data && prev.running === next.running && prev.saved === next.saved) {
      return prev;
    }
    cacheRef.current = next;
    return next;
  }, [getSnapshot]);

  const snap = useSyncExternalStore(subscribe, stableSnapshot, stableSnapshot);

  const begin = useCallback((saved?: S) => store.begin<S>(key, saved), [store, key]);
  const end = useCallback(() => store.end(key), [store, key]);
  const set = useCallback((data: T) => store.set<T>(key, data), [store, key]);

  // make eslint aware reg is intentionally recomputed; nothing to clean here.
  useEffect(() => () => { /* session intentionally persists past unmount */ }, []);

  return {
    data: snap.data,
    running: snap.running,
    saved: snap.saved as S,
    begin,
    end,
    set,
  };
}
