/**
 * TaskPersistenceProvider — the GLOBAL, foundational progress-state layer.
 *
 * Generalizes the feature-specific PcVideoExtractContext into a shell-wide
 * service that ANY end/feature can adopt via `usePersistentTask`. It implements
 * the same two persistence layers, but decoupled from any one feature:
 *
 *  1. Provider-above-routes (survives navigation across ALL ends):
 *     Mounted in ShellApp ABOVE <BrowserRouter>, this provider never unmounts as
 *     the user moves between ends/pages. It keeps a REGISTRY of live sessions —
 *     each session's `data`, `running` flag, persisted `saved` payload, and its
 *     poll timer — keyed by the hook key. So a page (the VIEW) unmounting never
 *     tears down a running task: the session lives here and the re-mounted page
 *     simply re-subscribes and reads the still-live `data`.
 *
 *  2. localStorage re-attach (survives a FULL page reload / UI restart):
 *     `begin(saved)` persists `{key, saved}` (via StorageManager, `nexus_task_…`
 *     namespace). On provider INIT we enumerate the persisted keys and, for each,
 *     call the hook's registered `reattach(saved)` once to restore `data` from
 *     the BACKEND (the source of truth) and resume polling if still active. So a
 *     hard reload reconnects to work that is still running server-side.
 *
 * Following the shell's conventions this module uses NO try/catch — every async
 * backend call is guarded with `.catch`, and synchronous parsing is delegated to
 * StorageManager (which guards internally).
 */
import React, {
  createContext, useContext, useRef, useState, useCallback, useEffect,
} from 'react';
import { StorageManager } from '../persistence/StorageManager';
import { TASK_INDEX_KEY, taskStorageKey, type PersistedTask } from './taskStorageKeys';

const DEFAULT_INTERVAL_MS = 2000;

/** What a hook registers so the provider can drive its lifecycle generically. */
export interface TaskRegistration<T = unknown, S = unknown> {
  poll: () => Promise<T | null>;
  reattach?: (saved: S) => Promise<T | null>;
  intervalMs?: number;
}

/** A live session held in the provider registry (survives page unmounts). */
interface Session<T = unknown, S = unknown> {
  running: boolean;
  data: T | null;
  saved: S | undefined;
  reg: TaskRegistration<T, S>;
  timer: number | null;
  /** UI subscribers (the mounted hook instances) notified on every change. */
  listeners: Set<() => void>;
}

interface TaskPersistenceValue {
  /** Register/refresh the hook's poll/reattach config for `key` (idempotent). */
  register: <T, S>(key: string, reg: TaskRegistration<T, S>) => void;
  /** Read the current session snapshot (null if none yet). */
  read: <T, S>(key: string) => { data: T | null; running: boolean; saved: S | undefined };
  /** Subscribe to a session's changes; returns an unsubscribe fn. */
  subscribe: (key: string, fn: () => void) => () => void;
  /** Start a session: persist `{key, saved}`, set running, begin polling. */
  begin: <S>(key: string, saved?: S) => void;
  /** Stop a session: clear timer + running, remove persisted record. */
  end: (key: string) => void;
  /** Imperatively set `data` (e.g. a WS push between polls). */
  set: <T>(key: string, data: T) => void;
}

const TaskPersistenceContext = createContext<TaskPersistenceValue | null>(null);

export function TaskPersistenceProvider({ children }: { children: React.ReactNode }) {
  // The registry is a ref: sessions must outlive any single render/page mount,
  // and we drive React updates through per-session listener notifications.
  const sessions = useRef<Map<string, Session>>(new Map());
  const [, force] = useState(0);

  const ensure = useCallback((key: string): Session => {
    let s = sessions.current.get(key);
    if (!s) {
      s = { running: false, data: null, saved: undefined, reg: { poll: async () => null }, timer: null, listeners: new Set() };
      sessions.current.set(key, s);
    }
    return s;
  }, []);

  const notify = useCallback((s: Session) => {
    s.listeners.forEach((fn) => fn());
  }, []);

  // ---- persisted index helpers ---------------------------------------- #
  const readIndex = useCallback((): string[] => {
    const idx = StorageManager.get<string[]>(TASK_INDEX_KEY, []);
    return Array.isArray(idx) ? idx : [];
  }, []);
  const writeIndex = useCallback((keys: string[]) => {
    StorageManager.set<string[]>(TASK_INDEX_KEY, Array.from(new Set(keys)));
  }, []);
  const persist = useCallback(<S,>(key: string, saved: S | undefined) => {
    StorageManager.set<PersistedTask<S | undefined>>(taskStorageKey(key), { key, saved });
    writeIndex([...readIndex(), key]);
  }, [readIndex, writeIndex]);
  const unpersist = useCallback((key: string) => {
    StorageManager.remove(taskStorageKey(key));
    writeIndex(readIndex().filter((k) => k !== key));
  }, [readIndex, writeIndex]);

  // ---- polling --------------------------------------------------------- #
  const stopTimer = useCallback((s: Session) => {
    if (s.timer != null) { clearInterval(s.timer); s.timer = null; }
  }, []);

  const startTimer = useCallback((key: string) => {
    const s = ensure(key);
    stopTimer(s);
    const interval = s.reg.intervalMs ?? DEFAULT_INTERVAL_MS;
    s.timer = window.setInterval(() => {
      const cur = sessions.current.get(key);
      if (!cur || !cur.running) return;
      cur.reg.poll()
        .then((d) => {
          if (d != null) { cur.data = d; notify(cur); return; }
          // null === "settled": the feature wants polling to stop but the session
          // to stay registered + persisted (e.g. a finished task whose final data
          // and re-attach record should survive). Halt the timer; keep `data`.
          stopTimer(cur);
        })
        .catch(() => { /* transient backend failure — keep last data, keep polling */ });
    }, interval);
  }, [ensure, stopTimer, notify]); // stopTimer used in the interval callback too

  // ---- public API ------------------------------------------------------ #
  const register = useCallback(<T, S>(key: string, reg: TaskRegistration<T, S>) => {
    const s = ensure(key);
    s.reg = reg as TaskRegistration;
    // If a session is already running (e.g. re-attached on init, or kept alive
    // across navigation) but its timer was cleared, resume polling with the
    // freshly-registered fn + interval.
    if (s.running && s.timer == null) startTimer(key);
  }, [ensure, startTimer]);

  const read = useCallback(<T, S>(key: string) => {
    const s = sessions.current.get(key);
    return {
      data: (s?.data ?? null) as T | null,
      running: s?.running ?? false,
      saved: s?.saved as S | undefined,
    };
  }, []);

  const subscribe = useCallback((key: string, fn: () => void) => {
    const s = ensure(key);
    s.listeners.add(fn);
    return () => { s.listeners.delete(fn); };
  }, [ensure]);

  const begin = useCallback(<S,>(key: string, saved?: S) => {
    const s = ensure(key);
    s.running = true;
    s.saved = saved;
    persist(key, saved);
    startTimer(key);
    // immediate first poll so the view fills without waiting a full interval
    s.reg.poll()
      .then((d) => { if (d != null) { s.data = d; notify(s); } })
      .catch(() => { /* ignore — interval will retry */ });
    notify(s);
  }, [ensure, persist, startTimer, notify]);

  const end = useCallback((key: string) => {
    const s = sessions.current.get(key);
    if (!s) { unpersist(key); return; }
    stopTimer(s);
    s.running = false;
    unpersist(key);
    notify(s);
  }, [stopTimer, unpersist, notify]);

  const set = useCallback(<T,>(key: string, data: T) => {
    const s = ensure(key);
    s.data = data;
    notify(s);
  }, [ensure, notify]);

  const value: TaskPersistenceValue = { register, read, subscribe, begin, end, set };

  // ---- INIT: re-attach to persisted backend work ----------------------- #
  // Runs once. For each persisted key we wait until a hook has registered its
  // `reattach`, then call it once to restore `data` and resume polling. The
  // registration may arrive after this provider mounts (the page lazy-loads),
  // so we poll the registry briefly for each pending re-attach.
  useEffect(() => {
    const keys = readIndex();
    if (keys.length === 0) return;
    const pending = new Set<string>(keys);
    const reattachOne = (key: string) => {
      const stored = StorageManager.get<PersistedTask | null>(taskStorageKey(key), null);
      if (!stored) { unpersist(key); pending.delete(key); return true; }
      const s = ensure(key);
      // mark running up-front so a navigation in-between doesn't drop it
      s.saved = stored.saved;
      s.running = true;
      const re = s.reg.reattach;
      if (!re) {
        // hook not registered yet (page not mounted) — resume polling with the
        // default poll once it registers; mark handled so we don't spin forever.
        // We still leave it running so `register` resumes the timer.
        return false;
      }
      pending.delete(key);
      re(stored.saved)
        .then((d) => {
          if (d == null) {
            // backend has no such task anymore — clear it
            s.running = false;
            stopTimer(s);
            unpersist(key);
          } else {
            s.data = d;
            startTimer(key);
          }
          notify(s);
        })
        .catch(() => { /* backend offline — keep persisted record + running flag; register/begin will recover */ });
      return true;
    };

    // try immediately, then a few delayed sweeps to catch lazy-mounted hooks
    pending.forEach((k) => reattachOne(k));
    let sweeps = 0;
    const iv = window.setInterval(() => {
      sweeps += 1;
      Array.from(pending).forEach((k) => reattachOne(k));
      if (pending.size === 0 || sweeps >= 20) { clearInterval(iv); force((n) => n + 1); }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- cleanup all timers on (app-lifetime) unmount -------------------- #
  useEffect(() => () => {
    sessions.current.forEach((s) => { if (s.timer != null) clearInterval(s.timer); });
  }, []);

  return (
    <TaskPersistenceContext.Provider value={value}>
      {children}
    </TaskPersistenceContext.Provider>
  );
}

export function useTaskPersistence(): TaskPersistenceValue {
  const ctx = useContext(TaskPersistenceContext);
  if (!ctx) throw new Error('useTaskPersistence must be used within <TaskPersistenceProvider>');
  return ctx;
}
