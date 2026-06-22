/* =============================================================================
 * CapAutoStore — self-describing local store (schema-on-write) over CapDatabase
 * =============================================================================
 *
 * WHO CAN USE THIS
 *   Public capability library, *built primarily for the wordnew mobile APP*.
 *   It EXTENDS CapDatabase (the cross-platform doc/SQL base), so it inherits the
 *   native-SQLite ↔ web-IndexedDB fallback, opening, transactions, raw SQL, etc.
 *
 * DESIGN THINKING (要点 / why it works this way)
 *   The goal is "throw server JSON at it and it just stores it" — perfect for
 *   syncing a backend table to the device with zero hand-written schema:
 *
 *   1. SCHEMA-ON-WRITE. You never declare a table up front. The FIRST insert
 *      infers the table shape from the data and creates it. Subsequent inserts
 *      into an existing table SKIP creation (cheap cache check) — only NEW
 *      fields trigger a non-destructive `ALTER TABLE ADD COLUMN` (schema grows,
 *      never shrinks). Query / update / delete NEVER create a table (so a typo'd
 *      table name can't silently spawn a ghost table during a read).
 *
 *   2. TYPE INFERENCE + WIDENING (CapTypeInferrer). Each JSON value is classified
 *      as integer / real / boolean / timestamp / json / text. When the same
 *      column is seen with different types across rows we keep the WIDEST
 *      compatible type so nothing ever fails to store:
 *          integer ⊕ real      → real    (a number column becomes double)
 *          number  ⊕ text      → text
 *          anything⊕ json      → text (json is stored as a JSON string)
 *          timestamp⊕ number   → integer (ms epoch)
 *      i.e. text is the universal top type. "是数字就用 double 型": as soon as a
 *      column sees a fractional value it widens int→real(double).
 *
 *   3. CANONICAL VALUES. Timestamps (Date objects or ISO-8601 strings) are
 *      normalized to epoch-ms numbers; booleans stay booleans; json stays an
 *      object on read. So a row read back is identical regardless of backend.
 *
 *   4. ARRAY INSERT. insert(table, rows[]) infers the table from rows[0] (per
 *      spec "取第一个值获得表结构"); extra fields appearing in later rows are
 *      absorbed by the ADD COLUMN evolution above.
 *
 *   5. EXPLICIT SCHEMA. You can also defineTable(name, {col: 'real', ...}) to
 *      create a table from a known shape without sampling data.
 *
 *   6. STORAGE BOUNDARY (自动保持可用存储大小的边界). Tables created with
 *      `{ evictable: true, maxRows }` are trimmed oldest-first when they exceed
 *      maxRows, and a global byte budget (web: navigator.storage.estimate) can
 *      evict across evictable tables — so an unbounded server sync can't fill
 *      the disk / blow the browser quota.
 *
 *   BACKENDS (inherited):
 *     - native  → real typed SQLite tables (indexed; fast for big time-series
 *                 like 280 coins × 48h). Raw SQL available.
 *     - web     → IndexedDB document store per table (schemaless rows; queries
 *                 run via in-memory filter — fine to GBs, but a full SQL/native
 *                 build is preferred for very large analytical scans).
 *
 * QUICK START
 *   import { capStore } from '@/shared/capabilities/CapAutoStore';
 *   await capStore.open('app_data');
 *   // table is created automatically from the first row's shape:
 *   await capStore.insert('candles', serverRows /* [{inst_id, ts, c, vol}, ...] *\/);
 *   const rows = await capStore.query('candles', { where: [['inst_id','=','BTC-USDT']],
 *                                                   orderBy: 'ts', limit: 2880 });
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import { CapDatabase, applyQuery } from './CapDatabase';
import type { CapDoc, CapQuery, CapWhere, CapWhereOp } from './CapDatabase';
import { getStorageEstimate } from './CapFilesystem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Inferred logical column types (mapped to SQLite affinity + a canonical JS form). */
export type CapColType = 'integer' | 'real' | 'boolean' | 'timestamp' | 'text' | 'json' | 'null';

/** A table schema: column name -> logical type. */
export type CapTableColumns = Record<string, CapColType>;

export interface CapTableSchema {
  columns: CapTableColumns;
  /** Primary key column. '__id' = library-generated id. */
  primaryKey: string;
  /** Whether the lib generates ids (true when no natural key existed). */
  generatedKey: boolean;
  /** Eviction policy for the storage boundary. */
  evictable: boolean;
  /** Max rows kept when evictable (oldest trimmed first). 0 = unlimited. */
  maxRows: number;
  /** Column used to order eviction (a timestamp column if found, else the pk). */
  orderColumn: string;
  /** Scalar columns that carry a secondary index (fast filters/sorts) on BOTH
   *  backends (SQL CREATE INDEX / IndexedDB createIndex). */
  indexes: string[];
}

export interface CapAutoTableOptions {
  /** Force a primary key column (else inferred: 'id' if present, else generated). */
  primaryKey?: string;
  /** Mark the table evictable for the storage boundary. */
  evictable?: boolean;
  /** Max rows to keep when evictable. */
  maxRows?: number;
  /** Columns to build indexes on (SQL backend) for fast lookups/sorts. */
  index?: string[];
}

export interface CapAutoStoreOptions {
  /** Global byte budget across evictable tables (web quota guard). 0 = off. */
  maxBytes?: number;
  logger?: (msg: string, ...args: unknown[]) => void;
}

// ---------------------------------------------------------------------------
// CapTypeInferrer — the value→type classifier + widening lattice
// ---------------------------------------------------------------------------

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export class CapTypeInferrer {
  /** Whether a string looks like an ISO-8601 date/time. */
  static isIsoDate(s: string): boolean {
    return ISO_DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
  }

  /** Classify a single JSON value into a logical type. */
  static inferType(value: unknown): CapColType {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'real';
    if (value instanceof Date) return 'timestamp';
    if (typeof value === 'string') return CapTypeInferrer.isIsoDate(value) ? 'timestamp' : 'text';
    if (typeof value === 'object') return 'json';
    return 'text';
  }

  /**
   * The widest type covering both `a` and `b` (the compatibility lattice). The
   * result can always store any value that either input type could.
   */
  static widen(a: CapColType, b: CapColType): CapColType {
    if (a === b) return a;
    if (a === 'null') return b;
    if (b === 'null') return a;
    const set = new Set([a, b]);
    // json or text always wins (universal text storage).
    if (set.has('text')) return 'text';
    if (set.has('json')) return 'text';
    // numeric family.
    if (set.has('integer') && set.has('real')) return 'real';
    if (set.has('boolean') && (set.has('integer') || set.has('real'))) {
      return set.has('real') ? 'real' : 'integer';
    }
    // timestamp mixed with a plain number → keep integer (ms epoch).
    if (set.has('timestamp') && (set.has('integer') || set.has('real'))) return 'integer';
    // timestamp mixed with anything else (boolean) → text (ambiguous).
    if (set.has('timestamp')) return 'text';
    // Fallback: text is always safe.
    return 'text';
  }

  /** Infer a column map from one sample row. */
  static inferRow(row: CapDoc): CapTableColumns {
    const cols: CapTableColumns = {};
    for (const [k, v] of Object.entries(row)) cols[k] = CapTypeInferrer.inferType(v);
    return cols;
  }

  /** Merge an incoming row's inferred types into an existing column map (widening). */
  static mergeInto(existing: CapTableColumns, row: CapDoc): { columns: CapTableColumns; added: string[]; widened: string[] } {
    const columns = { ...existing };
    const added: string[] = [];
    const widened: string[] = [];
    for (const [k, v] of Object.entries(row)) {
      const t = CapTypeInferrer.inferType(v);
      if (!(k in columns)) {
        columns[k] = t === 'null' ? 'text' : t;
        added.push(k);
      } else {
        const w = CapTypeInferrer.widen(columns[k], t);
        if (w !== columns[k]) {
          columns[k] = w;
          widened.push(k);
        }
      }
    }
    return { columns, added, widened };
  }

  /** Coerce a value to epoch-ms (Date / ISO string / number). null if not parseable. */
  static toEpochMs(value: unknown): number | null {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const t = Date.parse(value);
      return Number.isNaN(t) ? null : t;
    }
    return null;
  }

  /** SQLite column affinity for a logical type. */
  static affinity(type: CapColType): 'INTEGER' | 'REAL' | 'TEXT' {
    switch (type) {
      case 'integer':
      case 'boolean':
      case 'timestamp':
        return 'INTEGER';
      case 'real':
        return 'REAL';
      default:
        return 'TEXT';
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function safeIdent(name: string): string {
  const s = name.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(s) ? `_${s}` : s || '_col';
}

function genId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rnd}`;
}

/** Pick a sensible eviction-order column: a timestamp column, else the pk. */
function pickOrderColumn(columns: CapTableColumns, pk: string): string {
  const tsCol = Object.keys(columns).find((c) => columns[c] === 'timestamp');
  if (tsCol) return tsCol;
  for (const guess of ['ts', 'time', 'timestamp', 'created_at', 'updated_at']) {
    if (guess in columns) return guess;
  }
  return pk;
}

/** Canonicalize a row's values for storage (timestamp→ms, leave json/bool/num as-is). */
function canonicalize(row: CapDoc, columns: CapTableColumns): CapDoc {
  const out: CapDoc = {};
  for (const [k, v] of Object.entries(row)) {
    const t = columns[k];
    if (t === 'timestamp') out[k] = CapTypeInferrer.toEpochMs(v);
    else out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// SQL value (de)serialization (SQL backend only)
// ---------------------------------------------------------------------------

function sqlSerialize(value: unknown, type: CapColType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    case 'boolean':
      return value ? 1 : 0;
    case 'timestamp':
      return CapTypeInferrer.toEpochMs(value);
    case 'integer':
    case 'real':
      return typeof value === 'number' ? value : Number(value);
    default:
      return typeof value === 'string' ? value : String(value);
  }
}

function sqlDeserialize(value: unknown, type: CapColType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'json':
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return value;
      }
    case 'boolean':
      return !!value;
    default:
      return value;
  }
}

/**
 * Choose the SCALAR columns worth indexing for fast lookups/sorts: the eviction
 * order column, any explicitly-requested columns, and "id-ish" fields (the
 * usual server filter keys). json columns are never indexed. Capped to keep
 * write cost bounded. Used on BOTH backends so web and native get the same fast
 * paths (this is what makes "280 coins × 48h, filter by coin, order by ts" land
 * in the second-level range the request asked for).
 */
const ID_ISH_RE = /(^id$|_id$|_key$|symbol$|code$|name$|type$|cat$|category$|tag$|status$|state$)/i;

function indexableColumns(columns: CapTableColumns, pk: string, extra: string[] = [], order?: string): string[] {
  const out = new Set<string>();
  const consider = (c?: string): void => {
    if (c && c !== pk && columns[c] && columns[c] !== 'json') out.add(c);
  };
  if (order) consider(order);
  for (const c of extra) consider(c);
  for (const c of Object.keys(columns)) if (ID_ISH_RE.test(c)) consider(c);
  return Array.from(out).slice(0, 8);
}

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

class AutoWebDb {
  private db: IDBDatabase | null = null;
  constructor(private readonly dbName: string) {}

  private openRaw(version?: number, upgrade?: (db: IDBDatabase, txn: IDBTransaction | null) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = version != null ? indexedDB.open(this.dbName, version) : indexedDB.open(this.dbName);
      req.onupgradeneeded = () => upgrade?.(req.result, req.transaction);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked (close other tabs).'));
    });
  }

  private async ensureOpen(): Promise<IDBDatabase> {
    if (!this.db) this.db = await this.openRaw();
    return this.db;
  }

  /** Create the store (if missing) + any missing secondary indexes. */
  async ensureStore(table: string, pk: string, indexCols: string[]): Promise<void> {
    const db = await this.ensureOpen();
    let needStore = !db.objectStoreNames.contains(table);
    let missing: string[] = [];
    if (!needStore) {
      const store = db.transaction(table, 'readonly').objectStore(table);
      const have = new Set(Array.from(store.indexNames));
      missing = indexCols.filter((c) => !have.has(`ix_${c}`));
    }
    if (!needStore && missing.length === 0) return;
    const nextVer = db.version + 1;
    db.close();
    this.db = await this.openRaw(nextVer, (udb, txn) => {
      const store = udb.objectStoreNames.contains(table)
        ? txn!.objectStore(table)
        : udb.createObjectStore(table, { keyPath: pk });
      const have = new Set(Array.from(store.indexNames));
      for (const c of indexCols) if (!have.has(`ix_${c}`)) store.createIndex(`ix_${c}`, c, { unique: false });
    });
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

// ---------------------------------------------------------------------------
// CapAutoStore
// ---------------------------------------------------------------------------

const SCHEMA_COLLECTION = '_auto_schema';

export class CapAutoStore extends CapDatabase {
  private readonly opts: Required<Omit<CapAutoStoreOptions, 'logger'>> & Pick<CapAutoStoreOptions, 'logger'>;
  private schemas = new Map<string, CapTableSchema>();
  private schemasLoaded = false;
  private _dbName = 'app_data';
  private _web: AutoWebDb | null = null;

  constructor(options: CapAutoStoreOptions = {}) {
    super();
    this.opts = { maxBytes: options.maxBytes ?? 0, logger: options.logger };
  }

  /** The indexed IndexedDB engine for the web data path (own db, '_idx' suffix). */
  private get web(): AutoWebDb {
    if (!this._web) this._web = new AutoWebDb(`${this._dbName}_idx`);
    return this._web;
  }

  private log(msg: string, ...args: unknown[]): void {
    this.opts.logger?.(`[CapAutoStore] ${msg}`, ...args);
  }

  /**
   * Open the auto-store. Defaults to its OWN database name ('app_data') so a
   * CapAutoStore instance never shares a backend connection with the doc-store
   * `capDb` (two connections to one IndexedDB/SQLite name would conflict).
   */
  async open(dbName = 'app_data'): Promise<void> {
    this._dbName = dbName;
    return super.open(dbName);
  }

  /** Load the persisted schema registry once (after open). */
  private async loadSchemas(): Promise<void> {
    if (this.schemasLoaded) return;
    await this.open();
    const stored = await this.collection<{ schema: CapTableSchema }>(SCHEMA_COLLECTION).allStored();
    for (const s of stored) this.schemas.set(s.id, (s.doc as { schema: CapTableSchema }).schema);
    this.schemasLoaded = true;
  }

  private async persistSchema(table: string, schema: CapTableSchema): Promise<void> {
    this.schemas.set(table, schema);
    await this.collection(SCHEMA_COLLECTION).put(table, { schema });
  }

  /** Whether a table already exists (schema known / persisted). No creation. */
  async tableExists(table: string): Promise<boolean> {
    await this.loadSchemas();
    return this.schemas.has(table);
  }

  /** The known schema for a table, or null. */
  async schema(table: string): Promise<CapTableSchema | null> {
    await this.loadSchemas();
    return this.schemas.get(table) ?? null;
  }

  /** Names of all auto-managed tables. */
  async listTables(): Promise<string[]> {
    await this.loadSchemas();
    return Array.from(this.schemas.keys());
  }

  // -- table creation ------------------------------------------------------ #

  /** Create a table from an explicit column map (skips if it already exists). */
  async defineTable(table: string, columns: CapTableColumns, options: CapAutoTableOptions = {}): Promise<CapTableSchema> {
    await this.loadSchemas();
    if (this.schemas.has(table)) return this.schemas.get(table)!;
    const pk = options.primaryKey ?? ('id' in columns ? 'id' : '__id');
    const generatedKey = !(pk in columns);
    const cols: CapTableColumns = { ...columns };
    if (generatedKey) cols[pk] = 'text';
    const orderColumn = pickOrderColumn(cols, pk);
    const schema: CapTableSchema = {
      columns: cols,
      primaryKey: pk,
      generatedKey,
      evictable: !!options.evictable,
      maxRows: options.maxRows ?? 0,
      orderColumn,
      indexes: indexableColumns(cols, pk, options.index ?? [], orderColumn),
    };
    await this.createBackingStore(table, schema);
    await this.persistSchema(table, schema);
    this.log('defined table', table, Object.keys(cols).length, 'cols');
    return schema;
  }

  /** Ensure a table exists by inferring its shape from a sample row. */
  async ensureTableFromRow(table: string, sample: CapDoc, options: CapAutoTableOptions = {}): Promise<CapTableSchema> {
    await this.loadSchemas();
    const existing = this.schemas.get(table);
    if (existing) return existing;
    return this.defineTable(table, CapTypeInferrer.inferRow(sample), options);
  }

  /** Create the real backing store for a table (SQL typed table, or indexed IDB store). */
  private async createBackingStore(table: string, schema: CapTableSchema): Promise<void> {
    if (this.sqlAvailable) {
      const t = safeIdent(table);
      const colDefs = Object.entries(schema.columns)
        .map(([name, type]) => {
          const col = safeIdent(name);
          const aff = CapTypeInferrer.affinity(type);
          return name === schema.primaryKey ? `"${col}" ${aff} PRIMARY KEY` : `"${col}" ${aff}`;
        })
        .join(', ');
      await this.execute(`CREATE TABLE IF NOT EXISTS "${t}" (${colDefs});`);
      for (const c of schema.indexes) {
        if (!(c in schema.columns) || c === schema.primaryKey) continue;
        await this.execute(`CREATE INDEX IF NOT EXISTS "ix_${t}_${safeIdent(c)}" ON "${t}" ("${safeIdent(c)}");`);
      }
    } else {
      // Web: create the IndexedDB object store WITH secondary indexes up front.
      await this.web.ensureStore(table, schema.primaryKey, schema.indexes);
    }
  }

  /** Evolve an existing SQL table: ADD COLUMN for any newly-seen fields. */
  private async evolveSqlTable(table: string, schema: CapTableSchema, addedCols: string[]): Promise<void> {
    if (!this.sqlAvailable || !addedCols.length) return;
    const t = safeIdent(table);
    for (const c of addedCols) {
      const aff = CapTypeInferrer.affinity(schema.columns[c]);
      try {
        await this.execute(`ALTER TABLE "${t}" ADD COLUMN "${safeIdent(c)}" ${aff};`);
      } catch (e) {
        this.log('ADD COLUMN skipped', table, c, e);
      }
    }
  }

  // -- insert -------------------------------------------------------------- #

  /**
   * Insert one row or an array of rows. AUTO-CREATES the table from the first
   * row if it does not exist; otherwise evolves the schema for any new fields.
   * Idempotent by primary key (INSERT OR REPLACE / put). Returns inserted ids.
   */
  async insert(table: string, data: CapDoc | CapDoc[], options: CapAutoTableOptions = {}): Promise<string[]> {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return [];
    await this.loadSchemas();

    // 1) ensure / evolve schema from the FIRST row (+absorb new fields across rows).
    let schema = this.schemas.get(table);
    if (!schema) {
      schema = await this.ensureTableFromRow(table, rows[0], options);
    }
    // Absorb any new/widened fields seen across the batch.
    let merged = schema.columns;
    let changed = false;
    const added: string[] = [];
    for (const r of rows) {
      const res = CapTypeInferrer.mergeInto(merged, r);
      merged = res.columns;
      if (res.added.length || res.widened.length) changed = true;
      for (const a of res.added) if (!added.includes(a)) added.push(a);
    }
    if (changed) {
      const orderColumn = pickOrderColumn(merged, schema.primaryKey);
      const indexes = indexableColumns(merged, schema.primaryKey, schema.indexes, orderColumn);
      await this.evolveSqlTable(table, { ...schema, columns: merged }, added);
      schema = { ...schema, columns: merged, orderColumn, indexes };
      // Make sure new index columns get a backing index on either platform.
      if (this.sqlAvailable) {
        const t = safeIdent(table);
        for (const c of indexes) {
          if (c === schema.primaryKey) continue;
          await this.execute(`CREATE INDEX IF NOT EXISTS "ix_${t}_${safeIdent(c)}" ON "${t}" ("${safeIdent(c)}");`).catch(() => undefined);
        }
      } else {
        await this.web.ensureStore(table, schema.primaryKey, indexes);
      }
      await this.persistSchema(table, schema);
    }

    // 2) write rows.
    const ids = this.sqlAvailable
      ? await this.insertSql(table, rows, schema)
      : await this.insertWeb(table, rows, schema);

    // 3) keep storage within bounds.
    await this.enforceBudget(table);
    return ids;
  }

  private rowId(row: CapDoc, schema: CapTableSchema): string {
    if (schema.generatedKey) {
      const existing = row[schema.primaryKey];
      return existing != null ? String(existing) : genId();
    }
    const v = row[schema.primaryKey];
    return v != null ? String(v) : genId();
  }

  private async insertSql(table: string, rows: CapDoc[], schema: CapTableSchema): Promise<string[]> {
    const t = safeIdent(table);
    const cols = Object.keys(schema.columns);
    const colList = cols.map((c) => `"${safeIdent(c)}"`).join(',');
    const ids: string[] = [];

    // Serialize every row once; assign generated ids.
    const flat: unknown[][] = rows.map((r) => {
      const canon = canonicalize(r, schema.columns);
      if (schema.generatedKey && canon[schema.primaryKey] == null) canon[schema.primaryKey] = this.rowId(r, schema);
      ids.push(String(canon[schema.primaryKey]));
      return cols.map((c) => sqlSerialize(canon[c], schema.columns[c]));
    });

    // OPTIMIZATION: batch into MULTI-ROW inserts (one statement per chunk)
    // instead of one statement per row — orders of magnitude faster for big
    // syncs (e.g. 280 coins × 2880 candles). Chunk so params stay well under the
    // SQLite bind limit. The whole thing runs in one transaction.
    const perRow = cols.length || 1;
    const chunkRows = Math.max(1, Math.floor(900 / perRow));
    const oneTuple = `(${cols.map(() => '?').join(',')})`;
    await this.transaction(async () => {
      for (let i = 0; i < flat.length; i += chunkRows) {
        const slice = flat.slice(i, i + chunkRows);
        const sql = `INSERT OR REPLACE INTO "${t}" (${colList}) VALUES ${slice.map(() => oneTuple).join(',')};`;
        const params: unknown[] = [];
        for (const row of slice) params.push(...row);
        await this.run(sql, params);
      }
    });
    return ids;
  }

  private async insertWeb(table: string, rows: CapDoc[], schema: CapTableSchema): Promise<string[]> {
    const ids: string[] = [];
    const docs = rows.map((r) => {
      const canon = canonicalize(r, schema.columns);
      const id = this.rowId(r, schema);
      canon[schema.primaryKey] = id; // ensure the keyPath field is present
      ids.push(id);
      return canon;
    });
    await this.web.put(table, docs);
    return ids;
  }

  // -- read / update / delete (NEVER create a table) ----------------------- #

  /**
   * Query an auto-table. Returns [] if the table does not exist (NO creation).
   * Named `select` (not `query`) so it doesn't clash with the inherited raw-SQL
   * `query(sql, params)` from CapDatabase.
   */
  async select<T extends CapDoc = CapDoc>(table: string, q: CapQuery = {}): Promise<T[]> {
    await this.loadSchemas();
    const schema = this.schemas.get(table);
    if (!schema) return [];
    if (this.sqlAvailable) return this.querySql<T>(table, schema, q);
    // Web: pull only the INDEXED candidate set (e.g. one coin's rows), then
    // order + limit in memory — avoids loading the whole table.
    const candidates = await this.web.candidates(table, q.where, new Set(schema.indexes));
    return applyQuery(candidates as T[], q);
  }

  private async querySql<T extends CapDoc>(table: string, schema: CapTableSchema, q: CapQuery): Promise<T[]> {
    const t = safeIdent(table);
    const { clause, params } = this.buildWhere(q.where, schema);
    let sql = `SELECT * FROM "${t}"`;
    if (clause) sql += ` WHERE ${clause}`;
    if (q.orderBy && q.orderBy in schema.columns) {
      sql += ` ORDER BY "${safeIdent(q.orderBy)}" ${q.order === 'desc' ? 'DESC' : 'ASC'}`;
    }
    if (q.limit != null) sql += ` LIMIT ${Number(q.limit)}`;
    if (q.offset != null) sql += ` OFFSET ${Number(q.offset)}`;
    const rows = await this.query(sql, params); // inherited raw-SQL query
    return rows.map((r) => this.deserializeRow(r, schema)) as T[];
  }

  private buildWhere(where: CapWhere[] | undefined, schema: CapTableSchema): { clause: string; params: unknown[] } {
    if (!where || !where.length) return { clause: '', params: [] };
    const parts: string[] = [];
    const params: unknown[] = [];
    for (const [field, op, value] of where) {
      if (!(field in schema.columns)) continue;
      const col = `"${safeIdent(field)}"`;
      const type = schema.columns[field];
      switch (op) {
        case '=':
        case '!=':
        case '<':
        case '<=':
        case '>':
        case '>=':
          parts.push(`${col} ${op === '!=' ? '<>' : op} ?`);
          params.push(sqlSerialize(value, type));
          break;
        case 'in': {
          const arr = Array.isArray(value) ? value : [value];
          parts.push(`${col} IN (${arr.map(() => '?').join(',')})`);
          for (const v of arr) params.push(sqlSerialize(v, type));
          break;
        }
        case 'contains':
          parts.push(`${col} LIKE ?`);
          params.push(`%${String(value)}%`);
          break;
        case 'startsWith':
          parts.push(`${col} LIKE ?`);
          params.push(`${String(value)}%`);
          break;
      }
    }
    return { clause: parts.join(' AND '), params };
  }

  private deserializeRow(row: CapDoc, schema: CapTableSchema): CapDoc {
    const out: CapDoc = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = k in schema.columns ? sqlDeserialize(v, schema.columns[k]) : v;
    }
    return out;
  }

  /** Get a single row by primary key (no creation). */
  async getRow<T extends CapDoc = CapDoc>(table: string, id: string): Promise<T | null> {
    await this.loadSchemas();
    const schema = this.schemas.get(table);
    if (!schema) return null;
    if (this.sqlAvailable) {
      const rows = await this.query(`SELECT * FROM "${safeIdent(table)}" WHERE "${safeIdent(schema.primaryKey)}" = ? LIMIT 1;`, [id]);
      return rows[0] ? (this.deserializeRow(rows[0], schema) as T) : null;
    }
    return (await this.web.get(table, id)) as T | null;
  }

  /** Update (merge) a row by primary key (no creation). Returns false if absent table/row. */
  async updateRow(table: string, id: string, patch: CapDoc): Promise<boolean> {
    await this.loadSchemas();
    const schema = this.schemas.get(table);
    if (!schema) return false;
    const current = await this.getRow(table, id);
    if (!current) return false;
    const next = { ...current, ...patch, [schema.primaryKey]: id };
    await this.insert(table, next);
    return true;
  }

  /** Delete a row by primary key (no creation). */
  async deleteRow(table: string, id: string): Promise<void> {
    await this.loadSchemas();
    const schema = this.schemas.get(table);
    if (!schema) return;
    if (this.sqlAvailable) await this.run(`DELETE FROM "${safeIdent(table)}" WHERE "${safeIdent(schema.primaryKey)}" = ?;`, [id]);
    else await this.web.delete(table, id);
  }

  /** Count rows (optionally matching where). 0 if table absent. */
  async countRows(table: string, where?: CapWhere[]): Promise<number> {
    await this.loadSchemas();
    const schema = this.schemas.get(table);
    if (!schema) return 0;
    if (this.sqlAvailable) {
      const { clause, params } = this.buildWhere(where, schema);
      const sql = `SELECT COUNT(*) as n FROM "${safeIdent(table)}"${clause ? ` WHERE ${clause}` : ''};`;
      const rows = await this.query(sql, params);
      return Number(rows[0]?.n ?? 0);
    }
    if (!where || !where.length) return this.web.count(table);
    return (await this.select(table, { where })).length;
  }

  /** Drop a table entirely (data + schema). */
  async dropTable(table: string): Promise<void> {
    await this.loadSchemas();
    if (this.sqlAvailable) await this.execute(`DROP TABLE IF EXISTS "${safeIdent(table)}";`).catch(() => undefined);
    else await this.web.clear(table);
    this.schemas.delete(table);
    await this.collection(SCHEMA_COLLECTION).delete(table);
  }

  // -- storage boundary ---------------------------------------------------- #

  /** Set the global byte budget (web quota guard). */
  setMaxBytes(bytes: number): void {
    this.opts.maxBytes = bytes;
  }

  /** Current web storage usage estimate (0 on native — disk-bound). */
  async storageUsage(): Promise<{ usageBytes: number; quotaBytes: number; percentUsed: number }> {
    const est = await getStorageEstimate();
    return { usageBytes: est.usageBytes, quotaBytes: est.quotaBytes, percentUsed: est.percentUsed };
  }

  /**
   * Enforce the storage boundary: trim evictable tables to maxRows (oldest by
   * orderColumn), then, on web, if a global byte budget is set and exceeded,
   * trim evictable tables further. Called automatically after inserts.
   */
  async enforceBudget(touchedTable?: string): Promise<void> {
    await this.loadSchemas();
    // Per-table row cap (deterministic on both backends).
    const tables = touchedTable ? [touchedTable] : Array.from(this.schemas.keys());
    for (const table of tables) {
      const schema = this.schemas.get(table);
      if (!schema || !schema.evictable || schema.maxRows <= 0) continue;
      const n = await this.countRows(table);
      if (n > schema.maxRows) await this.trimOldest(table, schema, n - schema.maxRows);
    }
    // Global byte budget (web).
    if (this.opts.maxBytes > 0) {
      let { usageBytes } = await this.storageUsage();
      if (usageBytes <= this.opts.maxBytes) return;
      for (const [table, schema] of this.schemas) {
        if (usageBytes <= this.opts.maxBytes) break;
        if (!schema.evictable) continue;
        const n = await this.countRows(table);
        const drop = Math.max(1, Math.floor(n * 0.2)); // shed 20% at a time
        await this.trimOldest(table, schema, drop);
        usageBytes = (await this.storageUsage()).usageBytes;
      }
    }
  }

  private async trimOldest(table: string, schema: CapTableSchema, count: number): Promise<void> {
    if (count <= 0) return;
    if (this.sqlAvailable) {
      const t = safeIdent(table);
      const oc = safeIdent(schema.orderColumn);
      const pk = safeIdent(schema.primaryKey);
      // Delete the `count` rows with the smallest order value.
      await this.run(
        `DELETE FROM "${t}" WHERE "${pk}" IN (SELECT "${pk}" FROM "${t}" ORDER BY "${oc}" ASC LIMIT ?);`,
        [count],
      );
    } else {
      const rows = await this.web.allStored(table);
      const ordered = rows
        .slice()
        .sort((a, b) => Number(a[schema.orderColumn] ?? 0) - Number(b[schema.orderColumn] ?? 0));
      for (const victim of ordered.slice(0, count)) await this.web.delete(table, String(victim[schema.primaryKey]));
    }
    this.log('evicted', count, 'rows from', table);
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience
// ---------------------------------------------------------------------------

/** Shared auto-store (separate db name so it can coexist with the doc-store capDb). */
export const capStore = new CapAutoStore();
export const syncTable = (table: string, rows: CapDoc[], options?: CapAutoTableOptions): Promise<string[]> =>
  capStore.insert(table, rows, options);

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/** Live query over an auto-table (re-runs on deps / reload). */
export function useAutoQuery<T extends CapDoc = CapDoc>(
  table: string,
  query: CapQuery = {},
  deps: unknown[] = [],
): { rows: T[]; loading: boolean; reload: () => Promise<void> } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(query);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await capStore.open();
      setRows(await capStore.select<T>(table, query));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { rows, loading, reload };
}

/** Insert helper bound to a table, with a busy flag. */
export function useAutoInsert(table: string, options?: CapAutoTableOptions): {
  insert: (data: CapDoc | CapDoc[]) => Promise<string[]>;
  busy: boolean;
} {
  const [busy, setBusy] = useState(false);
  const insert = useCallback(
    async (data: CapDoc | CapDoc[]) => {
      setBusy(true);
      try {
        await capStore.open();
        return await capStore.insert(table, data, options);
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table],
  );
  return { insert, busy };
}

export default capStore;
