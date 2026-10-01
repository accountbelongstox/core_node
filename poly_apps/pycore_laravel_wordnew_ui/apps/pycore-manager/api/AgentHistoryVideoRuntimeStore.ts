import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  createPycoreLiveSource,
  pycoreApi,
  pycoreRouteRecoveryStore,
  PYCORE_EVENT_TOPICS,
  PYCORE_HTTP_ROUTES,
} from '../../../core/integrations/pycore';
import type { AgentHistoryVideoJob } from '../../../core/integrations/pycore';
import { createRuntimeStore, type RuntimeStore } from '../../../core/persistence/RuntimeStore';

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
  private store: RuntimeStore<AgentHistoryVideoRuntimeState>;
  private flight: Promise<void> | null = null;
  private readonly liveSource = createPycoreLiveSource({
    topics: {
      [PYCORE_EVENT_TOPICS.agentHistoryVideoChanged]: () => { void this.refresh(); },
      [PYCORE_EVENT_TOPICS.articlePublished]: () => { void this.refresh(); },
    },
    refresh: () => this.refresh(),
    fallbackMs: VIDEO_REFRESH_MS,
  });

  constructor() {
    this.store = createRuntimeStore<AgentHistoryVideoRuntimeState>({
      defaults: () => ({ jobs: [], revision: '', loading: true, initialized: false, error: null }),
      restore: () => {
        const recovered = pycoreRouteRecoveryStore.read<AgentHistoryVideoRuntimeState>(
          PYCORE_HTTP_ROUTES.agentHistoryArticleVideoLogs,
          { limit: VIDEO_LOG_LIMIT },
        );
        return recovered?.data
          ? { ...recovered.data, loading: false, initialized: true, error: null }
          : null;
      },
      errorFallback: 'AGENT_HISTORY_VIDEO_LOGS_UNAVAILABLE',
    });
  }

  getSnapshot = (): AgentHistoryVideoRuntimeState => this.store.getState();

  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  private patch(value: Partial<AgentHistoryVideoRuntimeState>): void {
    this.store.patch(value);
  }

  refresh = async (): Promise<void> => {
    if (this.flight) return this.flight;
    this.patch({ loading: !this.store.getState().initialized });
    this.flight = pycoreApi.getAgentHistoryVideoLogs(this.store.getState().revision, VIDEO_LOG_LIMIT)
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
        pycoreRouteRecoveryStore.write(
          PYCORE_HTTP_ROUTES.agentHistoryArticleVideoLogs,
          { limit: VIDEO_LOG_LIMIT },
          nextState,
          { revision: nextState.revision },
        );
        this.store.patch(nextState);
      })
      .catch((error: unknown) => {
        this.patch({ error: this.store.errorMessage(error) });
      })
      .finally(() => {
        this.flight = null;
        this.patch({ loading: false, initialized: true });
      });
    return this.flight;
  };

  start(): void {
    this.liveSource.retain();
  }

  stop(): void {
    this.liveSource.release();
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
