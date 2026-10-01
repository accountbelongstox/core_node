/** Exponential delay: the single reconnect, retry and failure back-off of the UI. */
export interface BackoffOptions {
  /** additive: plus a random share of minMs (default); half: between half and the full step; none. */
  jitter?: 'additive' | 'half' | 'none';
  /** Step the sequence starts at and returns to on reset (default 0). */
  initialStep?: number;
}

export class Backoff {
  private readonly minMs: number;
  private readonly maxMs: number;
  private readonly jitter: 'additive' | 'half' | 'none';
  private readonly initialStep: number;
  private step: number;

  constructor(minMs: number, maxMs: number, options: BackoffOptions = {}) {
    this.minMs = minMs;
    this.maxMs = maxMs;
    this.jitter = options.jitter ?? 'additive';
    this.initialStep = options.initialStep ?? 0;
    this.step = this.initialStep;
  }

  /** The capped delay of one step, without jitter and without advancing the sequence. */
  delayFor(step: number): number {
    return Math.min(this.maxMs, this.minMs * 2 ** step);
  }

  next(): number {
    const base = this.delayFor(this.step);
    if (base < this.maxMs) this.step += 1;
    if (this.jitter === 'half') return base / 2 + Math.random() * (base / 2);
    if (this.jitter === 'none') return base;
    return base + Math.floor(Math.random() * this.minMs);
  }

  reset(): void {
    this.step = this.initialStep;
  }
}
