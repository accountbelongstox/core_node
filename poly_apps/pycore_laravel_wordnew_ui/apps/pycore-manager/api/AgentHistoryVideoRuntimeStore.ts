import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  connectPycoreHttp,
  pycoreApi,
  pycoreEventBus,
  pycoreRouteRecoveryStore,
  PYCORE_BROWSER_EVENTS,
  PYCORE_EVENT_TOPICS,
  PYCORE_HTTP_ROUTES,
} from '../../../core/integrations/pycore';
import type { AgentHistoryVideoJob } from '../../../core/integrations/pycore';

const VIDEO_LOG_LIMIT = 100;
const VIDEO_REFRESH_MS = 2000;

export interface AgentHistoryVideoRuntimeState {
  jobs: AgentHistoryVideoJob[];
  revision: string;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

class AgentHistoryVideoRuntimeStore {
  private state: AgentHistoryVideoRuntimeState;
  private listeners = new Set<() => void>();
  private flight: Promise<void> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unsubscribers: Array<() => void> = [];
  private consumers = 0;

  constructor() {
    const recovered = pycoreRouteRecoveryStore.read<AgentHistoryVideoRuntimeState>(
      PYCORE_HTTP_ROUTES.agentHistoryArticleVideoLogs,
      { limit: VIDEO_LOG_LIMIT },
    );
    this.state = recovered?.data
      ? { ...recovered.data, loading: false, initialized: true, error: null }
      : { jobs: [], revision: '', loading: true, initialized: false, error: null };
  }

  getSnapshot = (): AgentHistoryVideoRuntimeState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(value: Partial<AgentHistoryVideoRuntimeState>): void {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }

  refresh = async (): Promise<void> => {
    if (this.flight) return this.flight;
    this.patch({ loading: !this.state.initialized });
    this.flight = pycoreApi.getAgentHistoryVideoLogs(this.state.revision, VIDEO_LOG_LIMIT)
      .then((response) => {
        if (!response.success || !response.data) {
          this.patch({ error: response.error || 'AGENT_HISTORY_VIDEO_LOGS_UNAVAILABLE' });
          return;
        }
        if (response.data.unchanged) {
          this.patch({ error: null, initialized: true });
          return;
        }
        const nextState: AgentHistoryVideoRuntimeState = {
          jobs: response.data.jobs || [],
          revision: response.data.revision || '',
          loading: false,
          initialized: true,
          error: null,
        };
        this.state = nextState;
        pycoreRouteRecoveryStore.write(
          PYCORE_HTTP_ROUTES.agentHistoryArticleVideoLogs,
          { limit: VIDEO_LOG_LIMIT },
          nextState,
          { revision: nextState.revision },
        );
        this.listeners.forEach((listener) => listener());
      })
      .catch((error: unknown) => {
        this.patch({ error: error instanceof Error ? error.message : 'AGENT_HISTORY_VIDEO_LOGS_UNAVAILABLE' });
      })
      .finally(() => {
        this.flight = null;
        this.patch({ loading: false, initialized: true });
      });
    return this.flight;
  };

  start(): void {
    this.consumers += 1;
    if (this.consumers !== 1) return;
    connectPycoreHttp();
    const refresh = () => { void this.refresh(); };
    this.unsubscribers = [
      pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.agentHistoryVideoChanged, refresh),
      pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.articlePublished, refresh),
      pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, refresh),
      pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventReplayLost, refresh),
    ];
    this.interval = setInterval(refresh, VIDEO_REFRESH_MS);
    refresh();
  }

  stop(): void {
    this.consumers = Math.max(0, this.consumers - 1);
    if (this.consumers !== 0) return;
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }
}

export const agentHistoryVideoRuntimeStore = new AgentHistoryVideoRuntimeStore();

export function useAgentHistoryVideoRuntime(): AgentHistoryVideoRuntimeState & { refresh: () => Promise<void> } {
  useEffect(() => {
    agentHistoryVideoRuntimeStore.start();
    return () => agentHistoryVideoRuntimeStore.stop();
  }, []);
  const state = useSyncExternalStore(
    agentHistoryVideoRuntimeStore.subscribe,
    agentHistoryVideoRuntimeStore.getSnapshot,
    agentHistoryVideoRuntimeStore.getSnapshot,
  );
  const refresh = useCallback(() => agentHistoryVideoRuntimeStore.refresh(), []);
  return useMemo(() => ({ ...state, refresh }), [state, refresh]);
}
