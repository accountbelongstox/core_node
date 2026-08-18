/**
 * Shared direct-Laravel endpoint state for pycore-manager.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { laravelApi, pycoreApi } from '@/apps/pycore-manager/api';
import type { LaravelApiEndpoint } from '@/apps/pycore-manager/api';

export interface PcLaravelEndpointContextValue {
  endpoints: LaravelApiEndpoint[];
  current: string;
  loading: boolean;
  probing: boolean;
  switching: string | null;
  error: string | null;
  fallback: boolean;
  actionError: string | null;
  reload: () => Promise<boolean>;
  select: (url: string) => Promise<void>;
  addUrl: (url: string) => Promise<void>;
  removeUrl: (url: string) => Promise<void>;
  reprobe: () => Promise<void>;
  clearActionError: () => void;
}

const ENDPOINT_CONTEXT_GLOBAL_KEY = '__pycoreManagerLaravelEndpointContext__';
const endpointContextRegistry = globalThis as typeof globalThis & Record<string, unknown>;
const existingEndpointContext = endpointContextRegistry[ENDPOINT_CONTEXT_GLOBAL_KEY] as
  React.Context<PcLaravelEndpointContextValue | null> | undefined;

// Context identity must survive Vite Fast Refresh. Recreating it during HMR
// leaves the existing Provider on the old instance and makes consumers throw
// PC_LARAVEL_ENDPOINT_PROVIDER_MISSING until a full reload.
const PcLaravelEndpointContext = existingEndpointContext
  ?? createContext<PcLaravelEndpointContextValue | null>(null);
endpointContextRegistry[ENDPOINT_CONTEXT_GLOBAL_KEY] = PcLaravelEndpointContext;

export function PcLaravelEndpointProvider({ children }: { children: React.ReactNode }) {
  const [endpoints, setEndpoints] = useState<LaravelApiEndpoint[]>([]);
  const [current, setCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<boolean> => {
    const rows = laravelApi.listEndpoints();
    setEndpoints(rows);
    setCurrent(laravelApi.currentEndpointUrl());
    setLoading(false);
    return rows.length > 0;
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
    const handleHealth = () => { void reload(); };
    window.addEventListener(laravelApi.events.healthChanged, handleHealth);
    window.addEventListener(laravelApi.events.endpointsChanged, handleHealth);
    window.addEventListener(laravelApi.events.selectionChanged, handleHealth);
    return () => {
      window.removeEventListener(laravelApi.events.healthChanged, handleHealth);
      window.removeEventListener(laravelApi.events.endpointsChanged, handleHealth);
      window.removeEventListener(laravelApi.events.selectionChanged, handleHealth);
    };
  }, [reload]);

  const select = useCallback(async (url: string) => {
    if (switching) return;
    setSwitching(url);
    setActionError(null);
    const result = await laravelApi.switchEndpoint(url);
    setSwitching(null);
    if (!result.ok) {
      setActionError(result.error || 'LARAVEL_ENDPOINT_UNAVAILABLE');
      return;
    }
    await reload();
    void pycoreApi.bindLaravelWorkerEndpoint(url).catch(() => undefined);
  }, [reload, switching]);

  const addUrl = useCallback(async (url: string) => {
    setActionError(null);
    const result = laravelApi.addEndpoint(url);
    if (!result.ok) {
      setActionError(result.error || 'LARAVEL_ENDPOINT_ADD_REJECTED');
      return;
    }
    await reload();
  }, [reload]);

  const removeUrl = useCallback(async (url: string) => {
    setActionError(null);
    const result = laravelApi.removeEndpoint(url);
    if (!result.ok) {
      setActionError(result.error || 'LARAVEL_ENDPOINT_REMOVE_FAILED');
      return;
    }
    await reload();
  }, [reload]);

  const reprobe = useCallback(async () => {
    if (probing) return;
    setProbing(true);
    setActionError(null);
    await laravelApi.probeEndpoints();
    await reload();
    setProbing(false);
  }, [probing, reload]);

  const clearActionError = useCallback(() => setActionError(null), []);
  const value = useMemo<PcLaravelEndpointContextValue>(() => ({
    endpoints,
    current,
    loading,
    probing,
    switching,
    error: null,
    fallback: false,
    actionError,
    reload,
    select,
    addUrl,
    removeUrl,
    reprobe,
    clearActionError,
  }), [
    endpoints, current, loading, probing, switching, actionError,
    reload, select, addUrl, removeUrl, reprobe, clearActionError,
  ]);

  return <PcLaravelEndpointContext.Provider value={value}>{children}</PcLaravelEndpointContext.Provider>;
}

export function usePcLaravelEndpoint(): PcLaravelEndpointContextValue {
  const context = useContext(PcLaravelEndpointContext);
  if (!context) throw new Error('PC_LARAVEL_ENDPOINT_PROVIDER_MISSING');
  return context;
}
