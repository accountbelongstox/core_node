/**
 * Web shim for @capacitor/core (wordnew end).
 *
 * The unified shell is a plain web build, so there is no Capacitor runtime.
 * WordNew's services guard every native call behind Capacitor.isNativePlatform(),
 * so reporting "web" here routes them all to their existing web fallbacks.
 */

export const Capacitor = {
  isNativePlatform(): boolean {
    return false;
  },
  getPlatform(): string {
    return 'web';
  },
  isPluginAvailable(_name: string): boolean {
    return false;
  },
};

export type PluginListenerHandle = { remove: () => Promise<void> };

export function registerPlugin<T = any>(_name: string, _impl?: unknown): T {
  // No native bridge in the web shell; return an empty proxy so property access
  // does not throw at import time. Real features come from WordNew's web fallbacks.
  return {} as T;
}

export class WebPlugin {
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }
  async removeAllListeners(): Promise<void> {}
}

export default { Capacitor, registerPlugin, WebPlugin };
