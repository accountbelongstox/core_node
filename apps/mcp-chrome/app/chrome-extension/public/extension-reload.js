// Static page the service supervisor opens after it points Chrome's registered
// extension folder at the live build: Chrome keeps the old service worker until
// the extension reloads, and reloading also closes this page.
chrome.runtime.reload();
