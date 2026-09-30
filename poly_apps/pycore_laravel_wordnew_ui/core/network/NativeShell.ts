/** Capacitor native shell detection shared by every transport and target selector. */
import { Capacitor } from '@capacitor/core';

/**
 * True inside the Capacitor native app. Its bundle is served from
 * `https://localhost`, a host that names the phone itself.
 */
export function isNativeAppShell(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
