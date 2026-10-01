/** Shared lifecycle of a live pycore store: topic pushes, reconcile on restart, replay loss or reconnect, slow fallback poll while the event link is down. */
import { connectPycoreHttp, isHttpConnected, onHttpStatus, subscribe } from './PycoreEventClient';
import { PYCORE_BROWSER_EVENTS } from './PycoreNetwork';
import { Poller } from '../../tasks/Poller';

export interface PycoreLiveSourceOptions {
  topics: Record<string, (payload: any) => void>;
  refresh: () => void | Promise<void>;
  /** Slow reconciliation poll while the event link is down; 0 relies on pushes alone. */
  fallbackMs?: number;
  /** Extra work when the pycore instance restarted, before the refresh. */
  onServerRestart?: () => void;
  onRetain?: () => void;
  onRelease?: () => void;
}

export interface PycoreLiveSource {
  retain: () => void;
  release: () => void;
}

/** Calls `onReconnect` each time the event link comes back after a drop (not for the initial state). */
export function watchReconnect(onReconnect: () => void): () => void {
  let wasConnected: boolean | null = null;
  return onHttpStatus((connected) => {
    if (connected && wasConnected === false) onReconnect();
    wasConnected = connected;
  });
}

export function createPycoreLiveSource(options: PycoreLiveSourceOptions): PycoreLiveSource {
  let holders = 0;
  let offs: Array<() => void> = [];
  let poller: Poller | null = null;
  const reconcile = (): void => { void options.refresh(); };

  function retain(): void {
    holders += 1;
    if (holders > 1) return;
    connectPycoreHttp();
    offs = [
      ...Object.entries(options.topics).map(([topic, handler]) => subscribe(topic, handler)),
      subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => {
        options.onServerRestart?.();
        reconcile();
      }),
      subscribe(PYCORE_BROWSER_EVENTS.httpEventReplayLost, reconcile),
      watchReconnect(reconcile),
    ];
    options.onRetain?.();
    reconcile();
    if (options.fallbackMs) {
      poller = new Poller(() => (isHttpConnected() ? undefined : options.refresh()), { intervalMs: options.fallbackMs, immediate: false });
      poller.start();
    }
  }

  function release(): void {
    holders = Math.max(0, holders - 1);
    if (holders > 0) return;
    offs.forEach((off) => off());
    offs = [];
    poller?.stop();
    poller = null;
    options.onRelease?.();
  }

  return { retain, release };
}
