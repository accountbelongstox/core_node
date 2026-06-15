/**
 * Web shim for @capacitor/app (wordflow end). App lifecycle events do not exist
 * on the web in the same form; listeners are inert and exitApp is a no-op.
 */

export type PluginListenerHandle = { remove: () => Promise<void> };

export const App = {
  async addListener(_eventName: string, _cb: (...args: any[]) => void): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  },
  async removeAllListeners(): Promise<void> {},
  async exitApp(): Promise<void> {},
  async getInfo(): Promise<{ name: string; id: string; build: string; version: string }> {
    return { name: 'wordflow', id: 'web', build: '0', version: '0.0.0' };
  },
  async getState(): Promise<{ isActive: boolean }> {
    return { isActive: true };
  },
};

export default { App };
