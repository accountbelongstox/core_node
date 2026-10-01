/** Reactive availability of the two compute paths, with hysteresis so a flapping link does not thrash jobs. */
import { COMPUTE_DEFAULTS, type ComputePath } from './ComputeTypes';

export interface AvailabilitySource {
  isUp: () => boolean;
  subscribe: (listener: () => void) => () => void;
}

export interface ComputeAvailabilitySnapshot {
  pycore: boolean;
  laravel: boolean;
  /** The selected pycore answers over its own link (not the relay). */
  direct: boolean;
  /** Not direct, Laravel up, and a pycore reachable through the relay (paired, or the selected relay target answering). */
  relay: boolean;
}

/** Inputs of the delivery channels beyond the two path sources. */
export interface ChannelInputs {
  relayMode: () => boolean;
  relayPaired: () => boolean;
  /** Fires when the relay mode or the pairing changes. */
  subscribe: (listener: () => void) => () => void;
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
  channels?: ChannelInputs;
}

type FlagName = keyof ComputeAvailabilitySnapshot;

const FLAGS: readonly FlagName[] = ['pycore', 'laravel', 'direct', 'relay'];
const NO_CHANNELS: ChannelInputs = { relayMode: () => false, relayPaired: () => false, subscribe: () => () => undefined };

export class ComputeAvailability {
  private snapshot: ComputeAvailabilitySnapshot = { pycore: false, laravel: false, direct: false, relay: false };
  private readonly listeners = new Set<() => void>();
  private readonly timers = new Map<FlagName, unknown>();
  private readonly offs: Array<() => void> = [];
  private readonly upAfterMs: number;
  private readonly downAfterMs: number;
  private readonly clock: ComputeClock;
  private readonly channels: ChannelInputs;

  constructor(private readonly sources: Record<ComputePath, AvailabilitySource>, options: ComputeAvailabilityOptions = {}) {
    this.upAfterMs = options.upAfterMs ?? COMPUTE_DEFAULTS.upAfterMs;
    this.downAfterMs = options.downAfterMs ?? COMPUTE_DEFAULTS.downAfterMs;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.channels = options.channels ?? NO_CHANNELS;
  }

  start(): void {
    if (this.offs.length) return;
    // The first reading is taken as is (and announced); only later changes are debounced.
    const initial = this.snapshot;
    this.snapshot = this.read();
    if (FLAGS.some((flag) => this.snapshot[flag] !== initial[flag])) this.listeners.forEach((listener) => listener());
    const observe = (): void => this.observeAll();
    this.offs.push(this.sources.pycore.subscribe(observe), this.sources.laravel.subscribe(observe), this.channels.subscribe(observe));
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

  /** Every flag from the live inputs: the one derivation that the debounce publishes. */
  private read(): ComputeAvailabilitySnapshot {
    const pycore = this.sources.pycore.isUp();
    const laravel = this.sources.laravel.isUp();
    const relayMode = this.channels.relayMode();
    const direct = pycore && !relayMode;
    const relay = !direct && laravel && (relayMode ? pycore : this.channels.relayPaired());
    return { pycore, laravel, direct, relay };
  }

  private observeAll(): void {
    const raw = this.read();
    FLAGS.forEach((flag) => this.observe(flag, raw[flag]));
  }

  private observe(flag: FlagName, value: boolean): void {
    const pending = this.timers.get(flag);
    if (pending !== undefined) {
      this.clock.clearTimeout(pending);
      this.timers.delete(flag);
    }
    if (value === this.snapshot[flag]) return;
    this.timers.set(flag, this.clock.setTimeout(() => {
      this.timers.delete(flag);
      // The reading may have flipped back without an event: re-read before publishing.
      if (this.read()[flag] !== value || this.snapshot[flag] === value) return;
      this.snapshot = { ...this.snapshot, [flag]: value };
      this.listeners.forEach((listener) => listener());
    }, value ? this.upAfterMs : this.downAfterMs));
  }
}
