/**
 * Web shim for @capacitor/core (wordnew end).
 *
 * The unified shell is a plain web build, so there is no Capacitor runtime.
 * WordNew's services guard every native call behind Capacitor.isNativePlatform(),
 * so reporting "web" here routes them all to their existing web fallbacks.
 * Inside the desktop app (native/desktop) the app plugins and file URLs come
 * from the desktop bridge; isNativeAppShell() reports the desktop shell itself.
 */
import { desktopShellBridge } from '../../../../core/network/DesktopShell';

export const Capacitor = {
  isNativePlatform(): boolean {
    return false;
  },
  getPlatform(): string {
    return 'web';
  },
  isPluginAvailable(name: string): boolean {
    return Boolean(desktopShellBridge()?.plugins[name]);
  },
  convertFileSrc(uri: string): string {
    return desktopShellBridge()?.convertFileSrc(uri) ?? uri;
  },
};

export type PluginListenerHandle = { remove: () => Promise<void> };

export function registerPlugin<T = any>(name: string, _impl?: unknown): T {
  // The desktop bridge implements the app plugins; elsewhere an empty object keeps
  // property access from throwing at import time (WordNew's web fallbacks run instead).
  return (desktopShellBridge()?.plugins[name] ?? {}) as T;
}

export class WebPlugin {
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  }
  async removeAllListeners(): Promise<void> {}
}

export default { Capacitor, registerPlugin, WebPlugin };
