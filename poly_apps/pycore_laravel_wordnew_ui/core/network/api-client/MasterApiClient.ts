/**
 * MasterApiClient — the ONE master HTTP base client for the dashboard's three
 * application-owned API libraries and shared service clients,
 * app-specific transport adapters). Each end inherits and opts in via subclass hooks.
 *
 * Canonical designs this mirrors for HTTP:
 *   - pycore/pyutils/rpc/client/unified_rpc_client.js (PYTHON_PYCORE.md §8.1):
 *     NO short timeouts + pending-request persistence in localStorage +
 *     reconnect resume;
 *   - NODE_NCORE_GUIDE.md §11 unified http-client: retry queue for POST writes
 *     while the endpoint is unavailable.
 *
 * Contract:
 *   - NO arbitrary frontend timeouts. The only guard is a single
 *     AbortController ceiling against truly dead sockets — DEFAULT 30 MINUTES,
 *     per-call override via `ceilingMs`, and `ceilingMs: 0` waits forever
 *     (rpc-client parity).
 *   - PERSISTENT WRITE QUEUE: a QUEUEABLE request (caller `queueable: true`,
 *     or the subclass's isQueueableEndpoint() default — typically idempotent
 *     POST writes) that fails with a NETWORK-level error (fetch TypeError,
 *     navigator.onLine === false) or hits the ceiling is persisted to
 *     localStorage (per-end namespaced key) and the caller's promise rejects
 *     with a distinguishable QueuedError. GETs and non-queueable calls are
 *     NEVER queued (they reject exactly as before). Tokens are NEVER
 *     persisted — the live token is re-resolved per replay attempt via
 *     resolveAuthHeaders().
 *   - REPLAY: FIFO, sequential, triggered by window 'online', by the
 *     subclass's endpoint-recovered hook (call drainQueue()), and on
 *     construction (app start). Success removes the entry; a NETWORK failure
 *     stops the drain (retried on the next trigger); an HTTP 4xx/5xx answer
 *     REMOVES the entry and emits 'queue-entry-failed' — the server answered,
 *     it is not a connectivity problem, so replaying forever would be wrong.
 *   - END-AGNOSTIC: subclasses provide resolveBaseUrl(), resolveAuthHeaders(),
 *     isQueueableEndpoint() default, the storage key and a log fn. The base
 *     never imports any end's event bus — observability goes through the tiny
 *     internal emitter (onQueueChange / onQueueEntryFailed).
 */

import { RequestQueue, QueuedRequestEntry } from './RequestQueue';
import { protocolFetch } from '../ProtocolFetch';

/** Default dead-socket ceiling: 30 minutes ("一般30分钟"). 0 = wait forever. */
export const DEFAULT_CEILING_MS = 30 * 60 * 1000;

export type MasterLogLevel = 'info' | 'success' | 'error';
export type MasterLogFn = (level: MasterLogLevel, message: string) => void;

/** RequestInit + the master client's per-call knobs. */
export interface MasterRequestOptions extends RequestInit {
  /**
   * Per-call override of the dead-socket ceiling (ms). 0 means wait forever.
   * When > 0 the ceiling owns the request's AbortSignal.
   */
  ceilingMs?: number;
  /**
   * Mark this request safe to persist + replay offline (idempotent write).
   * Defaults to the subclass's isQueueableEndpoint(endpoint, method).
   */
  queueable?: boolean;
}

/**
 * Rejection value when a queueable write was persisted offline instead of
 * completing. Distinguishable via isQueuedError() so callers can show a
 * "saved offline, will sync" notice instead of a failure.
 */
export class QueuedError extends Error {
  readonly queued = true as const;
  /** Id of the persisted queue entry. */
  readonly entryId: string;

  constructor(message: string, entryId: string) {
    super(message);
    this.name = 'QueuedError';
    this.entryId = entryId;
  }
}

/** Type guard for QueuedError (works across module instances/realms). */
export function isQueuedError(error: unknown): error is QueuedError {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as any).name === 'QueuedError' &&
    (error as any).queued === true
  );
}

/**
 * NETWORK-level failure (vs. an HTTP answer): the device is offline, fetch
 * rejected with a TypeError (DNS/connection/CORS), or the ceiling aborted a
 * dead socket. Only these make a queueable write eligible for persistence.
 */
export function isNetworkLevelFailure(error: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError || error?.name === 'TypeError') return true;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
  return false;
}

export interface MasterQueueState {
  size: number;
  draining: boolean;
}

export interface QueueEntryFailedInfo {
  entry: QueuedRequestEntry;
  /** The HTTP status the server answered with at replay time. */
  status: number;
}

type QueueChangeCb = (state: MasterQueueState) => void;
type QueueEntryFailedCb = (info: QueueEntryFailedInfo) => void;

export interface MasterApiClientConfig {
  /**
   * Per-end namespaced localStorage key for the persistent write queue
   * The queue is disabled when omitted/null; the
   * client is then a pure pass-through transport (laravel/pycore default).
   */
  queueStorageKey?: string | null;
  /** Override of the default 30-minute ceiling for every request. */
  defaultCeilingMs?: number;
  /**
   * Log sink — the dashboard logStore appendLog pattern fits here
   * (e.g. (level, msg) => appendLog(level, 'api', msg)). Silent by default.
   */
  log?: MasterLogFn;
}

export abstract class MasterApiClient {
  protected readonly defaultCeilingMs: number;
  protected readonly log: MasterLogFn;
  private readonly queue: RequestQueue | null;
  private draining = false;
  private queueChangeCbs = new Set<QueueChangeCb>();
  private entryFailedCbs = new Set<QueueEntryFailedCb>();

  constructor(config: MasterApiClientConfig = {}) {
    this.defaultCeilingMs = config.defaultCeilingMs ?? DEFAULT_CEILING_MS;
    this.log = config.log ?? (() => {});
    this.queue = config.queueStorageKey
      ? new RequestQueue(config.queueStorageKey)
      : null;

    if (this.queue && typeof window !== 'undefined') {
      // Replay trigger 1: connectivity returned.
      window.addEventListener('online', () => {
        void this.drainQueue();
      });
      // Replay trigger 2: app start (deferred a tick so the subclass finishes
      // constructing before its hooks are invoked). No-op on an empty queue.
      setTimeout(() => {
        void this.drainQueue();
      }, 0);
    }
  }

  // ---- Subclass hooks (END-AGNOSTIC contract) ----

  /** Live base URL (re-resolved per request AND per replay attempt). */
  protected abstract resolveBaseUrl(): string | Promise<string>;

  /**
   * Live auth/context headers, merged over the per-call headers at send time
   * (request AND replay). Tokens therefore never need to be persisted.
   */
  protected resolveAuthHeaders():
    | Record<string, string>
    | Promise<Record<string, string>> {
    return {};
  }

  /** Default queueability when the caller does not pass `queueable`. */
  protected isQueueableEndpoint(_endpoint: string, _method: string): boolean {
    return false;
  }

  /** Header names stripped from persisted queue entries (never store tokens). */
  protected authHeaderNames(): string[] {
    return ['Authorization'];
  }

  /** Human message carried by QueuedError (subclasses may localize). */
  protected queuedMessage(): string {
    return 'Saved offline — will sync when the connection returns.';
  }

  // ---- Public API ----

  /** Whether this client persists queueable writes. */
  get queueEnabled(): boolean {
    return this.queue !== null;
  }

  getQueueState(): MasterQueueState {
    return { size: this.queue?.size() ?? 0, draining: this.draining };
  }

  /** Read-only snapshot of the pending queue entries (FIFO order). */
  getQueueEntries(): readonly QueuedRequestEntry[] {
    return this.queue?.list() ?? [];
  }

  /** Subscribe to queue size/draining changes. Returns an unsubscribe fn. */
  onQueueChange(cb: QueueChangeCb): () => void {
    this.queueChangeCbs.add(cb);
    return () => this.queueChangeCbs.delete(cb);
  }

  /**
   * Subscribe to 'queue-entry-failed': a replayed entry got an HTTP 4xx/5xx
   * answer and was dropped (server answered — not a connectivity problem).
   */
  onQueueEntryFailed(cb: QueueEntryFailedCb): () => void {
    this.entryFailedCbs.add(cb);
    return () => this.entryFailedCbs.delete(cb);
  }

  /**
   * Transport-level request: resolve base URL + live auth headers, fetch with
   * the dead-socket ceiling, return the RAW Response (status/body handling is
   * the subclass's job). On a NETWORK-level failure of a queueable write the
   * request is persisted and the promise rejects with QueuedError; everything
   * else rejects exactly as fetch does.
   */
  async request(
    endpoint: string,
    options: MasterRequestOptions = {}
  ): Promise<Response> {
    const { ceilingMs, queueable, ...init } = options;
    const method = (init.method || 'GET').toUpperCase();
    const ceiling = ceilingMs ?? this.defaultCeilingMs;

    try {
      return await this.send(endpoint, init, ceiling);
    } catch (error) {
      if (this.shouldQueueFailure(endpoint, method, init, queueable, error)) {
        const entry = this.enqueueFailedWrite(endpoint, method, init);
        this.log(
          'info',
          `[master-api] queued offline write ${method} ${endpoint} (queue size ${this.queue!.size()})`
        );
        this.emitQueueChange();
        throw new QueuedError(this.queuedMessage(), entry.id);
      }
      throw error;
    }
  }

  /**
   * Drain the persistent queue: FIFO, sequential, base URL + token re-resolved
   * per attempt. Single-flight — concurrent triggers share one pass. Wire this
   * to the end's endpoint-recovered/endpoint-changed event in the subclass.
   */
  async drainQueue(): Promise<void> {
    if (!this.queue || this.draining) return;
    if (this.queue.size() === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    this.draining = true;
    this.emitQueueChange();
    try {
      for (;;) {
        const entry = this.queue.peek();
        if (!entry) break;

        this.queue.markAttempt(entry.id);
        let response: Response;
        try {
          response = await this.send(
            entry.endpoint,
            {
              method: entry.method,
              headers: entry.headers,
              ...(entry.body != null ? { body: entry.body } : {}),
            },
            this.defaultCeilingMs
          );
        } catch (error) {
          // Still a connectivity problem — stop the drain, keep the entry,
          // retry on the next trigger ('online' / endpoint-recovered).
          this.log(
            'info',
            `[master-api] queue drain paused (network): ${entry.method} ${entry.endpoint}`
          );
          break;
        }

        this.queue.remove(entry.id);
        if (response.ok) {
          this.log(
            'success',
            `[master-api] queued write replayed: ${entry.method} ${entry.endpoint} → ${response.status}`
          );
        } else {
          // The server ANSWERED (4xx/5xx) — drop the entry and surface it;
          // replaying forever would be wrong.
          this.log(
            'error',
            `[master-api] queued write dropped: ${entry.method} ${entry.endpoint} → HTTP ${response.status}`
          );
          this.emitEntryFailed({ entry, status: response.status });
        }
        this.emitQueueChange();
      }
    } finally {
      this.draining = false;
      this.emitQueueChange();
    }
  }

  // ---- Internals ----

  /**
   * One network delivery. Default: plain fetch to the resolved URL.
   * Subclasses routing through a framed transport (e.g. the pycore relay
   * scheme) override this hook - the queue/ceiling/replay semantics above
   * then apply unchanged on top of the overridden leg.
   */
  protected deliver(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    return protocolFetch(url, { ...init, ...(signal ? { signal } : {}) });
  }

  /** One fetch with live base URL + auth headers and the abort ceiling. */
  private async send(
    endpoint: string,
    init: RequestInit,
    ceiling: number
  ): Promise<Response> {
    const baseUrl = await this.resolveBaseUrl();
    const auth = await this.resolveAuthHeaders();
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      ...auth,
    };

    const controller = ceiling > 0 ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), ceiling)
      : null;
    try {
      return await this.deliver(`${baseUrl}${endpoint}`, { ...init, headers }, controller?.signal);
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  private shouldQueueFailure(
    endpoint: string,
    method: string,
    init: RequestInit,
    queueableOpt: boolean | undefined,
    error: unknown
  ): boolean {
    if (!this.queue) return false;
    // NEVER queue GETs, regardless of what the caller claims.
    if (method === 'GET') return false;
    const queueable = queueableOpt ?? this.isQueueableEndpoint(endpoint, method);
    if (!queueable) return false;
    // Only plain-string (JSON) bodies can be persisted — FormData/streams cannot.
    if (init.body != null && typeof init.body !== 'string') return false;
    return isNetworkLevelFailure(error);
  }

  private enqueueFailedWrite(
    endpoint: string,
    method: string,
    init: RequestInit
  ): QueuedRequestEntry {
    // Persist headers MINUS the auth header names — the live token is
    // re-resolved at replay time via resolveAuthHeaders().
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    };
    const stripped = this.authHeaderNames().map((n) => n.toLowerCase());
    for (const key of Object.keys(headers)) {
      if (stripped.includes(key.toLowerCase())) delete headers[key];
    }
    return this.queue!.enqueue({
      baseUrlKey: this.queue!.storageKey,
      endpoint,
      method,
      headers,
      body: typeof init.body === 'string' ? init.body : null,
    });
  }

  private emitQueueChange(): void {
    const state = this.getQueueState();
    this.queueChangeCbs.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error('[MasterApiClient] onQueueChange handler error:', e);
      }
    });
  }

  private emitEntryFailed(info: QueueEntryFailedInfo): void {
    this.entryFailedCbs.forEach((cb) => {
      try {
        cb(info);
      } catch (e) {
        console.error('[MasterApiClient] onQueueEntryFailed handler error:', e);
      }
    });
  }
}
