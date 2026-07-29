/**
 * PcLaravelEndpointContext — shared Laravel API endpoint state for the
 * pycore-manager end. Single source of truth for `laravel_api.*` RPC data so
 * the global top-bar switcher and Settings page stay in sync.
 *
 * Recovers from a slow `laravel_api.select` by ALSO listening to a
 * `laravel_endpoint_changed` WS broadcast from the server: even when the
 * caller's 30s promise has already timed out, the broadcast pulls the UI
 * back into sync as soon as the switch actually completes.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  pycoreLaravelApi, PYCORE_LARAVEL_API_CHANGED_EVENT,
  buildPcPreparedLaravelEndpoints, normalizeLaravelApiUrl, LARAVEL_API_PORT,
  subscribeWs,
} from '../../core/api-libs/pycore';
import type { LaravelApiEndpoint } from '../../core/api-libs/pycore';

const LARAVEL_ENDPOINT_CHANGED_EVENT = 'laravel_endpoint_changed';

/**
 * d.txt 8.2 — the Laravel endpoint is stored TWICE: the backend persists it in
 * user_data.json (laravel_api.current) and the frontend keeps its own copy in
 * localStorage under this key. When the frontend (re)connects to the backend,
 * the FRONTEND copy wins: any mismatch pushes `laravel_api.select(feUrl)` so a
 * backend-side reset/seed-migration can never silently undo the user's choice.
 */
const FE_ENDPOINT_KEY = 'pycore_laravel_current_endpoint';

function readFeEndpoint(): string {
  try { return localStorage.getItem(FE_ENDPOINT_KEY) || ''; } catch { return ''; }
}

function writeFeEndpoint(url: string): void {
  try {
    if (url) localStorage.setItem(FE_ENDPOINT_KEY, url);
  } catch { /* storage optional */ }
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
  // WS broadcast). Both may fire for the same switch; we only surface it
  // once so downstream listeners don't reload twice.
  const lastEndpointUrlRef = useRef<string | null>(null);
  // One-shot guard for the frontend-wins sync (d.txt 8.2): the last FE url we
  // already pushed to the backend, so a failing select never sync-loops.
  const feLastPushedRef = useRef<string | null>(null);

  const dispatchEndpointChanged = useCallback((url: string) => {
    if (!url || url === lastEndpointUrlRef.current) return;
    lastEndpointUrlRef.current = url;
    window.dispatchEvent(new CustomEvent(PYCORE_LARAVEL_API_CHANGED_EVENT, { detail: { url } }));
  }, []);

  const reload = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const r = await pycoreLaravelApi.list();
      if (r && Array.isArray(r.endpoints)) {
        setEndpoints(r.endpoints);
        setCurrent(r.current || '');
        setError(null);
        setFallback(false);
        // d.txt 8.2 — frontend-wins sync: the FE keeps its own endpoint copy
        // (localStorage) and the backend keeps one (user_data.json). On every
        // successful (re)connect the FE copy is authoritative: when it differs
        // from the backend's stored current, push it via laravel_api.select.
        const feUrl = readFeEndpoint();
        if (
          feUrl &&
          normalizeLaravelApiUrl(feUrl) !== normalizeLaravelApiUrl(r.current || '') &&
          feLastPushedRef.current !== feUrl
        ) {
          feLastPushedRef.current = feUrl;
          void pycoreLaravelApi.select(feUrl)
            .then((res) => {
              if (res && res.success === false) throw new Error(res.error || 'select failed');
              dispatchEndpointChanged(feUrl);
              void reload();
            })
            .catch(() => { feLastPushedRef.current = null; });
        }
        return true;
      }
      throw new Error(r?.error || 'laravel_api.list: malformed response');
    } catch (e: any) {
      // pycore RPC (:59000) offline: still surface the FRONTEND-known prepared
      // endpoints (read-only) so the switcher shows the available APIs rather than
      // an empty error box. We keep `error` set + flag `fallback` so the UI can
      // label these as prepared/offline.
      const prepared = buildPcPreparedLaravelEndpoints();
      setEndpoints(prepared);
      setCurrent((cur) => cur || prepared[0]?.url || '');
      setError(e?.message || 'RPC failed');
      setFallback(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    reload().then((ok) => {
      if (!ok && !cancelled) timer = setTimeout(() => { if (!cancelled) reload(); }, 3000);
    });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [reload]);

  // Subscribe to the server-side broadcast: `laravel_api.select` emits a
  // `laravel_endpoint_changed` event AFTER the switch is persisted. The
  // UI updates from this broadcast even when the caller's promise has
  // already timed out on the 30s RPC ceiling.
  useEffect(() => {
    const off = subscribeWs(LARAVEL_ENDPOINT_CHANGED_EVENT, (data: any) => {
      if (!data || typeof data !== 'object') return;
      if (Array.isArray(data.endpoints)) setEndpoints(data.endpoints);
      if (typeof data.current === 'string' && data.current) {
        setCurrent(data.current);
        writeFeEndpoint(data.current); // keep the FE copy aligned (d.txt 8.2)
        dispatchEndpointChanged(data.current);
      } else if (typeof data.url === 'string' && data.url) {
        setCurrent(data.url);
        writeFeEndpoint(data.url); // keep the FE copy aligned (d.txt 8.2)
        dispatchEndpointChanged(data.url);
      }
      setError(null);
      setFallback(false);
      setSwitching(null);
    });
    return () => { off(); };
  }, [dispatchEndpointChanged]);

  // Ensure the browser's CURRENT ORIGIN (host, forced to the laravel port 9000)
  // is a candidate — the backend cannot know the window URL, so the FE adds it
  // once after the list first loads. Idempotent: the backend dedups, and we
  // only attempt when the host isn't already present. Skipped while the RPC is
  // down (no endpoints loaded) so we don't spam a failing add.
  const currentOriginAddedRef = useRef(false);
  useEffect(() => {
    if (currentOriginAddedRef.current || loading || fallback) return; // never mutate while RPC is down
    if (typeof window === 'undefined' || !window.location?.hostname) return;
    if (endpoints.length === 0) return; // list not loaded yet / backend offline
    const originUrl = `http://${window.location.hostname}:${LARAVEL_API_PORT}`;
    currentOriginAddedRef.current = true; // one-shot regardless of outcome
    if (!endpoints.some((e) => normalizeLaravelApiUrl(e.url) === normalizeLaravelApiUrl(originUrl))) {
      void addUrl(originUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoints, loading]);

  const select = useCallback(async (url: string) => {
    if (!url || url === current || switching) return;
    setSwitching(url);
    setActionError(null);
    try {
      const r = await pycoreLaravelApi.select(url);
      if (r && r.success === false) throw new Error(r.error || 'select failed');
      writeFeEndpoint(url); // FE keeps its own copy of the selection (d.txt 8.2)
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
      await pycoreLaravelApi.probe();
    } catch (e: any) {
      setActionError(e?.message || 'probe failed');
    } finally {
      await reload();
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
