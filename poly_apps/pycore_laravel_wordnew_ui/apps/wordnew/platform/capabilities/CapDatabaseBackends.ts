/** Native SQLite and web IndexedDB database backends. */
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { stableIdentifier } from '../utils/stableHash';
import type { CapDoc, CapRawResult, CapStoredDoc } from './CapDatabase';
export function safeIsNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

export interface DbBackend {
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

export function validateCollectionName(name: string): void {
  if (!COLLECTION_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid collection name: ${name}`);
  }
}

export class IndexedDbBackend implements DbBackend {
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

export class SqliteBackend implements DbBackend {
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

