/**
 * RequestQueue — localStorage-backed persistent write queue for the master
 * API base client (see ./MasterApiClient.ts).
 *
 * Stores QUEUEABLE write requests that failed with a NETWORK-level error so
 * they can be replayed once connectivity returns. Mirrors the persistence
 * semantics of pycore's unified_rpc_client.js (pending requests survive page
 * refreshes via localStorage) for plain HTTP.
 *
 * Invariants:
 *   - per-end namespaced storage key (e.g. 'wf_api_queue') — ends never share
 *     a queue;
 *   - FIFO order (replay happens oldest-first, sequential);
 *   - tokens are NEVER persisted — entries store headers minus the auth header
 *     names; the live token is re-resolved at replay time by the client;
 *   - cap of QUEUE_MAX_ENTRIES entries (oldest dropped first), entries older
 *     than QUEUE_MAX_AGE_MS are pruned on load;
 *   - identical pending entries (endpoint + method + body) are deduped.
 */

/** Hard cap on persisted entries; the OLDEST entry is dropped past this. */
export const QUEUE_MAX_ENTRIES = 100;

/** Entries older than this are pruned when the queue is loaded. */
export const QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** One persisted queueable write. `headers` NEVER contains auth tokens. */
export interface QueuedRequestEntry {
  id: string;
  /** Which end/client namespace queued this (informational; the live base URL
   *  is re-resolved per replay attempt — never persisted). */
  baseUrlKey: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  /** JSON string body, or null. FormData/stream bodies are never queueable. */
  body: string | null;
  createdAt: number;
  attempts: number;
}

const generateEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const isValidEntry = (e: any): e is QueuedRequestEntry =>
  !!e &&
  typeof e === 'object' &&
  typeof e.id === 'string' &&
  typeof e.endpoint === 'string' &&
  typeof e.method === 'string' &&
  typeof e.createdAt === 'number';

export class RequestQueue {
  readonly storageKey: string;
  private entries: QueuedRequestEntry[] = [];

  constructor(storageKey: string) {
    this.storageKey = storageKey;
    this.load();
  }

  /** Number of pending entries. */
  size(): number {
    return this.entries.length;
  }

  /** Read-only snapshot of the pending entries (FIFO order). */
  list(): readonly QueuedRequestEntry[] {
    return this.entries.slice();
  }

  /** FIFO head — the next entry a drain should replay. */
  peek(): QueuedRequestEntry | undefined {
    return this.entries[0];
  }

  /**
   * Persist a failed queueable write. Identical pending entries
   * (endpoint + method + body) are deduped — the existing entry is returned.
   * Past the QUEUE_MAX_ENTRIES cap the OLDEST entry is dropped.
   */
  enqueue(
    input: Omit<QueuedRequestEntry, 'id' | 'createdAt' | 'attempts'>
  ): QueuedRequestEntry {
    const duplicate = this.entries.find(
      (e) =>
        e.endpoint === input.endpoint &&
        e.method === input.method &&
        e.body === input.body
    );
    if (duplicate) return duplicate;

    const entry: QueuedRequestEntry = {
      ...input,
      id: generateEntryId(),
      createdAt: Date.now(),
      attempts: 0,
    };
    this.entries.push(entry);
    while (this.entries.length > QUEUE_MAX_ENTRIES) {
      this.entries.shift();
    }
    this.persist();
    return entry;
  }

  /** Bump the attempt counter of an entry before a replay try. */
  markAttempt(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.attempts += 1;
      this.persist();
    }
  }

  /** Remove an entry (replayed successfully, or dropped after an HTTP answer). */
  remove(id: string): void {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length !== before) this.persist();
  }

  /** Drop everything (e.g. user-initiated reset). */
  clear(): void {
    this.entries = [];
    this.persist();
  }

  /** Load + prune (>24h old) from localStorage. SSR-safe (no-op without it). */
  private load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const kept = (Array.isArray(parsed) ? parsed : [])
        .filter(isValidEntry)
        .filter((e) => now - e.createdAt <= QUEUE_MAX_AGE_MS);
      this.entries = kept;
      if (!Array.isArray(parsed) || kept.length !== parsed.length) {
        this.persist();
      }
    } catch {
      this.entries = [];
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
      // Quota/serialization failure must never break the request path.
    }
  }
}
