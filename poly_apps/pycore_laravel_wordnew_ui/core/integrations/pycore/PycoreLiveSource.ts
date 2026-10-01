/** Shared lifecycle of a live pycore store: topic pushes, reconcile on restart or replay loss, slow fallback poll. */
import { connectPycoreHttp, subscribe } from './PycoreEventClient';
import { PYCORE_BROWSER_EVENTS } from './PycoreNetwork';
import { Poller } from '../../tasks/Poller';

export interface PycoreLiveSourceOptions {
  topics: Record<string, (payload: any) => void>;
  refresh: () => void | Promise<void>;
  /** Slow reconciliation poll; 0 relies on pushes alone. */
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
    ];
    options.onRetain?.();
    reconcile();
    if (options.fallbackMs) {
      poller = new Poller(options.refresh, { intervalMs: options.fallbackMs, immediate: false });
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
