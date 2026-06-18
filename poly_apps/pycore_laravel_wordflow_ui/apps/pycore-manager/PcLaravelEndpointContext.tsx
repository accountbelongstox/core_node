/**
 * PcLaravelEndpointContext — shared Laravel API endpoint state for the
 * pycore-manager end. Single source of truth for `laravel_api.*` RPC data so
 * the global top-bar switcher and Settings page stay in sync.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  pycoreLaravelApi, PYCORE_LARAVEL_API_CHANGED_EVENT,
} from '../../core/api-libs/pycore';
import type { LaravelApiEndpoint } from '../../core/api-libs/pycore';

export interface PcLaravelEndpointContextValue {
  endpoints: LaravelApiEndpoint[];
  current: string;
  loading: boolean;
  probing: boolean;
  switching: string | null;
  error: string | null;
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
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const r = await pycoreLaravelApi.list();
      if (r && Array.isArray(r.endpoints)) {
        setEndpoints(r.endpoints);
        setCurrent(r.current || '');
        setError(null);
        return true;
      }
      throw new Error(r?.error || 'laravel_api.list: malformed response');
    } catch (e: any) {
      setError(e?.message || 'RPC failed');
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

  // Ensure the browser's CURRENT ORIGIN (host, forced to the laravel port 9000)
  // is a candidate — the backend cannot know the window URL, so the FE adds it
  // once after the list first loads. Idempotent: the backend dedups, and we
  // only attempt when the host isn't already present. Skipped while the RPC is
  // down (no endpoints loaded) so we don't spam a failing add.
  const currentOriginAddedRef = useRef(false);
  useEffect(() => {
    if (currentOriginAddedRef.current || loading) return;
    if (typeof window === 'undefined' || !window.location?.hostname) return;
    if (endpoints.length === 0) return; // list not loaded yet / backend offline
    const originUrl = `http://${window.location.hostname}:9000`;
    const norm = (u: string) => (u || '').replace(/\/+$/, '');
    currentOriginAddedRef.current = true; // one-shot regardless of outcome
    if (!endpoints.some((e) => norm(e.url) === norm(originUrl))) {
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
      await reload();
      window.dispatchEvent(new CustomEvent(PYCORE_LARAVEL_API_CHANGED_EVENT, { detail: { url } }));
    } catch (e: any) {
      setActionError(e?.message || 'select failed');
    } finally {
      setSwitching(null);
    }
  }, [current, switching, reload]);

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
    actionError,
    reload,
    select,
    addUrl,
    removeUrl,
    reprobe,
    clearActionError,
  }), [
    endpoints, current, loading, probing, switching, error, actionError,
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
