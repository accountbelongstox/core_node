/**
 * Firefox console capture.
 *
 * Firefox has no chrome.debugger / CDP, so the Chrome path (Runtime/Log
 * domains) is impossible there. Instead a MAIN-world script wraps console.*
 * methods plus window error / unhandledrejection events for the duration of
 * the capture window and forwards each entry through the shared Firefox
 * MAIN-world relay to the background, which aggregates them into the exact
 * same result shape as the Chrome CDP path.
 *
 * Known degradation vs Chrome: CDP replays console history; on Firefox only
 * messages logged AFTER injection (during the capture window) are captured.
 *
 * Only reached behind import.meta.env.FIREFOX guards; compile-time dead code
 * on Chrome builds, so Chrome behavior is unchanged.
 */
import {
  FIREFOX_RELAY_MARKER,
  addRelayListener,
  ensureRelayBridge,
  runInMainWorld,
} from '@/utils/firefox-main-world-relay';

// Same flush window the Chrome CDP path waits after enabling the domains.
const CAPTURE_WINDOW_MS = 2000;
const WRAPPED_CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
const HISTORY_LIMITATION_NOTE =
  'Firefox: only messages logged during the capture window are included; messages logged before injection cannot be replayed (no CDP history on Firefox).';

interface FirefoxConsoleMessage {
  timestamp: number;
  level: string;
  text: string;
  args?: any[];
  source?: string;
  url?: string;
  lineNumber?: number;
  stackTrace?: any;
}

interface FirefoxConsoleException {
  timestamp: number;
  text: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: any;
}

interface FirefoxConsoleResult {
  success: boolean;
  message: string;
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  captureStartTime: number;
  captureEndTime: number;
  totalDurationMs: number;
  messages: FirefoxConsoleMessage[];
  exceptions: FirefoxConsoleException[];
  messageCount: number;
  exceptionCount: number;
  messageLimitReached: boolean;
}

/**
 * Runs INSIDE the target page's MAIN world (serialized by
 * scripting.executeScript). Must stay fully self-contained: no closures over
 * module scope, values arrive only through the args array.
 */
function consoleCaptureInPage(marker: string, sessionId: string, methods: string[]): void {
  const pageWindow = window as any;
  const registry = (pageWindow.__mcpFfConsoleCaptureSessions =
    pageWindow.__mcpFfConsoleCaptureSessions || {});
  if (registry[sessionId]) return;

  const post = (kind: string, data: any): void => {
    try {
      const payload: any = { kind, sessionId, data };
      payload[marker] = true;
      window.postMessage(payload, '*');
    } catch {
      // Ignore serialization failures for exotic values.
    }
  };

  const stringifyArg = (value: any): string => {
    try {
      if (typeof value === 'string') return value;
      if (value === undefined) return 'undefined';
      if (value === null) return 'null';
      if (typeof value === 'function') {
        return value.name ? `[Function: ${value.name}]` : '[Function]';
      }
      if (value instanceof Error) return value.stack || String(value);
      if (typeof value === 'object') {
        try {
          const json = JSON.stringify(value);
          return json && json.length > 1000 ? json.slice(0, 1000) + '…' : json || String(value);
        } catch {
          return Object.prototype.toString.call(value);
        }
      }
      return String(value);
    } catch {
      return '[Unserializable]';
    }
  };

  // A single shared wrapper set is installed for the first capture session and
  // fans out to every active session's sink. Concurrent captures on the same
  // tab no longer stack wrappers, so an early-uninstalling session cannot
  // leave dead wrappers or clobber a later session's restore: the real
  // originals are only restored once the last session uninstalls.
  let shared = pageWindow.__mcpFfConsoleShared;
  if (!shared || !shared.installed) {
    const originals: Record<string, any> = {};
    const consoleObject = console as any;
    const sessions: Map<string, (kind: string, data: any) => void> = new Map();

    const fanOut = (kind: string, data: any): void => {
      for (const sink of sessions.values()) {
        try {
          sink(kind, data);
        } catch {
          // A failing sink must not break the page's own logging.
        }
      }
    };

    for (const method of methods) {
      const original = consoleObject[method];
      if (typeof original !== 'function') continue;
      originals[method] = original;
      consoleObject[method] = function (...callArgs: any[]) {
        try {
          fanOut('console', {
            timestamp: Date.now(),
            level: method,
            text: callArgs.map(stringifyArg).join(' '),
            url: String(location.href),
          });
        } catch {
          // Never break the page's own logging.
        }
        return original.apply(consoleObject, callArgs);
      };
    }

    const errorHandler = (event: ErrorEvent): void => {
      fanOut('exception', {
        timestamp: Date.now(),
        text: String(event.message || (event.error && event.error.message) || 'Uncaught error'),
        url: String(event.filename || location.href),
        lineNumber: typeof event.lineno === 'number' ? event.lineno : undefined,
        columnNumber: typeof event.colno === 'number' ? event.colno : undefined,
        stackTrace: event.error && event.error.stack ? String(event.error.stack) : undefined,
      });
    };
    const rejectionHandler = (event: PromiseRejectionEvent): void => {
      const reason: any = event.reason;
      fanOut('exception', {
        timestamp: Date.now(),
        text:
          'Unhandled promise rejection: ' +
          (reason && reason.message ? String(reason.message) : stringifyArg(reason)),
        url: String(location.href),
        stackTrace: reason && reason.stack ? String(reason.stack) : undefined,
      });
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    shared = {
      installed: true,
      sessions,
      originals,
      errorHandler,
      rejectionHandler,
    };
    pageWindow.__mcpFfConsoleShared = shared;
  }

  shared.sessions.set(sessionId, post);

  registry[sessionId] = () => {
    shared.sessions.delete(sessionId);
    if (shared.sessions.size === 0) {
      const consoleObject = console as any;
      for (const method in shared.originals) consoleObject[method] = shared.originals[method];
      if (shared.errorHandler) window.removeEventListener('error', shared.errorHandler);
      if (shared.rejectionHandler) {
        window.removeEventListener('unhandledrejection', shared.rejectionHandler);
      }
      shared.installed = false;
      pageWindow.__mcpFfConsoleShared = null;
    }
    delete registry[sessionId];
  };
}

/** Runs INSIDE the target page's MAIN world: restores console.* and listeners. */
function consoleCaptureUninstallInPage(sessionId: string): void {
  const registry = (window as any).__mcpFfConsoleCaptureSessions;
  const uninstall = registry && registry[sessionId];
  if (typeof uninstall === 'function') {
    try {
      uninstall();
    } catch {
      // Page may have replaced console methods; nothing more to do.
    }
  }
}

/**
 * Firefox replacement for ConsoleTool.captureConsoleMessages: injects the
 * MAIN-world wrapper, collects relayed entries for the capture window, then
 * restores the page and returns the Chrome-shaped ConsoleResult.
 */
export async function captureConsoleMessagesFirefox(
  tabId: number,
  options: { includeExceptions: boolean; maxMessages: number; types: string[] },
): Promise<FirefoxConsoleResult> {
  const { includeExceptions, maxMessages, types } = options;
  const startTime = Date.now();
  const messages: FirefoxConsoleMessage[] = [];
  const exceptions: FirefoxConsoleException[] = [];
  let limitReached = false;

  const tab = await chrome.tabs.get(tabId);
  const sessionId = `console-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const collectedMessages: any[] = [];
  const collectedExceptions: any[] = [];

  await ensureRelayBridge(tabId);
  const removeListener = addRelayListener(tabId, (entry) => {
    if (entry.sessionId !== sessionId || !entry.data) return;
    if (entry.kind === 'console') {
      collectedMessages.push(entry.data);
    } else if (entry.kind === 'exception' && includeExceptions) {
      collectedExceptions.push(entry.data);
    }
  });

  try {
    await runInMainWorld(tabId, consoleCaptureInPage, [
      FIREFOX_RELAY_MARKER,
      sessionId,
      WRAPPED_CONSOLE_METHODS,
    ]);
    await new Promise((resolve) => setTimeout(resolve, CAPTURE_WINDOW_MS));
  } finally {
    removeListener();
    try {
      await runInMainWorld(tabId, consoleCaptureUninstallInPage, [sessionId]);
    } catch (e) {
      console.warn(`ConsoleTool: Error uninstalling Firefox console capture in tab ${tabId}:`, e);
    }
  }

  for (const entry of collectedMessages) {
    if (messages.length >= maxMessages) {
      limitReached = true;
      break;
    }
    const messageLevel = entry.level || 'log';
    if (types.length > 0 && !types.includes(messageLevel)) continue;
    const message: FirefoxConsoleMessage = {
      timestamp: entry.timestamp,
      level: messageLevel,
      text: entry.text || '',
      source: 'console-api',
      url: entry.url,
      lineNumber: entry.lineNumber,
    };
    if (entry.stackTrace) message.stackTrace = entry.stackTrace;
    messages.push(message);
  }

  for (const entry of collectedExceptions) {
    const exception: FirefoxConsoleException = {
      timestamp: entry.timestamp || Date.now(),
      text: entry.text || 'Unknown exception',
      url: entry.url,
      lineNumber: entry.lineNumber,
      columnNumber: entry.columnNumber,
    };
    if (entry.stackTrace) exception.stackTrace = entry.stackTrace;
    exceptions.push(exception);
  }

  const endTime = Date.now();
  messages.sort((a, b) => a.timestamp - b.timestamp);
  exceptions.sort((a, b) => a.timestamp - b.timestamp);

  return {
    success: true,
    message:
      `Console capture completed for tab ${tabId}. ${messages.length} messages, ` +
      `${exceptions.length} exceptions captured. ${HISTORY_LIMITATION_NOTE}`,
    tabId,
    tabUrl: tab.url || '',
    tabTitle: tab.title || '',
    captureStartTime: startTime,
    captureEndTime: endTime,
    totalDurationMs: endTime - startTime,
    messages,
    exceptions,
    messageCount: messages.length,
    exceptionCount: exceptions.length,
    messageLimitReached: limitReached,
  };
}
