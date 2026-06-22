/**
 * Web shim for @capacitor/keyboard (wordflow end). The browser manages the
 * on-screen keyboard; all methods are no-ops and listeners are inert.
 */

export type PluginListenerHandle = { remove: () => Promise<void> };

export const Keyboard = {
  async show(): Promise<void> {},
  async hide(): Promise<void> {},
  async setAccessoryBarVisible(_options: { isVisible: boolean }): Promise<void> {},
  async setScroll(_options: { isDisabled: boolean }): Promise<void> {},
  async addListener(_eventName: string, _cb: (...args: any[]) => void): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  },
  async removeAllListeners(): Promise<void> {},
};

export default { Keyboard };
