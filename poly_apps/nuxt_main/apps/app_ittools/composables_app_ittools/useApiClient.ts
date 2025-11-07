// Composable for API Client management
// Provides reactive API connection state and methods

import { ref, computed, onMounted, onUnmounted } from 'vue';
import apiClient, { type ApiResponse, type WebSocketCallbacks } from '@/apps/app_ittools/services_app_ittools/api-client';

export interface ConnectionState {
  httpConnected: boolean;
  wsConnected: boolean;
  lastError: string | null;
  serverStatus: any | null;
  integrationStatus: any | null;
}

export function useApiClient() {
  // Reactive state
  const connectionState = ref<ConnectionState>({
    httpConnected: false,
    wsConnected: false,
    lastError: null,
    serverStatus: null,
    integrationStatus: null,
  });

  const isLoading = ref(false);
  const lastUpdate = ref<Date | null>(null);

  // Computed properties
  const isFullyConnected = computed(() =>
    connectionState.value.httpConnected && connectionState.value.wsConnected
  );

  const connectionStatus = computed(() => {
    if (!connectionState.value.httpConnected && !connectionState.value.wsConnected) {
      return 'disconnected';
    } else if (connectionState.value.httpConnected && !connectionState.value.wsConnected) {
      return 'partial';
    } else if (isFullyConnected.value) {
      return 'connected';
    } else {
      return 'connecting';
    }
  });

  const statusColor = computed(() => {
    switch (connectionStatus.value) {
      case 'connected': return 'text-green-600';
      case 'partial': return 'text-yellow-600';
      case 'connecting': return 'text-blue-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  });

  const statusText = computed(() => {
    switch (connectionStatus.value) {
      case 'connected': return 'Fully Connected';
      case 'partial': return 'HTTP Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  });

  // Test HTTP connection
  const testHttpConnection = async (): Promise<boolean> => {
    try {
      isLoading.value = true;
      const response = await apiClient.getServerStatus();

      if (response.success) {
        connectionState.value.httpConnected = true;
        connectionState.value.serverStatus = response.data;
        connectionState.value.lastError = null;
        return true;
      } else {
        connectionState.value.httpConnected = false;
        connectionState.value.lastError = response.error || 'HTTP connection failed';
        return false;
      }
    } catch (error) {
      connectionState.value.httpConnected = false;
      connectionState.value.lastError = error instanceof Error ? error.message : 'HTTP connection error';
      return false;
    } finally {
      isLoading.value = false;
      lastUpdate.value = new Date();
    }
  };

  // Test WebSocket connection
  const connectWebSocket = async (): Promise<boolean> => {
    try {
      isLoading.value = true;

      const callbacks: WebSocketCallbacks = {
        onOpen: () => {
          connectionState.value.wsConnected = true;
          connectionState.value.lastError = null;
        },
        onClose: () => {
          connectionState.value.wsConnected = false;
        },
        onError: (error) => {
          connectionState.value.wsConnected = false;
          connectionState.value.lastError = 'WebSocket connection error';
        },
        onMessage: (message) => {
          console.log('WebSocket message received:', message);
        },
      };

      await apiClient.connectWebSocket(callbacks);
      return true;
    } catch (error) {
      connectionState.value.wsConnected = false;
      connectionState.value.lastError = error instanceof Error ? error.message : 'WebSocket connection error';
      return false;
    } finally {
      isLoading.value = false;
      lastUpdate.value = new Date();
    }
  };

  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    apiClient.disconnectWebSocket();
    connectionState.value.wsConnected = false;
  };

  // Initialize connections
  const initializeConnections = async (): Promise<void> => {
    // Test HTTP connection first
    const httpOk = await testHttpConnection();

    if (httpOk) {
      // Then connect WebSocket
      await connectWebSocket();
    }

    // Get integration status if connected
    if (connectionState.value.httpConnected) {
      try {
        const integrationResponse = await apiClient.getIntegrationStatus();
        if (integrationResponse.success) {
          connectionState.value.integrationStatus = integrationResponse.data;
        }
      } catch (error) {
        console.error('Failed to get integration status:', error);
      }
    }
  };

  // Reconnect connections
  const reconnectConnections = async (): Promise<void> => {
    // Reset connection state
    connectionState.value.httpConnected = false;
    connectionState.value.wsConnected = false;

    // Disconnect existing WebSocket if any
    disconnectWebSocket();

    // Reinitialize
    await initializeConnections();
  };

  // Auto-reconnect on window focus
  const handleWindowFocus = () => {
    if (!isFullyConnected.value) {
      console.log('Window focused, reconnecting...');
      reconnectConnections();
    }
  };

  // Auto-reconnect periodically
  let reconnectInterval: NodeJS.Timeout | null = null;

  const startAutoReconnect = () => {
    if (reconnectInterval) return;

    reconnectInterval = setInterval(() => {
      if (!isFullyConnected.value) {
        console.log('Auto-reconnecting...');
        reconnectConnections();
      }
    }, 30000); // Try to reconnect every 30 seconds
  };

  const stopAutoReconnect = () => {
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };

  // Lifecycle hooks
  onMounted(() => {
    // Add window focus listener
    window.addEventListener('focus', handleWindowFocus);

    // Start auto-reconnect
    startAutoReconnect();

    // Initialize connections
    initializeConnections();
  });

  onUnmounted(() => {
    // Remove window focus listener
    window.removeEventListener('focus', handleWindowFocus);

    // Stop auto-reconnect
    stopAutoReconnect();

    // Disconnect WebSocket
    disconnectWebSocket();
  });

  // Expose methods and state
  return {
    // State
    connectionState: readonly(connectionState),
    isLoading: readonly(isLoading),
    lastUpdate: readonly(lastUpdate),

    // Computed
    isFullyConnected,
    connectionStatus,
    statusColor,
    statusText,

    // Methods
    testHttpConnection,
    connectWebSocket,
    disconnectWebSocket,
    initializeConnections,
    reconnectConnections,

    // Auto-reconnect controls
    startAutoReconnect,
    stopAutoReconnect,

    // API client access
    apiClient,
  };
}

// Export singleton instance
export const useGlobalApiClient = () => {
  return useApiClient();
};