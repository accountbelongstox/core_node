/**
 * ServiceLink - the connection to ONE selected backend of a service (Laravel,
 * pycore). It never picks another endpoint: a transport failure turns the link
 * `reconnecting`, the selected endpoint is re-probed with backoff until it
 * answers, and every request waiting on the link continues on it. A changed
 * selection (`retarget`) is probed at once and requests continue there.
 *
 * Store pattern: `subscribe` / `getState` for `useSyncExternalStore`.
 */
import { isNetworkLevelFailure } from './NetworkFailure';
import { Backoff } from '../tasks/Backoff';

export type ServiceLinkState = 'unknown' | 'online' | 'reconnecting';

export interface ServiceLinkOptions {
  /** One probe of the selected endpoint; true when it answers. */
  probe: () => Promise<boolean>;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export interface ReconnectOptions {
  signal?: AbortSignal;
  /** A failure the link may recover from (default: network-level failures). */
  retryable?: (error: unknown) => boolean;
}

const DEFAULT_MIN_DELAY_MS = 1_000;
const DEFAULT_MAX_DELAY_MS = 15_000;
/** A request failing this often while its endpoint answers probes is not a connection problem. */
const MAX_FAILURES_WHILE_REACHABLE = 3;

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export class ServiceLink {
  private state: ServiceLinkState = 'unknown';
  private readonly listeners = new Set<() => void>();
  private readonly waiters = new Set<() => void>();
  private recovery: Promise<boolean> | null = null;
  private wake: (() => void) | null = null;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(private readonly options: ServiceLinkOptions) {
    this.minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.wake?.());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.wake?.();
      });
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getState = (): ServiceLinkState => this.state;

  isReconnecting(): boolean {
    return this.state === 'reconnecting';
  }

  /** A probe or a request reached the endpoint. */
  markOnline(): void {
    this.setState('online');
  }

  /** The endpoint did not answer (a probe or request just failed): reconnect until it does. */
  markDown(): void {
    this.setState('reconnecting');
    void this.recover();
  }

  /** The selection changed: probe the new endpoint now. */
  retarget(): void {
    if (this.recovery) this.wake?.();
    else void this.recover();
  }

  /** Resolves once the link is not reconnecting; rejects on abort. */
  waitOnline(signal?: AbortSignal): Promise<void> {
    if (this.state !== 'reconnecting') return Promise.resolve();
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<void>((resolve, reject) => {
      const done = (): void => {
        signal?.removeEventListener('abort', aborted);
        resolve();
      };
      const aborted = (): void => {
        this.waiters.delete(done);
        reject(abortError());
      };
      this.waiters.add(done);
      signal?.addEventListener('abort', aborted, { once: true });
    });
  }

  /**
   * Shared recovery pass: probes until the endpoint answers. Resolves true
   * when an outage was observed (at least one probe failed).
   */
  recover(signal?: AbortSignal): Promise<boolean> {
    if (!this.recovery) {
      this.recovery = this.reconnectLoop().finally(() => { this.recovery = null; });
    }
    if (!signal) return this.recovery;
    return Promise.race([
      this.recovery,
      new Promise<boolean>((_, reject) => {
        if (signal.aborted) reject(abortError());
        else signal.addEventListener('abort', () => reject(abortError()), { once: true });
      }),
    ]);
  }

  private async reconnectLoop(): Promise<boolean> {
    // The UI's shared exponential back-off (with jitter), fresh for every recovery pass.
    const backoff = new Backoff(this.minDelayMs, this.maxDelayMs);
    let outage = false;
    for (;;) {
      if (await this.options.probe().catch(() => false)) {
        this.setState('online');
        return outage;
      }
      outage = true;
      this.setState('reconnecting');
      await new Promise<void>((resolve) => {
        const finish = (): void => {
          clearTimeout(timer);
          if (this.wake === finish) this.wake = null;
          resolve();
        };
        const timer = setTimeout(finish, backoff.next());
        this.wake = finish;
      });
    }
  }

  private setState(next: ServiceLinkState): void {
    if (next !== 'reconnecting' && this.waiters.size > 0) {
      const waiting = [...this.waiters];
      this.waiters.clear();
      waiting.forEach((resolve) => resolve());
    }
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
}

/**
 * Run a request over a link: while the link reconnects the request waits, a
 * retryable failure hands the link to recovery, and the request is sent again
 * (re-resolving its URL) once the endpoint answers. Gives up only on abort, on
 * a non-retryable failure, or when the endpoint keeps answering probes while
 * this request keeps failing.
 */
export async function runWithReconnect<T>(
  link: ServiceLink,
  attempt: () => Promise<T>,
  options: ReconnectOptions = {},
): Promise<T> {
  const retryable = options.retryable ?? isNetworkLevelFailure;
  let failuresWhileReachable = 0;
  for (;;) {
    await link.waitOnline(options.signal);
    try {
      const result = await attempt();
      link.markOnline();
      return result;
    } catch (error) {
      if (options.signal?.aborted || !retryable(error)) throw error;
      const outage = await link.recover(options.signal);
      if (!outage && ++failuresWhileReachable >= MAX_FAILURES_WHILE_REACHABLE) throw error;
    }
  }
}
