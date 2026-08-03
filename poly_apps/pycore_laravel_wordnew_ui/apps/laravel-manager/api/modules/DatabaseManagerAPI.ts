import { BaseAPI } from '../../../../core/api-libs/laravel/transport/BaseAPI';
import { LARAVEL_API_ROUTE } from '../../../../core/api-libs/laravel/transport/ApiContract';

/**
 * DatabaseManagerAPI
 *
 * One method per endpoint of the shared `/api/dashboard/db-manager` contract.
 * Envelope for every JSON endpoint: { success, data?, message? }.
 *
 * Export / backup download endpoints return a binary file (Blob), not JSON,
 * so they intentionally bypass BaseAPI.request()/get() and use a raw fetch
 * that respects this module's resolved base URL + prefix + auth header, then
 * trigger a browser download via an object URL + anchor click.
 */

export type DbDriver = 'pgsql' | 'sqlite' | 'mysql';
export type ExportFormat = 'csv' | 'json';
export type ImportMode = 'append' | 'replace';

export interface DbConnectionInfo {
  key: string;
  name: string;
  connection: string;
  driver: DbDriver;
  database: string;
  is_main: boolean;
  prefix: string;
}

export interface DbStatus {
  connection: string;
  driver: string;
  database: string;
  reachable: boolean;
  size_bytes: number | null;
  size_human: string;
  table_count: number;
  server_version: string | null;
}

export interface DbTableInfo {
  name: string;
  /** Row count; -1 when the count failed (shown as "unknown"). */
  rows: number;
  is_app_table: boolean;
  /**
   * Best-effort last-write-activity timestamp (pgsql vacuum/analyze stats);
   * null on other drivers or never-touched tables. Used for sorting.
   */
  activity_at: string | null;
}

export interface DbStructureColumn {
  name: string;
  type: string;
  nullable: string;
  /** 'PRI' for primary-key columns, '' otherwise (merged db-viewer shape). */
  key: string;
  default: string | null;
  /** e.g. 'auto_increment', '' otherwise (merged db-viewer shape). */
  extra: string;
}

export interface DbTableDataResponse {
  data: Record<string, unknown>[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface DbImportResult {
  imported: number;
  skipped: number;
}

export interface DbBackup {
  id: string;
  file: string;
  size_bytes: number;
  size_human?: string;
  driver: string;
  connection: string;
  created_at: string;
}

/**
 * Credential snapshot for a connection. `supports_password` is false for
 * file-based drivers (sqlite), in which case `note` explains why the
 * change/reset controls are disabled.
 */
/** One database account (pgsql role / mysql user). host is mysql-only. */
export interface DbAccount {
  name: string;
  super: boolean;
  can_login: boolean;
  host: string | null;
}

export interface DbCredentialInfo {
  connection: string;
  driver: string;
  supports_password: boolean;
  superuser: string | null;
  /** Current working password of the configured account (admin surface); null for sqlite. */
  password: string | null;
  /** Database accounts (pg_roles / mysql.user); empty for sqlite. */
  users: DbAccount[];
  secret_key: string | null;
  note: string;
}

/**
 * Result of POST /credentials/change. `synced` = Laravel persisted the new
 * password to its credential store — only ever true for the configured
 * superuser (`is_configured_account`); other accounts never touch the store.
 */
export interface DbCredentialChangeResult {
  connection: string;
  driver: string;
  user: string;
  is_configured_account: boolean;
  synced: boolean;
  secret_key: string | null;
}

/** Result of POST /credentials/users. `password` is shown ONCE when generated. */
export interface DbAccountCreateResult {
  connection: string;
  driver: string;
  username: string;
  password: string;
  generated: boolean;
}

/**
 * Result of POST /credentials/reset. Same as the change result plus
 * `new_password` — a freshly generated strong password returned ONCE so the
 * operator can record it (it is not retrievable again).
 */
export interface DbCredentialResetResult {
  connection: string;
  driver: string;
  user: string;
  synced: boolean;
  secret_key: string;
  new_password: string;
}

export class DatabaseManagerAPI extends BaseAPI {
  /** GET /connections — all reachable connections (main + sub-apps). */
  async getConnections(): Promise<DbConnectionInfo[]> {
    const res = await this.get<{ connections: DbConnectionInfo[] }>('connections');
    if (!res.success || !res.data) return [];
    return (res.data as { connections: DbConnectionInfo[] }).connections ?? [];
  }

  /** GET /status?connection=K — per-connection driver/size/version snapshot. */
  async getStatus(connection: string): Promise<DbStatus | null> {
    const res = await this.get<DbStatus>('status', { connection });
    if (!res.success || !res.data) return null;
    return res.data as DbStatus;
  }

  /** GET /tables?connection=K — table list with row counts + app-table flag. */
  async getTables(connection: string): Promise<DbTableInfo[]> {
    const res = await this.get<{ tables: DbTableInfo[] }>('tables', { connection });
    if (!res.success || !res.data) return [];
    return (res.data as { tables: DbTableInfo[] }).tables ?? [];
  }

  /** GET /tables/{table}/structure?connection=K — column metadata. */
  async getStructure(table: string, connection: string): Promise<DbStructureColumn[]> {
    const res = await this.get<{ columns: DbStructureColumn[] }>(
      `tables/${encodeURIComponent(table)}/structure`,
      { connection }
    );
    if (!res.success || !res.data) return [];
    return (res.data as { columns: DbStructureColumn[] }).columns ?? [];
  }

  /** GET /tables/{table}/data?connection=K&page&per_page — paginated rows. */
  async getData(
    table: string,
    connection: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<DbTableDataResponse> {
    const res = await this.get<DbTableDataResponse>(
      `tables/${encodeURIComponent(table)}/data`,
      { connection, page, per_page: perPage }
    );
    if (!res.success || !res.data) {
      return { data: [], total: 0, per_page: perPage, current_page: page, last_page: 1 };
    }
    return res.data as DbTableDataResponse;
  }

  /**
   * GET /tables/{table}/export?connection=K&format — triggers a browser file
   * download. Raw fetch (not JSON) so we can stream the Blob and respect the
   * module's auth header + resolved base URL.
   */
  async exportTable(table: string, connection: string, format: ExportFormat): Promise<void> {
    const url = this.addQueryParams(
      this.buildURL(LARAVEL_API_ROUTE.database.exportTable(table)),
      { connection, format }
    );
    const filename = `${connection}_${table}.${format}`;
    await this.downloadBlob(url, filename);
  }

  /**
   * POST /tables/{table}/import (multipart) — import a CSV/JSON file in
   * append or replace mode. Returns counts.
   */
  async importTable(
    table: string,
    connection: string,
    file: File,
    format: ExportFormat,
    mode: ImportMode
  ): Promise<DbImportResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('format', format);
    form.append('mode', mode);
    form.append('connection', connection);

    const res = await this.post<DbImportResult>(
      `tables/${encodeURIComponent(table)}/import`,
      form
    );
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Import failed');
    }
    return res.data as DbImportResult;
  }

  /** POST /backup { connection } — create a backup for the connection. */
  async createBackup(connection: string): Promise<DbBackup> {
    const res = await this.post<{ backup: DbBackup }>('backup', { connection });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Backup failed');
    }
    return (res.data as { backup: DbBackup }).backup;
  }

  /** GET /backups?connection=K — list backups (omit connection = all). */
  async getBackups(connection?: string): Promise<DbBackup[]> {
    const params = connection ? { connection } : undefined;
    const res = await this.get<{ backups: DbBackup[] }>('backups', params);
    if (!res.success || !res.data) return [];
    return (res.data as { backups: DbBackup[] }).backups ?? [];
  }

  /** POST /backups/{id}/restore — restore a backup. */
  async restoreBackup(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await this.post<unknown>(`backups/${encodeURIComponent(id)}/restore`);
    return { success: res.success, message: res.message || res.error || undefined };
  }

  /** DELETE /backups/{id} — delete a backup. */
  async deleteBackup(id: string): Promise<{ success: boolean }> {
    const res = await this.delete<unknown>(`backups/${encodeURIComponent(id)}`);
    return { success: res.success };
  }

  /** GET /backups/{id}/download — trigger a browser download of the backup. */
  async downloadBackup(id: string, filename?: string): Promise<void> {
    const url = this.buildURL(LARAVEL_API_ROUTE.database.downloadBackup(id));
    await this.downloadBlob(url, filename || `backup_${id}`);
  }

  /**
   * GET /credentials?connection=K — credential snapshot for the connection.
   * sqlite returns supports_password=false with an explanatory note.
   */
  async getCredentials(connection: string): Promise<DbCredentialInfo | null> {
    const res = await this.get<DbCredentialInfo>('credentials', { connection });
    if (!res.success || !res.data) return null;
    return res.data as DbCredentialInfo;
  }

  /**
   * POST /credentials/change { connection, new_password, user? } — set a new
   * password for a database account (defaults to the configured superuser,
   * whose change also re-syncs Laravel's own config). `synced` reflects
   * whether the persist succeeded (always false for non-configured accounts).
   */
  async changePassword(
    connection: string,
    newPassword: string,
    user?: string
  ): Promise<DbCredentialChangeResult> {
    const res = await this.post<DbCredentialChangeResult>('credentials/change', {
      connection,
      new_password: newPassword,
      ...(user ? { user } : {})
    });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Password change failed');
    }
    return res.data as DbCredentialChangeResult;
  }

  /**
   * POST /credentials/users { connection, username, password? } — create a
   * database account (pgsql LOGIN role / mysql user@localhost, with privileges
   * on the connection's database). Empty password → a strong one is generated
   * and returned ONCE in the result.
   */
  async createAccount(
    connection: string,
    username: string,
    password?: string
  ): Promise<DbAccountCreateResult> {
    const res = await this.post<DbAccountCreateResult>('credentials/users', {
      connection,
      username,
      ...(password ? { password } : {})
    });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Account creation failed');
    }
    return res.data as DbAccountCreateResult;
  }

  /** DELETE /credentials/users/{username}?connection=K — drop a database account (configured superuser is guarded server-side). */
  async dropAccount(connection: string, username: string): Promise<boolean> {
    const res = await this.delete<{ username: string }>(
      `credentials/users/${encodeURIComponent(username)}?connection=${encodeURIComponent(connection)}`
    );
    if (!res.success) {
      throw new Error(res.error || 'Account drop failed');
    }
    return true;
  }

  /**
   * POST /credentials/reset { connection } — generate a fresh strong password,
   * apply it and re-sync Laravel's credential store. `new_password` is returned
   * ONCE and is not retrievable again.
   */
  async resetPassword(connection: string): Promise<DbCredentialResetResult> {
    const res = await this.post<DbCredentialResetResult>('credentials/reset', { connection });
    if (!res.success || !res.data) {
      throw new Error(res.error || 'Password reset failed');
    }
    return res.data as DbCredentialResetResult;
  }

  /**
   * Shared raw-fetch download helper. Streams the response as a Blob, builds an
   * object URL, clicks a temporary anchor and cleans up. Honors the module's
   * Authorization / global headers so loopback-bypass and bearer auth both work.
   */
  private async downloadBlob(url: string, filename: string): Promise<void> {
    const response = await this.rawRequest(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Download failed (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(objectUrl);
  }
}

/**
 * AuthDebugAPI
 *
 * Open (no-auth) probe for the loopback debug bypass. Lives under
 * `/api/dashboard/auth`. When debug_mode is true (loopback request) the app
 * treats the user as authenticated and never shows the login modal.
 */
export interface AuthDebugStatus {
  debug_mode: boolean;
  login_required: boolean;
  reason: 'loopback' | 'remote' | 'disabled';
  client_ip: string;
}

export class AuthDebugAPI extends BaseAPI {
  /**
   * GET /debug-status (no auth) — loopback debug-bypass probe.
   *
   * The probe follows the same selected endpoint as every Laravel Manager API.
   */
  async getDebugStatus(): Promise<AuthDebugStatus | null> {
    const res = await this.get<AuthDebugStatus>('debug-status', undefined, false, 0, false);
    if (!res.success || !res.data) return null;
    return res.data as AuthDebugStatus;
  }
}
