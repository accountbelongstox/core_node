/**
 * Web shim for @capacitor/browser.
 *
 * Backs the Capacitor Browser plugin with window.open (web). On native the real
 * plugin opens an in-app browser (SFSafariViewController / Chrome Custom Tabs)
 * which is what OAuth flows need; on web we open a popup/tab. Aliased in
 * vite.config.ts. Primarily provided for the wordnew mobile APP.
 */

import type { PluginListenerHandle } from './core';

export type { PluginListenerHandle } from './core';

let popup: Window | null = null;

export const Browser = {
  async open(options: { url: string; windowName?: string; presentationStyle?: string }): Promise<void> {
    try {
      popup = window.open(options.url, options.windowName || '_blank');
    } catch {
      // Fallback to a full-page navigation if popups are blocked.
      window.location.href = options.url;
    }
  },
  async close(): Promise<void> {
    try {
      popup?.close();
    } catch {
      /* ignore */
    }
    popup = null;
  },
  async addListener(_event: string, _cb: (...a: any[]) => void): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  },
  async removeAllListeners(): Promise<void> {},
};

export default { Browser };
