/** Exponential delay with jitter; the single reconnect/failure back-off of the relay client. */
export class Backoff {
  private readonly minMs: number;
  private readonly maxMs: number;
  private delayMs: number;

  constructor(minMs: number, maxMs: number) {
    this.minMs = minMs;
    this.maxMs = maxMs;
    this.delayMs = minMs;
  }

  next(): number {
    const delay = this.delayMs + Math.floor(Math.random() * this.minMs);
    this.delayMs = Math.min(this.maxMs, this.delayMs * 2);
    return delay;
  }

  reset(): void {
    this.delayMs = this.minMs;
  }
}
