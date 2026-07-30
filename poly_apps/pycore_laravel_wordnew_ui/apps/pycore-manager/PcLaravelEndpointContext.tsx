/**
 * PcLaravelEndpointContext — shared Laravel API endpoint state for the
 * pycore-manager end. Single source of truth for `laravel_api.*` RPC data so
 * the global top-bar switcher and Settings page stay in sync.
 *
 * Recovers from a slow `laravel_api.select` by ALSO listening to a
 * `laravel_endpoint_changed` HTTP event from the server: even when the
 * caller's 30s promise has already timed out, the broadcast pulls the UI
 * back into sync as soon as the switch actually completes.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  pycoreLaravelApi,
  buildPcPreparedLaravelEndpoints, buildPcPreparedLaravelEndpointUrls,
  normalizeLaravelApiUrl,
  subscribeHttpEvent,
} from '../../core/api-libs/pycore';
import { PYCORE_BROWSER_EVENTS, PYCORE_EVENT_TOPICS } from '../../core/api-libs/pycore/PycoreEventTopics';
import type { LaravelApiEndpoint } from '../../core/api-libs/pycore';
import { StorageKeys, StorageManager } from '../../core/persistence';

/**
 * The backend-selected endpoint is authoritative. The frontend keeps a local
 * copy only for the read-only offline fallback and refreshes it from every
 * successful backend response.
 */
function readFeEndpoint(): string {
  return StorageManager.getRaw(StorageKeys.PYCORE_LARAVEL_ENDPOINT) || '';
}

function writeFeEndpoint(url: string): void {
  if (url) StorageManager.setRaw(StorageKeys.PYCORE_LARAVEL_ENDPOINT, url);
}

function mergeEndpointRows(
  backendRows: LaravelApiEndpoint[],
  frontendRows: LaravelApiEndpoint[],
): LaravelApiEndpoint[] {
  const merged: LaravelApiEndpoint[] = [];
  const seen = new Set<string>();
  for (const row of [...backendRows, ...frontendRows]) {
    const normalizedUrl = normalizeLaravelApiUrl(row.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    merged.push({ ...row, url: normalizedUrl });
  }
  return merged;
}

function resolveDisplayedCurrent(
  backendCurrent: string,
  rows: LaravelApiEndpoint[],
): string {
  const normalizedBackend = normalizeLaravelApiUrl(backendCurrent);
  if (normalizedBackend) return normalizedBackend;
  const cachedFrontend = normalizeLaravelApiUrl(readFeEndpoint());
  if (cachedFrontend && rows.some((row) => row.url === cachedFrontend)) {
    return cachedFrontend;
  }
  return rows[0]?.url || '';
}

export interface PcLaravelEndpointContextValue {
  endpoints: LaravelApiEndpoint[];
  current: string;
  loading: boolean;
  probing: boolean;
  switching: string | null;
  error: string | null;
  /** true when `endpoints` is the read-only prepared fallback (pycore RPC offline). */
  fallback: boolean;
  actionError: string | null;
  reload: () => Promise<boolean>;
  select: (url: string) => Promise<void>;
  addUrl: (url: string) => Promise<void>;
  removeUrl: (url: string) => Promise<void>;
  reprobe: () => Promise<void>;
  clearActionError: () => void;
}

const PcLaravelEndpointContext = createContext<PcLaravelEndpointContextValue | null>(null);

export function PcLaravelEndpointProvider({ children }: { children: React.ReactNode }) {
  const [endpoints, setEndpoints] = useState<LaravelApiEndpoint[]>([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // De-dup CustomEvent dispatch across the two paths (promise success +
  // HTTP event). Both may fire for the same switch; we only surface it
  // once so downstream listeners don't reload twice.
  const lastEndpointUrlRef = useRef<string | null>(null);

  const dispatchEndpointChanged = useCallback((url: string) => {
    if (!url || url === lastEndpointUrlRef.current) return;
    lastEndpointUrlRef.current = url;
    window.dispatchEvent(new CustomEvent(PYCORE_BROWSER_EVENTS.laravelApiChanged, { detail: { url } }));
  }, []);

  // One-shot follow-up re-list (cached, probe:false) to pick up the fresh
  // health rows after the server-side background sweep that every list(probe)
  // kicks off. Guarded so overlapping reloads never stack timers.
  const sweepFollowUpRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSweepFollowUp = useCallback(() => {
    if (sweepFollowUpRef.current) clearTimeout(sweepFollowUpRef.current);
    sweepFollowUpRef.current = setTimeout(() => {
      sweepFollowUpRef.current = null;
      const preparedRows = buildPcPreparedLaravelEndpoints();
      pycoreLaravelApi.list({
        probe: false,
        frontendEndpoints: buildPcPreparedLaravelEndpointUrls(),
      })
        .then((r2) => {
          if (r2 && Array.isArray(r2.endpoints)) {
            const mergedRows = mergeEndpointRows(r2.endpoints, preparedRows);
            const nextCurrent = resolveDisplayedCurrent(r2.current || '', mergedRows);
            setEndpoints(mergedRows);
            setCurrent(nextCurrent);
            if (r2.current) writeFeEndpoint(nextCurrent);
          }
        })
        .catch(() => { /* follow-up refresh is best-effort */ });
    }, 4500);
  }, []);

  const reload = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const preparedRows = buildPcPreparedLaravelEndpoints();
      const r = await pycoreLaravelApi.list({
        frontendEndpoints: buildPcPreparedLaravelEndpointUrls(),
      });
      if (r && Array.isArray(r.endpoints)) {
        const mergedRows = mergeEndpointRows(r.endpoints, preparedRows);
        const nextCurrent = resolveDisplayedCurrent(r.current || '', mergedRows);
        setEndpoints(mergedRows);
        setCurrent(nextCurrent);
        if (r.current) writeFeEndpoint(nextCurrent);
        setError(null);
        setFallback(false);
        scheduleSweepFollowUp();
        return true;
      }
      throw new Error(r?.error || 'laravel_api.list: malformed response');
    } catch (e: any) {
      // pycore RPC (:59000) offline: still surface the FRONTEND-known prepared
      // endpoints (read-only) so the switcher shows the available APIs rather than
      // an empty error box. We keep `error` set + flag `fallback` so the UI can
      // label these as prepared/offline.
      const prepared = buildPcPreparedLaravelEndpoints();
      const cachedCurrent = resolveDisplayedCurrent('', prepared);
      setEndpoints(prepared);
      setCurrent(cachedCurrent);
      setError(e?.message || 'RPC failed');
      setFallback(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [scheduleSweepFollowUp]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    reload().then((ok) => {
      if (!ok && !cancelled) timer = setTimeout(() => { if (!cancelled) reload(); }, 3000);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (sweepFollowUpRef.current) { clearTimeout(sweepFollowUpRef.current); sweepFollowUpRef.current = null; }
    };
  }, [reload]);

  // Subscribe to the server-side broadcast: `laravel_api.select` emits a
  // `laravel_endpoint_changed` event AFTER the switch is persisted. The
  // UI updates from this broadcast even when the caller's promise has
  // already timed out on the 30s RPC ceiling.
  useEffect(() => {
    const off = subscribeHttpEvent(PYCORE_EVENT_TOPICS.laravelEndpointChanged, (data: any) => {
      if (!data || typeof data !== 'object') return;
      if (Array.isArray(data.endpoints)) {
        setEndpoints(mergeEndpointRows(
          data.endpoints,
          buildPcPreparedLaravelEndpoints(),
        ));
      }
      if (typeof data.current === 'string' && data.current) {
        const normalizedCurrent = normalizeLaravelApiUrl(data.current);
        setCurrent(normalizedCurrent);
        writeFeEndpoint(normalizedCurrent);
        dispatchEndpointChanged(normalizedCurrent);
      } else if (typeof data.url === 'string' && data.url) {
        const normalizedCurrent = normalizeLaravelApiUrl(data.url);
        setCurrent(normalizedCurrent);
        writeFeEndpoint(normalizedCurrent);
        dispatchEndpointChanged(normalizedCurrent);
      }
      setError(null);
      setFallback(false);
      setSwitching(null);
    });
    return () => { off(); };
  }, [dispatchEndpointChanged]);

  const select = useCallback(async (url: string) => {
    if (!url || url === current || switching) return;
    setSwitching(url);
    setActionError(null);
    try {
      const r = await pycoreLaravelApi.select(url);
      if (r && r.success === false) throw new Error(r.error || 'select failed');
      writeFeEndpoint(url);
      await reload();
      dispatchEndpointChanged(url);
      setSwitching(null);
    } catch (e: any) {
      // A late-arriving `laravel_endpoint_changed` broadcast may still
      // recover the UI even when this promise rejected. The broadcast
      // handler also resets `switching`, so this reset is idempotent.
      setActionError(e?.message || 'select failed');
      setSwitching(null);
    }
  }, [current, switching, reload, dispatchEndpointChanged]);

  const addUrl = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setActionError(null);
    try {
      const r = await pycoreLaravelApi.add(trimmed);
      if (r && r.success === false) throw new Error(r.error || 'add failed');
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'add failed');
    }
  }, [reload]);

  const removeUrl = useCallback(async (url: string) => {
    setActionError(null);
    try {
      const r = await pycoreLaravelApi.remove(url);
      if (r && r.success === false) throw new Error(r.error || 'remove failed');
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'remove failed');
    }
  }, [reload]);

  const reprobe = useCallback(async () => {
    if (probing) return;
    setProbing(true);
    setActionError(null);
    try {
      // The probe refresh runs server-side in the BACKGROUND now (the RPC
      // returns instantly with last-known rows). Wait out the sweep budget,
      // then re-list so the spinner covers the actual refresh instead of
      // flipping back on stale data.
      await pycoreLaravelApi.probe();
      await new Promise((resolve) => setTimeout(resolve, 4500));
      await reload();
    } catch (e: any) {
      setActionError(e?.message || 'probe failed');
    } finally {
      setProbing(false);
    }
  }, [probing, reload]);

  const clearActionError = useCallback(() => setActionError(null), []);

  const value = useMemo<PcLaravelEndpointContextValue>(() => ({
    endpoints,
    current,
    loading,
    probing,
    switching,
    error,
    fallback,
    actionError,
    reload,
    select,
    addUrl,
    removeUrl,
    reprobe,
    clearActionError,
  }), [
    endpoints, current, loading, probing, switching, error, fallback, actionError,
    reload, select, addUrl, removeUrl, reprobe, clearActionError,
  ]);

  return (
    <PcLaravelEndpointContext.Provider value={value}>
      {children}
    </PcLaravelEndpointContext.Provider>
  );
}

export function usePcLaravelEndpoint(): PcLaravelEndpointContextValue {
  const ctx = useContext(PcLaravelEndpointContext);
  if (!ctx) throw new Error('usePcLaravelEndpoint must be used within PcLaravelEndpointProvider');
  return ctx;
}
