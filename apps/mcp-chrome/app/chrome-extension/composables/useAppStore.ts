/**
 * Centralized application state management
 */

import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { DEFAULT_SERVER_PORT } from 'chrome-mcp-shared';
import { localStorage } from '@/services/ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';

// ============================================================
// Type definitions
// ============================================================

export interface ServerStatus {
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}

export interface AppSettings {
  autoConnectServer: boolean;
  serverPort: number;
  debugMode: boolean;
}

// ============================================================
// Default configuration
// ============================================================

const DEFAULT_SETTINGS: AppSettings = {
  autoConnectServer: true,
  serverPort: DEFAULT_SERVER_PORT,
  debugMode: false,
};

// ============================================================
// Global state
// ============================================================

const settings: Ref<AppSettings> = ref({ ...DEFAULT_SETTINGS });
const serverStatus: Ref<ServerStatus> = ref({
  isRunning: false,
  lastUpdated: Date.now(),
});

let initialization: Promise<void> | null = null;
let watcherActive = false;
let persistedSnapshot = '';

function mergeSettings(stored?: Partial<AppSettings>): AppSettings {
  return {
    autoConnectServer: stored?.autoConnectServer ?? DEFAULT_SETTINGS.autoConnectServer,
    serverPort: stored?.serverPort ?? DEFAULT_SETTINGS.serverPort,
    debugMode: stored?.debugMode ?? DEFAULT_SETTINGS.debugMode,
  };
}

async function saveSettings(): Promise<void> {
  const snapshot = JSON.stringify(settings.value);
  if (snapshot === persistedSnapshot) return;
  persistedSnapshot = snapshot;
  await localStorage.set(STORAGE_KEYS.APP_SETTINGS, settings.value);
}

function setupStateSync(): void {
  if (watcherActive) return;
  watcherActive = true;
  watch(settings, () => void saveSettings(), { deep: true });
  localStorage.subscribe<AppSettings>(STORAGE_KEYS.APP_SETTINGS, (value) => {
    if (!value) return;
    const next = mergeSettings(value);
    const snapshot = JSON.stringify(next);
    if (snapshot === persistedSnapshot) return;
    persistedSnapshot = snapshot;
    settings.value = next;
  });
}

async function initializeState(): Promise<void> {
  const stored = await localStorage.getMany<{
    appSettings: AppSettings;
    nativeServerPort: number;
  }>([STORAGE_KEYS.APP_SETTINGS, STORAGE_KEYS.NATIVE_SERVER_PORT]);
  const appSettings = stored[STORAGE_KEYS.APP_SETTINGS];
  const legacyPort = stored[STORAGE_KEYS.NATIVE_SERVER_PORT];
  settings.value = mergeSettings({
    ...(appSettings ?? {}),
    serverPort: appSettings?.serverPort ?? legacyPort ?? DEFAULT_SERVER_PORT,
  });
  persistedSnapshot = JSON.stringify(settings.value);
  if (legacyPort !== undefined) {
    await localStorage.set(STORAGE_KEYS.APP_SETTINGS, settings.value);
    await localStorage.remove(STORAGE_KEYS.NATIVE_SERVER_PORT);
  }
  setupStateSync();
}

// ============================================================
// State management hook
// ============================================================

export function useAppStore() {
  const initialize = async () => {
    initialization ??= initializeState();
    await initialization;
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

  const setDebugMode = (enabled: boolean) => {
    settings.value.debugMode = enabled;
  };

  // ============================================================
  // Reset
  // ============================================================

  const resetSettings = async () => {
    settings.value = mergeSettings();
    await saveSettings();
  };

  // ============================================================
  // Return
  // ============================================================

  return {
    settings,
    serverStatus,
    initialize,
    saveSettings,
    setAutoConnectServer,
    setServerPort,
    updateServerStatus,
    setDebugMode,
    resetSettings,
  };
}
