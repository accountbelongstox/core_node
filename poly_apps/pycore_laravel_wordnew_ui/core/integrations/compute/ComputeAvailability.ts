/** Reactive availability of the two compute paths, with hysteresis so a flapping link does not thrash jobs. */
import { COMPUTE_DEFAULTS, type ComputePath } from './ComputeTypes';

export interface AvailabilitySource {
  isUp: () => boolean;
  subscribe: (listener: () => void) => () => void;
}

export interface ComputeAvailabilitySnapshot {
  pycore: boolean;
  laravel: boolean;
}

export interface ComputeClock {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export const SYSTEM_CLOCK: ComputeClock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface ComputeAvailabilityOptions {
  upAfterMs?: number;
  downAfterMs?: number;
  clock?: ComputeClock;
}

const PATHS: readonly ComputePath[] = ['pycore', 'laravel'];

export class ComputeAvailability {
  private snapshot: ComputeAvailabilitySnapshot = { pycore: false, laravel: false };
  private readonly listeners = new Set<() => void>();
  private readonly timers = new Map<ComputePath, unknown>();
  private readonly offs: Array<() => void> = [];
  private readonly upAfterMs: number;
  private readonly downAfterMs: number;
  private readonly clock: ComputeClock;

  constructor(private readonly sources: Record<ComputePath, AvailabilitySource>, options: ComputeAvailabilityOptions = {}) {
    this.upAfterMs = options.upAfterMs ?? COMPUTE_DEFAULTS.upAfterMs;
    this.downAfterMs = options.downAfterMs ?? COMPUTE_DEFAULTS.downAfterMs;
    this.clock = options.clock ?? SYSTEM_CLOCK;
  }

  start(): void {
    if (this.offs.length) return;
    // The first reading is taken as is; only later changes are debounced.
    this.snapshot = { pycore: this.sources.pycore.isUp(), laravel: this.sources.laravel.isUp() };
    PATHS.forEach((path) => this.offs.push(this.sources[path].subscribe(() => this.observe(path))));
  }

  stop(): void {
    this.offs.splice(0).forEach((off) => off());
    this.timers.forEach((handle) => this.clock.clearTimeout(handle));
    this.timers.clear();
  }

  getSnapshot = (): ComputeAvailabilitySnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private observe(path: ComputePath): void {
    const raw = this.sources[path].isUp();
    const pending = this.timers.get(path);
    if (pending !== undefined) {
      this.clock.clearTimeout(pending);
      this.timers.delete(path);
    }
    if (raw === this.snapshot[path]) return;
    this.timers.set(path, this.clock.setTimeout(() => {
      this.timers.delete(path);
      // The reading may have flipped back without an event: re-read before publishing.
      if (this.sources[path].isUp() !== raw || this.snapshot[path] === raw) return;
      this.snapshot = { ...this.snapshot, [path]: raw };
      this.listeners.forEach((listener) => listener());
    }, raw ? this.upAfterMs : this.downAfterMs));
  }
}
