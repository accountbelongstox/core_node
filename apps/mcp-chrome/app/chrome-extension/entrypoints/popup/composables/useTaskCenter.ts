/**
 * Task Center Composable
 * Controls the unified task center from popup UI
 * Under 200 lines
 */

import { ref, onUnmounted } from 'vue';
import { apiManager } from '@/services/ApiManager';

// ==================== Live task drilldown (detail / events / SSE stream) ====================
// laravel_main control-plane SSE route (no-auth), tailed straight from the popup
// over the browser-native EventSource (background WorkerApiClient is for the
// worker-pull contract, not this drilldown). Field names + event names mirror
// TaskController::stream() and ServerManagerAPI.subscribeTaskDetail() EXACTLY:
//   GET  {base}/api/task/{id}/stream?cursor=<lastEventId>
//   task.detail-initial → full detail bundle (task + events + current_phase + metadata)
//   task.event          → one transition (carries `_id` = resume cursor)
//   ping                → keep-alive ({cursor})
//   stream.close        → server close ({cursor, done}); done!==true => reconnect from cursor

/** One status-transition row in a task's event timeline (TaskController detail/stream). */
export interface TaskStreamEvent {
  id: number | string;
  /** Present on streamed `task.event` frames (the resume cursor); absent in the snapshot. */
  _id?: number | string;
  task_id?: string;
  event: string;
  worker_id: string | null;
  attempt: number | null;
  detail: any;
  created_at: string | null;
}

/** The richer task object inside the detail bundle (data.task). */
export interface TaskStreamTask {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: string;
  capability: string | null;
  is_fast_tier: boolean;
  status: string;
  priority: number;
  progress: any;
  payload: any;
  result: any;
  error: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  timeout_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Full `task.detail-initial` payload (same shape as GET …/detail data). */
export interface TaskStreamBundle {
  task: TaskStreamTask;
  events: TaskStreamEvent[];
  current_phase: {
    phase: string | null;
    worker_id: string | null;
    elapsed_seconds: number | null;
  };
  metadata: {
    total_attempts: number;
    max_retries: number;
    will_retry: boolean;
    estimated_timeout_in_seconds: number | null;
  };
}

/** Callbacks for subscribeToTaskStream()'s EventSource lifecycle. */
export interface TaskStreamHandlers {
  onInitial?: (bundle: TaskStreamBundle) => void;
  onEvent?: (event: TaskStreamEvent) => void;
  onPing?: (cursor: string | null) => void;
  /** stream.close — done===true is terminal (no reconnect); done!==true reconnects from cursor. */
  onClose?: (cursor: string | null, done: boolean) => void;
  onError?: (err: Event) => void;
}

/** Handle returned by subscribeToTaskStream(); call close() to tear it down. */
export interface TaskStreamHandle {
  close: () => void;
}

/**
 * Subscribe to a task's live SSE stream and fold frames into `handlers`.
 *
 * Reconnect contract (mirrors ServerManagerAPI.subscribeTaskDetail): on a
 * server `stream.close`, reopen from the last cursor ONLY when `data.done !==
 * true` and the task has not reached a locally-observed terminal event — a
 * `done:true` close means a terminal status (no reconnect). Transport errors
 * are handled by the native EventSource auto-reconnect. close() is idempotent.
 */
export function subscribeToTaskStream(taskId: string, handlers: TaskStreamHandlers): TaskStreamHandle {
  let source: EventSource | null = null;
  let cursor: string | null = null;
  let closed = false;
  let terminal = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // apiManager.getCurrentBaseUrl() returns `protocol://host[:port]/` — strip the
  // trailing slash so we land on exactly `{base}/api/task/{id}/stream`.
  const apiBase = (): string => apiManager.getCurrentBaseUrl().replace(/\/+$/, '');

  const buildUrl = (): string => {
    const url = `${apiBase()}/api/task/${encodeURIComponent(taskId)}/stream`;
    return cursor !== null ? `${url}?cursor=${encodeURIComponent(cursor)}` : url;
  };

  const parse = (raw: string): any => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const teardownStream = (): void => {
    if (source) {
      try { source.close(); } catch { /* ignore */ }
      source = null;
    }
  };

  const open = (): void => {
    if (closed || typeof EventSource === 'undefined') return;

    const es = new EventSource(buildUrl());
    source = es;

    es.addEventListener('task.detail-initial', (ev) => {
      const data = parse((ev as MessageEvent).data) as TaskStreamBundle | null;
      if (data) handlers.onInitial?.(data);
    });

    es.addEventListener('task.event', (ev) => {
      const data = parse((ev as MessageEvent).data) as TaskStreamEvent | null;
      if (!data) return;
      const id = data._id ?? data.id;
      if (id !== undefined && id !== null) cursor = String(id);
      // Belt-and-suspenders for the close contract: completed/cancelled are
      // unambiguously terminal. failed/timeout may be retried (re-pended).
      if (data.event === 'completed' || data.event === 'cancelled') terminal = true;
      handlers.onEvent?.(data);
    });

    es.addEventListener('ping', (ev) => {
      const data = parse((ev as MessageEvent).data);
      if (data && data.cursor != null) cursor = String(data.cursor);
      handlers.onPing?.(cursor);
    });

    es.addEventListener('stream.close', (ev) => {
      const data = parse((ev as MessageEvent).data);
      if (data && data.cursor != null) cursor = String(data.cursor);
      const done = data?.done === true;
      handlers.onClose?.(cursor, done);
      teardownStream();
      // Reconnect-from-cursor only when the server says the task is still live.
      if (!closed && !done && !terminal) {
        reconnectTimer = setTimeout(open, 1500);
      }
    });

    es.onerror = (err) => {
      handlers.onError?.(err);
      // Let the native EventSource reconnect from buildUrl() (server de-dupes by
      // cursor); tearing down here would race the browser's own retry.
    };
  };

  open();

  return {
    close: () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      teardownStream();
    },
  };
}

export interface TaskCenterConfig {
  apiUrl: string;
  pollInterval?: number;
  processors: {
    [processorType: string]: any;
  };
}

export interface ProcessorStatus {
  isRunning: boolean;
  stats: {
    pending: number;
    translated: number;
    failed: number;
    lastRun: number | null;
    workerId: string | null;
    isOnline: boolean;
    queueTotal: number;
    newTasks: number;
    duplicateTasks: number;
    [key: string]: any;
  };
}

export interface TaskCenterStats {
  totalProcessors: number;
  runningProcessors: number;
  totalPending: number;
  totalTranslated: number;
  totalFailed: number;
  processors: {
    [processorType: string]: ProcessorStatus;
  };
}

export interface TaskCenterState {
  isRunning: boolean;
  stats: TaskCenterStats | null;
}

export function useTaskCenter() {
  const isActive = ref(false);
  const config = ref<TaskCenterConfig>({
    apiUrl: '',
    pollInterval: 5,
    processors: {
      bing_dictionary: {
        apiUrl: '',
        pollInterval: 5,
        batchSize: 5,
      },
    },
  });
  const state = ref<TaskCenterState>({
    isRunning: false,
    stats: null,
  });
  const error = ref('');

  let statsPollingInterval: ReturnType<typeof setInterval> | null = null;

  const toggleTaskCenter = async () => {
    isActive.value = !isActive.value;
    await chrome.storage.local.set({ task_center_active: isActive.value });

    if (isActive.value) {
      await loadConfig();
      await loadState();
      startStatsPolling();
    } else {
      stopStatsPolling();
      if (state.value.isRunning) {
        await stopTaskCenter();
      }
    }
  };

  const saveConfig = async () => {
    try {
      await chrome.storage.local.set({ task_center_config: config.value });
      console.log('[Task Center] Config saved');
    } catch (err) {
      console.error('[Task Center] Failed to save config:', err);
    }
  };

  const loadConfig = async () => {
    try {
      const result = await chrome.storage.local.get('task_center_config');
      if (result.task_center_config) {
        config.value = { ...config.value, ...result.task_center_config };
      }
    } catch (err) {
      console.error('[Task Center] Failed to load config:', err);
    }
  };

  const startTaskCenter = async () => {
    try {
      // Always use the single endpoint configured in Settings (shared ApiManager).
      await apiManager.initialize({ autoDetect: false });
      config.value.apiUrl = apiManager.getCurrentBaseUrl();
      const response = await chrome.runtime.sendMessage({
        type: 'task_center',
        action: 'start',
        config: config.value,
      });

      if (response && response.success) {
        state.value.isRunning = true;
        console.log('[Task Center] Started successfully');
      } else {
        console.error('[Task Center] Failed to start:', response?.error);
        error.value = response?.error || 'Failed to start Task Center';
      }
    } catch (err: any) {
      console.error('[Task Center] Start error:', err);
      error.value = err.message || 'Failed to start Task Center';
    }
  };

  const stopTaskCenter = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'task_center',
        action: 'stop',
      });

      if (response && response.success) {
        state.value.isRunning = false;
        console.log('[Task Center] Stopped successfully');
      } else {
        console.error('[Task Center] Failed to stop:', response?.error);
        error.value = response?.error || 'Failed to stop Task Center';
      }
    } catch (err: any) {
      console.error('[Task Center] Stop error:', err);
      error.value = err.message || 'Failed to stop Task Center';
    }
  };

  const loadState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'task_center',
        action: 'get_status',
      });

      if (response && response.success) {
        state.value.isRunning = response.isRunning;
        state.value.stats = response.stats;
      }
    } catch (err) {
      console.error('[Task Center] Failed to load state:', err);
    }
  };

  const startStatsPolling = () => {
    if (statsPollingInterval) return;

    statsPollingInterval = setInterval(async () => {
      await loadState();
    }, 3000);
  };

  const stopStatsPolling = () => {
    if (statsPollingInterval) {
      clearInterval(statsPollingInterval);
      statsPollingInterval = null;
    }
  };

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
  };

  const initialize = async () => {
    const result = await chrome.storage.local.get('task_center_active');
    if (result.task_center_active) {
      isActive.value = result.task_center_active;
      await loadConfig();
      await loadState();
      if (isActive.value) {
        startStatsPolling();
      }
    }
  };

  onUnmounted(() => {
    stopStatsPolling();
  });

  return {
    isActive,
    config,
    state,
    error,
    toggleTaskCenter,
    saveConfig,
    startTaskCenter,
    stopTaskCenter,
    formatTimestamp,
    initialize,
  };
}
