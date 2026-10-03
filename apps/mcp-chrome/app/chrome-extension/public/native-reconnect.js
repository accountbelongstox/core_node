// Static page the service supervisor opens to wake a disconnected native host.
// It is copied verbatim (no bundler, no dev server), so it runs on any build and
// always closes its own tab, even when the background does not answer.
const CONNECT_NATIVE_MESSAGE = 'connectNative';
const CLOSE_DEADLINE_MS = 3000;

function closeTab() {
  chrome.tabs.getCurrent((tab) => {
    if (tab && tab.id !== undefined) {
      chrome.tabs.remove(tab.id);
    } else {
      window.close();
    }
  });
}

setTimeout(closeTab, CLOSE_DEADLINE_MS);
chrome.runtime
  .sendMessage({ type: CONNECT_NATIVE_MESSAGE, forceReconnect: true })
  .catch(() => undefined)
  .finally(closeTab);
