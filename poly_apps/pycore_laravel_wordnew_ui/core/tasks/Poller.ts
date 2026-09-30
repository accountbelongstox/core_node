/** Visibility-aware interval poller: single-flight, failure backoff, manual wake. */

export interface PollerOptions {
  intervalMs: number;
  /** Run once immediately on start (default true). */
  immediate?: boolean;
  /** Pause while the document is hidden (default true). */
  pauseWhenHidden?: boolean;
  /** Double the interval on consecutive failures up to maxIntervalMs (default false). */
  backoff?: boolean;
  maxIntervalMs?: number;
  /** Debounce for wake() calls (default 0 = run as soon as idle). */
  wakeDebounceMs?: number;
}

export class Poller {
  private readonly task: () => void | Promise<void>;
  private readonly options: PollerOptions;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private pendingWake = false;
  private failures = 0;
  private running = false;
  private readonly onVisibility = (): void => {
    if (typeof document === 'undefined') return;
    if (!document.hidden && this.running) this.wake();
  };

  constructor(task: () => void | Promise<void>, options: PollerOptions) {
    this.task = task;
    this.options = options;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.options.pauseWhenHidden !== false && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    if (this.options.immediate !== false) this.execute();
    else this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
  }

  /** Run soon (topic wake / visibility regain); a flight in progress runs a trailing pass. */
  wake(): void {
    if (!this.running) return;
    if (this.inFlight) {
      this.pendingWake = true;
      return;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const delay = this.options.wakeDebounceMs ?? 0;
    if (delay <= 0) this.execute();
    else this.timer = setTimeout(() => this.execute(), delay);
  }

  private currentIntervalMs(): number {
    if (!this.options.backoff || this.failures === 0) return this.options.intervalMs;
    const cap = this.options.maxIntervalMs ?? this.options.intervalMs * 16;
    return Math.min(cap, this.options.intervalMs * 2 ** this.failures);
  }

  private scheduleNext(): void {
    if (!this.running || this.timer !== null) return;
    this.timer = setTimeout(() => this.execute(), this.currentIntervalMs());
  }

  private execute(): void {
    if (!this.running || this.inFlight) return;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.options.pauseWhenHidden !== false && typeof document !== 'undefined' && document.hidden) {
      this.scheduleNext();
      return;
    }
    this.inFlight = true;
    Promise.resolve()
      .then(() => this.task())
      .then(() => {
        this.failures = 0;
      })
      .catch(() => {
        this.failures += 1;
      })
      .finally(() => {
        this.inFlight = false;
        if (this.pendingWake) {
          this.pendingWake = false;
          this.wake();
          return;
        }
        this.scheduleNext();
      });
  }
}
