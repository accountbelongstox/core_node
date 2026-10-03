/** Shared hooks of the ops workbenches: remote loading, polling intervals, debounced values, one-shot flags. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ToolRunError } from '../toolRunner';

export interface RemoteState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
  /** `silent` keeps the current data on screen while the refresh runs. */
  reload: (silent?: boolean) => Promise<void>;
}

interface RemoteSnapshot<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
}

/** The same localized message the Tools page run lifecycle shows for a failure. */
export const describeError = (t: TFunction, err: unknown): string => {
  if (err instanceof ToolRunError) {
    return err.code === 'remote_failed' && err.params.message
      ? String(err.params.message)
      : t(`uiTools.errors.${err.code}`, { ...err.params, defaultValue: err.code });
  }
  return err instanceof Error ? err.message : t('uiTools.errors.unknown');
};

/** Loads on mount and whenever `deps` change; the latest request wins. */
export function useRemote<T>(load: () => Promise<T>, deps: DependencyList = [], enabled = true): RemoteState<T> {
  const { t } = useTranslation();
  const loadRef = useRef(load);
  const seq = useRef(0);
  const [snapshot, setSnapshot] = useState<RemoteSnapshot<T>>({ data: null, error: null, loading: enabled, updatedAt: null });
  loadRef.current = load;

  const reload = useCallback(async (silent = false): Promise<void> => {
    const id = ++seq.current;
    if (!silent) setSnapshot((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loadRef.current();
      if (id === seq.current) setSnapshot({ data, error: null, loading: false, updatedAt: Date.now() });
    } catch (err) {
      if (id === seq.current) setSnapshot((prev) => ({ ...prev, loading: false, error: describeError(t, err) }));
    }
  }, [t]);

  useEffect(() => {
    if (enabled) void reload();
    return () => { seq.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload, ...deps]);

  return { ...snapshot, reload };
}

/** Calls `callback` every `ms` milliseconds while `ms` is a number. */
export function useInterval(callback: () => void, ms: number | null): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    if (ms === null) return undefined;
    const timer = setInterval(() => callbackRef.current(), ms);
    return () => clearInterval(timer);
  }, [ms]);
}

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** A boolean that turns on and falls back by itself (copied / saved confirmations). */
export function useFlash(ms = 1800): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, flash];
}

/** True while the component is mounted; guards state updates after long awaits. */
export function useMountedRef(): { current: boolean } {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return mounted;
}
