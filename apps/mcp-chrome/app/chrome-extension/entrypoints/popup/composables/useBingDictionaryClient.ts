/**
 * Bing Dictionary Client Mode Composable
 * Handles client service control and configuration (under 200 lines)
 */

import { ref, onUnmounted } from 'vue';
import { apiManager } from '@/services/ApiManager';

export type ServiceMode = 'legacy' | 'worker';

export interface ClientConfig {
  apiUrl: string;
  fetchInterval: number;
  batchSize: number;
  mode?: ServiceMode;
  // Worker mode: number of Bing dictionary tabs driven in parallel.
  tabCount?: number;
  // Worker mode: default target language when a task omits one.
  targetLanguage?: string;
}

export interface ClientServiceStats {
  pending: number;
  translated: number;
  failed: number;
  invalid?: number;         // Words Bing had no entry for (marked invalid)
  lastRun: number | null;
  workerId?: string | null;
  isOnline?: boolean;
  // Queue statistics
  queueTotal?: number;      // Total tasks in current queue
  newTasks?: number;        // New tasks received in last poll
  duplicateTasks?: number;  // Duplicate tasks skipped in last poll
  activeTabs?: number;      // Bing tabs currently in the pool
  currentWord?: string | null;   // Word currently being looked up
  currentTaskId?: string | null; // Task currently being processed
}

export interface ClientServiceState {
  isRunning: boolean;
  stats: ClientServiceStats | null;
}

export function useBingDictionaryClient() {
  const clientMode = ref(false);
  const clientConfig = ref<ClientConfig>({
    apiUrl: '',
    fetchInterval: 5,  // Default 5 seconds for real-time updates
    batchSize: 10,
    mode: 'worker', // Default to Worker API mode
    tabCount: 3,     // Parallel Bing dictionary tabs (worker mode)
    targetLanguage: 'zh',
  });
  const clientService = ref<ClientServiceState>({
    isRunning: false,
    stats: null,
  });
  const error = ref('');
  const connectionStatus = ref<{ state: 'idle' | 'testing' | 'ok' | 'fail'; message: string }>({
    state: 'idle',
    message: '',
  });

  // The worker pulls the untranslated queue from laravel_main using the SINGLE
  // endpoint configured in Settings (the shared ApiManager). There is no separate
  // endpoint list here — that was redundant. `currentEndpoint` mirrors Settings.
  const currentEndpoint = ref('');
  const syncEndpointFromSettings = () => {
    const url = apiManager.getCurrentBaseUrl();
    currentEndpoint.value = url;
    clientConfig.value.apiUrl = url;
  };

  // Ad-hoc Bing scrape test (default word "hello").
  const testWords = ref('hello');
  const testResults = ref<any[]>([]);
  const testing = ref(false);

  let statsPollingInterval: ReturnType<typeof setInterval> | null = null;

  const toggleClientMode = async () => {
    clientMode.value = !clientMode.value;
    await chrome.storage.local.set({ bing_dictionary_client_mode: clientMode.value });

    if (clientMode.value) {
      await loadClientConfig();
      await loadClientServiceState();
      startStatsPolling();
    } else {
      stopStatsPolling();
      if (clientService.value.isRunning) {
        await toggleClientService();
      }
    }
  };

  // Update a single config field from the panel and persist it, with light
  // sanitation so unreasonable values can't reach the worker.
  const updateConfig = async (field: string, value: any) => {
    let next = value;
    if (field === 'apiUrl' && typeof value === 'string') {
      next = value.trim().replace(/\/+$/, '');
    } else if (field === 'tabCount') {
      const n = Number(value);
      next = Number.isFinite(n) ? Math.max(1, Math.min(8, Math.round(n))) : 3;
    } else if (field === 'batchSize') {
      const n = Number(value);
      next = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.round(n))) : 5;
    } else if (field === 'fetchInterval') {
      const n = Number(value);
      next = Number.isFinite(n) ? Math.max(1, Math.min(3600, Math.round(n))) : 5;
    } else if (field === 'targetLanguage' && typeof value === 'string') {
      next = value.trim().toLowerCase();
    }
    (clientConfig.value as any)[field] = next;
    // Editing the endpoint invalidates a previous connection test.
    if (field === 'apiUrl') {
      connectionStatus.value = { state: 'idle', message: '' };
    }
    await saveClientConfig();
  };

  // Ping the endpoint configured in Settings so the user gets reachability feedback.
  const testConnection = async () => {
    syncEndpointFromSettings();
    if (!clientConfig.value.apiUrl) {
      connectionStatus.value = { state: 'fail', message: 'No endpoint configured in Settings' };
      return;
    }
    connectionStatus.value = { state: 'testing', message: 'Testing…' };
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'bing_dictionary_worker_service',
        action: 'test_connection',
        config: clientConfig.value,
        mode: 'worker',
      });
      if (response && response.ok) {
        connectionStatus.value = { state: 'ok', message: response.message || 'Connected' };
      } else {
        connectionStatus.value = {
          state: 'fail',
          message: (response && response.message) || 'Unreachable',
        };
      }
    } catch (err: any) {
      connectionStatus.value = { state: 'fail', message: err?.message || 'Unreachable' };
    }
  };

  // ---- Ad-hoc Bing scrape test --------------------------------------------
  const runScrapeTest = async () => {
    const words = (testWords.value || '')
      .split(/[\s,，、]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (words.length === 0) {
      testResults.value = [];
      return;
    }
    testing.value = true;
    testResults.value = [];
    try {
      syncEndpointFromSettings();
      const response = await chrome.runtime.sendMessage({
        type: 'bing_dictionary_worker_service',
        action: 'test_scrape',
        words,
        config: clientConfig.value,
        mode: 'worker',
      });
      if (response && response.success) {
        testResults.value = response.results || [];
      } else {
        error.value = (response && response.error) || 'Scrape test failed';
      }
    } catch (err: any) {
      error.value = err?.message || 'Scrape test failed';
    } finally {
      testing.value = false;
    }
  };

  // Always-on activation for an embedded panel: load saved config, pull the
  // endpoint from Settings, load current service state, and begin polling.
  const initPanel = async () => {
    await loadClientConfig();
    await apiManager.initialize({ autoDetect: false });
    syncEndpointFromSettings();
    await loadClientServiceState();
    startStatsPolling();
  };

  const saveClientConfig = async () => {
    try {
      await chrome.storage.local.set({ bing_dictionary_client_config: clientConfig.value });
      console.log('[Bing Dictionary] Client config saved');
    } catch (err) {
      console.error('[Bing Dictionary] Failed to save client config:', err);
    }
  };

  const loadClientConfig = async () => {
    try {
      const result = await chrome.storage.local.get('bing_dictionary_client_config');
      if (result.bing_dictionary_client_config) {
        clientConfig.value = { ...clientConfig.value, ...result.bing_dictionary_client_config };
      }
    } catch (err) {
      console.error('[Bing Dictionary] Failed to load client config:', err);
    }
  };

  const toggleClientService = async () => {
    try {
      // Always pull the endpoint from Settings right before starting.
      if (!clientService.value.isRunning) {
        syncEndpointFromSettings();
      }
      // Always the worker service — the only path aligned with laravel_main's
      // /api/worker/* endpoints (the legacy /api/dictionary/* client was removed).
      const response = await chrome.runtime.sendMessage({
        type: 'bing_dictionary_worker_service',
        action: clientService.value.isRunning ? 'stop' : 'start',
        config: clientConfig.value,
      });

      if (response && response.success) {
        clientService.value.isRunning = !clientService.value.isRunning;
        console.log(`[Bing Dictionary] worker service ${clientService.value.isRunning ? 'started' : 'stopped'}`);
      } else {
        console.error('[Bing Dictionary] Failed to toggle service:', response?.error);
        error.value = response?.error || 'Failed to toggle service';
      }
    } catch (err: any) {
      console.error('[Bing Dictionary] Service toggle error:', err);
      error.value = err.message || 'Failed to toggle service';
    }
  };

  const loadClientServiceState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'bing_dictionary_worker_service',
        action: 'get_status',
      });

      if (response && response.success) {
        clientService.value.isRunning = response.isRunning;
        clientService.value.stats = response.stats;
      }
    } catch (err) {
      console.error('[Bing Dictionary] Failed to load service state:', err);
    }
  };

  const startStatsPolling = () => {
    if (statsPollingInterval) return;

    statsPollingInterval = setInterval(async () => {
      await loadClientServiceState();
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
    const result = await chrome.storage.local.get('bing_dictionary_client_mode');
    if (result.bing_dictionary_client_mode) {
      clientMode.value = result.bing_dictionary_client_mode;
      await loadClientConfig();
      await loadClientServiceState();
      if (clientMode.value) {
        startStatsPolling();
      }
    }
  };

  onUnmounted(() => {
    stopStatsPolling();
  });

  return {
    clientMode,
    clientConfig,
    clientService,
    error,
    connectionStatus,
    currentEndpoint,
    testWords,
    testResults,
    testing,
    toggleClientMode,
    saveClientConfig,
    updateConfig,
    testConnection,
    syncEndpointFromSettings,
    runScrapeTest,
    toggleClientService,
    formatTimestamp,
    initialize,
    initPanel,
  };
}
