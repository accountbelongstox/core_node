import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LlmStatus } from '../../../core/integrations/pycore';
import {
  createPycoreLiveSource,
  pycoreApi,
  pycoreRouteRecoveryStore,
  PYCORE_HTTP_ROUTES,
} from '../../../core/integrations/pycore';
import { createRuntimeStore } from '../../../core/persistence/RuntimeStore';

const recovered = pycoreRouteRecoveryStore.read<LlmStatus>(
  PYCORE_HTTP_ROUTES.llmStatusStatus,
  {},
);

export interface LlmStatusRuntimeState {
  status: LlmStatus | null;
  loading: boolean;
  error: string | null;
}

const store = createRuntimeStore<LlmStatusRuntimeState>({
  defaults: () => ({ status: null, loading: false, error: null }),
  restore: () => recovered ? { status: recovered.data || null, loading: false, error: null } : null,
  errorFallback: 'LLM_STATUS_UNAVAILABLE',
});

let statusFlight: Promise<void> | null = null;

const patch = (partial: Partial<LlmStatusRuntimeState>) => store.patch(partial);

export function getLlmStatusRuntimeState(): LlmStatusRuntimeState {
  return store.getState();
}

export function subscribeLlmStatusRuntime(listener: () => void): () => void {
  return store.subscribe(listener);
}

export async function refreshLlmStatusRuntime(): Promise<void> {
  if (statusFlight) return statusFlight;
  patch({ loading: true });
  statusFlight = pycoreApi.getLlmStatus()
    .then((response: LlmStatus) => {
      if (!response.success) {
        patch({ error: 'LLM_STATUS_UNAVAILABLE' });
        return;
      }
      pycoreRouteRecoveryStore.write(PYCORE_HTTP_ROUTES.llmStatusStatus, {}, response);
      patch({ status: response, error: null });
    })
    .catch((error: unknown) => {
      patch({ error: store.errorMessage(error) });
    })
    .finally(() => {
      statusFlight = null;
      patch({ loading: false });
    });
  return statusFlight;
}

const liveSource = createPycoreLiveSource({ topics: {}, refresh: refreshLlmStatusRuntime });

export interface LlmStatusRuntimeHook extends LlmStatusRuntimeState {
  refresh: () => Promise<void>;
}

export function useLlmStatusRuntime(): LlmStatusRuntimeHook {
  useEffect(() => {
    liveSource.retain();
    return liveSource.release;
  }, []);
  const snapshot = useSyncExternalStore(
    subscribeLlmStatusRuntime,
    getLlmStatusRuntimeState,
    getLlmStatusRuntimeState,
  );
  const refresh = useCallback(() => refreshLlmStatusRuntime(), []);
  return useMemo(() => ({ ...snapshot, refresh }), [snapshot, refresh]);
}
