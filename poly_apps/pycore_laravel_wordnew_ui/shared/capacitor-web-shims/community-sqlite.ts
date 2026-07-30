/**
 * Web shim for @capacitor-community/sqlite.
 *
 * The community SQLite plugin's WEB implementation requires the heavyweight
 * `jeep-sqlite` custom element + a sql.js WASM build to be registered by the
 * host app. The pycore_laravel_wordnew_ui web shell does NOT ship that, so on
 * web the CapDatabase library uses IndexedDB directly instead of SQL.
 *
 * This shim therefore only needs to make the import RESOLVE on the web build and
 * to report "SQL not available on web" — CapDatabase guards every SQL call behind
 * that flag and never instantiates these stubs on web. Aliased in vite.config.ts.
 *
 * AVAILABILITY: SQL backend = native only (here). Web = IndexedDB document store
 * (see shared/capabilities/CapDatabase.ts). Primarily for the wordnew mobile APP.
 */

const NOT_AVAILABLE = 'SQLite SQL backend is not available on web (no jeep-sqlite). Use the document API.';

export class SQLiteDBConnection {
  async open(): Promise<void> {
    throw new Error(NOT_AVAILABLE);
  }
  async close(): Promise<void> {
    /* no-op */
  }
  async execute(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
  async query(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
  async run(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
  async executeSet(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
  async beginTransaction(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
  async commitTransaction(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
  async rollbackTransaction(): Promise<any> {
    throw new Error(NOT_AVAILABLE);
  }
}

export class SQLiteConnection {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_plugin?: unknown) {}
  async initWebStore(): Promise<void> {
    throw new Error(NOT_AVAILABLE);
  }
  async saveToStore(): Promise<void> {
    /* no-op */
  }
  async checkConnectionsConsistency(): Promise<{ result: boolean }> {
    return { result: false };
  }
  async isConnection(): Promise<{ result: boolean }> {
    return { result: false };
  }
  async createConnection(): Promise<SQLiteDBConnection> {
    return new SQLiteDBConnection();
  }
  async retrieveConnection(): Promise<SQLiteDBConnection> {
    return new SQLiteDBConnection();
  }
  async closeConnection(): Promise<void> {
    /* no-op */
  }
  async isInConfigEncryption(): Promise<{ result: boolean }> {
    return { result: false };
  }
}

export const CapacitorSQLite = {
  /** Marker the library reads to detect the web stub. */
  __isWebStub: true,
};

export default { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection };
