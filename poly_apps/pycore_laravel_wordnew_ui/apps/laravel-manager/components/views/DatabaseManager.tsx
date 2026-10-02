import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';
import {
  api, DbConnectionInfo, DbStatus, DbTableInfo, DbStructureColumn,
  DbTableDataResponse, ExportFormat, ImportMode, DbBackup,
  DbCredentialInfo, DbAccountCreateResult, DatabaseManagerApiError,
} from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../admin/Modal';
import { useToast } from '../admin';
import {
  LoadingBlock, InlineSpinner, AlertBox, EmptyState, StatusBadge, Field, CopyButton,
} from '../common';
import type { StatusTone } from '../common';
import { CenteredPage, CenteredTabBar, PageHeader } from '@/apps/laravel-manager/components/common/CenteredPageLayout';
import { useApiResource } from '@/apps/laravel-manager/hooks';
import {
  DatabaseZap, Layers, RefreshCw, ChevronLeft, ChevronRight, Search,
  ArrowUp, ArrowDown, ArrowUpDown, Columns3, Table2, Clock3,
  Maximize2, Minimize2, Download, Upload, Save, RotateCcw,
  Trash2, HardDrive, KeyRound, ShieldAlert, Eye, EyeOff, Users, UserPlus, Server,
} from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import { logInfo, logSuccess, logError } from '@/core/logstore/logStore';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { Trans, useTranslation } from '@/apps/laravel-manager/i18n';
import { DataSyncTab } from './database-manager/DataSyncTab';
import { findDbTableActions, type DbTableRowActionsProps } from './database-manager/DbTableActions';

const DEFAULT_PER_PAGE = 1000;
const MAX_PER_PAGE = 5000;
const SCHEMA_FIELDS = ['name', 'type', 'nullable', 'key', 'default', 'extra'] as const;
const BACKUP_COLUMNS = ['col_file', 'col_driver', 'col_connection', 'col_size', 'col_created', 'col_actions'] as const;
const BOLD = { strong: <strong /> };
const BOLD_MONO = { strong: <strong />, mono: <strong className="font-mono" /> };

/** The server's message when it sent one, otherwise the localized fallback. */
function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Localized download failure: the HTTP status when the server answered, else the network message. */
function downloadErrorText(error: unknown, t: TFunction): string {
  if (error instanceof DatabaseManagerApiError && error.status > 0) {
    return t('db_manager.download_failed_status', { status: error.status });
  }
  return errorText(error, t('db_manager.download_failed'));
}

/** Semantic tone for a driver name (driver words don't auto-map, so override). */
function driverTone(driver: string): StatusTone {
  switch (driver) {
    case 'pgsql':
      return 'info';
    case 'mysql':
      return 'warning';
    case 'sqlite':
      return 'success';
    default:
      return 'info';
  }
}

/** Schema grid (absorbed the former DatabaseViewer's richer columns). Fills its
 *  parent and scrolls internally with a sticky header. */
const SchemaTable: React.FC<{ columns: DbStructureColumn[] }> = ({ columns }) => {
  const { t } = useTranslation();
  if (!columns.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 p-3">{t('db_manager.tables.no_columns')}</p>;
  }
  const headers = SCHEMA_FIELDS;
  return (
    <div className="h-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
              >
                {t(`db_manager.schema.${h}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((col, i) => (
            <tr
              key={i}
              className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              {headers.map((h) => {
                const raw = String((col as unknown as Record<string, unknown>)[h] ?? '');
                return (
                  <td
                    key={h}
                    className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate"
                    title={raw}
                  >
                    {h === 'key' && raw === 'PRI' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <KeyRound className="w-3 h-3" />
                        PRI
                      </span>
                    ) : h === 'name' ? (
                      <span className="font-mono text-[13px]">{raw}</span>
                    ) : (
                      raw
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Data grid (absorbed from the former DatabaseViewer). Fills its parent and
 *  scrolls internally (both axes) with a sticky header — built for 1000-row pages. */
const DataGrid: React.FC<{
  columns: { name: string }[];
  rows: Record<string, unknown>[];
  /** Table-specific row actions (leading column) from the table-action registry. */
  RowActions?: React.ComponentType<DbTableRowActionsProps>;
  actionsLabel?: string;
}> = ({ columns, rows, RowActions, actionsLabel }) => {
  const { t } = useTranslation();
  const keys = columns.map((c) => c.name);
  if (!keys.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 p-3">{t('db_manager.tables.no_columns')}</p>;
  }
  return (
    <div className="h-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            {RowActions && (
              <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap border-b border-slate-200 dark:border-slate-700">
                {actionsLabel}
              </th>
            )}
            {keys.map((k) => (
              <th
                key={k}
                className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap border-b border-slate-200 dark:border-slate-700"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={keys.length + (RowActions ? 1 : 0)} className="px-3 py-4 text-center text-slate-500">
                {t('db_manager.tables.no_rows')}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className={`border-t border-slate-100 dark:border-slate-700/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 ${
                  i % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''
                }`}
              >
                {RowActions && (
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <RowActions row={row} />
                  </td>
                )}
                {keys.map((k) => (
                  <td
                    key={k}
                    className="px-3 py-1.5 text-slate-700 dark:text-slate-300 max-w-xs truncate"
                    title={String(row[k] ?? '')}
                  >
                    {row[k] === null || row[k] === undefined ? (
                      <span className="text-slate-400 dark:text-slate-500 italic">null</span>
                    ) : (
                      String(row[k])
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const PaginationBar: React.FC<{
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ currentPage, lastPage, total, perPage, onPrev, onNext }) => {
  const { t } = useTranslation();
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);
  return (
    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
      <span>
        {t('db_manager.tables.range', { from, to, total })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1`}
        >
          <ChevronLeft className="w-4 h-4" />
          {t('db_manager.tables.prev')}
        </button>
        <span>
          {t('db_manager.tables.page_of', { page: currentPage, last: lastPage || 1 })}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= lastPage}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1`}
        >
          {t('db_manager.tables.next')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5 text-sm">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{value}</span>
  </div>
);

// ──────────────────────────── Status strip ────────────────────────────
// Former standalone Status tab, condensed to one card row rendered above the
// table browser (Status + Tables are now ONE tab).
const StatusStrip: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const { t } = useTranslation();
  const { data: status, loading, refresh: load } = useApiResource<DbStatus>(
    () => api.databaseManager.getStatus(connection.key),
    { deps: [connection.key] }
  );

  const item = (label: string, value: React.ReactNode) => (
    <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span className="text-slate-400 dark:text-slate-500 text-xs">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  );

  return (
    <div className={`${commonClasses.card} px-4 py-2.5 flex items-center gap-x-5 gap-y-1 flex-wrap`}>
      <div className="flex items-center gap-2 min-w-0">
        <Server className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{connection.name}</span>
        <StatusBadge status={connection.driver} tone={driverTone(connection.driver)} withDot={false} />
      </div>
      {loading ? (
        <span className="flex items-center gap-2 text-slate-400 text-sm">
          <InlineSpinner size={14} />
          {t('db_manager.status.loading')}
        </span>
      ) : !status ? (
        <span className="text-sm text-red-600 dark:text-red-400">{t('db_manager.status.unavailable')}</span>
      ) : (
        <>
          {item(t('db_manager.status.database'), status.database)}
          <StatusBadge
            status={t(status.reachable ? 'db_manager.status.reachable' : 'db_manager.status.unreachable')}
            tone={status.reachable ? 'success' : 'error'}
            withDot={false}
          />
          {item(t('db_manager.status.size'), status.size_human)}
          {item(t('db_manager.status.tables'), status.table_count)}
          {status.server_version && item(t('db_manager.status.server'), status.server_version)}
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 dark:text-slate-500 text-xs">{t('db_manager.status.backup_via')}</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {backupMechanism(status.driver)}
            </span>
          </span>
        </>
      )}
      <span className="flex-1" />
      <button
        type="button"
        onClick={load}
        title={t('db_manager.status.refresh')}
        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─────────────────────────────── Tables tab ───────────────────────────────
type TableSortKey = 'name' | 'rows' | 'activity';

const fmtRows = (n: number, unknownLabel: string): string => (n < 0 ? unknownLabel : n.toLocaleString());

/** Short local timestamp for the best-effort activity time; em-dash when unknown. */
const fmtActivity = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TablesTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const { t } = useTranslation();
  const [tables, setTables] = useState<DbTableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [structure, setStructure] = useState<DbStructureColumn[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  // null = no failure; '' = failed without a server message.
  const [structureError, setStructureError] = useState<string | null>(null);
  const [data, setData] = useState<DbTableDataResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<TableSortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [rightTab, setRightTab] = useState<'structure' | 'data'>('structure');
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [perPageDraft, setPerPageDraft] = useState(String(DEFAULT_PER_PAGE));
  /** Fullscreen applies ONLY to the structure/data viewer card (not the page). */
  const [isFull, setIsFull] = useState(false);

  // Esc leaves the region fullscreen.
  useEffect(() => {
    if (!isFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFull]);

  // Only the newest table-list request may apply (connection switches and refreshes race).
  const tablesRequestRef = useRef(0);
  const loadTables = useCallback(() => {
    const request = ++tablesRequestRef.current;
    const isLatest = () => request === tablesRequestRef.current;
    setLoading(true);
    setError(null);
    api.databaseManager
      .getTables(connection.key)
      .then((list) => {
        if (!isLatest()) return;
        setTables(list);
        setSelected((prev) => (prev && list.some((t) => t.name === prev) ? prev : list[0]?.name ?? null));
      })
      .catch((e) => {
        if (!isLatest()) return;
        setTables([]);
        setError(errorText(e, t('db_manager.tables.load_failed')));
      })
      .finally(() => {
        if (isLatest()) setLoading(false);
      });
  }, [connection.key, t]);

  // Reset selection when switching connection, then (re)load.
  useEffect(() => {
    setSelected(null);
    setPage(1);
    loadTables();
  }, [loadTables]);

  // A new table never shows the previous table's columns or rows.
  useEffect(() => {
    setStructure([]);
    setStructureError(null);
    setData(null);
    setDataError(null);
    if (!selected) return;
    let cancelled = false;
    setStructureLoading(true);
    api.databaseManager
      .getStructure(selected, connection.key)
      .then((cols) => {
        if (!cancelled) setStructure(cols);
      })
      .catch((e: unknown) => {
        if (!cancelled) setStructureError(e instanceof Error ? e.message : '');
      })
      .finally(() => {
        if (!cancelled) setStructureLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, connection.key]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDataLoading(true);
    setDataError(null);
    api.databaseManager
      .getData(selected, connection.key, page, perPage)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setData(null);
        setDataError(e instanceof Error ? e.message : '');
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, connection.key, page, perPage]);

  // Filtered + sorted list for the sidebar. Sorting is pure-frontend: the
  // full table list is already loaded, so no extra requests per sort click.
  const visibleTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? tables.filter((t) => t.name.toLowerCase().includes(q)) : [...tables];
    const dir = sortAsc ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortKey === 'rows') return (a.rows - b.rows) * dir;
      if (sortKey === 'activity') {
        const ta = a.activity_at ? Date.parse(a.activity_at) : 0;
        const tb = b.activity_at ? Date.parse(b.activity_at) : 0;
        if (ta !== tb) return (ta - tb) * dir;
        return a.name.localeCompare(b.name); // stable tiebreaker
      }
      return a.name.localeCompare(b.name) * dir;
    });
    return filtered;
  }, [tables, query, sortKey, sortAsc]);

  /** Click on the active key flips direction; a new key starts with its natural one. */
  const toggleSort = (key: TableSortKey) => {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name'); // rows/activity start descending (biggest/newest first)
    }
  };

  const commitPerPage = () => {
    const n = parseInt(perPageDraft, 10);
    const next = Number.isFinite(n) ? Math.max(1, Math.min(MAX_PER_PAGE, n)) : DEFAULT_PER_PAGE;
    setPerPageDraft(String(next));
    if (next !== perPage) {
      setPerPage(next);
      setPage(1);
    }
  };

  const selectedInfo = selected ? tables.find((t) => t.name === selected) ?? null : null;
  const tableActions = useMemo(() => findDbTableActions(selected), [selected]);

  const sortButton = (key: TableSortKey, label: string) => {
    const active = sortKey === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleSort(key)}
        title={t('db_manager.tables.sort_by', { label })}
        className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium transition-colors ${
          active
            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        {label}
        {active ? (
          sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    );
  };

  if (loading) {
    return <LoadingBlock label={t('db_manager.tables.loading')} />;
  }

  if (error) {
    return (
      <div className="py-4">
        <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button
          type="button"
          onClick={loadTables}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:h-[calc(100vh-360px)] lg:min-h-[440px]">
      {/* ───────── left: table list with search + sort ───────── */}
      <div className={`${commonClasses.card} w-full lg:w-72 flex-shrink-0 flex flex-col overflow-hidden max-h-64 lg:max-h-none`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>
            {t('db_manager.tables.title')}{' '}
            <span className="text-xs font-normal text-slate-400">
              {query ? `${visibleTables.length}/${tables.length}` : tables.length}
            </span>
          </span>
          <button type="button" onClick={loadTables} title={t('common.refresh')}>
            <RefreshCw className="w-4 h-4 text-slate-500 hover:text-indigo-600" />
          </button>
        </div>
        <div className="px-3 pt-2 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('db_manager.tables.filter_placeholder')}
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            />
          </div>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            {sortButton('name', t('db_manager.tables.sort_name'))}
            {sortButton('rows', t('db_manager.tables.sort_rows'))}
            {sortButton('activity', t('db_manager.tables.sort_time'))}
          </div>
        </div>
        <div className="flex-1 overflow-auto border-t border-slate-100 dark:border-slate-700/50">
          {visibleTables.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">{t(query ? 'db_manager.tables.no_matching' : 'db_manager.tables.none')}</p>
          ) : (
            visibleTables.map((row) => (
              <button
                key={row.name}
                type="button"
                onClick={() => {
                  setSelected(row.name);
                  setPage(1);
                }}
                className={`w-full text-left px-4 py-2 text-sm border-b border-slate-100 dark:border-slate-700/50 transition-colors ${
                  selected === row.name
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
                    : 'border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
                title={row.name}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate font-mono text-[13px] ${
                      selected === row.name
                        ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.name}
                  </span>
                  <StatusBadge
                    status={t(row.is_app_table ? 'db_manager.tables.badge_app' : 'db_manager.tables.badge_main')}
                    tone={row.is_app_table ? 'info' : 'success'}
                    withDot={false}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{t('db_manager.tables.rows', { rows: fmtRows(row.rows, t('db_manager.tables.rows_unknown')) })}</span>
                  {row.activity_at && (
                    <span className="flex items-center gap-1" title={t('db_manager.tables.last_activity', { time: fmtActivity(row.activity_at) })}>
                      <Clock3 className="w-3 h-3" />
                      {fmtActivity(row.activity_at)}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ───────── right: Structure / Data as switchable tabs ───────── */}
      {(() => {
        const viewerInner = !selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
            {t('db_manager.tables.select_table')}
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Table2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                  {selected}
                </span>
                {selectedInfo && (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {t('db_manager.tables.rows', { rows: fmtRows(selectedInfo.rows, t('db_manager.tables.rows_unknown')) })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setRightTab('structure')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      rightTab === 'structure'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Columns3 className="w-4 h-4" />
                    {t('db_manager.tables.structure')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab('data')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      rightTab === 'data'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Table2 className="w-4 h-4" />
                    {t('db_manager.tables.data')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFull((v) => !v)}
                  title={t(isFull ? 'db_manager.tables.fullscreen_exit' : 'db_manager.tables.fullscreen_enter')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {isFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {rightTab === 'structure' ? (
              <div className="flex-1 min-h-0 p-4">
                {structureLoading ? (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                    <InlineSpinner />
                    {t('db_manager.loading')}
                  </div>
                ) : structureError !== null ? (
                  <AlertBox variant="error">{structureError || t('db_manager.viewer.structure_failed')}</AlertBox>
                ) : (
                  <SchemaTable columns={structure} />
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {t('db_manager.tables.rows_per_page')}
                    <input
                      type="number"
                      min={1}
                      max={MAX_PER_PAGE}
                      value={perPageDraft}
                      onChange={(e) => setPerPageDraft(e.target.value)}
                      onBlur={commitPerPage}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-24 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                    />
                    <span className="text-slate-400">{t('db_manager.tables.max_per_page', { max: MAX_PER_PAGE })}</span>
                  </label>
                  {data && (
                    <PaginationBar
                      currentPage={data.current_page}
                      lastPage={data.last_page}
                      total={data.total}
                      perPage={data.per_page}
                      onPrev={() => setPage((p) => Math.max(1, p - 1))}
                      onNext={() => setPage((p) => Math.min(data.last_page, p + 1))}
                    />
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  {dataLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                      <InlineSpinner />
                      {t('db_manager.loading')}
                    </div>
                  ) : dataError !== null ? (
                    <AlertBox variant="error">{dataError || t('db_manager.viewer.data_failed')}</AlertBox>
                  ) : data ? (
                    <DataGrid
                      columns={structure.length ? structure : []}
                      rows={data.data}
                      RowActions={tableActions?.RowActions}
                      actionsLabel={t('db_manager.row_actions')}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </>
        );

        if (isFull) {
          // Region-only fullscreen: the viewer card floats over the viewport
          // via the shared Portal/OVERLAY_Z framework; the page keeps a
          // placeholder so the layout doesn't collapse. Esc or ⤡ returns.
          return (
            <>
              <div
                className={`${commonClasses.card} flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500`}
              >
                {t('db_manager.tables.fullscreen_placeholder')}
              </div>
              <Portal>
                <div className={`fixed inset-0 ${OVERLAY_Z.modal} bg-slate-100 dark:bg-slate-950 p-3 flex flex-col`}>
                  <div className={`${commonClasses.card} flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden`}>
                    {viewerInner}
                  </div>
                </div>
              </Portal>
            </>
          );
        }

        return (
          <div className={`${commonClasses.card} flex-1 flex flex-col min-w-0 overflow-hidden min-h-[420px] lg:min-h-0`}>
            {viewerInner}
          </div>
        );
      })()}
    </div>
  );
};

// ────────────────────────────── Import/Export tab ──────────────────────────────

const ImportExportTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [table, setTable] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [importFormat, setImportFormat] = useState<ExportFormat>('csv');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);

  const { data: tables, loading } = useApiResource<DbTableInfo[]>(
    () => api.databaseManager.getTables(connection.key),
    {
      deps: [connection.key],
      initialData: [],
      onSuccess: (list) =>
        setTable((prev) => (prev && list.some((row) => row.name === prev) ? prev : list[0]?.name ?? ''))
    }
  );
  const tableList = tables ?? [];
  const modeLabel = t(importMode === 'replace' ? 'db_manager.io.mode_replace' : 'db_manager.io.mode_append');

  const handleExport = async () => {
    if (!table) return;
    setBusy(true);
    // Export downloads via raw fetch (binary), so it bypasses the automatic
    // BaseAPI request logging — log the operation explicitly.
    logInfo('db-manager', `Export ${connection.key}.${table} as ${exportFormat.toUpperCase()}…`);
    try {
      await api.databaseManager.exportTable(table, connection.key, exportFormat);
      logSuccess('db-manager', `Export ${connection.key}.${table} done`);
      toast.success(t('db_manager.io.exported', { table, format: exportFormat.toUpperCase() }));
    } catch (e) {
      const msg = downloadErrorText(e, t);
      logError('db-manager', `Export ${connection.key}.${table} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!table || !file) return;
    setBusy(true);
    setConfirmImport(false);
    logInfo('db-manager', `Import ${file.name} → ${connection.key}.${table} (${importFormat}, ${importMode})…`);
    try {
      const result = await api.databaseManager.importTable(
        table,
        connection.key,
        file,
        importFormat,
        importMode
      );
      logSuccess('db-manager', `Import ${connection.key}.${table}: ${result.imported} imported, ${result.skipped} skipped`);
      toast.success(t('db_manager.io.imported', { imported: result.imported, skipped: result.skipped }));
      setFile(null);
    } catch (e) {
      const msg = errorText(e, t('db_manager.io.import_failed'));
      logError('db-manager', `Import ${connection.key}.${table} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label={t('db_manager.tables.loading')} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Export */}
      <div className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('db_manager.io.export_title')}</h3>
        </div>
        <Field label={t('db_manager.io.table')}>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className={`${commonClasses.select} w-full`}
          >
            {tableList.map((row) => (
              <option key={row.name} value={row.name}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('db_manager.io.format')}>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            className={`${commonClasses.select} w-full`}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </Field>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy || !table}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
        >
          <Download className="w-4 h-4" />
          {t('db_manager.io.download')}
        </button>
      </div>

      {/* Import */}
      <div className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('db_manager.io.import_title')}</h3>
        </div>
        <Field label={t('db_manager.io.table')}>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className={`${commonClasses.select} w-full`}
          >
            {tableList.map((row) => (
              <option key={row.name} value={row.name}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('db_manager.io.format')}>
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as ExportFormat)}
              className={`${commonClasses.select} w-full`}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </Field>
          <Field label={t('db_manager.io.mode')}>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className={`${commonClasses.select} w-full`}
            >
              <option value="append">{t('db_manager.io.mode_append')}</option>
              <option value="replace">{t('db_manager.io.mode_replace')}</option>
            </select>
          </Field>
        </div>
        <Field label={t('db_manager.io.file')}>
          <input
            type="file"
            accept={importFormat === 'csv' ? '.csv' : '.json'}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${commonClasses.input} w-full`}
          />
        </Field>
        <button
          type="button"
          onClick={() => setConfirmImport(true)}
          disabled={busy || !table || !file}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
        >
          <Upload className="w-4 h-4" />
          {t('db_manager.io.import')}
        </button>
      </div>

      <Modal
        isOpen={confirmImport}
        onClose={() => setConfirmImport(false)}
        title={t('db_manager.io.confirm_title')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmImport(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={runImport}
              className={`${commonClasses.button} ${
                importMode === 'replace'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : commonClasses.buttonPrimary
              }`}
            >
              {t(importMode === 'replace' ? 'db_manager.io.replace_and_import' : 'db_manager.io.import')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <Trans
            i18nKey="db_manager.io.confirm_body"
            values={{ file: file?.name ?? '', format: importFormat.toUpperCase(), table, connection: connection.name, mode: modeLabel }}
            components={BOLD}
          />
          {importMode === 'replace' && (
            <span className="block mt-2 text-red-600 dark:text-red-400">
              {t('db_manager.io.replace_warning')}
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Backup tab ───────────────────────────────

function backupMechanism(driver: string): string {
  switch (driver) {
    case 'pgsql':
      return 'pg_dump';
    case 'mysql':
      return 'mysqldump';
    case 'sqlite':
      return 'file-copy';
    default:
      return driver;
  }
}

const BackupTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DbBackup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbBackup | null>(null);

  const { data: backupsData, loading, refresh: load } = useApiResource<DbBackup[]>(
    () => api.databaseManager.getBackups(connection.key),
    { deps: [connection.key], initialData: [] }
  );
  const backups = backupsData ?? [];

  const handleCreate = async () => {
    setBusy(true);
    logInfo('db-manager', `Creating backup of ${connection.key} via ${backupMechanism(connection.driver)}…`);
    try {
      await api.databaseManager.createBackup(connection.key);
      logSuccess('db-manager', `Backup of ${connection.key} created`);
      toast.success(t('db_manager.backup.created', { mechanism: backupMechanism(connection.driver) }));
      load();
    } catch (e) {
      const msg = errorText(e, t('db_manager.backup.create_failed'));
      logError('db-manager', `Backup of ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setBusy(true);
    logInfo('db-manager', `Restoring backup ${target.file}…`);
    try {
      const res = await api.databaseManager.restoreBackup(target.id);
      if (res.success) {
        logSuccess('db-manager', `Restore of ${target.file} done`);
        toast.success(res.message || t('db_manager.backup.restored'));
      } else {
        logError('db-manager', `Restore of ${target.file} failed — ${res.message || 'unknown error'}`);
        toast.error(res.message || t('db_manager.backup.restore_failed'));
      }
    } catch (e) {
      const msg = errorText(e, t('db_manager.backup.restore_failed'));
      logError('db-manager', `Restore of ${target.file} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusy(true);
    try {
      const res = await api.databaseManager.deleteBackup(target.id);
      if (res.success) {
        logSuccess('db-manager', `Backup ${target.file} deleted`);
        toast.success(t('db_manager.backup.deleted'));
        load();
      } else {
        logError('db-manager', `Delete of backup ${target.file} failed`);
        toast.error(t('db_manager.backup.delete_failed'));
      }
    } catch (e) {
      const msg = errorText(e, t('db_manager.backup.delete_failed'));
      logError('db-manager', `Delete of backup ${target.file} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (b: DbBackup) => {
    // Raw-fetch binary download — bypasses BaseAPI logging, log explicitly.
    logInfo('db-manager', `Downloading backup ${b.file}…`);
    try {
      await api.databaseManager.downloadBackup(b.id, b.file);
      logSuccess('db-manager', `Download of ${b.file} started`);
    } catch (e) {
      const msg = downloadErrorText(e, t);
      logError('db-manager', `Download of ${b.file} failed — ${msg}`);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Trans i18nKey="db_manager.backup.mechanism_for" values={{ connection: connection.name }} components={BOLD} />{' '}
          <StatusBadge
            status={backupMechanism(connection.driver)}
            tone={driverTone(connection.driver)}
            withDot={false}
          />
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            {t('db_manager.backup.create')}
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label={t('db_manager.backup.loading')} />
      ) : backups.length === 0 ? (
        <div className={commonClasses.card}>
          <EmptyState icon={Save} message={t('db_manager.backup.empty')} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-700/50">
                {BACKUP_COLUMNS.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t(`db_manager.backup.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate" title={b.file}>
                    {b.file}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={b.driver} tone={driverTone(b.driver)} withDot={false} />
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{b.connection}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {b.size_human ?? t('db_manager.backup.size_bytes', { bytes: b.size_bytes })}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{b.created_at}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title={t('db_manager.backup.restore')}
                        onClick={() => setRestoreTarget(b)}
                        disabled={busy}
                        className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title={t('db_manager.backup.download')}
                        onClick={() => handleDownload(b)}
                        className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title={t('db_manager.backup.delete')}
                        onClick={() => setDeleteTarget(b)}
                        disabled={busy}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Restore confirm */}
      <Modal
        isOpen={restoreTarget !== null}
        onClose={() => setRestoreTarget(null)}
        title={t('db_manager.backup.restore_title')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setRestoreTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className={`${commonClasses.button} bg-amber-600 hover:bg-amber-700 text-white`}
            >
              {t('db_manager.backup.restore')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <Trans
            i18nKey="db_manager.backup.restore_confirm"
            values={{ file: restoreTarget?.file ?? '', connection: connection.name }}
            components={BOLD}
          />
          <span className="block mt-2 text-red-600 dark:text-red-400">
            {t('db_manager.backup.restore_warning')}
          </span>
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('db_manager.backup.delete_title')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white`}
            >
              {t('db_manager.backup.delete')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <Trans i18nKey="db_manager.backup.delete_confirm" values={{ file: deleteTarget?.file ?? '' }} components={BOLD} />
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Credentials tab ───────────────────────────────

const CredentialsTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Change-password modal state. changeTarget = which account (defaults to
  // the configured superuser when opened from the action card).
  const [showChange, setShowChange] = useState(false);
  const [changeTarget, setChangeTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset-password modal state.
  const [showReset, setShowReset] = useState(false);
  // The freshly generated password, shown ONCE after a successful reset.
  const [generated, setGenerated] = useState<string | null>(null);
  const [generatedSynced, setGeneratedSynced] = useState<boolean>(true);

  // Current-password reveal (identity card).
  const [showPassword, setShowPassword] = useState(false);

  // Add-account modal state; createdAccount holds the one-time password result.
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [createdAccount, setCreatedAccount] = useState<DbAccountCreateResult | null>(null);

  // Drop-account confirm.
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const { data: info, loading, refresh: load } = useApiResource<DbCredentialInfo>(
    () => api.databaseManager.getCredentials(connection.key),
    { deps: [connection.key] }
  );

  const supported = !!info?.supports_password;

  const resetChangeForm = () => {
    setNewPassword('');
    setConfirmPassword('');
  };

  const runChange = async () => {
    if (!newPassword || newPassword !== confirmPassword) return;
    const targetUser = changeTarget ?? info?.superuser ?? undefined;
    setBusy(true);
    logInfo('db-manager', `Changing DB password for ${targetUser ?? 'superuser'}@${connection.key}…`);
    try {
      const res = await api.databaseManager.changePassword(connection.key, newPassword, targetUser);
      setShowChange(false);
      resetChangeForm();
      if (res.is_configured_account) {
        if (res.synced) {
          logSuccess('db-manager', `Password for ${res.user}@${connection.key} changed & synced`);
          toast.success(t('db_manager.credentials.change_success'));
        } else {
          logError('db-manager', `Password for ${res.user}@${connection.key} changed but NOT synced to Laravel config`);
          toast.error(t('db_manager.credentials.change_not_synced'));
        }
      } else {
        logSuccess('db-manager', `Password for account ${res.user}@${connection.key} changed`);
        toast.success(t('db_manager.credentials.changed_for', { user: res.user }));
      }
      load();
    } catch (e) {
      const msg = errorText(e, t('db_manager.credentials.change_failed'));
      logError('db-manager', `Password change for ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runAddUser = async () => {
    const username = addUsername.trim();
    if (!username) return;
    setBusy(true);
    logInfo('db-manager', `Creating DB account ${username}@${connection.key}…`);
    try {
      const res = await api.databaseManager.createAccount(
        connection.key,
        username,
        addPassword || undefined
      );
      setShowAddUser(false);
      setAddUsername('');
      setAddPassword('');
      if (res.generated) {
        // Generated password is shown once in a dedicated modal.
        setCreatedAccount(res);
      }
      logSuccess('db-manager', `Account ${res.username}@${connection.key} created${res.generated ? ' (generated password)' : ''}`);
      toast.success(t('db_manager.credentials.account_created', { user: res.username }));
      load();
    } catch (e) {
      const msg = errorText(e, t('db_manager.credentials.account_create_failed'));
      logError('db-manager', `Create account ${username}@${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runDropUser = async () => {
    if (!dropTarget) return;
    const username = dropTarget;
    setDropTarget(null);
    setBusy(true);
    logInfo('db-manager', `Dropping DB account ${username}@${connection.key}…`);
    try {
      await api.databaseManager.dropAccount(connection.key, username);
      logSuccess('db-manager', `Account ${username}@${connection.key} dropped`);
      toast.success(t('db_manager.credentials.dropped', { user: username }));
      load();
    } catch (e) {
      const msg = errorText(e, t('db_manager.credentials.drop_failed'));
      logError('db-manager', `Drop account ${username}@${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const runReset = async () => {
    setBusy(true);
    setShowReset(false);
    logInfo('db-manager', `Resetting root DB password for ${connection.key}…`);
    try {
      const res = await api.databaseManager.resetPassword(connection.key);
      setGenerated(res.new_password);
      setGeneratedSynced(res.synced);
      if (res.synced) {
        logSuccess('db-manager', `Root password for ${connection.key} reset & synced`);
        toast.success(t('db_manager.credentials.reset_success'));
      } else {
        logError('db-manager', `Root password for ${connection.key} reset but NOT synced to Laravel config`);
        toast.error(t('db_manager.credentials.reset_not_synced'));
      }
      load();
    } catch (e) {
      const msg = errorText(e, t('db_manager.credentials.reset_failed'));
      logError('db-manager', `Root password reset for ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label={t('db_manager.credentials.loading')} />;
  }

  if (!info) {
    return (
      <div className="py-4">
        <p className="text-red-600 dark:text-red-400 mb-3">{t('db_manager.credentials.unavailable')}</p>
        <button
          type="button"
          onClick={load}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className={`${commonClasses.card} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('db_manager.credentials.title')}</h3>
          <StatusBadge status={info.driver} tone={driverTone(info.driver)} withDot={false} className="ml-1" />
        </div>
        <StatRow label={t('db_manager.credentials.connection')} value={info.connection} />
        <StatRow label={t('db_manager.credentials.superuser')} value={info.superuser ?? '—'} />
        {supported && info.password !== null && (
          <StatRow
            label={t('db_manager.credentials.password')}
            value={
              <span className="flex items-center gap-2 font-mono">
                <span className="select-all">
                  {showPassword ? info.password || t('db_manager.credentials.empty_password') : '•'.repeat(Math.min(16, Math.max(8, info.password.length)))}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={t(showPassword ? 'db_manager.credentials.hide_password' : 'db_manager.credentials.show_password')}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <CopyButton text={info.password} label={t('db_manager.credentials.copy')} variant="outline" />
              </span>
            }
          />
        )}
        <StatRow
          label={t('db_manager.credentials.password_auth')}
          value={
            <StatusBadge
              status={t(supported ? 'db_manager.credentials.supported' : 'db_manager.credentials.not_applicable')}
              tone={supported ? 'success' : 'warning'}
              withDot={false}
            />
          }
        />
        {info.secret_key && <StatRow label={t('db_manager.credentials.secret_key')} value={info.secret_key} />}
      </div>

      {/* Re-sync explainer (pgsql/mysql) */}
      {supported ? (
        <AlertBox variant="info" icon={false}>
          <span className="flex gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{t('db_manager.credentials.sync_note')}</span>
          </span>
        </AlertBox>
      ) : (
        <AlertBox variant="warning">
          {info.note || t('db_manager.credentials.no_password_note')}
        </AlertBox>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('db_manager.credentials.change')}</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <Trans
              i18nKey="db_manager.credentials.change_desc_user"
              values={{ user: info.superuser ?? t('db_manager.credentials.the_user') }}
              components={BOLD}
            />
          </p>
          <button
            type="button"
            onClick={() => {
              resetChangeForm();
              setChangeTarget(info.superuser);
              setShowChange(true);
            }}
            disabled={!supported || busy}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            <KeyRound className="w-4 h-4" />
            {t('db_manager.credentials.change')}
          </button>
        </div>

        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('db_manager.credentials.reset')}</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('db_manager.credentials.reset_desc')}
          </p>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            disabled={!supported || busy}
            className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50`}
          >
            <ShieldAlert className="w-4 h-4" />
            {t('db_manager.credentials.reset')}
          </button>
        </div>
      </div>

      {/* Accounts (driver-aware: pgsql roles / mysql users; sqlite has none) */}
      {supported && (
        <div className={`${commonClasses.card} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('db_manager.credentials.accounts')}</h3>
              <span className="text-xs text-slate-400">
                {t(info.driver === 'pgsql' ? 'db_manager.credentials.pgsql_roles' : 'db_manager.credentials.mysql_users')} ({info.users.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddUsername('');
                setAddPassword('');
                setShowAddUser(true);
              }}
              disabled={busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
            >
              <UserPlus className="w-4 h-4" />
              {t('db_manager.credentials.add_account')}
            </button>
          </div>
          {info.users.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('db_manager.credentials.no_accounts')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">{t('db_manager.credentials.col_account')}</th>
                    {info.driver !== 'pgsql' && (
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">{t('db_manager.credentials.col_host')}</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">{t('db_manager.credentials.col_flags')}</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">{t('db_manager.credentials.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {info.users.map((u) => {
                    const isConfigured = u.name === info.superuser;
                    return (
                      <tr
                        key={`${u.name}@${u.host ?? ''}`}
                        className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-3 py-2 font-mono text-[13px] text-slate-700 dark:text-slate-300">
                          {u.name}
                          {isConfigured && (
                            <StatusBadge status={t('db_manager.credentials.flag_laravel')} tone="info" withDot={false} className="ml-2" />
                          )}
                        </td>
                        {info.driver !== 'pgsql' && (
                          <td className="px-3 py-2 font-mono text-[13px] text-slate-500">{u.host ?? '—'}</td>
                        )}
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            {u.super && <StatusBadge status={t('db_manager.credentials.flag_super')} tone="warning" withDot={false} />}
                            <StatusBadge
                              status={t(u.can_login ? 'db_manager.credentials.flag_login' : 'db_manager.credentials.flag_no_login')}
                              tone={u.can_login ? 'success' : 'error'}
                              withDot={false}
                            />
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              resetChangeForm();
                              setChangeTarget(u.name);
                              setShowChange(true);
                            }}
                            disabled={busy}
                            className="px-2 py-1 text-xs rounded text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
                          >
                            {t('db_manager.credentials.change')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDropTarget(u.name)}
                            disabled={busy || isConfigured}
                            title={isConfigured ? t('db_manager.credentials.drop_blocked') : t('db_manager.credentials.drop_user', { user: u.name })}
                            className="ml-1 px-2 py-1 text-xs rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                          >
                            {t('db_manager.credentials.drop')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Change-password modal */}
      <Modal
        isOpen={showChange}
        onClose={() => {
          setShowChange(false);
          resetChangeForm();
        }}
        title={t('db_manager.credentials.change')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowChange(false);
                resetChangeForm();
              }}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={runChange}
              disabled={!passwordsMatch || busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} disabled:opacity-50`}
            >
              {t('db_manager.credentials.change_and_sync')}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <Trans
              i18nKey="db_manager.credentials.change_for"
              values={{ user: changeTarget ?? info.superuser ?? t('db_manager.credentials.the_user'), connection: connection.name }}
              components={BOLD}
            />{' '}
            {t((changeTarget ?? info.superuser) === info.superuser
              ? 'db_manager.credentials.change_resyncs'
              : 'db_manager.credentials.change_untouched')}
          </p>
          <Field label={t('db_manager.credentials.new_password')}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={`${commonClasses.input} w-full`}
            />
          </Field>
          <Field
            label={t('db_manager.credentials.confirm_password')}
            error={confirmPassword.length > 0 && !passwordsMatch ? t('db_manager.credentials.passwords_no_match') : undefined}
          >
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={`${commonClasses.input} w-full`}
            />
          </Field>
        </div>
      </Modal>

      {/* Reset confirm modal */}
      <Modal
        isOpen={showReset}
        onClose={() => setShowReset(false)}
        title={t('db_manager.credentials.reset')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowReset(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={runReset}
              disabled={busy}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white disabled:opacity-50`}
            >
              {t('db_manager.credentials.reset_and_generate')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <Trans
            i18nKey="db_manager.credentials.reset_for"
            values={{ user: info.superuser ?? t('db_manager.credentials.the_root_user'), connection: connection.name }}
            components={BOLD}
          />
          <span className="block mt-2 text-red-600 dark:text-red-400">
            {t('db_manager.credentials.reset_confirm')}
          </span>
        </p>
      </Modal>

      {/* Generated-password reveal modal (shown once) */}
      <Modal
        isOpen={generated !== null}
        onClose={() => setGenerated(null)}
        title={t('db_manager.credentials.new_password_title')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenerated(null)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              {t('db_manager.credentials.stored_it')}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <AlertBox variant="error">
            <span>{t('db_manager.credentials.store_now_warning')}</span>
          </AlertBox>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-sm break-all select-all">
              {generated}
            </code>
            {generated && <CopyButton text={generated} label={t('db_manager.credentials.copy')} variant="outline" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(generatedSynced ? 'db_manager.credentials.synced_note' : 'db_manager.credentials.not_synced_note')}
          </p>
        </div>
      </Modal>

      {/* Add-account modal */}
      <Modal
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title={t('db_manager.credentials.add_account')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={runAddUser}
              disabled={!addUsername.trim() || busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} disabled:opacity-50`}
            >
              {t('db_manager.credentials.create_account')}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <Trans
              i18nKey={info.driver === 'pgsql' ? 'db_manager.credentials.add_pgsql_desc' : 'db_manager.credentials.add_mysql_desc'}
              values={{ database: connection.database }}
              components={BOLD}
            />
          </p>
          <Field label={t('db_manager.credentials.username')}>
            <input
              type="text"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder={t('db_manager.credentials.username_placeholder')}
              className={`${commonClasses.input} w-full font-mono`}
            />
          </Field>
          <Field label={t('db_manager.credentials.password')} hint={t('db_manager.credentials.password_hint')}>
            <input
              type="password"
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              className={`${commonClasses.input} w-full`}
            />
          </Field>
        </div>
      </Modal>

      {/* Created-account one-time password reveal */}
      <Modal
        isOpen={createdAccount !== null}
        onClose={() => setCreatedAccount(null)}
        title={t('db_manager.credentials.created_title')}
        size="sm"
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setCreatedAccount(null)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              {t('db_manager.credentials.stored_it')}
            </button>
          </div>
        }
      >
        {createdAccount && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <Trans
                i18nKey="db_manager.credentials.created_password"
                values={{ user: createdAccount.username }}
                components={BOLD_MONO}
              />
            </p>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm break-all">
              <span className="flex-1 select-all">{createdAccount.password}</span>
              <CopyButton text={createdAccount.password} label={t('db_manager.credentials.copy')} variant="outline" />
            </div>
          </div>
        )}
      </Modal>

      {/* Drop-account confirm */}
      <Modal
        isOpen={dropTarget !== null}
        onClose={() => setDropTarget(null)}
        title={t('db_manager.credentials.drop_account')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDropTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={runDropUser}
              disabled={busy}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white disabled:opacity-50`}
            >
              {t('db_manager.credentials.drop_account')}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          <Trans
            i18nKey="db_manager.credentials.drop_confirm"
            values={{ user: dropTarget ?? '', connection: connection.name }}
            components={BOLD_MONO}
          />
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Root view ───────────────────────────────
// Status was merged into the Tables tab (compact StatusStrip above the browser).

interface DatabaseManagerProps {
  lang: Language;
}

type TabKey = 'tables' | 'io' | 'backup' | 'sync' | 'credentials';

const DatabaseManager: React.FC<DatabaseManagerProps> = () => {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('tables');
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'tables', label: t('dbSync.tabs.tables') },
    { key: 'io', label: t('dbSync.tabs.io') },
    { key: 'backup', label: t('dbSync.tabs.backup') },
    { key: 'sync', label: t('dbSync.tabs.sync') },
    { key: 'credentials', label: t('dbSync.tabs.credentials') }
  ];

  const {
    data: connectionsData,
    loading,
    error,
    refresh: loadConnections
  } = useApiResource<DbConnectionInfo[]>(() => api.databaseManager.getConnections(), {
    initialData: [],
    onSuccess: (list) =>
      setSelectedKey((prev) => {
        if (prev && list.some((c) => c.key === prev)) return prev;
        const main = list.find((c) => c.is_main);
        return main?.key ?? list[0]?.key ?? '';
      })
  });
  const connections = connectionsData ?? [];

  const selected = useMemo(
    () => connections.find((c) => c.key === selectedKey) ?? null,
    [connections, selectedKey]
  );

  if (loading) {
    return <LoadingBlock full size="lg" label={t('db_manager.loading_connections')} />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 md:p-6">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4 break-words">{error}</p>
          <button
            type="button"
            onClick={loadConnections}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <CenteredPage className="h-full flex flex-col p-3 md:p-6">
      <PageHeader
        title={t('db_manager.title')}
        subtitle={t('db_manager.subtitle')}
        icon={<DatabaseZap className="w-6 h-6 md:w-8 md:h-8 shrink-0 text-indigo-600 dark:text-indigo-400" />}
        wrapActions
        actionsClassName="w-full md:w-auto"
        tight
        actions={
          <>
            <Layers className="w-4 h-4 shrink-0 text-slate-400" />
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              disabled={connections.length === 0}
              aria-label={t('db_manager.connection')}
              title={selected ? `${selected.name} · ${selected.driver}` : t('db_manager.no_connection')}
              className={`${commonClasses.select} flex-1 md:flex-none min-w-0 w-full md:w-auto md:max-w-sm py-1.5 md:py-2 text-sm truncate`}
            >
              {connections.length === 0 && <option value="">{t('db_manager.no_connection')}</option>}
              {connections.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name} {t(c.is_main ? 'db_manager.kind_main' : 'db_manager.kind_app')} · {c.driver}
                </option>
              ))}
            </select>
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-3 md:mb-4">
        <CenteredTabBar items={tabs.map((item) => ({ id: item.key, label: item.label }))} activeId={tab} onChange={(id) => setTab(id as TabKey)} />
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'sync' ? (
          <DataSyncTab />
        ) : !selected ? (
          <div className="py-6 space-y-3 text-sm text-slate-500 dark:text-slate-400">
            <p className="font-medium text-slate-700 dark:text-slate-300">{t('db_manager.no_connection')}</p>
            <p>{t('db_manager.no_connection_hint')}</p>
            <button
              type="button"
              onClick={loadConnections}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <>
            {tab === 'tables' && (
              <div key={selected.key} className="space-y-3">
                <StatusStrip connection={selected} />
                <TablesTab connection={selected} />
              </div>
            )}
            {tab === 'io' && <ImportExportTab key={selected.key} connection={selected} />}
            {tab === 'backup' && <BackupTab key={selected.key} connection={selected} />}
            {tab === 'credentials' && <CredentialsTab key={selected.key} connection={selected} />}
          </>
        )}
      </div>
    </CenteredPage>
  );
};

export default DatabaseManager;
