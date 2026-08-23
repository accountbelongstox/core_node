import { computed, ref } from 'vue';
import { DEFAULT_SERVER_PORT, NativeMessageType } from 'chrome-mcp-shared';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { useAppStore, type ServerStatus } from '@/composables/useAppStore';
import { getMessage } from '@/utils/i18n';
import { logger } from '@/utils/logger';

export type NativeConnectionStatus = 'unknown' | 'connected' | 'disconnected';

const nativeConnectionStatus = ref<NativeConnectionStatus>('unknown');
const isConnecting = ref(false);
const isReactivating = ref(false);
const reactivationError = ref('');
const copyButtonText = ref(getMessage('copyConfigButton'));
const REACTIVATION_TIMEOUT_MS = 15000;
let reactivationTimer: ReturnType<typeof setTimeout> | null = null;
const appStore = useAppStore();
const nativeServerPort = computed({
  get: () => appStore.settings.value.serverPort || DEFAULT_SERVER_PORT,
  set: (port: number) => appStore.setServerPort(port),
});
const serverStatus = appStore.serverStatus;
const isConnected = computed(() => nativeConnectionStatus.value === 'connected');
const isReady = computed(
  () => isConnected.value && serverStatus.value.isRunning,
);
const mcpConfigJson = computed(() => {
  const port = serverStatus.value.port || nativeServerPort.value;
  return JSON.stringify(
    {
      mcpServers: {
        'streamable-mcp-server': {
          type: 'streamable-http',
          url: `http://127.0.0.1:${port}/mcp`,
        },
      },
    },
    null,
    2,
  );
});

function applyServerResponse(response: { serverStatus?: ServerStatus; connected?: boolean }): void {
  if (response.serverStatus) appStore.updateServerStatus(response.serverStatus);
  if (response.connected !== undefined) {
    nativeConnectionStatus.value = response.connected ? 'connected' : 'disconnected';
  }
}

function handleServerStatusMessage(message: { type?: string; payload?: ServerStatus }): void {
  if (message.type !== BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED || !message.payload) return;
  appStore.updateServerStatus(message.payload);
  if (message.payload.isRunning) finishReactivation();
}

function finishReactivation(): void {
  if (reactivationTimer) clearTimeout(reactivationTimer);
  reactivationTimer = null;
  isReactivating.value = false;
}

async function checkNativeConnection(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: NativeMessageType.PING_NATIVE });
    nativeConnectionStatus.value = response?.connected ? 'connected' : 'disconnected';
  } catch (error) {
    nativeConnectionStatus.value = 'disconnected';
    logger.warn('Popup', 'Native connection check failed', error);
  }
}

async function requestServerStatus(type: string): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type });
    if (response?.success) applyServerResponse(response);
  } catch (error) {
    logger.warn('Popup', 'Server status request failed', error);
  }
}

async function reactivateServer(): Promise<void> {
  if (isReactivating.value || isConnecting.value) return;
  isReactivating.value = true;
  reactivationError.value = '';
  reactivationTimer = setTimeout(() => {
    void requestServerStatus(BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS).finally(() => {
      if (!isReady.value) reactivationError.value = getMessage('reactivateMcpFailed');
      finishReactivation();
    });
  }, REACTIVATION_TIMEOUT_MS);
  try {
    const response = await chrome.runtime.sendMessage({
      type: NativeMessageType.CONNECT_NATIVE,
      port: nativeServerPort.value,
      forceReconnect: true,
    });
    if (!response?.success) throw new Error('Native host rejected the reactivation request');
    nativeConnectionStatus.value = 'connected';
  } catch (error) {
    reactivationError.value = getMessage('reactivateMcpFailed');
    finishReactivation();
    logger.error('Popup', 'Native MCP service reactivation failed', error);
  }
}

export function useServerConnection() {
  const initialize = async () => {
    await appStore.initialize();
    await Promise.all([
      checkNativeConnection(),
      requestServerStatus(BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS),
    ]);
    chrome.runtime.onMessage.addListener(handleServerStatusMessage);
  };

  const dispose = () => chrome.runtime.onMessage.removeListener(handleServerStatusMessage);

  const updatePort = (event: Event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isInteger(value) && value >= 1 && value <= 65535) nativeServerPort.value = value;
  };

  const refreshServerStatus = () =>
    requestServerStatus(BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS);

  const toggleConnection = async () => {
    if (isConnecting.value || isReactivating.value) return;
    isConnecting.value = true;
    try {
      if (nativeConnectionStatus.value === 'connected') {
        await chrome.runtime.sendMessage({ type: NativeMessageType.DISCONNECT_NATIVE });
        nativeConnectionStatus.value = 'disconnected';
        logger.info('Popup', 'Disconnected from native host');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: NativeMessageType.CONNECT_NATIVE,
        port: nativeServerPort.value,
      });
      nativeConnectionStatus.value = response?.success ? 'connected' : 'disconnected';
      if (response?.success) {
        window.setTimeout(() => void refreshServerStatus(), 500);
        logger.info('Popup', `Connected to native host on port ${nativeServerPort.value}`);
      } else {
        logger.error('Popup', 'Native host connection failed', response);
      }
    } catch (error) {
      nativeConnectionStatus.value = 'disconnected';
      logger.error('Popup', 'Native host connection failed', error);
    } finally {
      isConnecting.value = false;
    }
  };

  const copyMcpConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfigJson.value);
      copyButtonText.value = getMessage('configCopiedNotification');
    } catch {
      copyButtonText.value = getMessage('networkErrorMessage');
    }
    window.setTimeout(() => {
      copyButtonText.value = getMessage('copyConfigButton');
    }, 2000);
  };

  const statusText = computed(() => {
    if (isReady.value) {
      return getMessage('serviceRunningStatus', [String(serverStatus.value.port ?? nativeServerPort.value)]);
    }
    if (nativeConnectionStatus.value === 'connected') {
      return getMessage('connectedServiceNotStartedStatus');
    }
    return nativeConnectionStatus.value === 'unknown'
      ? getMessage('detectingStatus')
      : getMessage('serviceNotConnectedStatus');
  });

  return {
    nativeConnectionStatus,
    nativeServerPort,
    serverStatus,
    isConnecting,
    isReactivating,
    reactivationError,
    isConnected,
    isReady,
    copyButtonText,
    mcpConfigJson,
    statusText,
    initialize,
    dispose,
    updatePort,
    refreshServerStatus,
    toggleConnection,
    reactivateServer,
    copyMcpConfig,
  };
}
