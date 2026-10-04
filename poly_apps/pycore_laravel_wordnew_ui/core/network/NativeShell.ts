/** Native app shell detection (Capacitor or desktop) shared by every transport and target selector. */
import { Capacitor } from '@capacitor/core';
import { isDesktopAppShell } from './DesktopShell';

/**
 * True inside an installed app shell: the Capacitor native app (bundle served
 * from `https://localhost`, a host that names the phone itself) or the desktop
 * app (`app://localhost`). Both keep clips on the device's disk.
 */
export function isNativeAppShell(): boolean {
  if (isDesktopAppShell()) return true;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
