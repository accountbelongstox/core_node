import { stableHash } from '../utils/stableHash';
import { CapDatabase, type CapCollection } from './CapDatabase';
import { CapLargeCache } from './CapFilesystem';

export type CapResourceRefreshMode = 'stale' | 'always' | 'never';

export interface CapResourceRecord<T = unknown> extends Record<string, unknown> {
  id: string;
  namespace: string;
  key: string;
  scope: string;
  payload: T;
  fetchedAt: number;
  expiresAt: number;
}

export interface CapResourcePackageOptions {
  dbName?: string;
  collection?: string;
  namespace: string;
  defaultTtlMs?: number;
  assets?: CapResourceAssetCache;
  onValue?: (value: unknown) => void | Promise<void>;
}

export interface CapResourceQuery<T> {
  key: string;
  scope?: string;
  fetchRemote: () => Promise<T>;
  ttlMs?: number;
  refresh?: CapResourceRefreshMode;
  /** Return false when a cached/static response is incomplete and must be re-fetched. */
  isUsable?: (payload: T) => boolean;
}

export interface CapResourcePutOptions {
  scope?: string;
  ttlMs?: number;
}

export interface CapResourceStats {
  records: number;
  bytes: number;
}

export interface CapResourceAssetCacheOptions {
  dir: string;
  budget: () => number | Promise<number>;
  extractUrls?: (payload: unknown) => Iterable<string>;
  keyFor?: (url: string) => string;
  mimeFor?: (url: string) => string | undefined;
  concurrency?: number;
  budgetRefreshMs?: number;
}

export interface CapResourceAssetStats {
  files: number;
  bytes: number;
  budgetBytes: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_BUDGET_REFRESH_MS = 60 * 60 * 1000;
const DEFAULT_ASSET_CONCURRENCY = 4;

function defaultAssetKey(url: string): string {
  const match = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/.exec(url);
  const extension = match ? `.${match[1].toLowerCase()}` : '.bin';
  return `r${stableHash(url)}${extension}`;
}

function estimateJsonBytes(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    return typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(serialized).byteLength
      : serialized.length * 2;
  } catch {
    return 0;
  }
}

/** Durable, quota-aware asset cache backed by native files or web OPFS/IndexedDB. */
export class CapResourceAssetCache {
  private readonly options: CapResourceAssetCacheOptions;
  private readonly resolved = new Map<string, string>();
  private readonly inFlight = new Map<string, Promise<string | null>>();
  private readonly queued = new Set<string>();
  private readonly preloadQueue: string[] = [];
  private preloadWorkers = 0;
  private cachePromise: Promise<CapLargeCache> | null = null;
  private configuredBudgetBytes = 0;
  private budgetResolvedAt = 0;
  private generation = 0;
  /** Route-scoped gate: when true, no NEW fetches start (queue state is kept). */
  private paused = false;
  private readonly resumeWaiters: Array<() => void> = [];

  constructor(options: CapResourceAssetCacheOptions) {
    this.options = options;
  }

  /**
   * Pause/resume background network activity (route-scoped lifecycle). Pausing
   * keeps all state — resolved urls, the in-flight map, and any preload queue
   * position; workers simply wait until resumed. In-flight fetches finish
   * naturally (fetch has no abort here), so at most `concurrency` requests
   * complete after pausing.
   */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused) {
      const waiters = this.resumeWaiters.splice(0);
      waiters.forEach((wake) => wake());
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  private waitResumed(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => {
      this.resumeWaiters.push(resolve);
    });
  }

  private async cache(): Promise<CapLargeCache> {
    const refreshMs = this.options.budgetRefreshMs ?? DEFAULT_BUDGET_REFRESH_MS;
    if (!this.cachePromise || Date.now() - this.budgetResolvedAt >= refreshMs) {
      this.budgetResolvedAt = Date.now();
      this.cachePromise = Promise.resolve(this.options.budget()).then((budgetBytes) => {
        this.configuredBudgetBytes = Math.max(0, Math.floor(budgetBytes));
        return new CapLargeCache({ dir: this.options.dir, maxBytes: this.configuredBudgetBytes });
      }).catch((error) => {
        this.cachePromise = null;
        throw error;
      });
    }
    return this.cachePromise;
  }

  ensure(url: string): Promise<string | null> {
    const existing = this.resolved.get(url);
    const pending = this.inFlight.get(url);
    if (!url || !/^https?:\/\//i.test(url)) return Promise.resolve(null);
    if (existing) return Promise.resolve(existing);
    if (pending) return pending;

    const generation = this.generation;
    const operation = (async (): Promise<string | null> => {
      try {
        // Route gate: no NEW fetch while the owning route is inactive; the
        // promise settles when resumed (state preserved, never rejected).
        await this.waitResumed();
        const cache = await this.cache();
        const key = (this.options.keyFor ?? defaultAssetKey)(url);
        const mime = this.options.mimeFor?.(url);
        const localUrl = await cache.getOrFetchUrl(key, () => url, mime);
        if (generation !== this.generation) {
          await cache.blobs.delete(key);
          if (localUrl?.startsWith('blob:') && typeof URL !== 'undefined') URL.revokeObjectURL(localUrl);
          return null;
        }
        if (localUrl) this.resolved.set(url, localUrl);
        return localUrl;
      } catch {
        return null;
      } finally {
        this.inFlight.delete(url);
      }
    })();
    this.inFlight.set(url, operation);
    return operation;
  }

  resolveSync(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    const localUrl = this.resolved.get(url);
    if (localUrl) return localUrl;
    void this.ensure(url);
    return url;
  }

  preload(urls: Iterable<string>): void {
    for (const url of new Set(urls)) {
      if (!url || this.resolved.has(url) || this.inFlight.has(url) || this.queued.has(url)) continue;
      this.queued.add(url);
      this.preloadQueue.push(url);
    }
    this.startPreloadWorkers();
  }

  private startPreloadWorkers(): void {
    const concurrency = Math.max(1, this.options.concurrency ?? DEFAULT_ASSET_CONCURRENCY);
    while (this.preloadWorkers < concurrency && this.preloadQueue.length > 0) {
      this.preloadWorkers += 1;
      void this.runPreloadWorker();
    }
  }

  private async runPreloadWorker(): Promise<void> {
    try {
      while (this.preloadQueue.length > 0) {
        await this.waitResumed();
        const url = this.preloadQueue.shift();
        if (!url) continue;
        this.queued.delete(url);
        await this.ensure(url);
      }
    } finally {
      this.preloadWorkers -= 1;
      this.startPreloadWorkers();
    }
  }

  preloadPayload(payload: unknown): void {
    const urls = this.options.extractUrls?.(payload);
    if (urls) this.preload(urls);
  }

  async stats(): Promise<CapResourceAssetStats> {
    try {
      const cache = await this.cache();
      const keys = await cache.blobs.keys();
      return {
        files: keys.length,
        bytes: await cache.totalSize(),
        budgetBytes: this.configuredBudgetBytes,
      };
    } catch {
      return { files: 0, bytes: 0, budgetBytes: this.configuredBudgetBytes };
    }
  }

  async clear(): Promise<void> {
    this.generation += 1;
    for (const localUrl of this.resolved.values()) {
      if (localUrl.startsWith('blob:') && typeof URL !== 'undefined') URL.revokeObjectURL(localUrl);
    }
    this.resolved.clear();
    this.preloadQueue.length = 0;
    this.queued.clear();
    try {
      const cache = await this.cache();
      await cache.clear();
    } catch {
      /* Asset caching is best-effort. */
    }
  }
}

/**
 * Cross-platform read-through resource package. Reads are local-first, stale
 * entries refresh in the background, misses deduplicate one remote request,
 * and every successful remote value is mirrored byte-for-byte as JSON payload.
 */
export class CapResourcePackage {
  private readonly options: Required<Pick<CapResourcePackageOptions, 'namespace'>> & CapResourcePackageOptions;
  private readonly database = new CapDatabase();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private ready: Promise<void> | null = null;

  constructor(options: CapResourcePackageOptions) {
    this.options = options;
  }

  private documentId(key: string, scope: string): string {
    return stableHash(JSON.stringify([this.options.namespace, scope, key]));
  }

  private operationId(key: string, scope: string): string {
    return stableHash(JSON.stringify([scope, key]));
  }

  private async collection(): Promise<CapCollection<CapResourceRecord>> {
    if (!this.ready) {
      this.ready = this.database.open(this.options.dbName ?? 'cap_resources').catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    await this.ready;
    return this.database.collection<CapResourceRecord>(this.options.collection ?? 'resources');
  }

  private consume(value: unknown): void {
    this.options.assets?.preloadPayload(value);
    if (this.options.onValue) void Promise.resolve(this.options.onValue(value)).catch(() => undefined);
  }

  async get<T>(key: string, scope = 'public'): Promise<CapResourceRecord<T> | null> {
    try {
      const collection = await this.collection();
      const record = await collection.get(this.documentId(key, scope)) as CapResourceRecord<T> | null;
      if (!record || record.namespace !== this.options.namespace || record.key !== key || record.scope !== scope) {
        return null;
      }
      return record;
    } catch {
      return null;
    }
  }

  async put<T>(key: string, payload: T, options: CapResourcePutOptions = {}): Promise<boolean> {
    const scope = options.scope ?? 'public';
    const fetchedAt = Date.now();
    const ttlMs = Math.max(0, options.ttlMs ?? this.options.defaultTtlMs ?? DEFAULT_TTL_MS);
    const record: CapResourceRecord<T> = {
      id: this.documentId(key, scope),
      namespace: this.options.namespace,
      key,
      scope,
      payload,
      fetchedAt,
      expiresAt: fetchedAt + ttlMs,
    };
    this.consume(payload);
    try {
      const collection = await this.collection();
      await collection.put(record.id, record as CapResourceRecord);
      return true;
    } catch {
      return false;
    }
  }

  private refresh<T>(query: CapResourceQuery<T>, scope: string): Promise<T> {
    const operationId = this.operationId(query.key, scope);
    const pending = this.inFlight.get(operationId) as Promise<T> | undefined;
    if (pending) return pending;
    const operation = (async (): Promise<T> => {
      try {
        const value = await query.fetchRemote();
        if (!query.isUsable || query.isUsable(value)) {
          await this.put(query.key, value, { scope, ttlMs: query.ttlMs });
        }
        return value;
      } finally {
        this.inFlight.delete(operationId);
      }
    })();
    this.inFlight.set(operationId, operation);
    return operation;
  }

  async query<T>(query: CapResourceQuery<T>): Promise<T> {
    const scope = query.scope ?? 'public';
    const local = await this.get<T>(query.key, scope);
    const refreshMode = query.refresh ?? 'stale';
    if (!local) return this.refresh(query, scope);

    // Never treat an incomplete static-resource response as a valid cache hit.
    // The caller receives a fresh remote response, while only a complete value
    // is persisted by refresh().
    if (query.isUsable && !query.isUsable(local.payload)) {
      return this.refresh(query, scope);
    }

    this.consume(local.payload);
    const stale = local.expiresAt <= Date.now();
    if (refreshMode === 'always' || (refreshMode === 'stale' && stale)) {
      void this.refresh(query, scope).catch(() => undefined);
    }
    return local.payload;
  }

  async remove(key: string, scope = 'public'): Promise<boolean> {
    try {
      const collection = await this.collection();
      await collection.delete(this.documentId(key, scope));
      return true;
    } catch {
      return false;
    }
  }

  async stats(): Promise<CapResourceStats> {
    try {
      const collection = await this.collection();
      const records = await collection.all();
      return { records: records.length, bytes: records.reduce((total, record) => total + estimateJsonBytes(record), 0) };
    } catch {
      return { records: 0, bytes: 0 };
    }
  }

  async clear(): Promise<boolean> {
    try {
      const collection = await this.collection();
      await collection.clear();
      return true;
    } catch {
      return false;
    }
  }
}
