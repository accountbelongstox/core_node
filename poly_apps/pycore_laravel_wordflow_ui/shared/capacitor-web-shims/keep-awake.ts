/**
 * Web shim for @capacitor-community/keep-awake.
 *
 * Backs the community KeepAwake plugin with the browser Screen Wake Lock API
 * (navigator.wakeLock). Re-acquires the lock on visibilitychange (the OS drops
 * wake locks when a tab is hidden). Aliased on the web build (see vite.config).
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build) —
 * e.g. keep the screen on during a Walkman / listening session — with this
 * browser fallback for the web shell.
 */

let sentinel: any = null; // WakeLockSentinel
let desired = false;
let visWired = false;

function wakeLockApi(): any {
  try {
    return (navigator as any)?.wakeLock || null;
  } catch {
    return null;
  }
}

async function acquire(): Promise<void> {
  const api = wakeLockApi();
  if (!api?.request) return;
  try {
    sentinel = await api.request('screen');
    sentinel.addEventListener?.('release', () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

function wireVisibility(): void {
  if (visWired || typeof document === 'undefined') return;
  visWired = true;
  document.addEventListener('visibilitychange', () => {
    if (desired && document.visibilityState === 'visible' && !sentinel) {
      void acquire();
    }
  });
}

export const KeepAwake = {
  async keepAwake(): Promise<void> {
    desired = true;
    wireVisibility();
    await acquire();
  },
  async allowSleep(): Promise<void> {
    desired = false;
    try {
      await sentinel?.release?.();
    } catch {
      /* ignore */
    }
    sentinel = null;
  },
  async isSupported(): Promise<{ isSupported: boolean }> {
    return { isSupported: !!wakeLockApi()?.request };
  },
  async isKeptAwake(): Promise<{ isKeptAwake: boolean }> {
    return { isKeptAwake: !!sentinel };
  },
};

export default { KeepAwake };
