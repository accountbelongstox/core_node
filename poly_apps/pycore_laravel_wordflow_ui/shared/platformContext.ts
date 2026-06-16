/**
 * Web-vs-app context detection for shell chrome that should only appear in the
 * browser-hosted dashboard (served from a real http(s) URL) and disappear when
 * the same UI is packaged as a native Capacitor app.
 *
 * In the pycore_laravel_wordflow_ui web build, '@capacitor/core' resolves to the local
 * web shim (Capacitor.isNativePlatform() === false — see shared/capacitor-web-shims),
 * so this returns true on a normal http(s) page and false only in an actual
 * native Capacitor build or a non-URL context (SSR / file://).
 */
import { Capacitor } from '@capacitor/core';

/**
 * True only when running as a web page served from a real http(s) URL — i.e.
 * NOT a native Capacitor app and NOT a non-URL context (SSR / file://).
 * Use to gate web-only entry points (e.g. the AI Chat top-bar icon).
 */
export function isWebUrlContext(): boolean {
  // Native Capacitor build: hide web-only chrome.
  if (Capacitor.isNativePlatform()) return false;
  if (typeof window === 'undefined') return false;
  const protocol = window.location?.protocol ?? '';
  return protocol === 'http:' || protocol === 'https:';
}
