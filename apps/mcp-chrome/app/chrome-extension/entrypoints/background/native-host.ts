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

let nativePort: chrome.runtime.Port | null = null;
export const HOST_NAME = NATIVE_HOST.NAME;

// ---------------------------------------------------------------------------
// Connection recovery (auto-reconnect + watchdog)
//
// MV3 service workers die after ~30s idle, and the native host link can drop
// (host crash, port takeover, OS sleep). We recover with two layers:
//   1. Exponential-backoff setTimeout reconnect while the SW is alive.
//   2. A chrome.alarms watchdog (survives SW death) that re-establishes the
//      connection on its next tick if it is down.
// A user-initiated DISCONNECT suppresses both so we never fight the user.
// ---------------------------------------------------------------------------
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let userDisconnected = false;
let lastKnownPort: number = NATIVE_HOST.DEFAULT_PORT;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_ALARM = 'native-host-reconnect-watchdog';

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
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
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
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

let currentServerStatus: ServerStatus = {
  isRunning: false,
  lastUpdated: Date.now(),
};

/**
 * Save server status to chrome.storage
 */
async function saveServerStatus(status: ServerStatus): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SERVER_STATUS]: status });
  } catch (error) {
    console.error(ERROR_MESSAGES.SERVER_STATUS_SAVE_FAILED, error);
  }
}

/**
 * Load server status from chrome.storage
 */
async function loadServerStatus(): Promise<ServerStatus> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.SERVER_STATUS]);
    if (result[STORAGE_KEYS.SERVER_STATUS]) {
      return result[STORAGE_KEYS.SERVER_STATUS];
    }
  } catch (error) {
    console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
  }
  return {
    isRunning: false,
    lastUpdated: Date.now(),
  };
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

/**
 * Connect to the native messaging host
 * @param port - The port number to use for the server
 * @param forceReconnect - If true, disconnect and reconnect even if already connected
 */
export function connectNativeHost(port: number = NATIVE_HOST.DEFAULT_PORT, forceReconnect: boolean = false) {
  // Remember the port for watchdog/auto-reconnect; a fresh connect attempt is
  // never a user disconnect.
  lastKnownPort = port;
  userDisconnected = false;
  clearReconnectTimer();

  if (nativePort) {
    if (!forceReconnect) {
      console.log(`Already connected to native host, skipping connection`);
      return;
    }
    // Force reconnect: disconnect first
    console.log(`Force reconnecting to native host with new port ${port}`);
    nativePort.disconnect();
    nativePort = null;
  }

  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);

    nativePort.onMessage.addListener(async (message) => {
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

        nativePort?.postMessage({
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
          nativePort?.postMessage({
            responseToRequestId: requestId,
            payload: {
              status: 'success',
              message: SUCCESS_MESSAGES.TOOL_EXECUTED,
              data: result,
            },
          });
        } catch (error) {
          nativePort?.postMessage({
            responseToRequestId: requestId,
            payload: {
              status: 'error',
              message: ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
              error: error instanceof Error ? error.message : String(error),
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
        await saveServerStatus(currentServerStatus);
        broadcastServerStatusChange(currentServerStatus);
        console.log(`${SUCCESS_MESSAGES.SERVER_STARTED} on port ${port}`);
      } else if (message.type === NativeMessageType.SERVER_STOPPED) {
        currentServerStatus = {
          isRunning: false,
          port: currentServerStatus.port, // Keep last known port for reconnection
          lastUpdated: Date.now(),
        };
        await saveServerStatus(currentServerStatus);
        broadcastServerStatusChange(currentServerStatus);
        console.log(SUCCESS_MESSAGES.SERVER_STOPPED);
      } else if (message.type === NativeMessageType.ERROR_FROM_NATIVE_HOST) {
        const hostErr = message.payload?.message || 'Unknown error';
        // "Server is busy" / "already running" / "Shutdown rejected" all mean a
        // server IS up on the port — that is success from the extension's POV,
        // not a fatal error. Reflect it as running instead of alarming the user.
        const benign =
          /already running|server is busy|active sessions|shutdown rejected/i.test(hostErr);
        if (benign) {
          console.warn('[NativeHost] Treating as already-running:', hostErr);
          reconnectAttempts = 0;
          clearReconnectTimer();
          currentServerStatus = {
            isRunning: true,
            port: currentServerStatus.port || lastKnownPort,
            lastUpdated: Date.now(),
          };
          await saveServerStatus(currentServerStatus);
          broadcastServerStatusChange(currentServerStatus);
        } else {
          console.error('Error from native host:', hostErr);
        }
      } else if (message.type === 'file_operation_response') {
        // Forward file operation response back to the requesting tool
        chrome.runtime.sendMessage(message).catch(() => {
          // Ignore if no listeners
        });
      }
    });

    nativePort.onDisconnect.addListener(async () => {
      // A throw in the diagnostic below (or any future code) must never strand
      // nativePort pointing at the disconnected port. The finally block always
      // releases the dead port, broadcasts, and re-arms reconnect - keeping
      // PING_NATIVE honest and letting the watchdog recover.
      let isForbiddenError = false;
      try {
        const errorMsg = chrome.runtime.lastError?.message || 'Unknown error';
        console.error(ERROR_MESSAGES.NATIVE_DISCONNECTED, errorMsg);

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
        nativePort = null;

        // Update connection status but keep server status if it was running
        // The server process might still be alive even if the connection dropped
        broadcastServerStatusChange(currentServerStatus);

        // Auto-reconnect with exponential backoff unless this was a forbidden
        // (mis-registered ID) error — those never recover by retrying — or a
        // user-initiated disconnect. The alarm watchdog backstops the SW dying.
        if (!isForbiddenError && !userDisconnected) {
          scheduleReconnect(lastKnownPort);
        }
      }
    });

    // Always send START to the freshly-spawned host process. Native messaging
    // launches a NEW host process for EVERY connectNative() call, so on a
    // Service-Worker wake the process we just connected to is NOT the one that
    // currently owns the port — it has an empty server and has never run the
    // singleton handover. Gating START on `currentServerStatus.isRunning` (a flag
    // persisted from a PREVIOUS process) left the port owned by a now link-dead
    // orphan: it still received tool calls over HTTP but could no longer relay
    // them to the browser (dead stdout), so every call hung to the full timeout.
    // Sending START makes THIS process run startServer() -> singleton.detect(),
    // which either adopts the healthy existing server (no restart) or evicts the
    // dead orphan and takes the port over — keeping the port owner and the live
    // extension link in the SAME process.
    nativePort.postMessage({ type: NativeMessageType.START, payload: { port } });
    console.log(`Sent START message to native host with port ${port}`);
  } catch (error) {
    console.error(ERROR_MESSAGES.NATIVE_CONNECTION_FAILED, error);
    nativePort = null;
    // Broadcast connection failure to UI
    broadcastServerStatusChange(currentServerStatus);
    // Retry with backoff (e.g. host briefly unavailable during a takeover).
    if (!userDisconnected) {
      scheduleReconnect(lastKnownPort);
    }
  }
}

/**
 * Initialize native host listeners and load initial state
 */
export const initNativeHostListener = () => {
  // Initialize server status from storage
  loadServerStatus()
    .then((status) => {
      currentServerStatus = status;
      // Auto-connect on service worker initialization
      // This ensures connection is re-established when service worker wakes up
      if (!nativePort) {
        const port = status.port || NATIVE_HOST.DEFAULT_PORT;
        connectNativeHost(port);
        console.log(`Auto-connecting to native host on port ${port}`);
      }
    })
    .catch((error) => {
      console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
    });

  // onStartup: connect using stored port preference
  chrome.runtime.onStartup.addListener(() => {
    const port = currentServerStatus.port || NATIVE_HOST.DEFAULT_PORT;
    connectNativeHost(port);
  });

  // Watchdog: a periodic alarm survives service-worker termination and
  // re-establishes a dropped native connection on its next tick. Resets the
  // fast-reconnect budget so backoff starts fresh each tick. 0.5 min is the MV3
  // alarm floor (older Chrome clamps up to 1) — kept as short as allowed so that
  // after the fast-reconnect budget is exhausted, recovery (and the singleton
  // port handover that START now triggers) still happens within ~30-60s.
  chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 0.5 });
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
      connectNativeHost(port, forceReconnect);
      sendResponse({ success: true, port });
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
        nativePort.disconnect();
        nativePort = null;
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active connection' });
      }
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.GET_SERVER_STATUS) {
      sendResponse({
        success: true,
        serverStatus: currentServerStatus,
        connected: nativePort !== null,
      });
      return true;
    }

    if (message.type === BACKGROUND_MESSAGE_TYPES.REFRESH_SERVER_STATUS) {
      loadServerStatus()
        .then((storedStatus) => {
          currentServerStatus = storedStatus;
          sendResponse({
            success: true,
            serverStatus: currentServerStatus,
            connected: nativePort !== null,
          });
        })
        .catch((error) => {
          console.error(ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED, error);
          sendResponse({
            success: false,
            error: ERROR_MESSAGES.SERVER_STATUS_LOAD_FAILED,
            serverStatus: currentServerStatus,
            connected: nativePort !== null,
          });
        });
      return true;
    }

    // Forward file operation messages to native host
    if (message.type === 'forward_to_native' && message.message) {
      if (nativePort) {
        nativePort.postMessage(message.message);
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
