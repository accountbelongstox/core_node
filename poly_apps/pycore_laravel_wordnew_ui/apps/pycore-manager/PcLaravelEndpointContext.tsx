/**
 * Shared Laravel endpoint state for pycore-manager.
 *
 * `pycore*` fields are pycore's own view (`ui/assist/laravel_endpoints`): its
 * route list, health, and selected route. `endpoints` / `current` stay the
 * browser's own Laravel transport view for the pages that read Laravel directly.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { laravelApi, pycoreApi } from '@/apps/pycore-manager/api';
import type { LaravelApiEndpoint, PycoreLaravelEndpointRow } from '@/apps/pycore-manager/api';
import { NETWORK_TIMEOUTS } from '../../core/config/NetworkTiming';
import { PycoreHttpError } from '../../core/integrations/pycore/PycoreClient';
import { getPycoreHealth, PYCORE_HEALTH_EVENT } from '../../core/integrations/pycore/PycoreHealth';
import { PC_REQUEST_FAILED_CODE, pcFailureCode } from './utils/pcErrorCodes';
import type { PcFailureFields } from './utils/pcErrorCodes';

export interface PcLaravelEndpointContextValue {
  /** Browser transport endpoint list (not pycore's). */
  endpoints: LaravelApiEndpoint[];
  /** Browser transport selection (not pycore's). */
  current: string;
  /** Pycore's Laravel route rows. */
  pycoreEndpoints: PycoreLaravelEndpointRow[];
  /** The route pycore currently uses ('' when none). */
  pycoreCurrent: string;
  /** True when the browser's Laravel URL is not a route of pycore's selected server. */
  serverMismatch: boolean;
  loading: boolean;
  probing: boolean;
  switching: string | null;
  /** Pycore failure code of the last list read; null when pycore answered. */
  error: string | null;
  actionError: string | null;
  reload: () => Promise<boolean>;
  select: (url: string) => Promise<void>;
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

type BindAnswer = PcFailureFields & { success?: boolean };

const BIND_FAILED_CODE = 'LARAVEL_ENDPOINT_BIND_FAILED';

const sameRoute = (left: string, right: string): boolean =>
  left.trim().replace(/\/+$/, '').toLowerCase() === right.trim().replace(/\/+$/, '').toLowerCase();

export function PcLaravelEndpointProvider({ children }: { children: React.ReactNode }) {
  const [endpoints, setEndpoints] = useState<LaravelApiEndpoint[]>([]);
  const [current, setCurrent] = useState('');
  const [pycoreEndpoints, setPycoreEndpoints] = useState<PycoreLaravelEndpointRow[]>([]);
  const [pycoreCurrent, setPycoreCurrent] = useState('');
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const sweepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sweepResolveRef = useRef<(() => void) | null>(null);
  const aliveRef = useRef(true);

  const reloadBrowser = useCallback((): void => {
    setEndpoints(laravelApi.listEndpoints());
    setCurrent(laravelApi.currentEndpointUrl());
  }, []);

  const refresh = useCallback(async (probe: boolean): Promise<boolean> => {
    let response: Awaited<ReturnType<typeof pycoreApi.getLaravelEndpoints>> | null = null;
    try {
      response = await pycoreApi.getLaravelEndpoints(probe);
    } catch {
      response = null;
    }
    if (!aliveRef.current) return false;
    if (!response?.success) {
      const failure = pcFailureCode(response) || PC_REQUEST_FAILED_CODE;
      errorRef.current = failure;
      setError(failure);
      setPycoreEndpoints([]);
      setPycoreCurrent('');
      return false;
    }
    errorRef.current = null;
    setError(null);
    setPycoreEndpoints(Array.isArray(response.endpoints) ? response.endpoints : []);
    setPycoreCurrent(response.current || '');
    return true;
  }, []);

  const cancelSweep = useCallback((): void => {
    if (sweepTimerRef.current) clearTimeout(sweepTimerRef.current);
    sweepTimerRef.current = null;
    const resolve = sweepResolveRef.current;
    sweepResolveRef.current = null;
    if (resolve) resolve();
  }, []);

  // Pycore probes in the background; its results appear on a later read, so
  // exactly one timed re-read follows each probe request.
  const rereadAfterSweep = useCallback((): Promise<void> => {
    cancelSweep();
    return new Promise<void>((resolve) => {
      sweepResolveRef.current = resolve;
      sweepTimerRef.current = setTimeout(() => {
        sweepTimerRef.current = null;
        sweepResolveRef.current = null;
        void refresh(false).finally(resolve);
      }, NETWORK_TIMEOUTS.pycoreEndpointSweepMs);
    });
  }, [cancelSweep, refresh]);

  const reload = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    const ok = await refresh(true);
    if (aliveRef.current) setLoading(false);
    if (ok) void rereadAfterSweep();
    return ok;
  }, [refresh, rereadAfterSweep]);

  useEffect(() => {
    aliveRef.current = true;
    reloadBrowser();
    void reload();
    const handleBrowser = () => { reloadBrowser(); };
    const handlePycoreHealth = () => {
      if (getPycoreHealth().up === true && errorRef.current) void reload();
    };
    window.addEventListener(laravelApi.events.healthChanged, handleBrowser);
    window.addEventListener(laravelApi.events.endpointsChanged, handleBrowser);
    window.addEventListener(laravelApi.events.selectionChanged, handleBrowser);
    window.addEventListener(PYCORE_HEALTH_EVENT, handlePycoreHealth);
    return () => {
      aliveRef.current = false;
      cancelSweep();
      window.removeEventListener(laravelApi.events.healthChanged, handleBrowser);
      window.removeEventListener(laravelApi.events.endpointsChanged, handleBrowser);
      window.removeEventListener(laravelApi.events.selectionChanged, handleBrowser);
      window.removeEventListener(PYCORE_HEALTH_EVENT, handlePycoreHealth);
    };
  }, [reload, reloadBrowser, cancelSweep]);

  const select = useCallback(async (url: string) => {
    if (switching) return;
    setSwitching(url);
    setActionError(null);
    let response: BindAnswer | null = null;
    let thrownCode = '';
    try {
      response = await pycoreApi.bindLaravelWorkerEndpoint(url) as BindAnswer | null;
    } catch (error) {
      thrownCode = error instanceof PycoreHttpError ? error.code : '';
    }
    const failure = response?.success === true ? null : pcFailureCode(response) || thrownCode || BIND_FAILED_CODE;
    if (failure) setActionError(failure);
    await refresh(false);
    setSwitching(null);
  }, [refresh, switching]);

  const reprobe = useCallback(async () => {
    if (probing) return;
    setProbing(true);
    setActionError(null);
    const ok = await refresh(true);
    if (ok) await rereadAfterSweep();
    if (aliveRef.current) setProbing(false);
  }, [probing, refresh, rereadAfterSweep]);

  const clearActionError = useCallback(() => setActionError(null), []);

  const serverMismatch = useMemo<boolean>(() => {
    if (error || !current || pycoreEndpoints.length === 0) return false;
    return !pycoreEndpoints.some((row) => row.selected_server && sameRoute(row.url, current));
  }, [error, current, pycoreEndpoints]);

  const value = useMemo<PcLaravelEndpointContextValue>(() => ({
    endpoints,
    current,
    pycoreEndpoints,
    pycoreCurrent,
    serverMismatch,
    loading,
    probing,
    switching,
    error,
    actionError,
    reload,
    select,
    reprobe,
    clearActionError,
  }), [
    endpoints, current, pycoreEndpoints, pycoreCurrent, serverMismatch, loading, probing,
    switching, error, actionError, reload, select, reprobe, clearActionError,
  ]);

  return <PcLaravelEndpointContext.Provider value={value}>{children}</PcLaravelEndpointContext.Provider>;
}

export function usePcLaravelEndpoint(): PcLaravelEndpointContextValue {
  const context = useContext(PcLaravelEndpointContext);
  if (!context) throw new Error('PC_LARAVEL_ENDPOINT_PROVIDER_MISSING');
  return context;
}
