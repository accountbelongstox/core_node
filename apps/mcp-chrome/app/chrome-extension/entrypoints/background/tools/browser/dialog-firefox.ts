/**
 * Firefox JavaScript dialog handling.
 *
 * Firefox has no chrome.debugger / CDP, so Page.handleJavaScriptDialog (which
 * answers a currently OPEN dialog on Chrome) is impossible there. Instead the
 * tool ARMS a MAIN-world auto-responder: window.alert/confirm/prompt are
 * overridden so future dialogs are answered automatically according to the
 * configured action (accept/dismiss + promptText), never showing the native
 * dialog. Each intercepted dialog is reported through the shared Firefox
 * MAIN-world relay and returned (drained) by the next tool call.
 *
 * Known degradations vs Chrome: dialogs opened BEFORE arming and
 * beforeunload dialogs cannot be intercepted.
 *
 * Only reached behind import.meta.env.FIREFOX guards; compile-time dead code
 * on Chrome builds, so Chrome behavior is unchanged.
 */
import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import {
  FIREFOX_RELAY_ACTION,
  FIREFOX_RELAY_MARKER,
  ensureRelayBridge,
  runInMainWorld,
} from '@/utils/firefox-main-world-relay';

const MAX_INTERCEPTED_DIALOGS_PER_TAB = 50;
const FIREFOX_DIALOG_NOTE =
  'Firefox: no CDP, so instead of answering a currently open dialog this arms a MAIN-world ' +
  'auto-responder for future alert/confirm/prompt dialogs on this tab (until the page reloads). ' +
  'Dialogs opened before arming and beforeunload dialogs cannot be intercepted. ' +
  'interceptedDialogs lists dialogs auto-answered since the previous call.';

// Per-tab log of dialogs intercepted by the MAIN-world auto-responder.
const interceptedDialogsByTab = new Map<number, any[]>();

// Persistent recorder: registered at module init so reports sent while the
// event page was asleep still wake it and get recorded before any tool call.
if (import.meta.env.FIREFOX) {
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender) => {
    if (message?.action !== FIREFOX_RELAY_ACTION) return;
    if (message.entry?.kind !== 'dialog' || !message.entry.data) return;
    const senderTabId = sender.tab?.id;
    if (typeof senderTabId !== 'number') return;
    const log = interceptedDialogsByTab.get(senderTabId) || [];
    log.push(message.entry.data);
    if (log.length > MAX_INTERCEPTED_DIALOGS_PER_TAB) {
      log.splice(0, log.length - MAX_INTERCEPTED_DIALOGS_PER_TAB);
    }
    interceptedDialogsByTab.set(senderTabId, log);
  });

  chrome.tabs.onRemoved.addListener((tabId: number) => {
    interceptedDialogsByTab.delete(tabId);
  });
}

/**
 * Runs INSIDE the target page's MAIN world (serialized by
 * scripting.executeScript). Must stay fully self-contained: no closures over
 * module scope, values arrive only through the args array. Re-running only
 * updates the configured action/promptText (overrides install once per page).
 */
function dialogAutoResponderInPage(
  marker: string,
  action: string,
  promptText: string | null,
): void {
  const pageWindow = window as any;

  let state = pageWindow.__mcpFfDialogAutoResponder;
  if (state) {
    state.action = action;
    state.promptText = promptText;
    return;
  }
  state = { action, promptText };
  pageWindow.__mcpFfDialogAutoResponder = state;

  const post = (data: any): void => {
    try {
      const payload: any = { kind: 'dialog', data };
      payload[marker] = true;
      window.postMessage(payload, '*');
    } catch {
      // Reporting must never break the page.
    }
  };
  const report = (dialogType: string, message: any, response: any, defaultValue?: any): void => {
    post({
      timestamp: Date.now(),
      dialogType,
      message: message === undefined ? '' : String(message),
      defaultValue: defaultValue === undefined ? undefined : String(defaultValue),
      action: state.action,
      response,
      url: String(location.href),
    });
  };

  window.alert = function (message?: any): void {
    report('alert', message, null);
  };
  window.confirm = function (message?: any): boolean {
    const result = state.action === 'accept';
    report('confirm', message, result);
    return result;
  };
  window.prompt = function (message?: any, defaultValue?: any): string | null {
    let result: string | null = null;
    if (state.action === 'accept') {
      if (state.promptText !== null && state.promptText !== undefined) {
        result = String(state.promptText);
      } else if (defaultValue !== undefined && defaultValue !== null) {
        result = String(defaultValue);
      } else {
        result = '';
      }
    }
    report('prompt', message, result, defaultValue);
    return result;
  };
}

/**
 * Firefox replacement for HandleDialogTool's CDP call: arms the MAIN-world
 * auto-responder and returns the Chrome-shaped response plus armed/note and
 * the dialogs intercepted since the previous call (drained).
 */
export async function handleDialogFirefox(
  tabId: number,
  action: 'accept' | 'dismiss',
  promptText?: string,
): Promise<ToolResult> {
  try {
    await ensureRelayBridge(tabId);
    await runInMainWorld(tabId, dialogAutoResponderInPage, [
      FIREFOX_RELAY_MARKER,
      action,
      action === 'accept' && promptText !== undefined ? promptText : null,
    ]);

    const intercepted = interceptedDialogsByTab.get(tabId) || [];
    interceptedDialogsByTab.set(tabId, []);

    return createJsonResponse({
      success: true,
      action,
      promptText: promptText || null,
      armed: true,
      note: FIREFOX_DIALOG_NOTE,
      interceptedDialogs: intercepted,
    });
  } catch (error) {
    return createErrorResponse(
      `Failed to handle dialog: ${toErrorMessage(error)}. The page may not allow script injection (e.g. about: pages).`,
    );
  }
}
