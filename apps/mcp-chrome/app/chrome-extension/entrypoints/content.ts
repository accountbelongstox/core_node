// MUST stay the first import: aliases chrome -> browser on Firefox before any
// other module top-level code touches chrome.* (no-op, tree-shaken on Chrome).
import '@/utils/browser-shim';

export default defineContentScript({
  matches: ['*://*.google.com/*'],
  main() {},
});
