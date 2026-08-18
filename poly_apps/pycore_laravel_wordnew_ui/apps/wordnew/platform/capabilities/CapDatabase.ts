/* =============================================================================
 * CapDatabase — public, cross-platform structured DATABASE capability library
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library for any app/page in pycore_laravel_wordnew_ui.
 *   *Built primarily for the wordnew mobile APP* (native Capacitor build of
 *   /wordnew): a large local word/sentence/review store that must work offline,
 *   scale to hundreds of thousands of rows, and survive app restarts. Falls back
 *   to IndexedDB on the web.
 *
 * THE MODEL
 *   A DOCUMENT / COLLECTION database (NoSQL-style) that maps cleanly onto BOTH
 *   backends, so the SAME code runs everywhere:
 *     - put/get/delete/all/query/count/bulk over typed collections of JSON docs.
 *     - simple typed query filters (where / orderBy / limit / offset).
 *   Plus an OPTIONAL raw-SQL escape hatch that is only available on the SQL
 *   backend (native) — guarded by `db.sqlAvailable` and clearly marked.
 *
 *   ┌───────────── FEATURE AVAILABILITY MATRIX ─────────────┐
 *   │ feature              │ native (SQLite) │ web (IndexedDB) │
 *   │ collections/docs     │       ✅         │       ✅         │
 *   │ query filters        │       ✅         │       ✅         │
 *   │ key-value store      │       ✅         │       ✅         │
 *   │ transactions (docs)  │   ✅ (atomic)    │  ✅ (per-store)  │
 *   │ raw SQL (execute/run)│       ✅         │   ❌ (throws)    │
 *   │ encryption           │  ❌ (not set)    │       ❌         │
 *   │ practical capacity   │  ~disk (GBs)     │ browser quota*  │
 *   └───────────────────────────────────────────────────────┘
 *   *Web/IndexedDB capacity is governed by the browser storage quota; request a
 *    persistent grant via CapFilesystem.requestPersistentStorage() to reduce
 *    eviction risk. For 10-100GB BLOB caches use CapFilesystem (OPFS), NOT this.
 *
 * NATIVE vs WEB (always falls back to web)
 *   - Native: @capacitor-community/sqlite (real SQLite; SQL backend).
 *   - Web: IndexedDB (the import resolves to a stub that reports SQL
 *     unavailable; the document API runs entirely on IndexedDB).
 *
 * QUICK START
 *   import { capDb } from '@/apps/wordnew/platform/capabilities/CapDatabase';
 *   await capDb.open('wordnew');
 *   const words = capDb.collection<Word>('words');
 *   await words.put('w-1', { text: 'serendipity', mastery: 0 });
 *   const due = await words.query({ where: [['mastery', '<', 50]], limit: 20 });
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { stableIdentifier } from '../utils/stableHash';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapDoc = Record<string, unknown>;
export type CapDbBackendKind = 'sqlite' | 'indexeddb';

export type CapWhereOp = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'contains' | 'startsWith';
/** A single filter clause: [field, operator, value]. Field supports dot paths. */
export type CapWhere = [string, CapWhereOp, unknown];

export interface CapQuery {
  /** AND-combined filter clauses. */
  where?: CapWhere[];
  /** Field to sort by (dot path). */
  orderBy?: string;
  /** Sort direction. Default 'asc'. */
  order?: 'asc' | 'desc';
  /** Max rows. */
  limit?: number;
  /** Rows to skip. */
  offset?: number;
}

export interface CapStoredDoc<T = CapDoc> {
  id: string;
  doc: T;
  updatedAt: number;
}

export interface CapRawResult {
  /** Rows for a SELECT. */
  rows: CapDoc[];
  /** Affected row count for a mutation. */
  changes: number;
  /** Last inserted row id (mutations). */
  lastId?: number;
}

// ---------------------------------------------------------------------------
// Shared query evaluation (pure)
// ---------------------------------------------------------------------------

function getPath(obj: CapDoc, path: string): unknown {
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as CapDoc)[key];
    return undefined;
  }, obj);
}

function matchesWhere(doc: CapDoc, [field, op, value]: CapWhere): boolean {
  const v = getPath(doc, field);
  switch (op) {
    case '=':
      return v === value;
    case '!=':
      return v !== value;
    case '<':
      return (v as number) < (value as number);
    case '<=':
      return (v as number) <= (value as number);
    case '>':
      return (v as number) > (value as number);
    case '>=':
      return (v as number) >= (value as number);
    case 'in':
      return Array.isArray(value) && value.includes(v as never);
    case 'contains':
      return Array.isArray(v) ? v.includes(value as never) : String(v ?? '').includes(String(value));
    case 'startsWith':
      return String(v ?? '').startsWith(String(value));
    default:
      return false;
  }
}

/** Apply a CapQuery to an in-memory array of docs (pure, exported for reuse). */
export function applyQuery<T extends CapDoc>(docs: T[], q: CapQuery = {}): T[] {
  let out = docs;
  if (q.where && q.where.length) out = out.filter((d) => q.where!.every((w) => matchesWhere(d, w)));
  if (q.orderBy) {
    const field = q.orderBy;
    const dir = q.order === 'desc' ? -1 : 1;
    out = out.slice().sort((a, b) => {
      const av = getPath(a, field) as never;
      const bv = getPath(b, field) as never;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }
  const start = q.offset ?? 0;
  const end = q.limit != null ? start + q.limit : undefined;
  if (start || end != null) out = out.slice(start, end);
  return out;
}

function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

interface DbBackend {
  readonly kind: CapDbBackendKind;
  readonly sqlAvailable: boolean;
  open(dbName: string): Promise<void>;
  close(): Promise<void>;
  deleteDatabase(dbName: string): Promise<void>;
  ensureCollection(name: string): Promise<void>;
  put(coll: string, id: string, doc: CapDoc): Promise<void>;
  bulkPut(coll: string, items: Array<{ id: string; doc: CapDoc }>): Promise<void>;
  get(coll: string, id: string): Promise<CapDoc | null>;
  delete(coll: string, id: string): Promise<void>;
  all(coll: string): Promise<CapStoredDoc[]>;
  count(coll: string): Promise<number>;
  clear(coll: string): Promise<void>;
  // raw SQL (only when sqlAvailable)
  exec?(sql: string): Promise<CapRawResult>;
  query?(sql: string, params?: unknown[]): Promise<CapDoc[]>;
  run?(sql: string, params?: unknown[]): Promise<CapRawResult>;
  transaction?<T>(fn: () => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// IndexedDB backend (web)
// ---------------------------------------------------------------------------

const STORE_PREFIX = 'c_';
const COLLECTION_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateCollectionName(name: string): void {
  if (!COLLECTION_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid collection name: ${name}`);
  }
}

class IndexedDbBackend implements DbBackend {
  readonly kind = 'indexeddb' as const;
  readonly sqlAvailable = false;
  private db: IDBDatabase | null = null;
  private dbName = '';
  private reopenPromise: Promise<void> | null = null;
  private schemaChain: Promise<void> = Promise.resolve();

  async open(dbName: string): Promise<void> {
    this.dbName = dbName;
    this.db = await this.rawOpen();
  }

  private rawOpen(version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const req = version != null ? indexedDB.open(this.dbName, version) : indexedDB.open(this.dbName);
      req.onupgradeneeded = () => upgrade?.(req.result);
      req.onsuccess = () => {
        const db = req.result;
        if (settled) {
          db.close();
          return;
        }
        settled = true;
        db.onversionchange = () => {
          db.close();
          if (this.db === db) this.db = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        if (settled) return;
        settled = true;
        reject(req.error);
      };
      req.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new Error('IndexedDB open blocked (close other tabs).'));
      };
    });
  }

  private async ensureDatabase(): Promise<void> {
    if (this.db) return;
    if (!this.reopenPromise) {
      this.reopenPromise = this.rawOpen().then((db) => {
        this.db = db;
      }).finally(() => {
        this.reopenPromise = null;
      });
    }
    await this.reopenPromise;
  }

  async ensureCollection(name: string): Promise<void> {
    validateCollectionName(name);
    await this.ensureDatabase();
    const store = STORE_PREFIX + name;
    if (this.db.objectStoreNames.contains(store)) return;
    const operation = this.schemaChain.then(async () => {
      if (!this.db) throw new Error('Database not open.');
      if (this.db.objectStoreNames.contains(store)) return;
      const nextVersion = this.db.version + 1;
      this.db.close();
      this.db = await this.rawOpen(nextVersion, (db) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      });
    });
    this.schemaChain = operation.catch(() => undefined);
    await operation;
  }

  private tx(coll: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Database not open.');
    return this.db.transaction(STORE_PREFIX + coll, mode).objectStore(STORE_PREFIX + coll);
  }

  private wrap<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(coll: string, id: string, doc: CapDoc): Promise<void> {
    await this.ensureCollection(coll);
    await this.wrap(this.tx(coll, 'readwrite').put({ id, doc, updatedAt: Date.now() }));
  }

  async bulkPut(coll: string, items: Array<{ id: string; doc: CapDoc }>): Promise<void> {
    await this.ensureCollection(coll);
    const store = this.tx(coll, 'readwrite');
    const now = Date.now();
    await Promise.all(items.map((it) => this.wrap(store.put({ id: it.id, doc: it.doc, updatedAt: now }))));
  }

  async get(coll: string, id: string): Promise<CapDoc | null> {
    await this.ensureCollection(coll);
    const rec = (await this.wrap(this.tx(coll, 'readonly').get(id))) as CapStoredDoc | undefined;
    return rec ? rec.doc : null;
  }

  async delete(coll: string, id: string): Promise<void> {
    await this.ensureCollection(coll);
    await this.wrap(this.tx(coll, 'readwrite').delete(id));
  }

  async all(coll: string): Promise<CapStoredDoc[]> {
    await this.ensureCollection(coll);
    return (await this.wrap(this.tx(coll, 'readonly').getAll())) as CapStoredDoc[];
  }

  async count(coll: string): Promise<number> {
    await this.ensureCollection(coll);
    return (await this.wrap(this.tx(coll, 'readonly').count())) as number;
  }

  async clear(coll: string): Promise<void> {
    await this.ensureCollection(coll);
    await this.wrap(this.tx(coll, 'readwrite').clear());
  }

  async close(): Promise<void> {
    await this.reopenPromise?.catch(() => undefined);
    this.db?.close();
    this.db = null;
  }

  async deleteDatabase(dbName: string): Promise<void> {
    await this.close();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  }
}

// ---------------------------------------------------------------------------
// SQLite backend (native)
// ---------------------------------------------------------------------------

class SqliteBackend implements DbBackend {
  readonly kind = 'sqlite' as const;
  readonly sqlAvailable = true;
  private conn: any = null; // SQLiteConnection
  private db: any = null; // SQLiteDBConnection
  private dbName = '';
  private known = new Set<string>();

  async open(dbName: string): Promise<void> {
    this.dbName = dbName;
    this.conn = new SQLiteConnection(CapacitorSQLite);
    const consistent = (await this.conn.checkConnectionsConsistency().catch(() => ({ result: false }))).result;
    const isConn = (await this.conn.isConnection(dbName, false).catch(() => ({ result: false }))).result;
    this.db =
      consistent && isConn
        ? await this.conn.retrieveConnection(dbName, false)
        : await this.conn.createConnection(dbName, false, 'no-encryption', 1, false);
    await this.db.open();
  }

  private table(coll: string): string {
    validateCollectionName(coll);
    return STORE_PREFIX + stableIdentifier(coll, 'collection');
  }

  async ensureCollection(name: string): Promise<void> {
    validateCollectionName(name);
    if (this.known.has(name)) return;
    const t = this.table(name);
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, doc TEXT NOT NULL, updated_at INTEGER);`,
    );
    this.known.add(name);
  }

  async put(coll: string, id: string, doc: CapDoc): Promise<void> {
    await this.ensureCollection(coll);
    await this.db.run(`INSERT OR REPLACE INTO ${this.table(coll)} (id, doc, updated_at) VALUES (?,?,?);`, [
      id,
      JSON.stringify(doc),
      Date.now(),
    ]);
  }

  async bulkPut(coll: string, items: Array<{ id: string; doc: CapDoc }>): Promise<void> {
    if (items.length === 0) return;
    await this.ensureCollection(coll);
    const now = Date.now();
    const set = items.map((it) => ({
      statement: `INSERT OR REPLACE INTO ${this.table(coll)} (id, doc, updated_at) VALUES (?,?,?);`,
      values: [it.id, JSON.stringify(it.doc), now],
    }));
    await this.db.executeSet(set);
  }

  async get(coll: string, id: string): Promise<CapDoc | null> {
    await this.ensureCollection(coll);
    const res = await this.db.query(`SELECT doc FROM ${this.table(coll)} WHERE id = ?;`, [id]);
    const row = res?.values?.[0];
    return row ? (JSON.parse(row.doc) as CapDoc) : null;
  }

  async delete(coll: string, id: string): Promise<void> {
    await this.ensureCollection(coll);
    await this.db.run(`DELETE FROM ${this.table(coll)} WHERE id = ?;`, [id]);
  }

  async all(coll: string): Promise<CapStoredDoc[]> {
    await this.ensureCollection(coll);
    const res = await this.db.query(`SELECT id, doc, updated_at FROM ${this.table(coll)};`);
    return (res?.values ?? []).map((r: any) => ({ id: r.id, doc: JSON.parse(r.doc), updatedAt: r.updated_at }));
  }

  async count(coll: string): Promise<number> {
    await this.ensureCollection(coll);
    const res = await this.db.query(`SELECT COUNT(*) as n FROM ${this.table(coll)};`);
    return res?.values?.[0]?.n ?? 0;
  }

  async clear(coll: string): Promise<void> {
    await this.ensureCollection(coll);
    await this.db.run(`DELETE FROM ${this.table(coll)};`);
  }

  async exec(sql: string): Promise<CapRawResult> {
    const res = await this.db.execute(sql);
    return { rows: [], changes: res?.changes?.changes ?? 0, lastId: res?.changes?.lastId };
  }

  async query(sql: string, params: unknown[] = []): Promise<CapDoc[]> {
    const res = await this.db.query(sql, params);
    return res?.values ?? [];
  }

  async run(sql: string, params: unknown[] = []): Promise<CapRawResult> {
    const res = await this.db.run(sql, params);
    return { rows: res?.values ?? [], changes: res?.changes?.changes ?? 0, lastId: res?.changes?.lastId };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.db.beginTransaction();
    try {
      const r = await fn();
      await this.db.commitTransaction();
      return r;
    } catch (e) {
      try {
        await this.db.rollbackTransaction();
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  async close(): Promise<void> {
    try {
      await this.db?.close();
      await this.conn?.closeConnection(this.dbName, false);
    } catch {
      /* ignore */
    }
    this.db = null;
  }

  async deleteDatabase(dbName: string): Promise<void> {
    try {
      await this.db?.delete();
    } catch {
      /* ignore */
    }
    await this.close();
  }
}

// ---------------------------------------------------------------------------
// Typed collection handle
// ---------------------------------------------------------------------------

export class CapCollection<T extends CapDoc = CapDoc> {
  constructor(private readonly backend: DbBackend, public readonly name: string) {}

  /** Insert or replace a document by id. */
  put(id: string, doc: T): Promise<void> {
    return this.backend.put(this.name, id, doc);
  }

  /** Insert/replace many documents efficiently. */
  bulkPut(items: Array<{ id: string; doc: T }>): Promise<void> {
    return this.backend.bulkPut(this.name, items);
  }

  /** Fetch a document by id, or null. */
  get(id: string): Promise<T | null> {
    return this.backend.get(this.name, id) as Promise<T | null>;
  }

  /** Delete a document by id. */
  delete(id: string): Promise<void> {
    return this.backend.delete(this.name, id);
  }

  /** Every document in the collection. */
  async all(): Promise<T[]> {
    return (await this.backend.all(this.name)).map((r) => r.doc as T);
  }

  /** Every document with its id + updatedAt envelope. */
  allStored(): Promise<CapStoredDoc<T>[]> {
    return this.backend.all(this.name) as Promise<CapStoredDoc<T>[]>;
  }

  /** Query with simple filters / ordering / paging. */
  async query(q: CapQuery = {}): Promise<T[]> {
    const docs = (await this.backend.all(this.name)).map((r) => r.doc as T);
    return applyQuery(docs, q);
  }

  /** Count documents (optionally matching a where filter). */
  async count(where?: CapWhere[]): Promise<number> {
    if (!where || !where.length) return this.backend.count(this.name);
    return (await this.query({ where })).length;
  }

  /** Remove all documents in the collection. */
  clear(): Promise<void> {
    return this.backend.clear(this.name);
  }

  /** Functional update of a single document (get -> mutate -> put). */
  async update(id: string, mutator: (current: T | null) => T): Promise<T> {
    const next = mutator(await this.get(id));
    await this.put(id, next);
    return next;
  }

  /** First document matching the where clauses, or null. */
  async findOne(where: CapWhere[]): Promise<T | null> {
    const rows = await this.query({ where, limit: 1 });
    return rows[0] ?? null;
  }

  /** All documents matching the where clauses. */
  find(where: CapWhere[]): Promise<T[]> {
    return this.query({ where });
  }

  /** Whether any document matches the where clauses. */
  async exists(where: CapWhere[]): Promise<boolean> {
    return (await this.findOne(where)) != null;
  }

  /** Delete every document matching the where clauses; returns the count. */
  async deleteWhere(where: CapWhere[]): Promise<number> {
    const stored = await this.allStored();
    const victims = stored.filter((s) => where.every((w) => matchesWhere(s.doc, w)));
    for (const v of victims) await this.delete(v.id);
    return victims.length;
  }

  /** Map every stored document to {id, doc} for export/backup. */
  dump(): Promise<CapStoredDoc<T>[]> {
    return this.allStored();
  }
}

// ---------------------------------------------------------------------------
// CapDatabase
// ---------------------------------------------------------------------------

export class CapDatabase {
  private backend: DbBackend | null = null;
  private opened = '';
  private collections = new Map<string, CapCollection>();
  private transition: Promise<void> = Promise.resolve();

  /** Whether the active backend supports raw SQL (native only). */
  get sqlAvailable(): boolean {
    return this.backend?.sqlAvailable ?? false;
  }
  /** Which backend is active. */
  get backendKind(): CapDbBackendKind | null {
    return this.backend?.kind ?? null;
  }
  get isOpen(): boolean {
    return this.backend != null;
  }

  /** Open (or reopen) a named database. Idempotent and serialized. */
  open(dbName = 'wordnew'): Promise<void> {
    if (this.opened === dbName && this.backend) return Promise.resolve();
    const operation = this.transition.catch(() => undefined).then(async () => {
      if (this.opened === dbName && this.backend) return;
      await this.closeCurrent();
      const backend = safeIsNative() ? new SqliteBackend() : new IndexedDbBackend();
      try {
        await backend.open(dbName);
      } catch (error) {
        await backend.close().catch(() => undefined);
        throw error;
      }
      this.backend = backend;
      this.opened = dbName;
    });
    this.transition = operation;
    return operation;
  }

  private ensureOpen(): DbBackend {
    if (!this.backend) throw new Error('CapDatabase: call open() first.');
    return this.backend;
  }

  /** Get a typed collection handle (cached). */
  collection<T extends CapDoc = CapDoc>(name: string): CapCollection<T> {
    validateCollectionName(name);
    const backend = this.ensureOpen();
    let coll = this.collections.get(name);
    if (!coll) {
      coll = new CapCollection<T>(backend, name);
      this.collections.set(name, coll);
    }
    return coll as CapCollection<T>;
  }

  // -- simple key-value (one shared collection) ---------------------------- #

  /** Set a key-value pair (stored in the reserved '_kv' collection). */
  kvSet<T = unknown>(key: string, value: T): Promise<void> {
    return this.ensureOpen().put('_kv', key, { v: value });
  }
  /** Get a key-value pair, or the fallback. */
  async kvGet<T = unknown>(key: string, fallback: T | null = null): Promise<T | null> {
    const rec = await this.ensureOpen().get('_kv', key);
    return rec ? ((rec as { v: T }).v ?? fallback) : fallback;
  }
  /** Delete a key-value pair. */
  kvDelete(key: string): Promise<void> {
    return this.ensureOpen().delete('_kv', key);
  }

  // -- raw SQL (SQL backend only) ------------------------------------------ #

  /** Run a SQL statement (DDL/DML). THROWS on web (no SQL backend). */
  execute(sql: string): Promise<CapRawResult> {
    const b = this.ensureOpen();
    if (!b.exec) throw new Error('Raw SQL is not available on this backend (web/IndexedDB). Use the document API.');
    return b.exec(sql);
  }
  /** Run a parameterized SELECT. THROWS on web. */
  query(sql: string, params?: unknown[]): Promise<CapDoc[]> {
    const b = this.ensureOpen();
    if (!b.query) throw new Error('Raw SQL is not available on this backend (web/IndexedDB). Use the document API.');
    return b.query(sql, params);
  }
  /** Run a parameterized mutation. THROWS on web. */
  run(sql: string, params?: unknown[]): Promise<CapRawResult> {
    const b = this.ensureOpen();
    if (!b.run) throw new Error('Raw SQL is not available on this backend (web/IndexedDB). Use the document API.');
    return b.run(sql, params);
  }

  /**
   * Run a function inside a transaction. On the SQL backend this is a real
   * atomic transaction; on IndexedDB it simply runs the function (per-store
   * atomicity only). Documented difference — do not rely on cross-collection
   * atomicity on web.
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const b = this.ensureOpen();
    return b.transaction ? b.transaction(fn) : fn();
  }

  private async closeCurrent(): Promise<void> {
    const backend = this.backend;
    this.backend = null;
    this.opened = '';
    this.collections.clear();
    await backend?.close();
  }

  /** Close the database (keeps data on disk). */
  close(): Promise<void> {
    const operation = this.transition.catch(() => undefined).then(() => this.closeCurrent());
    this.transition = operation;
    return operation;
  }

  /** Permanently delete the database and all its data. */
  deleteDatabase(dbName = this.opened || 'wordnew'): Promise<void> {
    const operation = this.transition.catch(() => undefined).then(async () => {
      const usesOpenBackend = this.backend != null && this.opened === dbName;
      const backend = usesOpenBackend
        ? this.backend as DbBackend
        : safeIsNative() ? new SqliteBackend() : new IndexedDbBackend();
      if (!usesOpenBackend) await backend.open(dbName);
      await backend.deleteDatabase(dbName);
      if (usesOpenBackend) {
        this.backend = null;
        this.opened = '';
        this.collections.clear();
      }
    });
    this.transition = operation;
    return operation;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

export const capDb = new CapDatabase();
export const openDatabase = (dbName?: string): Promise<void> => capDb.open(dbName);

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/** Open the shared database on mount; reports readiness. */
export function useDatabase(dbName = 'wordnew'): { ready: boolean; sqlAvailable: boolean; backend: CapDbBackendKind | null } {
  const [ready, setReady] = useState(capDb.isOpen);
  useEffect(() => {
    let mounted = true;
    void capDb.open(dbName).then(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, [dbName]);
  return { ready, sqlAvailable: capDb.sqlAvailable, backend: capDb.backendKind };
}

/**
 * Live query over a collection. Re-runs when `deps` change or `reload` is called.
 *
 *   const { rows, reload } = useQuery<Word>('words', { where: [['due', '=', true]] });
 */
export function useQuery<T extends CapDoc = CapDoc>(
  collection: string,
  query: CapQuery = {},
  deps: unknown[] = [],
): { rows: T[]; loading: boolean; reload: () => Promise<void> } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const queryKey = JSON.stringify(query);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await capDb.open();
      setRows(await capDb.collection<T>(collection).query(query));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, queryKey]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { rows, loading, reload };
}

/** Live single document by id + a save helper. */
export function useDocument<T extends CapDoc = CapDoc>(
  collection: string,
  id: string,
): { doc: T | null; loading: boolean; save: (doc: T) => Promise<void>; reload: () => Promise<void> } {
  const [doc, setDoc] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await capDb.open();
      setDoc(await capDb.collection<T>(collection).get(id));
    } finally {
      setLoading(false);
    }
  }, [collection, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (next: T) => {
      await capDb.open();
      await capDb.collection<T>(collection).put(id, next);
      setDoc(next);
    },
    [collection, id],
  );

  return { doc, loading, save, reload };
}

// ===========================================================================
// EXTENDED CAPABILITIES — backup/restore + collection hook
// ===========================================================================
//
// Export collections to a plain JSON bundle (pairs nicely with CapFilesystem's
// downloadText / writeJson for an on-device backup) and re-import them, plus a
// React hook that hands a component a typed collection + a live row count.

export interface CapDbExport {
  __exportedAt: string;
  collections: Record<string, Array<{ id: string; doc: CapDoc }>>;
}

/** Export one or more collections into a portable JSON bundle. */
export async function exportCollections(names: string[], db: CapDatabase = capDb): Promise<CapDbExport> {
  await db.open();
  const out: CapDbExport = { __exportedAt: new Date().toISOString(), collections: {} };
  for (const name of names) {
    const stored = await db.collection(name).dump();
    out.collections[name] = stored.map((s) => ({ id: s.id, doc: s.doc }));
  }
  return out;
}

/**
 * Import a JSON bundle produced by exportCollections. When `replace` is true
 * each target collection is cleared first; otherwise documents are merged
 * (bulkPut), overwriting by id.
 */
export async function importCollections(
  bundle: CapDbExport,
  options: { replace?: boolean } = {},
  db: CapDatabase = capDb,
): Promise<{ collections: number; documents: number }> {
  await db.open();
  let docs = 0;
  const names = Object.keys(bundle.collections || {});
  for (const name of names) {
    const coll = db.collection(name);
    if (options.replace) await coll.clear();
    const items = bundle.collections[name] || [];
    await coll.bulkPut(items);
    docs += items.length;
  }
  return { collections: names.length, documents: docs };
}

/**
 * React hook: hand a component a typed collection handle + a live document
 * count, with helpers to put/delete that refresh the count.
 *
 *   const { count, put, remove, refresh } = useCollection<Word>('words');
 */
export function useCollection<T extends CapDoc = CapDoc>(
  name: string,
): {
  collection: CapCollection<T> | null;
  count: number;
  ready: boolean;
  put: (id: string, doc: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [coll, setColl] = useState<CapCollection<T> | null>(null);

  const refresh = useCallback(async () => {
    await capDb.open();
    const c = capDb.collection<T>(name);
    setColl(c);
    setReady(true);
    setCount(await c.count());
  }, [name]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const put = useCallback(
    async (id: string, doc: T) => {
      await capDb.open();
      await capDb.collection<T>(name).put(id, doc);
      setCount(await capDb.collection<T>(name).count());
    },
    [name],
  );

  const remove = useCallback(
    async (id: string) => {
      await capDb.open();
      await capDb.collection<T>(name).delete(id);
      setCount(await capDb.collection<T>(name).count());
    },
    [name],
  );

  return { collection: coll, count, ready, put, remove, refresh };
}

export default capDb;
