/** One idle timer: `arm()` restarts it on every sign of life (`arm(ms)` with a different window), `clear()` stops it, `onStall` fires after the window of silence. */
import { QUEUE_CENTER_HTTP_TRANSFER } from '../contracts/QueueCenterContract';

/** The transfer idle window of the shared contract (http_transfer.idle_timeout_seconds). */
export const TRANSFER_IDLE_MS = QUEUE_CENTER_HTTP_TRANSFER.idle_timeout_seconds * 1000;

export interface IdleWatchdog {
  arm: (windowMs?: number) => void;
  clear: () => void;
}

export function createIdleWatchdog(stallMs: number, onStall: () => void): IdleWatchdog {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    arm: (windowMs = stallMs) => {
      clear();
      timer = setTimeout(() => {
        timer = null;
        onStall();
      }, windowMs);
    },
    clear,
  };
}
