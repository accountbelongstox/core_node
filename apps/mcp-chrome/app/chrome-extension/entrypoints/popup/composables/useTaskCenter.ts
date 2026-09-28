/**
 * Task Center Composable
 * Controls the unified task center from popup UI
 * Under 200 lines
 */

import { ref, onUnmounted } from 'vue';
import { currentApiClient, getApiBase } from '@/services/ApiManager';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { WorkerApiClient } from '@/entrypoints/background/api/WorkerApiClient';
import { logger } from '@/utils/logger';
import { getMessage } from '@/utils/i18n';
import { formatTimestamp } from '@/utils/time-helpers';
import type { CapabilityKey } from '@/utils/task-capabilities';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { LANES } from '@/utils/task-center-lanes';
import type {
  TaskDetail,
  TaskDetailBundle,
  TaskEvent,
} from '@/utils/queue-center-contract';
import { TERMINAL_TASK_STATUSES } from '@/utils/queue-center-contract';
import { queueCenterWakeService } from '@/entrypoints/background/services/task-center/QueueCenterWakeService';
import { AsyncOperationController, IntervalController } from '@/utils/async';
// Canonical control-protocol types + message constants (shared with background).
import {
  TASK_CENTER_MSG,
  TASK_CENTER_DEFAULTS,
  toTaskCenterSettings,
  type TaskCenterConfig,
  type TaskCenterSettings,
  type TaskCenterStats,
  type ProcessorStatus,
  type BackendHealth,
  type FullTaskCenterStatus,
} from '@/utils/task-center-types';

// ==================== Live task drilldown ====================
// Queue Center Mercure is a wake-up signal. The durable task/detail endpoint is
// fetched once on open and again after a coalesced queue change; no popup-owned
// EventSource or Laravel request worker is retained.

// Compatibility names retained for existing modal imports. Their definitions
// now come from the shared Laravel/Pycore/mcp-chrome task contract.
export type TaskStreamEvent = TaskEvent;
export type TaskStreamTask = TaskDetail;
export type TaskStreamBundle = TaskDetailBundle;

/** Compatibility callbacks retained for existing task-detail modal imports. */
export interface TaskStreamHandlers {
  onInitial?: (bundle: TaskStreamBundle) => void;
  onEvent?: (event: TaskStreamEvent) => void;
  onPing?: (cursor: string | null) => void;
  onClose?: (cursor: string | null, done: boolean) => void;
  onError?: (err: Event) => void;
}

/** Handle returned by subscribeToTaskStream(); call close() to tear it down. */
export interface TaskStreamHandle {
  close: () => void;
}

/** The one popup task-detail read: WorkerApiClient.getTaskDetail on the current endpoint. */
export async function loadTaskDetail(taskId: string): Promise<TaskStreamBundle | null> {
  const response = await currentApiClient(WorkerApiClient).getTaskDetail(taskId);
  const data = (response?.data ?? response) as TaskStreamBundle | null;
  return data?.task ? data : null;
}

/**
 * Subscribe to shared Queue Center wakes and reconcile one bounded detail row.
 */
export function subscribeToTaskStream(taskId: string, handlers: TaskStreamHandlers): TaskStreamHandle {
  const refreshOperation = new AsyncOperationController<void>();
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const refresh = (): Promise<void> => {
    if (closed) return Promise.resolve();
    return refreshOperation.run(async () => {
      try {
        const data = await loadTaskDetail(taskId);
        if (closed || !data) return;
        handlers.onInitial?.(data);
        if (TERMINAL_TASK_STATUSES.includes(data.task.status)) {
          closed = true;
          unsubscribe?.();
          unsubscribe = null;
          handlers.onClose?.(null, true);
        }
      } catch (error) {
        logger.warn('Task Center', 'Task detail reconciliation failed', error);
        handlers.onError?.(new Event('error'));
      }
    });
  };

  unsubscribe = queueCenterWakeService.subscribe(getApiBase(), () => { void refresh(); });
  void refresh();

  return {
    close: () => {
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

interface StoredBingWorkerConfig {
  fetchInterval?: number;
  batchSize?: number;
  tabCount?: number;
  sourceLanguage?: string;
  targetLanguage?: string;
}

// TaskCenterConfig / TaskCenterStats / ProcessorStatus / BackendHealth are
// imported from the shared canonical module — no local copies.
export type { TaskCenterConfig, TaskCenterStats, ProcessorStatus };

/** Popup-local reactive state, built from the shared status shapes. */
export interface TaskCenterState {
  isRunning: boolean;
  activeApiUrl: string | null;
  stats: TaskCenterStats | null;
  backend: BackendHealth | null;
  activeCapabilities: CapabilityKey[];
}

export function useTaskCenter() {
  const isStarting = ref(false);
  // Display only: the background resolves the API base and re-points running
  // workers itself when the endpoint changes.
  const { apiBaseUrl } = useApiEndpoint();
  const config = ref<TaskCenterSettings>({
    pollInterval: TASK_CENTER_DEFAULTS.pollInterval,
    processors: {
      [LANES.BING_DICTIONARY]: {
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
    activeCapabilities: [],
  });
  const error = ref('');
  let startRequestVersion = 0;

  const statsPolling = new IntervalController();

  const LOG = 'Task Center';

  const saveConfig = async () => {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TASK_CENTER_CONFIG]: toTaskCenterSettings(config.value),
      });
      logger.debug(LOG, 'Config saved');
    } catch (err) {
      logger.error(LOG, 'Failed to save config', err);
    }
  };

  const loadConfig = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TASK_CENTER_CONFIG);
      if (result[STORAGE_KEYS.TASK_CENTER_CONFIG]) {
        // A legacy persisted apiUrl is ignored; the next save drops it.
        config.value = toTaskCenterSettings({
          ...config.value,
          ...result[STORAGE_KEYS.TASK_CENTER_CONFIG],
        });
      }
    } catch (err) {
      logger.error(LOG, 'Failed to load config', err);
    }
  };

  const loadRuntimeProcessorSettings = async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG);
    const stored = (result[STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG] || {}) as StoredBingWorkerConfig;
    const current = config.value.processors?.[LANES.BING_DICTIONARY] || {};
    config.value.processors = {
      ...(config.value.processors || {}),
      [LANES.BING_DICTIONARY]: {
        ...current,
        pollInterval: Math.max(
          1,
          Math.min(3600, Math.round(Number(stored.fetchInterval) || TASK_CENTER_DEFAULTS.pollInterval)),
        ),
        batchSize: Math.max(
          1,
          Math.min(
            TASK_LIMITS.worker_pull,
            Math.round(Number(stored.batchSize) || TASK_CENTER_DEFAULTS.batchSize),
          ),
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
    const requestVersion = ++startRequestVersion;
    isStarting.value = true;
    try {
      error.value = '';
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

      if (requestVersion !== startRequestVersion) return;

      if (response && response.success) {
        state.value.isRunning = true;
        logger.info(LOG, 'Started successfully');
        await loadState();
        // Keep the backend-health + validity-progress strip live while running.
        startStatsPolling();
      } else {
        logger.error(LOG, 'Failed to start', response?.error);
        error.value = response?.error || getMessage('taskCenterStartFailed');
      }
    } catch (err: any) {
      if (requestVersion !== startRequestVersion) return;
      logger.error(LOG, 'Start error', err);
      error.value = err.message || getMessage('taskCenterStartFailed');
    } finally {
      if (requestVersion === startRequestVersion) isStarting.value = false;
    }
  };

  const stopTaskCenter = async () => {
    try {
      error.value = '';
      startRequestVersion++;
      isStarting.value = false;
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
        error.value = response?.error || getMessage('taskCenterStopFailed');
      }
    } catch (err: any) {
      logger.error(LOG, 'Stop error', err);
      error.value = err.message || getMessage('taskCenterStopFailed');
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
        state.value.activeCapabilities = Array.isArray(status.activeCapabilities)
          ? status.activeCapabilities
          : [];
      }
    } catch (err) {
      logger.error(LOG, 'Failed to load state', err);
    }
  };

  const startStatsPolling = () => {
    statsPolling.start(() => void loadState(), 3000);
  };

  const stopStatsPolling = () => {
    statsPolling.stop();
  };

  const initialize = async () => {
    // Always reconcile with the background so reopening the popup mid-run shows
    // the true state; resume the live poll whenever the center is running (the
    // background run-intent, not a popup flag, is the source of truth now).
    await loadConfig();
    await loadState();
    if (state.value.isRunning) {
      startStatsPolling();
    }
  };

  onUnmounted(() => {
    stopStatsPolling();
  });

  return {
    isStarting,
    apiBaseUrl,
    config,
    state,
    error,
    saveConfig,
    startTaskCenter,
    stopTaskCenter,
    formatTimestamp,
    initialize,
  };
}
