/** IndexedDB engine for schema-on-write web tables. */
import { applyQuery } from './CapDatabase';
import type { CapDoc, CapQuery, CapWhere, CapWhereOp } from './CapDatabase';
import type { CapTableSchema } from './CapAutoSchema';
import { safeIdent } from './CapAutoSchema';
// ---------------------------------------------------------------------------
// AutoWebDb — a self-managed, INDEXED IndexedDB engine for the web path.
//
// The base CapDatabase IndexedDB store has no secondary indexes, so a filtered
// query there must load the whole table (getAll) and filter in memory — fatal
// for 100k+ rows. AutoWebDb creates one object store per table WITH secondary
// indexes on the chosen columns, so a query with an equality/range clause on an
// indexed field scans only the matching key-range (e.g. one coin's ~2880
// candles) instead of all 800k rows; the small candidate set is then ordered +
// limited in memory. Uses its OWN db name (suffix '_idx') to avoid colliding
// with the base store's connection to the same db name.
// ---------------------------------------------------------------------------

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function buildKeyRange(op: CapWhereOp, value: unknown): IDBKeyRange | null {
  try {
    switch (op) {
      case '=':
        return IDBKeyRange.only(value as IDBValidKey);
      case '>':
        return IDBKeyRange.lowerBound(value as IDBValidKey, true);
      case '>=':
        return IDBKeyRange.lowerBound(value as IDBValidKey, false);
      case '<':
        return IDBKeyRange.upperBound(value as IDBValidKey, true);
      case '<=':
        return IDBKeyRange.upperBound(value as IDBValidKey, false);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export class AutoWebDb {
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;
  private schemaChain: Promise<void> = Promise.resolve();
  constructor(private readonly dbName: string) {}

  private openRaw(version?: number, upgrade?: (db: IDBDatabase, txn: IDBTransaction | null) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = version != null ? indexedDB.open(this.dbName, version) : indexedDB.open(this.dbName);
      req.onupgradeneeded = () => upgrade?.(req.result, req.transaction);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          if (this.db === db) this.db = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked (close other tabs).'));
    });
  }

  private async ensureOpen(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (!this.openPromise) {
      this.openPromise = this.openRaw().then((db) => {
        this.db = db;
        return db;
      }).finally(() => {
        this.openPromise = null;
      });
    }
    return this.openPromise;
  }

  /** Create the store (if missing) + any missing secondary indexes. */
  async ensureStore(table: string, pk: string, indexCols: string[]): Promise<void> {
    const operation = this.schemaChain.then(() => this.ensureStoreNow(table, pk, indexCols));
    this.schemaChain = operation.catch(() => undefined);
    return operation;
  }

  private async ensureStoreNow(table: string, pk: string, indexCols: string[]): Promise<void> {
    const db = await this.ensureOpen();
    const needStore = !db.objectStoreNames.contains(table);
    let missing: string[] = [];
    if (!needStore) {
      const store = db.transaction(table, 'readonly').objectStore(table);
      const have = new Set(Array.from(store.indexNames));
      missing = indexCols.filter((column) => !have.has(`ix_${column}`));
    }
    if (!needStore && missing.length === 0) return;
    const nextVersion = db.version + 1;
    db.close();
    this.db = null;
    this.db = await this.openRaw(nextVersion, (upgradeDb, transaction) => {
      const store = upgradeDb.objectStoreNames.contains(table)
        ? transaction!.objectStore(table)
        : upgradeDb.createObjectStore(table, { keyPath: pk });
      const have = new Set(Array.from(store.indexNames));
      for (const column of indexCols) {
        if (!have.has(`ix_${column}`)) store.createIndex(`ix_${column}`, column, { unique: false });
      }
    });
  }

  async close(): Promise<void> {
    await this.openPromise?.catch(() => undefined);
    this.db?.close();
    this.db = null;
  }

  async put(table: string, rows: CapDoc[]): Promise<void> {
    const db = await this.ensureOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(table, 'readwrite');
      const store = tx.objectStore(table);
      for (const r of rows) store.put(r);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async get(table: string, id: string): Promise<CapDoc | null> {
    const db = await this.ensureOpen();
    const store = db.transaction(table, 'readonly').objectStore(table);
    return ((await idbReq(store.get(id))) as CapDoc | undefined) ?? null;
  }

  async delete(table: string, id: string): Promise<void> {
    const db = await this.ensureOpen();
    const tx = db.transaction(table, 'readwrite');
    tx.objectStore(table).delete(id);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async count(table: string): Promise<number> {
    const db = await this.ensureOpen();
    const store = db.transaction(table, 'readonly').objectStore(table);
    return (await idbReq(store.count())) as number;
  }

  async clear(table: string): Promise<void> {
    const db = await this.ensureOpen();
    if (!db.objectStoreNames.contains(table)) return;
    const tx = db.transaction(table, 'readwrite');
    tx.objectStore(table).clear();
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Collect CANDIDATE rows for a query: if a where clause targets an indexed
   * column with an equality/range op, scan only that index key-range; otherwise
   * return all rows. The caller applies the full filter/order/limit on the
   * (ideally small) candidate set.
   */
  async candidates(table: string, where: CapWhere[] | undefined, indexed: Set<string>): Promise<CapDoc[]> {
    const db = await this.ensureOpen();
    if (!db.objectStoreNames.contains(table)) return [];
    const store = db.transaction(table, 'readonly').objectStore(table);
    // Prefer an equality clause on an indexed column (most selective), else a
    // range clause on an indexed column.
    const usable = (where ?? []).filter(
      ([f, op]) => indexed.has(f) && store.indexNames.contains(`ix_${f}`) && ['=', '<', '<=', '>', '>='].includes(op),
    );
    const clause = usable.find(([, op]) => op === '=') ?? usable[0];
    if (clause) {
      const range = buildKeyRange(clause[1], clause[2]);
      if (range) return (await idbReq(store.index(`ix_${clause[0]}`).getAll(range))) as CapDoc[];
    }
    return (await idbReq(store.getAll())) as CapDoc[];
  }

  async allStored(table: string): Promise<CapDoc[]> {
    const db = await this.ensureOpen();
    if (!db.objectStoreNames.contains(table)) return [];
    const store = db.transaction(table, 'readonly').objectStore(table);
    return (await idbReq(store.getAll())) as CapDoc[];
  }

  async dropStore(table: string): Promise<void> {
    await this.clear(table);
  }
}

