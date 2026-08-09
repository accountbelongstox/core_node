import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LlmStatus } from '../../../core/api-libs/pycore';
import {
  connectPycoreHttp,
  pycoreApi,
  pycoreEventBus,
  pycoreRouteRecoveryStore,
  PYCORE_BROWSER_EVENTS,
  PYCORE_HTTP_ROUTES,
} from '../../../core/api-libs/pycore';

const STORE_EVENT = 'pycore-llm-status-runtime-changed';
const recovered = pycoreRouteRecoveryStore.read<LlmStatus>(
  PYCORE_HTTP_ROUTES.llmStatusStatus,
  {},
);

export interface LlmStatusRuntimeState {
  status: LlmStatus | null;
  loading: boolean;
  error: string | null;
}

let state: LlmStatusRuntimeState = {
  status: recovered?.data || null,
  loading: false,
  error: null,
};
let consumerCount = 0;
let statusFlight: Promise<void> | null = null;
let unsubscribers: Array<() => void> = [];

function notify(): void {
  window.dispatchEvent(new CustomEvent(STORE_EVENT));
}

function patch(partial: Partial<LlmStatusRuntimeState>): void {
  state = { ...state, ...partial };
  notify();
}

export function getLlmStatusRuntimeState(): LlmStatusRuntimeState {
  return state;
}

export function subscribeLlmStatusRuntime(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(STORE_EVENT, handler);
  return () => window.removeEventListener(STORE_EVENT, handler);
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
      patch({ error: error instanceof Error ? error.message : 'LLM_STATUS_UNAVAILABLE' });
    })
    .finally(() => {
      statusFlight = null;
      patch({ loading: false });
    });
  return statusFlight;
}

function startLlmStatusRuntime(): void {
  consumerCount += 1;
  if (consumerCount !== 1) return;
  connectPycoreHttp();
  unsubscribers = [
    pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => {
      void refreshLlmStatusRuntime();
    }),
    pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventReplayLost, () => {
      void refreshLlmStatusRuntime();
    }),
  ];
  void refreshLlmStatusRuntime();
}

function stopLlmStatusRuntime(): void {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount !== 0) return;
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
}

export interface LlmStatusRuntimeHook extends LlmStatusRuntimeState {
  refresh: () => Promise<void>;
}

export function useLlmStatusRuntime(): LlmStatusRuntimeHook {
  useEffect(() => {
    startLlmStatusRuntime();
    return () => stopLlmStatusRuntime();
  }, []);
  const snapshot = useSyncExternalStore(
    subscribeLlmStatusRuntime,
    getLlmStatusRuntimeState,
    getLlmStatusRuntimeState,
  );
  const refresh = useCallback(() => refreshLlmStatusRuntime(), []);
  return useMemo(() => ({ ...snapshot, refresh }), [snapshot, refresh]);
}
