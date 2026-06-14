/**
 * Bing Dictionary Client Mode Composable
 * Handles client service control and configuration (under 200 lines)
 */

import { ref, onUnmounted } from 'vue';

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

  // Update a single config field from the panel and persist it.
  const updateConfig = async (field: string, value: any) => {
    (clientConfig.value as any)[field] = value;
    await saveClientConfig();
  };

  // Always-on activation for an embedded panel: load saved config + current
  // service state and begin polling, independent of the legacy clientMode toggle.
  const initPanel = async () => {
    await loadClientConfig();
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
      // Determine message type based on mode
      const messageType = clientConfig.value.mode === 'worker'
        ? 'bing_dictionary_worker_service'
        : 'bing_dictionary_client_service';

      const response = await chrome.runtime.sendMessage({
        type: messageType,
        action: clientService.value.isRunning ? 'stop' : 'start',
        config: clientConfig.value,
        mode: clientConfig.value.mode,
      });

      if (response && response.success) {
        clientService.value.isRunning = !clientService.value.isRunning;
        console.log(`[Bing Dictionary] ${response.mode || clientConfig.value.mode} service ${clientService.value.isRunning ? 'started' : 'stopped'}`);
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
      const messageType = clientConfig.value.mode === 'worker'
        ? 'bing_dictionary_worker_service'
        : 'bing_dictionary_client_service';

      const response = await chrome.runtime.sendMessage({
        type: messageType,
        action: 'get_status',
        mode: clientConfig.value.mode,
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
    toggleClientMode,
    saveClientConfig,
    updateConfig,
    toggleClientService,
    formatTimestamp,
    initialize,
    initPanel,
  };
}
