/**
 * Desktop (Electron) app shell bridge, exposed by native/desktop/preload.cjs.
 * Dependency-free: the @capacitor web shims and NativeShell both read it.
 */

/** Window global the desktop preload exposes (contract with native/desktop/preload.cjs). */
export const DESKTOP_BRIDGE_GLOBAL = 'coreNodeDesktop';

export interface DesktopShellBridge {
  /** Host OS (`win32`, `linux`, `darwin`). */
  platform: string;
  /** Desktop implementations of the app plugins (DeviceStorage, ForegroundSync, LanInfo, Immersive). */
  plugins: Record<string, unknown>;
  /** Real-disk implementation of the @capacitor/filesystem API. */
  fs: Record<string, (...args: any[]) => Promise<any>>;
  /** A `file://` URI as a URL the page can load (audio / images). */
  convertFileSrc(uri: string): string;
}

export function desktopShellBridge(): DesktopShellBridge | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as Record<string, DesktopShellBridge | undefined>)[DESKTOP_BRIDGE_GLOBAL]) ?? null;
}

/** True inside the desktop app (its bundle is served from `app://localhost`, a host that names this PC). */
export function isDesktopAppShell(): boolean {
  return desktopShellBridge() !== null;
}
