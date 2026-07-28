/**
 * Task Center Composable
 * Controls the unified task center from popup UI
 * Under 200 lines
 */

import { ref, onUnmounted, watch } from 'vue';
import { apiManager, getApiBase } from '@/services/ApiManager';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { logger } from '@/utils/logger';
import { formatTimestamp } from '@/utils/time-helpers';
import type { CapabilityKey } from '@/utils/task-capabilities';
import { taskPath } from '@/utils/api-paths';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { LANES } from '@/utils/task-center-lanes';
import type {
  TaskDetail,
  TaskDetailBundle,
  TaskEvent,
} from '@/utils/queue-center-contract';
// Canonical control-protocol types + message constants (shared with background).
import {
  TASK_CENTER_MSG,
  VALIDITY_RUNNER_MSG,
  TASK_CENTER_DEFAULTS,
  type TaskCenterConfig,
  type TaskCenterStats,
  type ProcessorStatus,
  type BackendHealth,
  type ValidityStatus,
  type FullTaskCenterStatus,
} from '@/utils/task-center-types';

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

// Compatibility names retained for existing modal imports. Their definitions
// now come from the shared Laravel/Pycore/mcp-chrome task contract.
export type TaskStreamEvent = TaskEvent;
export type TaskStreamTask = TaskDetail;
export type TaskStreamBundle = TaskDetailBundle;

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

  // getApiBase() returns `protocol://host[:port]` (trailing slash stripped) so we
  // land on exactly `{base}/api/task/{id}/stream`.
  const apiBase = getApiBase;

  const buildUrl = (): string => {
    const url = `${apiBase()}${taskPath(taskId, 'stream')}`;
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

/** Config forwarded to the background client-driven validity runner. */
export interface ValidityRunnerConfig {
  apiUrl?: string;
  language?: string;
  limit?: number;
}

interface StoredBingWorkerConfig {
  fetchInterval?: number;
  batchSize?: number;
  tabCount?: number;
  sourceLanguage?: string;
  targetLanguage?: string;
}

// TaskCenterConfig / TaskCenterStats / ProcessorStatus / BackendHealth /
// ValidityStatus are imported from the shared canonical module — no local copies.
export type { TaskCenterConfig, TaskCenterStats, ProcessorStatus, ValidityStatus };

/** Popup-local reactive state, built from the shared status shapes. */
export interface TaskCenterState {
  isRunning: boolean;
  activeApiUrl: string | null;
  stats: TaskCenterStats | null;
  backend: BackendHealth | null;
  validity: ValidityStatus | null;
  activeCapabilities: CapabilityKey[];
}

export function useTaskCenter() {
  const isActive = ref(false);
  const { apiBaseUrl } = useApiEndpoint();
  const config = ref<TaskCenterConfig>({
    apiUrl: '',
    pollInterval: TASK_CENTER_DEFAULTS.pollInterval,
    processors: {
      bing_dictionary: {
        apiUrl: '',
        pollInterval: TASK_CENTER_DEFAULTS.pollInterval,
        batchSize: TASK_CENTER_DEFAULTS.batchSize,
      },
    },
  });
  const state = ref<TaskCenterState>({
    isRunning: false,
    activeApiUrl: null,
    stats: null,
    backend: null,
    validity: null,
    activeCapabilities: [],
  });
  const error = ref('');
  let endpointRequestVersion = 0;
  let endpointRequestQueue: Promise<void> = Promise.resolve();

  watch(apiBaseUrl, (url) => {
    if (!url) return;
    config.value.apiUrl = url;
    if (config.value.processors?.bing_dictionary) {
      config.value.processors.bing_dictionary.apiUrl = url.replace(/\/+$/, '');
    }
  }, { immediate: true });

  let statsPollingInterval: ReturnType<typeof setInterval> | null = null;

  const toggleTaskCenter = async () => {
    isActive.value = !isActive.value;
    await chrome.storage.local.set({ [STORAGE_KEYS.TASK_CENTER_ACTIVE]: isActive.value });

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

  const LOG = 'Task Center';

  const saveConfig = async () => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.TASK_CENTER_CONFIG]: config.value });
      logger.debug(LOG, 'Config saved');
    } catch (err) {
      logger.error(LOG, 'Failed to save config', err);
    }
  };

  const loadConfig = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TASK_CENTER_CONFIG);
      if (result[STORAGE_KEYS.TASK_CENTER_CONFIG]) {
        config.value = { ...config.value, ...result[STORAGE_KEYS.TASK_CENTER_CONFIG] };
      }
    } catch (err) {
      logger.error(LOG, 'Failed to load config', err);
    }
  };

  const loadRuntimeProcessorSettings = async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG);
    const stored = (result[STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG] || {}) as StoredBingWorkerConfig;
    const apiUrl = config.value.apiUrl.replace(/\/+$/, '');
    const current = config.value.processors?.[LANES.BING_DICTIONARY] || { apiUrl };
    config.value.processors = {
      ...(config.value.processors || {}),
      [LANES.BING_DICTIONARY]: {
        ...current,
        apiUrl,
        pollInterval: Math.max(
          1,
          Math.min(3600, Math.round(Number(stored.fetchInterval) || TASK_CENTER_DEFAULTS.pollInterval)),
        ),
        batchSize: Math.max(
          1,
          Math.min(50, Math.round(Number(stored.batchSize) || TASK_CENTER_DEFAULTS.batchSize)),
        ),
        tabCount: Math.max(1, Math.min(8, Math.round(Number(stored.tabCount) || 3))),
        sourceLanguage: String(stored.sourceLanguage || 'en').trim().toLowerCase(),
        targetLanguage: String(stored.targetLanguage || 'zh').trim().toLowerCase(),
      },
    };
  };

  // Start the center with the checked capability keys. The background
  // derives the concrete processorTypes; the popup only names capabilities.
  const startTaskCenter = async (activeCapabilities: CapabilityKey[]) => {
    try {
      error.value = '';
      await apiManager.initialize({ autoDetect: false });
      config.value.apiUrl = apiManager.getCurrentBaseUrl();
      await loadRuntimeProcessorSettings();
      await saveConfig();
      const response = await chrome.runtime.sendMessage({
        type: TASK_CENTER_MSG,
        action: 'start',
        config: {
          ...config.value,
          processors: { ...(config.value.processors || {}) },
          activeCapabilities,
        },
      });

      if (response && response.success) {
        state.value.isRunning = true;
        logger.info(LOG, 'Started successfully');
        await loadState();
        // Keep the backend-health + validity-progress strip live while running.
        startStatsPolling();
      } else {
        logger.error(LOG, 'Failed to start', response?.error);
        error.value = response?.error || 'Failed to start Task Center';
      }
    } catch (err: any) {
      logger.error(LOG, 'Start error', err);
      error.value = err.message || 'Failed to start Task Center';
    }
  };

  // Live switch: flip a single capability on/off without a full restart. The
  // background enables/disables the lane (and the validity runner) in place.
  const setCapability = async (capability: CapabilityKey, enabled: boolean) => {
    try {
      error.value = '';
      await loadRuntimeProcessorSettings();
      const response = await chrome.runtime.sendMessage({
        type: TASK_CENTER_MSG,
        action: 'set_capability',
        capability,
        enabled,
        config: {
          ...config.value,
          processors: { ...(config.value.processors || {}) },
        },
      });

      if (response && response.success) {
        logger.info(LOG, `Capability ${capability} -> ${enabled}`);
        await loadState();
        return true;
      } else {
        logger.error(LOG, 'Failed to set capability', response?.error);
        error.value = response?.error || 'Failed to update capability';
        return false;
      }
    } catch (err: any) {
      logger.error(LOG, 'Set capability error', err);
      error.value = err.message || 'Failed to update capability';
      return false;
    }
  };

  const stopTaskCenter = async () => {
    try {
      error.value = '';
      const response = await chrome.runtime.sendMessage({
        type: TASK_CENTER_MSG,
        action: 'stop',
      });

      if (response && response.success) {
        state.value.isRunning = false;
        logger.info(LOG, 'Stopped successfully');
        // Reflect the final stopped status, then halt the recurring poll.
        await loadState();
        stopStatsPolling();
      } else {
        logger.error(LOG, 'Failed to stop', response?.error);
        error.value = response?.error || 'Failed to stop Task Center';
      }
    } catch (err: any) {
      logger.error(LOG, 'Stop error', err);
      error.value = err.message || 'Failed to stop Task Center';
    }
  };

  const reconfigureTaskCenter = async () => {
    if (!state.value.isRunning || state.value.activeCapabilities.length === 0) return;
    try {
      error.value = '';
      await loadRuntimeProcessorSettings();
      await saveConfig();
      const response = await chrome.runtime.sendMessage({
        type: TASK_CENTER_MSG,
        action: 'reconfigure',
        config: {
          ...config.value,
          processors: { ...(config.value.processors || {}) },
          activeCapabilities: [...state.value.activeCapabilities],
        },
      });
      if (!response?.success) {
        error.value = response?.error || 'Failed to switch the running API endpoint';
        logger.error(LOG, 'Endpoint reconfiguration failed', response?.error);
      }
      await loadState();
    } catch (err: any) {
      error.value = err?.message || 'Failed to switch the running API endpoint';
      logger.error(LOG, 'Endpoint reconfiguration error', err);
      await loadState();
    }
  };

  watch(apiBaseUrl, (url) => {
    const next = String(url || '').replace(/\/+$/, '');
    const active = String(state.value.activeApiUrl || '').replace(/\/+$/, '');
    if (!next || !state.value.isRunning || (active && next === active)) return;

    const version = ++endpointRequestVersion;
    endpointRequestQueue = endpointRequestQueue.then(async () => {
      if (version !== endpointRequestVersion) return;
      await reconfigureTaskCenter();
    });
    endpointRequestQueue = endpointRequestQueue.catch((err) => {
      logger.error(LOG, 'Queued endpoint reconfiguration failed', err);
    });
  });

  const startValidityRunner = async (runnerConfig?: ValidityRunnerConfig) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: VALIDITY_RUNNER_MSG,
        action: 'start',
        config: { apiUrl: config.value.apiUrl, ...(runnerConfig || {}) },
      });
      if (response && response.success) {
        logger.info(LOG, 'Validity runner started');
      } else {
        logger.error(LOG, 'Failed to start validity runner', response?.error);
      }
    } catch (err: any) {
      logger.error(LOG, 'Validity runner start error', err);
    }
  };

  const stopValidityRunner = async () => {
    try {
      await chrome.runtime.sendMessage({ type: VALIDITY_RUNNER_MSG, action: 'stop' });
      logger.info(LOG, 'Validity runner stopped');
    } catch (err: any) {
      logger.error(LOG, 'Validity runner stop error', err);
    }
  };

  const loadState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: TASK_CENTER_MSG,
        action: 'get_status',
      });

      if (response && response.success) {
        const status = response as { success: boolean } & FullTaskCenterStatus;
        state.value.isRunning = status.isRunning;
        state.value.activeApiUrl = status.activeApiUrl ?? null;
        state.value.stats = status.stats;
        state.value.backend = status.backend ?? null;
        state.value.validity = status.validity ?? null;
        state.value.activeCapabilities = Array.isArray(status.activeCapabilities)
          ? status.activeCapabilities
          : [];
      }
    } catch (err) {
      logger.error(LOG, 'Failed to load state', err);
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

  const initialize = async () => {
    // Always reconcile with the background so reopening the popup mid-run shows
    // the true state; resume the live poll whenever the center is running (the
    // background run-intent, not a popup flag, is the source of truth now).
    const result = await chrome.storage.local.get(STORAGE_KEYS.TASK_CENTER_ACTIVE);
    isActive.value = result[STORAGE_KEYS.TASK_CENTER_ACTIVE] === true;
    await loadConfig();
    if (apiBaseUrl.value) {
      config.value.apiUrl = apiBaseUrl.value;
      if (config.value.processors?.[LANES.BING_DICTIONARY]) {
        config.value.processors[LANES.BING_DICTIONARY].apiUrl = apiBaseUrl.value.replace(/\/+$/, '');
      }
    }
    await loadState();
    const selectedApiUrl = config.value.apiUrl.replace(/\/+$/, '');
    const activeApiUrl = String(state.value.activeApiUrl || '').replace(/\/+$/, '');
    if (state.value.isRunning && activeApiUrl && selectedApiUrl && activeApiUrl !== selectedApiUrl) {
      await reconfigureTaskCenter();
    }
    if (state.value.isRunning) {
      startStatsPolling();
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
    setCapability,
    startValidityRunner,
    stopValidityRunner,
    formatTimestamp,
    initialize,
  };
}
