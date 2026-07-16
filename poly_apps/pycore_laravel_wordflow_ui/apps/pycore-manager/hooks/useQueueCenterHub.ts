/**
 * Shared Queue Center hub — one poll of GET /api/local/task-center for all tabs.
 * Same cached Laravel reachability the Translation Queue tab uses (monitor snapshot).
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { PcTaskCenterResponse } from '../../../core/api-libs/pycore/pycoreTypes';

const HUB_POLL_MS = 5000;

export interface QueueCenterHubState {
  /** pycore responded — distinct from Laravel live sync. */
  pycoreReachable: boolean;
  /** Cached monitor flag (same source as Translation Queue). */
  laravelReachable: boolean | null;
  /** UI-selected Laravel URL (user_data laravel_api.current). */
  laravelStoredEndpoint: string | null;
  /** Last-known healthy Laravel URL the monitor/worker actually uses. */
  laravelActiveEndpoint: string | null;
  localTaskTotal: number | null;
  localProcessing: number | null;
  translationPending: number | null;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
  refreshHub: () => void;
}

const defaultHub: QueueCenterHubState = {
  pycoreReachable: true,
  laravelReachable: null,
  laravelStoredEndpoint: null,
  laravelActiveEndpoint: null,
  localTaskTotal: null,
  localProcessing: null,
  translationPending: null,
  timestamp: null,
  loading: true,
  error: null,
  refreshHub: () => {},
};

const QueueCenterHubContext = createContext<QueueCenterHubState>(defaultHub);

function parseHubPayload(raw: PcTaskCenterResponse | null): Omit<QueueCenterHubState, 'loading' | 'error' | 'refreshHub' | 'pycoreReachable'> {
  const remote = raw?.remote_queue;
  const local = raw?.local_tasks;
  const counts = local?.counts;
  const summary = remote?.summary;
  const stored = remote?.laravel_endpoint ?? null;
  const active = remote?.laravel_active_endpoint ?? stored;
  let localTaskTotal: number | null = null;
  if (counts) {
    localTaskTotal = (['pending', 'processing', 'completed', 'failed'] as const)
      .reduce((sum, key) => sum + (typeof counts[key] === 'number' ? counts[key]! : 0), 0);
  }
  return {
    laravelReachable: typeof remote?.laravel_reachable === 'boolean' ? remote.laravel_reachable : null,
    laravelStoredEndpoint: stored,
    laravelActiveEndpoint: active,
    localTaskTotal,
    localProcessing: typeof counts?.processing === 'number' ? counts.processing : null,
    translationPending: typeof summary?.pending === 'number' ? summary.pending : null,
    timestamp: raw?.timestamp ?? null,
  };
}

export const QueueCenterHubProvider: React.FC<{ children: React.ReactNode; refreshTick?: number }> = ({
  children,
  refreshTick = 0,
}) => {
  const [hub, setHub] = useState<Omit<QueueCenterHubState, 'refreshHub'>>({
    pycoreReachable: true,
    laravelReachable: null,
    laravelStoredEndpoint: null,
    laravelActiveEndpoint: null,
    localTaskTotal: null,
    localProcessing: null,
    translationPending: null,
    timestamp: null,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const poll = useCallback(async (silent = false) => {
    if (!silent) {
      setHub((prev) => ({ ...prev, loading: true }));
    }
    try {
      const raw = await pycoreApi.getTaskCenter();
      if (!mounted.current) return;
      setHub({
        pycoreReachable: true,
        ...parseHubPayload(raw),
        loading: false,
        error: null,
      });
    } catch (e: any) {
      if (!mounted.current) return;
      setHub((prev) => ({
        ...prev,
        pycoreReachable: false,
        loading: false,
        error: e?.message || 'task-center unavailable',
      }));
    }
  }, []);

  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    void pollRef.current(false);
    const id = window.setInterval(() => { void pollRef.current(true); }, HUB_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (refreshTick > 0) void pollRef.current(true);
  }, [refreshTick]);

  const refreshHub = useCallback(() => { void pollRef.current(false); }, []);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub }),
    [hub, refreshHub],
  );

  return React.createElement(QueueCenterHubContext.Provider, { value }, children);
};

export function useQueueCenterHub(): QueueCenterHubState {
  return useContext(QueueCenterHubContext);
}

/** Laravel live sync is down; pycore itself is still up. */
export function laravelLiveSyncOffline(hub: QueueCenterHubState): boolean {
  return hub.pycoreReachable && hub.laravelReachable === false;
}

/** Selected URL differs from the active URL the monitor uses. */
export function laravelEndpointMismatch(hub: QueueCenterHubState): boolean {
  const stored = hub.laravelStoredEndpoint?.replace(/\/$/, '');
  const active = hub.laravelActiveEndpoint?.replace(/\/$/, '');
  return !!(stored && active && stored !== active);
}
