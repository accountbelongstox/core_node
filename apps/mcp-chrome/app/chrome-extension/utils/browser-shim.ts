/**
 * Firefox compatibility shim (side-effect module).
 *
 * On Firefox, chrome.* APIs are CALLBACK-only while browser.* is promise-based.
 * This codebase calls chrome.* in promise style everywhere, so on Firefox we
 * alias the global `chrome` namespace to `browser` (promise-based, same event
 * listener semantics). Must be imported as the FIRST import of every
 * entrypoint so nothing touches chrome.* before the alias is installed.
 *
 * On Chrome builds import.meta.env.FIREFOX is a compile-time false, so this
 * whole block is tree-shaken away and Chrome behavior is unchanged.
 */
if (import.meta.env.FIREFOX) {
  (globalThis as any).chrome = (globalThis as any).browser;
}

export {};
