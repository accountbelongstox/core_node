/**
 * Task Center Composable
 * Controls the unified task center from popup UI
 * Under 200 lines
 */

import { ref, onUnmounted } from 'vue';

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
