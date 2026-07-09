/**
 * Centralized application state management
 */

import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';

// ============================================================
// Type definitions
// ============================================================

export interface ServerStatus {
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export interface TaskQueueConfig {
  enabled: boolean;
  paused: boolean;
  maxConcurrent: number;
  retryAttempts: number;
}

export interface AppSettings {
  currentEndpoint: string;
  customEndpoint?: string;
  taskQueue: TaskQueueConfig;
  autoConnectServer: boolean;
  serverPort: number;
  language: string;
  debugMode: boolean;
}

// ============================================================
// Default configuration
// ============================================================

const DEFAULT_SETTINGS: AppSettings = {
  currentEndpoint: 'localhost',
  taskQueue: {
    enabled: false,
    paused: false,
    maxConcurrent: 3,
    retryAttempts: 2,
  },
  autoConnectServer: true,
  serverPort: 12306,
  language: 'zh-CN',
  debugMode: false,
};

const STORAGE_KEY = 'appSettings';

// ============================================================
// Global state
// ============================================================

const settings: Ref<AppSettings> = ref({ ...DEFAULT_SETTINGS });
const serverStatus: Ref<ServerStatus> = ref({
  isRunning: false,
  lastUpdated: Date.now(),
});

let isInitialized = false;

// ============================================================
// State management hook
// ============================================================

export function useAppStore() {
  const saveSettings = async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings.value });
  };

  // Setup the auto-save watcher. Called once from initialize() AFTER stored
  // settings have been loaded, so the first watcher emission never overwrites
  // persisted data with stale defaults.
  let watcherActive = false;
  const setupWatcher = () => {
    if (watcherActive) return;
    watcherActive = true;
    watch(settings, () => {
      saveSettings();
    }, { deep: true });
  };

  const initialize = async () => {
    if (isInitialized) return;

    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    if (stored[STORAGE_KEY]) {
      settings.value = { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY] };
    }

    isInitialized = true;
    // Start watching only after the stored value is loaded — avoids a race
    // where the watcher fires on the initial default value and overwrites
    // the persisted settings before they're restored.
    setupWatcher();
  };

  // ============================================================
  // API settings
  // ============================================================

  const setCurrentEndpoint = (endpointId: string) => {
    settings.value.currentEndpoint = endpointId;
  };

  const setCustomEndpoint = (url: string) => {
    settings.value.customEndpoint = url;
  };

  // ============================================================
  // Task queue settings
  // ============================================================

  const enableTaskQueue = () => {
    settings.value.taskQueue.enabled = true;
  };

  const disableTaskQueue = () => {
    settings.value.taskQueue.enabled = false;
  };

  const pauseTaskQueue = () => {
    settings.value.taskQueue.paused = true;
  };

  const resumeTaskQueue = () => {
    settings.value.taskQueue.paused = false;
  };

  const setMaxConcurrent = (count: number) => {
    settings.value.taskQueue.maxConcurrent = Math.max(1, Math.min(10, count));
  };

  const setRetryAttempts = (count: number) => {
    settings.value.taskQueue.retryAttempts = Math.max(0, Math.min(5, count));
  };

  // ============================================================
  // Server settings
  // ============================================================

  const setAutoConnectServer = (enabled: boolean) => {
    settings.value.autoConnectServer = enabled;
  };

  const setServerPort = (port: number) => {
    settings.value.serverPort = port;
  };

  const updateServerStatus = (status: Partial<ServerStatus>) => {
    serverStatus.value = {
      ...serverStatus.value,
      ...status,
      lastUpdated: Date.now(),
    };
  };

  // ============================================================
  // Other settings
  // ============================================================

  const setLanguage = (lang: string) => {
    settings.value.language = lang;
  };

  const setDebugMode = (enabled: boolean) => {
    settings.value.debugMode = enabled;
  };

  // ============================================================
  // Reset
  // ============================================================

  const resetSettings = async () => {
    settings.value = { ...DEFAULT_SETTINGS };
    await saveSettings();
  };

  // ============================================================
  // Computed
  // ============================================================

  const isTaskQueueActive = computed(() => {
    return settings.value.taskQueue.enabled && !settings.value.taskQueue.paused;
  });

  const canExecuteTasks = computed(() => {
    return isTaskQueueActive.value && serverStatus.value.isRunning;
  });

  // ============================================================
  // Return
  // ============================================================

  return {
    settings,
    serverStatus,
    initialize,
    saveSettings,
    setCurrentEndpoint,
    setCustomEndpoint,
    enableTaskQueue,
    disableTaskQueue,
    pauseTaskQueue,
    resumeTaskQueue,
    setMaxConcurrent,
    setRetryAttempts,
    setAutoConnectServer,
    setServerPort,
    updateServerStatus,
    setLanguage,
    setDebugMode,
    resetSettings,
    isTaskQueueActive,
    canExecuteTasks,
  };
}
