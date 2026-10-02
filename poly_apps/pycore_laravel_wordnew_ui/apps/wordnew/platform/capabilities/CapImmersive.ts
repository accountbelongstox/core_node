/* =============================================================================
 * CapImmersive - immersive fullscreen playback (system bars hidden, landscape)
 * =============================================================================
 * Native (Android, app plugin `Immersive`): hides the status / navigation bars
 * and turns the screen to landscape; exit restores both. Web: the document
 * fullscreen API and a landscape orientation lock where the browser allows
 * them (iOS Safari allows neither: the page's own full-viewport layer is the
 * fullscreen there). Every call is best-effort and never throws.
 * ========================================================================== */
import { registerPlugin } from '@capacitor/core';
import { isNativeAppShell } from '../../../../core/network/NativeShell';

interface ImmersivePlugin {
  enter(options: { landscape: boolean }): Promise<void>;
  exit(): Promise<void>;
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

const nativeImmersive = registerPlugin<ImmersivePlugin>('Immersive');

function orientation(): LockableOrientation | undefined {
  return typeof screen === 'undefined' ? undefined : screen.orientation as LockableOrientation | undefined;
}

export const capImmersive = {
  async enter(landscape = true): Promise<void> {
    if (isNativeAppShell()) {
      await nativeImmersive.enter({ landscape }).catch(() => undefined);
      return;
    }
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      if (landscape) await orientation()?.lock?.('landscape');
    } catch {
      /* not allowed here: the page layer alone is the fullscreen */
    }
  },

  async exit(): Promise<void> {
    if (isNativeAppShell()) {
      await nativeImmersive.exit().catch(() => undefined);
      return;
    }
    if (typeof document === 'undefined') return;
    try { orientation()?.unlock(); } catch { /* unsupported */ }
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  },

  /** Web: the user left the document fullscreen (Esc, system back); native never reports it. */
  onWebExit(listener: () => void): () => void {
    if (isNativeAppShell() || typeof document === 'undefined') return () => undefined;
    let was = Boolean(document.fullscreenElement);
    const onChange = (): void => {
      if (was && !document.fullscreenElement) listener();
      was = Boolean(document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  },
};
