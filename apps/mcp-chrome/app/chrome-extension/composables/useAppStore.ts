/**
 * 统一应用状态管理中心
 * Centralized application state management
 */

import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';

// ============================================================
// 类型定义
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
  // API设置
  currentEndpoint: string;
  customEndpoint?: string;

  // 任务队列设置
  taskQueue: TaskQueueConfig;

  // 服务器设置
  autoConnectServer: boolean;
  serverPort: number;

  // 语言设置
  language: string;

  // 调试设置
  debugMode: boolean;
}

// ============================================================
// 默认配置
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
// 全局状态
// ============================================================

const settings: Ref<AppSettings> = ref({ ...DEFAULT_SETTINGS });
const serverStatus: Ref<ServerStatus> = ref({
  isRunning: false,
  lastUpdated: Date.now(),
});

let isInitialized = false;

// ============================================================
// 状态管理 Hook
// ============================================================

export function useAppStore() {
  // 初始化
  const initialize = async () => {
    if (isInitialized) return;

    const stored = await chrome.storage.local.get([STORAGE_KEY]);
    if (stored[STORAGE_KEY]) {
      settings.value = { ...DEFAULT_SETTINGS, ...stored[STORAGE_KEY] };
    }

    isInitialized = true;
  };

  // 保存设置
  const saveSettings = async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings.value });
  };

  // 自动保存
  watch(settings, () => {
    saveSettings();
  }, { deep: true });

  // ============================================================
  // API设置
  // ============================================================

  const setCurrentEndpoint = (endpointId: string) => {
    settings.value.currentEndpoint = endpointId;
  };

  const setCustomEndpoint = (url: string) => {
    settings.value.customEndpoint = url;
  };

  // ============================================================
  // 任务队列设置
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
  // 服务器设置
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
  // 其他设置
  // ============================================================

  const setLanguage = (lang: string) => {
    settings.value.language = lang;
  };

  const setDebugMode = (enabled: boolean) => {
    settings.value.debugMode = enabled;
  };

  // ============================================================
  // 重置
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
  // 返回
  // ============================================================

  return {
    // 状态
    settings,
    serverStatus,

    // 初始化
    initialize,
    saveSettings,

    // API设置
    setCurrentEndpoint,
    setCustomEndpoint,

    // 任务队列
    enableTaskQueue,
    disableTaskQueue,
    pauseTaskQueue,
    resumeTaskQueue,
    setMaxConcurrent,
    setRetryAttempts,

    // 服务器
    setAutoConnectServer,
    setServerPort,
    updateServerStatus,

    // 其他
    setLanguage,
    setDebugMode,

    // 重置
    resetSettings,

    // Computed
    isTaskQueueActive,
    canExecuteTasks,
  };
}
