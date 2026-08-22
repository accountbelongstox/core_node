/** Schema inference, normalization, and SQL value conversion. */
import type { CapDoc } from './CapDatabase';
import { stableIdentifier } from '../utils/stableHash';
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

export function safeIdent(name: string): string {
  return stableIdentifier(name, 'column');
}

export function genId(): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rnd}`;
}

/** Pick a sensible eviction-order column: a timestamp column, else the pk. */
export function pickOrderColumn(columns: CapTableColumns, pk: string): string {
  const tsCol = Object.keys(columns).find((c) => columns[c] === 'timestamp');
  if (tsCol) return tsCol;
  for (const guess of ['ts', 'time', 'timestamp', 'created_at', 'updated_at']) {
    if (guess in columns) return guess;
  }
  return pk;
}

/** Canonicalize a row's values for storage (timestamp→ms, leave json/bool/num as-is). */
export function canonicalize(row: CapDoc, columns: CapTableColumns): CapDoc {
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

export function sqlSerialize(value: unknown, type: CapColType): unknown {
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

export function sqlDeserialize(value: unknown, type: CapColType): unknown {
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

export function indexableColumns(columns: CapTableColumns, pk: string, extra: string[] = [], order?: string): string[] {
  const out = new Set<string>();
  const consider = (c?: string): void => {
    if (c && c !== pk && columns[c] && columns[c] !== 'json') out.add(c);
  };
  if (order) consider(order);
  for (const c of extra) consider(c);
  for (const c of Object.keys(columns)) if (ID_ISH_RE.test(c)) consider(c);
  return Array.from(out).slice(0, 8);
}

