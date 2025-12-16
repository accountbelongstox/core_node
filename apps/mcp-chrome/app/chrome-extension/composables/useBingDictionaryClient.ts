import { ref, Ref } from 'vue';

export interface ClientConfig {
  apiUrl: string;
  fetchInterval: number;
  batchSize: number;
  enabled: boolean;
}

export interface ClientService {
  isRunning: boolean;
  stats: {
    pending: number;
    translated: number;
    failed: number;
    lastRun: number | null;
  };
}

const DEFAULT_CONFIG: ClientConfig = {
  apiUrl: 'http://localhost:9000',
  fetchInterval: 30,
  batchSize: 10,
  enabled: false,
};

export function useBingDictionaryClient() {
  const clientMode = ref(false);
  const clientConfig: Ref<ClientConfig> = ref({ ...DEFAULT_CONFIG });
  const clientService: Ref<ClientService> = ref({
    isRunning: false,
    stats: {
      pending: 0,
      translated: 0,
      failed: 0,
      lastRun: null,
    },
  });

  /**
   * Initialize client mode from storage
   */
  const initialize = async () => {
    try {
      const result = await chrome.storage.local.get([
        'bingDictionaryClientMode',
        'bingDictionaryClientConfig',
      ]);

      if (result.bingDictionaryClientMode !== undefined) {
        clientMode.value = result.bingDictionaryClientMode;
      }

      if (result.bingDictionaryClientConfig) {
        clientConfig.value = { ...DEFAULT_CONFIG, ...result.bingDictionaryClientConfig };
      }

      // Get service status from background
      await updateServiceStatus();
    } catch (err) {
      console.error('Failed to initialize client mode:', err);
    }
  };

  /**
   * Toggle client mode
   */
  const toggleClientMode = async () => {
    clientMode.value = !clientMode.value;
    await chrome.storage.local.set({
      bingDictionaryClientMode: clientMode.value,
    });
  };

  /**
   * Save client configuration
   */
  const saveClientConfig = async () => {
    try {
      await chrome.storage.local.set({
        bingDictionaryClientConfig: clientConfig.value,
      });

      // If service is running, update it with new config
      if (clientService.value.isRunning) {
        await chrome.runtime.sendMessage({
          type: 'BING_CLIENT_UPDATE_CONFIG',
          config: clientConfig.value,
        });
      }
    } catch (err) {
      console.error('Failed to save client config:', err);
    }
  };

  /**
   * Toggle client service (start/stop)
   */
  const toggleClientService = async () => {
    try {
      if (clientService.value.isRunning) {
        // Stop service
        await chrome.runtime.sendMessage({
          type: 'BING_CLIENT_STOP',
        });
      } else {
        // Start service
        await chrome.runtime.sendMessage({
          type: 'BING_CLIENT_START',
          config: clientConfig.value,
        });
      }

      // Wait a bit for service to update
      setTimeout(updateServiceStatus, 500);
    } catch (err) {
      console.error('Failed to toggle client service:', err);
    }
  };

  /**
   * Update service status from background
   */
  const updateServiceStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'BING_CLIENT_GET_STATUS',
      });

      if (response?.status) {
        clientService.value = response.status;
      }
    } catch (err) {
      console.error('Failed to get service status:', err);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return date.toLocaleString();
  };

  return {
    clientMode,
    clientConfig,
    clientService,
    toggleClientMode,
    saveClientConfig,
    toggleClientService,
    formatTimestamp,
    initialize,
  };
}
