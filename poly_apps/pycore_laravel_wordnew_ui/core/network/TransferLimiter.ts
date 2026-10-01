/**
 * TransferLimiter - the device-wide concurrency of data transfers per backend
 * lane (pycore, Laravel). Every bulk transfer (clip bundles, per-file clip
 * downloads, chunked reads) takes a slot of its lane for the time its request
 * is on the wire; requests beyond the limit wait in order. Small control
 * requests (lookups, queue batches) are not limited.
 *
 * The limit of each lane is a device setting kept in the local persisted state
 * (never roamed: what a phone's link sustains is that phone's), defaulting to
 * the contract's `transfer.parallel_defaults` and clamped to
 * 1..`transfer.parallel_max`. Changing it applies at once: a raised limit
 * starts waiting transfers, a lowered one lets running transfers finish and
 * starts new ones only below it.
 *
 * Live state (active / queued / limit per lane) for UI widgets through
 * `subscribe` / `getSnapshot` (useSyncExternalStore shape).
 */
import { AUDIO_ORCH_TRANSFER } from '../contracts/AudioOrchestrationContract';
import { PersistedStore } from '../persistence';

export type TransferLane = 'pycore' | 'laravel';
export const TRANSFER_LANES: readonly TransferLane[] = ['pycore', 'laravel'];

export type TransferLimits = Record<TransferLane, number>;

export interface TransferLaneState {
  limit: number;
  defaultLimit: number;
  active: number;
  queued: number;
}

export type TransferSnapshot = Record<TransferLane, TransferLaneState>;

const TRANSFER_LIMITS_KEY = 'core.transfer.limits';
const PUBLISH_DELAY_MS = 100;

/** A lane limit within the contract's bounds. */
export function clampTransferLimit(value: number): number {
  return Math.min(AUDIO_ORCH_TRANSFER.parallelMax, Math.max(1, Math.round(Number(value) || 1)));
}

class TransferLimitsStore extends PersistedStore<TransferLimits> {
  constructor() {
    super(TRANSFER_LIMITS_KEY, () => ({ ...AUDIO_ORCH_TRANSFER.parallelDefaults }));
  }
}

type Waiter = { start: () => void; signal?: AbortSignal; onAbort: () => void };

class TransferLimiterService {
  private readonly limits = new TransferLimitsStore();
  private readonly active: Record<TransferLane, number> = { pycore: 0, laravel: 0 };
  private readonly waiters: Record<TransferLane, Waiter[]> = { pycore: [], laravel: [] };
  private readonly listeners = new Set<() => void>();
  private snapshot: TransferSnapshot = this.build();
  private publishTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): TransferSnapshot => this.snapshot;

  limit(lane: TransferLane): number {
    return clampTransferLimit(this.limits.get(lane));
  }

  /** Persist a lane's limit (device-local) and apply it at once. */
  setLimit(lane: TransferLane, value: number): void {
    this.limits.patch({ [lane]: clampTransferLimit(value) } as Partial<TransferLimits>);
    this.pump(lane);
    this.publishNow();
  }

  /** Back to the contract defaults. */
  resetLimits(): void {
    this.limits.patch({ ...AUDIO_ORCH_TRANSFER.parallelDefaults });
    TRANSFER_LANES.forEach((lane) => this.pump(lane));
    this.publishNow();
  }

  /** Run `work` holding a slot of `lane` (waits for a free slot; `signal` aborts the wait). */
  async run<T>(lane: TransferLane, work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(lane, signal);
    try {
      return await work();
    } finally {
      this.active[lane] -= 1;
      this.pump(lane);
      this.publishSoon();
    }
  }

  private acquire(lane: TransferLane, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    if (this.active[lane] < this.limit(lane) && this.waiters[lane].length === 0) {
      this.active[lane] += 1;
      this.publishSoon();
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        signal,
        start: () => {
          signal?.removeEventListener('abort', waiter.onAbort);
          this.active[lane] += 1;
          resolve();
        },
        onAbort: () => {
          this.waiters[lane] = this.waiters[lane].filter((entry) => entry !== waiter);
          this.publishSoon();
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
      };
      signal?.addEventListener('abort', waiter.onAbort, { once: true });
      this.waiters[lane].push(waiter);
      this.publishSoon();
    });
  }

  /** Start waiting transfers while the lane is below its limit. */
  private pump(lane: TransferLane): void {
    while (this.active[lane] < this.limit(lane) && this.waiters[lane].length > 0) {
      this.waiters[lane].shift()?.start();
    }
  }

  private build(): TransferSnapshot {
    const lane = (name: TransferLane): TransferLaneState => ({
      limit: this.limit(name),
      defaultLimit: clampTransferLimit(AUDIO_ORCH_TRANSFER.parallelDefaults[name]),
      active: this.active[name],
      queued: this.waiters[name].length,
    });
    return { pycore: lane('pycore'), laravel: lane('laravel') };
  }

  /** Slot changes come in bursts: publish at most every PUBLISH_DELAY_MS. */
  private publishSoon(): void {
    this.publishTimer ??= setTimeout(() => this.publishNow(), PUBLISH_DELAY_MS);
  }

  private publishNow(): void {
    if (this.publishTimer) clearTimeout(this.publishTimer);
    this.publishTimer = null;
    this.snapshot = this.build();
    this.listeners.forEach((listener) => listener());
  }
}

/** The one device-wide transfer limiter. */
export const transferLimiter = new TransferLimiterService();
