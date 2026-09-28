/* eslint-disable */

(() => {
  // Prevent duplicate injection of the bridge itself.
  if (window.__INJECT_SCRIPT_TOOL_UNIVERSAL_BRIDGE_LOADED__) return;
  window.__INJECT_SCRIPT_TOOL_UNIVERSAL_BRIDGE_LOADED__ = true;
  const EVENT_NAME = {
    RESPONSE: 'chrome-mcp:response',
    CLEANUP: 'chrome-mcp:cleanup',
    EXECUTE: 'chrome-mcp:execute',
  };
  // Bounded timeout for MAIN-world requests: if the injected script never
  // responds (crash, missing/wrong listener, mid-request cleanup) the pending
  // entry is rejected so the message channel and calling MCP tool do not hang.
  const MAIN_WORLD_REQUEST_TIMEOUT_MS = 30000;
  // requestId -> { sendResponse, timer }. Storing the timer lets every resolve
  // path clear it, enforcing clear-timer-on-all-paths discipline.
  const pendingRequests = new Map();

  // Resolve a pending request with a payload and clear its timeout guard.
  function resolvePending(requestId, payload) {
    const entry = pendingRequests.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingRequests.delete(requestId);
    try {
      entry.sendResponse(payload);
    } catch (_) {
      // sendResponse can throw if the message channel already closed; ignore.
    }
  }

  // Reject every still-pending request (used on bridge cleanup) so no MAIN-world
  // dispatch is orphaned when the bridge tears down mid-request.
  function rejectAllPending(error) {
    for (const requestId of Array.from(pendingRequests.keys())) {
      resolvePending(requestId, { error });
    }
  }

  const messageHandler = (request, _sender, sendResponse) => {
    // --- Lifecycle Command ---
    if (request.type === EVENT_NAME.CLEANUP) {
      window.dispatchEvent(new CustomEvent(EVENT_NAME.CLEANUP));
      // Acknowledge cleanup signal received, but don't hold the connection.
      sendResponse({ success: true });
      return false; // Synchronous response; cleanup already removed this listener
    }

    // --- Execution Command for MAIN world ---
    if (request.targetWorld === 'MAIN') {
      const requestId = `req-${Date.now()}-${Math.random()}`;
      const timer = setTimeout(() => {
        resolvePending(requestId, {
          error: `MAIN-world script did not respond within ${MAIN_WORLD_REQUEST_TIMEOUT_MS}ms`,
        });
      }, MAIN_WORLD_REQUEST_TIMEOUT_MS);
      pendingRequests.set(requestId, { sendResponse, timer });

      window.dispatchEvent(
        new CustomEvent(EVENT_NAME.EXECUTE, {
          detail: {
            action: request.action,
            payload: request.payload,
            requestId: requestId,
          },
        }),
      );
      return true; // Async response is expected.
    }
    // Note: Requests for ISOLATED world are handled by the user's isolatedWorldCode script directly.
    // This listener won't process them unless it's the only script in ISOLATED world.
  };

  chrome.runtime.onMessage.addListener(messageHandler);

  // Listen for responses coming back from the MAIN world.
  const responseHandler = (event) => {
    if (!event || !event.detail) return;
    const { requestId, data, error } = event.detail;
    resolvePending(requestId, { data, error });
  };
  window.addEventListener(EVENT_NAME.RESPONSE, responseHandler);

  // --- Self Cleanup ---
  // When the cleanup signal arrives, this bridge must also clean itself up.
  const cleanupHandler = () => {
    // Reject any in-flight MAIN-world requests so callers do not hang forever.
    rejectAllPending('inject-bridge cleaned up before MAIN-world response arrived');
    chrome.runtime.onMessage.removeListener(messageHandler);
    window.removeEventListener(EVENT_NAME.RESPONSE, responseHandler);
    window.removeEventListener(EVENT_NAME.CLEANUP, cleanupHandler);
    delete window.__INJECT_SCRIPT_TOOL_UNIVERSAL_BRIDGE_LOADED__;
  };
  window.addEventListener(EVENT_NAME.CLEANUP, cleanupHandler);
})();
