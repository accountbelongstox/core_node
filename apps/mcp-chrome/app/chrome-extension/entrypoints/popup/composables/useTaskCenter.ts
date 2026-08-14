/**
 * Task Center Composable
 * Controls the unified task center from popup UI
 * Under 200 lines
 */

import { ref, onUnmounted, watch } from 'vue';
import { apiManager, getApiBase } from '@/services/ApiManager';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { logger } from '@/utils/logger';
import { getMessage } from '@/utils/i18n';
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
import { TERMINAL_TASK_STATUSES } from '@/utils/queue-center-contract';
import { queueCenterWakeService } from '@/entrypoints/background/services/task-center/QueueCenterWakeService';
import { AsyncOperationController, fetchWithTimeout, IntervalController } from '@/utils/async';
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

// ==================== Live task drilldown ====================
// Queue Center Reverb is a wake-up signal. The durable task/detail endpoint is
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

/**
 * Subscribe to shared Queue Center wakes and reconcile one bounded detail row.
 */
export function subscribeToTaskStream(taskId: string, handlers: TaskStreamHandlers): TaskStreamHandle {
  const refreshOperation = new AsyncOperationController<void>();
  const apiBase = getApiBase().replace(/\/+$/, '');
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const refresh = (): Promise<void> => {
    if (closed) return Promise.resolve();
    return refreshOperation.run(async () => {
      try {
        const response = await fetchWithTimeout(
          `${apiBase}${taskPath(taskId, 'detail')}`,
          10000,
          { headers: { 'Cache-Control': 'no-cache' } },
        );
        if (!response.ok) throw new Error(`Task detail HTTP ${response.status}`);
        const json = await response.json();
        const data = (json?.data ?? json) as TaskStreamBundle;
        if (closed || !data?.task) return;
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

  unsubscribe = queueCenterWakeService.subscribe(apiBase, () => { void refresh(); });
  void refresh();

  return {
    close: () => {
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
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
  const isStarting = ref(false);
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
  let startRequestVersion = 0;

  watch(apiBaseUrl, (url) => {
    if (!url) return;
    config.value.apiUrl = url;
    if (config.value.processors?.bing_dictionary) {
      config.value.processors.bing_dictionary.apiUrl = url.replace(/\/+$/, '');
    }
  }, { immediate: true });

  const statsPolling = new IntervalController();

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
        error.value = response?.error || getMessage('capabilityUpdateFailed');
        return false;
      }
    } catch (err: any) {
      logger.error(LOG, 'Set capability error', err);
      error.value = err.message || getMessage('capabilityUpdateFailed');
      return false;
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

  const reconfigureTaskCenter = async () => {
    if (!state.value.isRunning) return;
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
        error.value = response?.error || getMessage('endpointSwitchFailed');
        logger.error(LOG, 'Endpoint reconfiguration failed', response?.error);
      }
      await loadState();
    } catch (err: any) {
      error.value = err?.message || getMessage('endpointSwitchFailed');
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
    statsPolling.start(() => void loadState(), 3000);
  };

  const stopStatsPolling = () => {
    statsPolling.stop();
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
    isStarting,
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
