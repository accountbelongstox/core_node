/**
 * Web shim for @capacitor/network.
 *
 * Backs the Capacitor Network plugin with the browser online/offline events and
 * the (Chromium-only) Network Information API (`navigator.connection`). On the
 * web build `@capacitor/network` is aliased to this file (see vite.config.ts).
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working.
 */

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface ConnectionStatus {
  connected: boolean;
  connectionType: ConnectionType;
}

export type ConnectionStatusChangeListener = (status: ConnectionStatus) => void;
export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

function conn(): any {
  try {
    const nav = navigator as any;
    return nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
  } catch {
    return null;
  }
}

function deriveType(): ConnectionType {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'none';
  const c = conn();
  if (!c) return typeof navigator !== 'undefined' && navigator.onLine ? 'unknown' : 'none';
  // effectiveType: 'slow-2g' | '2g' | '3g' | '4g'; type: 'wifi' | 'cellular' | ...
  const t = (c.type as string) || '';
  if (t === 'wifi' || t === 'ethernet') return 'wifi';
  if (t === 'cellular') return 'cellular';
  if (t === 'none') return 'none';
  if (c.effectiveType) return 'cellular';
  return navigator.onLine ? 'unknown' : 'none';
}

function currentStatus(): ConnectionStatus {
  const connected = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  return { connected, connectionType: connected ? deriveType() : 'none' };
}

const listeners = new Set<ConnectionStatusChangeListener>();
let wired = false;

function emit(): void {
  const status = currentStatus();
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      /* ignore listener errors */
    }
  });
}

function ensureWired(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);
  const c = conn();
  if (c && typeof c.addEventListener === 'function') c.addEventListener('change', emit);
}

export const Network = {
  async getStatus(): Promise<ConnectionStatus> {
    return currentStatus();
  },

  async addListener(
    eventName: 'networkStatusChange',
    listenerFunc: ConnectionStatusChangeListener,
  ): Promise<PluginListenerHandle> {
    ensureWired();
    if (eventName === 'networkStatusChange') listeners.add(listenerFunc);
    return {
      remove: async () => {
        listeners.delete(listenerFunc);
      },
    };
  },

  async removeAllListeners(): Promise<void> {
    listeners.clear();
  },
};

export default { Network };
