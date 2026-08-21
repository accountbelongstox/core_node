import { NativeMessageType } from 'chrome-mcp-shared';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import {
  NATIVE_HOST,
  ICONS,
  NOTIFICATIONS,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@/common/constants';
import { handleCallTool } from './tools';
import { TimeoutController } from '@/utils/async';
import { toErrorMessage } from '@/utils/errors';
import { localStorage } from '@/services/ExtensionStorage';

let nativePort: chrome.runtime.Port | null = null;
export const HOST_NAME = NATIVE_HOST.NAME;

// ---------------------------------------------------------------------------
// Connection recovery (auto-reconnect + watchdog)
//
// A native port keeps current Chrome service workers alive, but the link can
// still drop after a host crash, extension reload, browser shutdown, or OS sleep.
// We recover with two layers:
//   1. Exponential-backoff setTimeout reconnect while the SW is alive.
//   2. A chrome.alarms watchdog (survives SW death) that re-establishes the
//      connection on its next tick if it is down.
// A user-initiated DISCONNECT suppresses both so we never fight the user.
// ---------------------------------------------------------------------------
let reconnectAttempts = 0;
const reconnectTimeout = new TimeoutController();
let userDisconnected = false;
let lastKnownPort: number = NATIVE_HOST.DEFAULT_PORT;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_ALARM = 'native-host-reconnect-watchdog';

function clearReconnectTimer(): void {
  reconnectTimeout.cancel();
}

function postNativeMessage(connection: chrome.runtime.Port, message: unknown): boolean {
  if (nativePort !== connection) return false;
  try {
    connection.postMessage(message);
    return true;
  } catch (error) {
    console.error(ERROR_MESSAGES.NATIVE_DISCONNECTED, error);
    releaseNativeConnection(connection, true);
    connection.disconnect();
    return false;
  }
}

/**
 * Resolve the Chrome native-messaging manifest path for the diagnostic shown on
 * a forbidden/disconnect error. MV3 service workers have no Node `process`
 * global, so referencing process.platform / process.env throws a ReferenceError;
 * the OS is detected from navigator.platform (Win32/MacIntel/Linux*) instead,
 * and the user home is rendered as a shell/env placeholder.
 */
function getNativeManifestPath(): string {
  const platform = (typeof navigator !== 'undefined' && navigator.platform) || '';
  if (/^Win/i.test(platform)) {
    return '%USERPROFILE%\\AppData\\Roaming\\Google\\Chrome\\NativeMessagingHosts\\com.chromemcp.nativehost.json';
  }
  if (/^Mac/i.test(platform)) {
    return '~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.chromemcp.nativehost.json';
  }
  return '~/.config/google-chrome/NativeMessagingHosts/com.chromemcp.nativehost.json';
}

function scheduleReconnect(port: number): void {
  if (userDisconnected) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn(
      `[NativeHost] Max fast-reconnect attempts reached; the alarm watchdog will keep retrying.`,
    );
    return;
  }
  clearReconnectTimer();
  const backoff = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts);
  const delay = Math.min(MAX_RECONNECT_DELAY_MS, backoff) + Math.floor(Math.random() * 500);
  reconnectAttempts++;
  console.log(`[NativeHost] Reconnect attempt ${reconnectAttempts} in ${delay}ms`);
  reconnectTimeout.schedule(() => {
    connectNativeHost(port);
  }, delay);
}

/**
 * Server status management interface
 */
interface ServerStatus {
  isRunning: boolean;
  port?: number;
  lastUpdated: number;
}

interface NativeHostSettings {
  autoConnectServer?: boolean;
}

let currentServerStatus: ServerStatus = {
  isRunning: false,
  lastUpdated: Date.now(),
};

/**
 * Save server status to chrome.storage
 */
async function saveServerStatus(status: ServerStatus): Promise<void> {
  try {
    await localStorage.set(STORAGE_KEYS.SERVER_STATUS, status);
  } catch (error) {
    console.error(ERROR_MESSAGES.SERVER_STATUS_SAVE_FAILED, error);
  }
}

/**
 * Load server status from chrome.storage
 */
async function loadServerStatus(): Promise<ServerStatus> {
  try {
    return await localStorage.get<ServerStatus>(STORAGE_KEYS.SERVER_STATUS, {
      isRunning: false,
      lastUpdated: Date.now(),
    });
  } catch (error) {
    console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
  }
  return {
    isRunning: false,
    lastUpdated: Date.now(),
  };
}

async function shouldAutoConnect(): Promise<boolean> {
  const settings = await localStorage.get<NativeHostSettings>(STORAGE_KEYS.APP_SETTINGS, {});
  return settings.autoConnectServer ?? true;
}

async function ensureReconnectAlarm(): Promise<void> {
  const alarm = await chrome.alarms.get(RECONNECT_ALARM);
  if (!alarm) {
    await chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 0.5 });
  }
}

/**
 * Broadcast server status change to all listeners
 */
function broadcastServerStatusChange(status: ServerStatus): void {
  chrome.runtime
    .sendMessage({
      type: BACKGROUND_MESSAGE_TYPES.SERVER_STATUS_CHANGED,
      payload: status,
    })
    .catch(() => {
      // Ignore errors if no listeners are present
    });
}

function createServerStatusResponse() {
  return {
    success: true,
    serverStatus: currentServerStatus,
    connected: nativePort !== null,
  };
}

function releaseNativeConnection(connection: chrome.runtime.Port, reconnect: boolean): void {
  if (nativePort !== connection) return;
  nativePort = null;
  currentServerStatus = {
    ...currentServerStatus,
    isRunning: false,
    lastUpdated: Date.now(),
  };
  void saveServerStatus(currentServerStatus);
  broadcastServerStatusChange(currentServerStatus);
  if (reconnect && !userDisconnected) {
    scheduleReconnect(lastKnownPort);
  }
}

/**
 * Connect to the native messaging host
 * @param port - The port number to use for the server
 * @param forceReconnect - If true, disconnect and reconnect even if already connected
 */
export function connectNativeHost(
  port: number = NATIVE_HOST.DEFAULT_PORT,
  forceReconnect: boolean = false,
): boolean {
  let connectionForCleanup: chrome.runtime.Port | null = null;

  // Remember the port for watchdog/auto-reconnect; a fresh connect attempt is
  // never a user disconnect.
  lastKnownPort = port;
  userDisconnected = false;
  clearReconnectTimer();

  if (nativePort) {
    if (!forceReconnect) {
      console.log(`Already connected to native host, skipping connection`);
      return true;
    }
    // Force reconnect: disconnect first
    console.log(`Force reconnecting to native host with new port ${port}`);
    const previousPort = nativePort;
    releaseNativeConnection(previousPort, false);
    previousPort.disconnect();
  }

  try {
    const connection = chrome.runtime.connectNative(HOST_NAME);
    connectionForCleanup = connection;
    nativePort = connection;

    connection.onMessage.addListener(async (message) => {
      if (nativePort !== connection) return;
      // chrome.notifications.create({
      //   type: NOTIFICATIONS.TYPE,
      //   iconUrl: chrome.runtime.getURL(ICONS.NOTIFICATION),
      //   title: 'Message from native host',
      //   message: `Received data from host: ${JSON.stringify(message)}`,
      //   priority: NOTIFICATIONS.PRIORITY,
      // });

      if (message.type === NativeMessageType.PROCESS_DATA && message.requestId) {
        const requestId = message.requestId;
        const requestPayload = message.payload;

        postNativeMessage(connection, {
          responseToRequestId: requestId,
          payload: {
            status: 'success',
            message: SUCCESS_MESSAGES.TOOL_EXECUTED,
            data: requestPayload,
          },
        });
      } else if (message.type === NativeMessageType.CALL_TOOL && message.requestId) {
        const requestId = message.requestId;
        try {
          const result = await handleCallTool(message.payload);
          postNativeMessage(connection, {
            responseToRequestId: requestId,
            payload: {
              status: 'success',
              message: SUCCESS_MESSAGES.TOOL_EXECUTED,
              data: result,
            },
          });
        } catch (error) {
          postNativeMessage(connection, {
            responseToRequestId: requestId,
            payload: {
              status: 'error',
              message: ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
              error: toErrorMessage(error),
            },
          });
        }
      } else if (message.type === NativeMessageType.SERVER_STARTED) {
        const port = message.payload?.port;
        // Healthy connection re-established — reset the reconnect backoff.
        reconnectAttempts = 0;
        clearReconnectTimer();
        currentServerStatus = {
          isRunning: true,
          port: port,
          lastUpdated: Date.now(),
        };
        void saveServerStatus(currentServerStatus);
        broadcastServerStatusChange(currentServerStatus);
        console.log(`${SUCCESS_MESSAGES.SERVER_STARTED} on port ${port}`);
      } else if (message.type === NativeMessageType.SERVER_STOPPED) {
        currentServerStatus = {
          isRunning: false,
          port: currentServerStatus.port, // Keep last known port for reconnection
          lastUpdated: Date.now(),
        };
        void saveServerStatus(currentServerStatus);
        broadcastServerStatusChange(currentServerStatus);
        console.log(SUCCESS_MESSAGES.SERVER_STOPPED);
      } else if (message.type === NativeMessageType.ERROR_FROM_NATIVE_HOST) {
        const hostErr = message.payload?.message || 'Unknown error';
        console.error('Error from native host:', hostErr);
      } else if (message.type === 'file_operation_response') {
        // Forward file operation response back to the requesting tool
        chrome.runtime.sendMessage(message).catch(() => {
          // Ignore if no listeners
        });
      }
    });

    connection.onDisconnect.addListener(() => {
      // A throw in the diagnostic below (or any future code) must never strand
      // nativePort pointing at the disconnected port. The finally block always
      // releases the dead port, broadcasts, and re-arms reconnect - keeping
      // PING_NATIVE honest and letting the watchdog recover.
      let isForbiddenError = false;
      try {
        const errorMsg = chrome.runtime.lastError?.message || 'Unknown error';
        console.error(ERROR_MESSAGES.NATIVE_DISCONNECTED, errorMsg);

        if (nativePort !== connection) return;

        // Check if it's a permission/forbidden error
        isForbiddenError = errorMsg.includes('forbidden') ||
                         errorMsg.includes('Access to the specified native messaging host is forbidden');

        if (isForbiddenError) {
          const currentExtensionId = chrome.runtime.id;
          console.error('Native messaging host access forbidden. This usually means:');
          console.error('1. The extension ID in the native host manifest does not match the current extension ID');
          console.error('2. Current extension ID:', currentExtensionId);
          console.error('3. Solution: Re-run the build script to automatically update the native host manifest');
          console.error('   Command: .\\scripts\\start.ps1');
          console.error('4. Or manually update the manifest file:');
          console.error(`   Location: ${getNativeManifestPath()}`);
          console.error(`   Update "allowed_origins" to: ["chrome-extension://${currentExtensionId}/"]`);
        }
      } finally {
        releaseNativeConnection(connection, !isForbiddenError);
      }
    });

    // Every native connection owns its own host process. START binds the MCP
    // listener to that same process; singleton handover removes any older owner.
    const started = postNativeMessage(connection, {
      type: NativeMessageType.START,
      payload: { port },
    });
    if (started) {
      console.log(`Sent START message to native host with port ${port}`);
    }
    return started;
  } catch (error) {
    console.error(ERROR_MESSAGES.NATIVE_CONNECTION_FAILED, error);
    if (connectionForCleanup) {
      releaseNativeConnection(connectionForCleanup, false);
      connectionForCleanup.disconnect();
    } else {
      currentServerStatus = {
        ...currentServerStatus,
        isRunning: false,
        lastUpdated: Date.now(),
      };
      void saveServerStatus(currentServerStatus);
      broadcastServerStatusChange(currentServerStatus);
    }
    // Retry with backoff (e.g. host briefly unavailable during a takeover).
    if (!userDisconnected) {
      scheduleReconnect(lastKnownPort);
    }
    return false;
  }
}

/**
 * Initialize native host listeners and load initial state
 */
export const initNativeHostListener = () => {
  Promise.all([loadServerStatus(), shouldAutoConnect()])
    .then(([status, autoConnect]) => {
      currentServerStatus = { ...status, isRunning: false, lastUpdated: Date.now() };
      if (!nativePort && autoConnect) {
        userDisconnected = false;
        const port = currentServerStatus.port || NATIVE_HOST.DEFAULT_PORT;
        connectNativeHost(port);
        console.log(`Auto-connecting to native host on port ${port}`);
      } else if (!autoConnect) {
        userDisconnected = true;
      }
    })
    .catch((error) => {
      console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
    });

  // onStartup: connect using stored port preference
  chrome.runtime.onStartup.addListener(() => {
    void shouldAutoConnect().then((autoConnect) => {
      userDisconnected = !autoConnect;
      if (!autoConnect) return;
      const port = currentServerStatus.port || NATIVE_HOST.DEFAULT_PORT;
      connectNativeHost(port);
    });
  });

  // Watchdog: a periodic alarm survives service-worker termination and
  // re-establishes a dropped native connection on its next tick. Resets the
  // fast-reconnect budget so backoff starts fresh each tick. 0.5 min is the MV3
  // alarm floor (older Chrome clamps up to 1) — kept as short as allowed so that
  // after the fast-reconnect budget is exhausted, recovery (and the singleton
  // port handover that START now triggers) still happens within ~30-60s.
  void ensureReconnectAlarm().catch((error) => {
    console.error(ERROR_MESSAGES.NATIVE_CONNECTION_FAILED, error);
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RECONNECT_ALARM) return;
    if (userDisconnected || nativePort) return;
    reconnectAttempts = 0;
    const port = currentServerStatus.port || lastKnownPort || NATIVE_HOST.DEFAULT_PORT;
    console.log('[NativeHost] Watchdog re-establishing native connection');
    connectNativeHost(port);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === NativeMessageType.CONNECT_NATIVE) {
      const port =
        typeof message === 'object' && message.port ? message.port : NATIVE_HOST.DEFAULT_PORT;
      // Force reconnect if port is different or if explicitly requested
      const forceReconnect = message.forceReconnect || (currentServerStatus.port !== undefined && currentServerStatus.port !== port);
      const success = connectNativeHost(port, forceReconnect);
      sendResponse({ success, port });
      return true;
    }

    if (message.type === NativeMessageType.PING_NATIVE) {
      const connected = nativePort !== null;
      sendResponse({ connected });
      return true;
    }

    if (message.type === NativeMessageType.DISCONNECT_NATIVE) {
      // User-initiated: suppress auto-reconnect/watchdog until the next explicit
      // connect.
      userDisconnected = true;
      clearReconnectTimer();
      if (nativePort) {
        const connection = nativePort;
        releaseNativeConnection(connection, false);
        connection.disconnect();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active connection' });
      }
      return true;
    }

    if (
      message.type === BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS ||
      message.type === BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS
    ) {
      sendResponse(createServerStatusResponse());
      return true;
    }

    // Forward file operation messages to native host
    if (message.type === 'forward_to_native' && message.message) {
      const connection = nativePort;
      if (connection && postNativeMessage(connection, message.message)) {
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Native host not connected' });
      }
      return true;
    }
  });
};

/**
 * Expose the current native messaging port for modules that need a direct
 * request/response exchange with the native host (e.g. the Firefox file
 * upload path: runtime.sendMessage is never delivered back to the sending
 * background context on Firefox, so the forward_to_native relay above cannot
 * be used from background code there). Returns null when not connected.
 */
export function getNativePort(): chrome.runtime.Port | null {
  return nativePort;
}
