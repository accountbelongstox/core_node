import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  connectPycoreHttp,
  pycoreApi,
  pycoreEventBus,
  pycoreRouteRecoveryStore,
  PYCORE_BROWSER_EVENTS,
  PYCORE_EVENT_TOPICS,
  PYCORE_HTTP_ROUTES,
  requestPycoreHttp,
} from '../../../core/integrations/pycore';

const STORE_EVENT = 'pycore-agent-history-runtime-changed';
const OPERATION_REFRESH_MIN_MS = 5000;
const OPERATION_EVENT_DEBOUNCE_MS = 250;
const PIPELINE_SCOPES = new Set(['agent_history', 'agent_history_pipeline']);

export interface AgentHistoryRuntimeState {
  articleConfig: Record<string, any> | null;
  articleSummary: Record<string, any> | null;
  operationSnapshot: Record<string, any> | null;
  aiDashboard: Record<string, any> | null;
  configLoading: boolean;
  operationLoading: boolean;
  initialized: boolean;
  authoritative: boolean;
  configError: string | null;
  operationError: string | null;
}

let state: AgentHistoryRuntimeState = {
  articleConfig: null,
  articleSummary: null,
  operationSnapshot: null,
  aiDashboard: null,
  configLoading: true,
  operationLoading: true,
  initialized: false,
  authoritative: false,
  configError: null,
  operationError: null,
};
const recovered = pycoreRouteRecoveryStore.read<AgentHistoryRuntimeState>(
  PYCORE_HTTP_ROUTES.agentHistoryRuntimeGet,
  {},
);
if (recovered?.data) {
  state = {
    ...recovered.data,
    configLoading: false,
    operationLoading: false,
    initialized: true,
    authoritative: false,
  };
}
let operationFlight: Promise<void> | null = null;
let runtimeFlight: Promise<void> | null = null;
let operationRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let runtimeUnsubscribers: Array<() => void> = [];
let consumerCount = 0;
let lastOperationReadAt = 0;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function notify(): void {
  window.dispatchEvent(new CustomEvent(STORE_EVENT));
}

function schedulePersist(): void {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    pycoreRouteRecoveryStore.write(
      PYCORE_HTTP_ROUTES.agentHistoryRuntimeGet,
      {},
      state,
      { revision: String(state.operationSnapshot?.operation?.revision || '') },
    );
  }, 250);
}

function patch(partial: Partial<AgentHistoryRuntimeState>): void {
  state = { ...state, ...partial };
  schedulePersist();
  notify();
}

export function getAgentHistoryRuntimeState(): AgentHistoryRuntimeState {
  return state;
}

export function subscribeAgentHistoryRuntime(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(STORE_EVENT, handler);
  return () => window.removeEventListener(STORE_EVENT, handler);
}

export function setAgentHistoryArticleConfig(config: Record<string, any>): void {
  patch({ articleConfig: config, configError: null });
}

export async function refreshAgentHistoryRuntime(): Promise<void> {
  if (runtimeFlight) return runtimeFlight;
  patch({ configLoading: true, operationLoading: true });
  runtimeFlight = pycoreApi.getAgentHistoryRuntime()
    .then((response) => {
      if (!response.success || !response.data) {
        const error = response.error || 'AGENT_HISTORY_RUNTIME_UNAVAILABLE';
        patch({ configError: error, operationError: error });
        return;
      }
      patch({
        articleConfig: response.data.article_config || null,
        articleSummary: response.data.article_summary || null,
        operationSnapshot: response.data.operation_snapshot || null,
        aiDashboard: response.data.ai_dashboard || null,
        configError: null,
        operationError: null,
        authoritative: true,
      });
      lastOperationReadAt = Date.now();
    })
    .catch((error: unknown) => {
      const message = errorMessage(error, 'AGENT_HISTORY_RUNTIME_UNAVAILABLE');
      patch({ configError: message, operationError: message });
    })
    .finally(() => {
      runtimeFlight = null;
      patch({
        configLoading: false,
        operationLoading: false,
        initialized: true,
      });
    });
  return runtimeFlight;
}

export async function refreshAgentHistoryOperation(force = false): Promise<void> {
  const now = Date.now();
  if (operationFlight) return operationFlight;
  if (!force && now - lastOperationReadAt < OPERATION_REFRESH_MIN_MS) return;
  patch({ operationLoading: true });
  operationFlight = requestPycoreHttp(PYCORE_HTTP_ROUTES.operationSnapshot, {
    scope: 'agent_history',
    include_items: false,
  })
    .then((response) => {
      lastOperationReadAt = Date.now();
      if (response?.success && response.data) {
        patch({ operationSnapshot: response.data, operationError: null });
        return;
      }
      patch({ operationError: response?.error || 'AGENT_HISTORY_OPERATION_UNAVAILABLE' });
    })
    .catch((error: unknown) => {
      lastOperationReadAt = Date.now();
      patch({ operationError: errorMessage(error, 'AGENT_HISTORY_OPERATION_UNAVAILABLE') });
    })
    .finally(() => {
      operationFlight = null;
      patch({ operationLoading: false });
    });
  return operationFlight;
}

function scheduleOperationRefresh(): void {
  const elapsed = Date.now() - lastOperationReadAt;
  const delay = Math.max(
    OPERATION_EVENT_DEBOUNCE_MS,
    OPERATION_REFRESH_MIN_MS - elapsed,
  );
  if (operationRefreshTimer !== null) clearTimeout(operationRefreshTimer);
  operationRefreshTimer = setTimeout(() => {
    operationRefreshTimer = null;
    void refreshAgentHistoryRuntime();
  }, delay);
}

function applyOperationEvent(payload: Record<string, any>): void {
  const current = state.operationSnapshot || {};
  const currentOperation = current.operation || {};
  const eventType = String(payload.event_type || '');
  const statusByType: Record<string, string> = {
    'operation.started': 'running',
    'operation.completed': 'completed',
    'operation.failed': 'failed',
    'operation.cancel_requested': 'cancel_requested',
    'operation.cancelled': 'cancelled',
  };
  const recentEvents = [
    {
      seq: payload.operation_event_seq,
      event_id: payload.event_id,
      level: payload.level,
      type: eventType,
      message: payload.message,
      created_at: payload.created_at,
    },
    ...(Array.isArray(current.recent_events) ? current.recent_events : []),
  ].slice(0, 50);
  patch({
    operationSnapshot: {
      ...current,
      operation: {
        ...currentOperation,
        id: payload.operation_id || currentOperation.id,
        revision: payload.operation_revision || currentOperation.revision,
        status: statusByType[eventType] || currentOperation.status,
        totals: payload.totals || currentOperation.totals,
        timestamps: {
          ...(currentOperation.timestamps || {}),
          updated_at: payload.created_at,
        },
      },
      recent_events: recentEvents,
      current_item: payload.operation_item_id ? {
        id: payload.operation_item_id,
        status: payload.item_status,
        stage: payload.stage,
        progress: payload.progress,
        updated_at: payload.created_at,
      } : current.current_item,
    },
    operationError: null,
  });
}

function startAgentHistoryRuntime(): void {
  consumerCount += 1;
  if (consumerCount !== 1) return;
  connectPycoreHttp();
  runtimeUnsubscribers = [
    pycoreEventBus.subscribe(
      PYCORE_EVENT_TOPICS.operationChanged,
      (payload: any) => {
        const scope = String(payload?.operation_scope || '');
        if (!PIPELINE_SCOPES.has(scope)) return;
        applyOperationEvent(payload || {});
        scheduleOperationRefresh();
      },
    ),
    pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => {
      void refreshAgentHistoryRuntime();
    }),
    pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventReplayLost, () => {
      void refreshAgentHistoryRuntime();
    }),
  ];
  void refreshAgentHistoryRuntime();
}

function stopAgentHistoryRuntime(): void {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount !== 0) return;
  if (operationRefreshTimer !== null) {
    clearTimeout(operationRefreshTimer);
    operationRefreshTimer = null;
  }
  runtimeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  runtimeUnsubscribers = [];
}

export interface AgentHistoryRuntimeHook extends AgentHistoryRuntimeState {
  refresh: () => Promise<void>;
}

export function useAgentHistoryRuntime(): AgentHistoryRuntimeHook {
  useEffect(() => {
    startAgentHistoryRuntime();
    return () => stopAgentHistoryRuntime();
  }, []);

  const snapshot = useSyncExternalStore(
    subscribeAgentHistoryRuntime,
    getAgentHistoryRuntimeState,
    getAgentHistoryRuntimeState,
  );
  const refresh = useCallback(() => refreshAgentHistoryRuntime(), []);
  return useMemo(
    () => ({ ...snapshot, refresh }),
    [snapshot, refresh],
  );
}
