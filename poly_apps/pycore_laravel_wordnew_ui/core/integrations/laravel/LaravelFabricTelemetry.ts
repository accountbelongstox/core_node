import { RELAY_FABRIC_CONTRACT, type RelayFabricTelemetryItem } from '../../contracts/RelayFabricContract';
import { laravelRelayApi as laravelApi } from './LaravelRelayAPI';

const FLUSH_INTERVAL_MS = 5_000;
const QUEUE_LIMIT = RELAY_FABRIC_CONTRACT.limits.telemetry_batch * 5;
const BATCH_LIMIT = RELAY_FABRIC_CONTRACT.limits.telemetry_batch;

/**
 * Batches completed fabric calls and posts them to the owner telemetry
 * endpoint at most every FLUSH_INTERVAL_MS, plus once when the page hides.
 * Telemetry is best effort: a failed batch is dropped, never retried.
 */
class LaravelFabricTelemetry {
  private queue: RelayFabricTelemetryItem[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastFlushAt = 0;
  private wired = false;

  record(item: RelayFabricTelemetryItem): void {
    this.wire();
    this.queue.push(item);
    if (this.queue.length > QUEUE_LIMIT) this.queue.splice(0, this.queue.length - QUEUE_LIMIT);
    this.schedule();
  }

  flush(keepalive = false): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.queue.length === 0) return;
    this.lastFlushAt = Date.now();
    const items = this.queue.splice(0, BATCH_LIMIT);
    void laravelApi.postFabricTelemetry(items, keepalive).catch(() => undefined);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer || this.queue.length === 0) return;
    const wait = Math.max(0, this.lastFlushAt + FLUSH_INTERVAL_MS - Date.now());
    this.timer = setTimeout(() => this.flush(), wait);
  }

  private wire(): void {
    if (this.wired || typeof document === 'undefined') return;
    this.wired = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushAll();
    });
    window.addEventListener('pagehide', () => this.flushAll());
  }

  private flushAll(): void {
    while (this.queue.length > 0) this.flush(true);
  }
}

export const laravelFabricTelemetry = new LaravelFabricTelemetry();
