/**
 * Web shim for @capacitor/app.
 *
 * Wires the Capacitor App lifecycle API to real browser events so the shared
 * CapAppState capability works on the web shell too:
 *   - appStateChange  <- document visibilitychange (+ window focus/blur)
 *   - backButton      <- window popstate (history back)
 *   - appUrlOpen      <- not emitted on web (deep links arrive via the URL)
 *   - pause / resume  <- visibility hidden / visible
 * exitApp / minimizeApp are no-ops on the web. Aliased on the web build
 * (see vite.config.ts). Primarily for the wordnew mobile APP native build.
 */

export type PluginListenerHandle = { remove: () => Promise<void> };

type AnyCb = (...args: any[]) => void;
const listeners: Record<string, Set<AnyCb>> = {
  appStateChange: new Set(),
  backButton: new Set(),
  appUrlOpen: new Set(),
  pause: new Set(),
  resume: new Set(),
  appRestoredResult: new Set(),
};

let wired = false;

function emit(event: string, payload?: any): void {
  listeners[event]?.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore listener errors */
    }
  });
}

function ensureWired(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  const onVisible = (): void => {
    const isActive = document.visibilityState === 'visible';
    emit('appStateChange', { isActive });
    emit(isActive ? 'resume' : 'pause');
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', () => emit('appStateChange', { isActive: true }));
  window.addEventListener('blur', () => emit('appStateChange', { isActive: false }));
  window.addEventListener('popstate', () => {
    emit('backButton', { canGoBack: window.history.length > 1 });
  });
}

export const App = {
  async addListener(eventName: string, cb: AnyCb): Promise<PluginListenerHandle> {
    ensureWired();
    if (!listeners[eventName]) listeners[eventName] = new Set();
    listeners[eventName].add(cb);
    return {
      remove: async () => {
        listeners[eventName]?.delete(cb);
      },
    };
  },
  async removeAllListeners(): Promise<void> {
    Object.values(listeners).forEach((s) => s.clear());
  },
  async exitApp(): Promise<void> {
    /* no-op on web */
  },
  async minimizeApp(): Promise<void> {
    /* no-op on web */
  },
  async getInfo(): Promise<{ name: string; id: string; build: string; version: string }> {
    return { name: 'wordflow', id: 'web', build: '0', version: '0.0.0' };
  },
  async getState(): Promise<{ isActive: boolean }> {
    const isActive =
      typeof document === 'undefined' ? true : document.visibilityState === 'visible';
    return { isActive };
  },
  async getLaunchUrl(): Promise<{ url: string } | null> {
    try {
      return typeof window !== 'undefined' ? { url: window.location.href } : null;
    } catch {
      return null;
    }
  },
};

export default { App };
