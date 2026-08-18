/**
 * Firefox MAIN-world -> background relay (shared plumbing).
 *
 * Firefox has no chrome.debugger / CDP, so tools that relied on CDP events
 * (console capture, JavaScript dialog handling) inject a MAIN-world wrapper
 * into the target page instead. MAIN-world code has no extension APIs, so
 * events travel:
 *   MAIN world --window.postMessage--> ISOLATED-world forwarder (installed
 *   once per page by this module) --runtime.sendMessage--> background, where
 *   scoped listeners collect them per tab.
 *
 * This module is only reached behind import.meta.env.FIREFOX guards; on
 * Chrome builds those call sites are compile-time dead code and tree-shaken,
 * so Chrome behavior is unchanged.
 */

/** Marker property distinguishing relay postMessages from unrelated page messages. */
export const FIREFOX_RELAY_MARKER = '__mcpFirefoxMainWorldRelay__';

/** runtime.sendMessage action used by the ISOLATED-world forwarder. */
export const FIREFOX_RELAY_ACTION = 'firefox:main-world-relay:event';

export interface FirefoxRelayEntry {
  kind: 'console' | 'exception' | 'dialog';
  sessionId?: string;
  data: any;
}

/**
 * Runs INSIDE the target page's ISOLATED world (serialized by
 * scripting.executeScript). Must stay fully self-contained: no closures over
 * module scope, values arrive only through the args array. Uses browser.*
 * directly (native promise API in Firefox content contexts; this function
 * never runs on Chrome).
 */
function relayForwarderInPage(marker: string, action: string): void {
  const pageWindow = window as any;
  if (pageWindow.__mcpFfRelayForwarderInstalled) return;
  pageWindow.__mcpFfRelayForwarderInstalled = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const payload: any = event.data;
    if (!payload || payload[marker] !== true) return;
    try {
      (globalThis as any).browser.runtime
        .sendMessage({
          action,
          entry: { kind: payload.kind, sessionId: payload.sessionId, data: payload.data },
        })
        .catch(() => {
          // Background not reachable (event page restarting); drop the entry.
        });
    } catch {
      // Extension context invalidated (extension reloaded); drop the entry.
    }
  });
}

/** Install the ISOLATED-world forwarder in a tab (idempotent per page load). */
export async function ensureRelayBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: relayForwarderInPage,
    args: [FIREFOX_RELAY_MARKER, FIREFOX_RELAY_ACTION],
    world: 'ISOLATED',
  });
}

/** Run a self-contained function in the tab's MAIN world (Firefox 128+). */
export async function runInMainWorld(
  tabId: number,
  func: (...funcArgs: any[]) => void,
  args: any[],
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
    world: 'MAIN',
  });
}

/**
 * Background-side scoped listener: receives relay entries coming from one tab.
 * Returns a function that removes the listener.
 */
export function addRelayListener(
  tabId: number,
  handler: (entry: FirefoxRelayEntry) => void,
): () => void {
  const listener = (message: any, sender: chrome.runtime.MessageSender): void => {
    if (message?.action !== FIREFOX_RELAY_ACTION) return;
    if (sender.tab?.id !== tabId) return;
    if (!message.entry) return;
    handler(message.entry as FirefoxRelayEntry);
    // No sendResponse: the forwarder ignores responses, other listeners are unaffected.
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
