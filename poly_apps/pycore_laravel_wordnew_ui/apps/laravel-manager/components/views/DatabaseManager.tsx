import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  api, DbConnectionInfo, DbStatus, DbTableInfo, DbStructureColumn,
  DbTableDataResponse, ExportFormat, ImportMode, DbBackup,
  DbCredentialInfo, DbAccountCreateResult,
} from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../admin/Modal';
import { useToast } from '../admin';
import {
  LoadingBlock, InlineSpinner, AlertBox, EmptyState, StatusBadge, Field, CopyButton,
} from '../common';
import type { StatusTone } from '../common';
import { CenteredPage, CenteredTabBar } from '@/apps/laravel-manager/components/common/CenteredPageLayout';
import { useApiResource } from '@/apps/laravel-manager/hooks';
import {
  DatabaseZap, Layers, RefreshCw, ChevronLeft, ChevronRight, Search,
  ArrowUp, ArrowDown, ArrowUpDown, Columns3, Table2, Clock3,
  Maximize2, Minimize2, Download, Upload, Save, RotateCcw,
  Trash2, HardDrive, KeyRound, ShieldAlert, Eye, EyeOff, Users, UserPlus,
} from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import { logInfo, logSuccess, logError } from '@/core/logstore/logStore';
import { Language } from '@/apps/laravel-manager/uiTypes';
import { useTranslation } from '@/apps/laravel-manager/i18n';
import { DataSyncTab } from './database-manager/DataSyncTab';

const DEFAULT_PER_PAGE = 1000;
const MAX_PER_PAGE = 5000;

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
  if (!columns.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 p-3">No columns</p>;
  }
  const headers = ['name', 'type', 'nullable', 'key', 'default', 'extra'];
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
                {h}
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
                const raw = String((col as Record<string, unknown>)[h] ?? '');
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
}> = ({ columns, rows }) => {
  const keys = columns.map((c) => c.name);
  if (!keys.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 p-3">No columns</p>;
  }
  return (
    <div className="h-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
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
              <td colSpan={keys.length} className="px-3 py-4 text-center text-slate-500">
                No rows
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
  const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, total);
  return (
    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
      <span>
        {from}–{to} of {total} rows
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1`}
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        <span>
          Page {currentPage} of {lastPage || 1}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage >= lastPage}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-1`}
        >
          Next
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
          Loading status…
        </span>
      ) : !status ? (
        <span className="text-sm text-red-600 dark:text-red-400">Status unavailable</span>
      ) : (
        <>
          {item('DB', status.database)}
          <StatusBadge
            status={status.reachable ? 'reachable' : 'unreachable'}
            tone={status.reachable ? 'success' : 'error'}
            withDot={false}
          />
          {item('Size', status.size_human)}
          {item('Tables', status.table_count)}
          {status.server_version && item('Server', status.server_version)}
          <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 dark:text-slate-500 text-xs">Backup via</span>
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
        title="Refresh status"
        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─────────────────────────────── Tables tab ───────────────────────────────
type TableSortKey = 'name' | 'rows' | 'activity';

const fmtRows = (n: number): string => (n < 0 ? 'unknown' : n.toLocaleString());

/** Short local timestamp for the best-effort activity time; em-dash when unknown. */
const fmtActivity = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TablesTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
  const [tables, setTables] = useState<DbTableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [structure, setStructure] = useState<DbStructureColumn[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [data, setData] = useState<DbTableDataResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
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

  const loadTables = useCallback(() => {
    setLoading(true);
    setError(null);
    api.databaseManager
      .getTables(connection.key)
      .then((list) => {
        setTables(list);
        setSelected((prev) => (prev && list.some((t) => t.name === prev) ? prev : list[0]?.name ?? null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tables'))
      .finally(() => setLoading(false));
  }, [connection.key]);

  // Reset selection when switching connection, then (re)load.
  useEffect(() => {
    setSelected(null);
    setPage(1);
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (!selected) {
      setStructure([]);
      setData(null);
      return;
    }
    let cancelled = false;
    setStructureLoading(true);
    api.databaseManager
      .getStructure(selected, connection.key)
      .then((cols) => {
        if (!cancelled) setStructure(cols);
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
    api.databaseManager
      .getData(selected, connection.key, page, perPage)
      .then((res) => {
        if (!cancelled) setData(res);
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

  const sortButton = (key: TableSortKey, label: string) => {
    const active = sortKey === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleSort(key)}
        title={`Sort by ${label.toLowerCase()}`}
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
    return <LoadingBlock label="Loading tables…" />;
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
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-360px)] min-h-[440px]">
      {/* ───────── left: table list with search + sort ───────── */}
      <div className={`${commonClasses.card} w-72 flex-shrink-0 flex flex-col overflow-hidden`}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>
            Tables{' '}
            <span className="text-xs font-normal text-slate-400">
              {query ? `${visibleTables.length}/${tables.length}` : tables.length}
            </span>
          </span>
          <button type="button" onClick={loadTables} title="Refresh">
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
              placeholder="Filter tables…"
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            />
          </div>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            {sortButton('name', 'Name')}
            {sortButton('rows', 'Rows')}
            {sortButton('activity', 'Time')}
          </div>
        </div>
        <div className="flex-1 overflow-auto border-t border-slate-100 dark:border-slate-700/50">
          {visibleTables.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">{query ? 'No matching tables' : 'No tables'}</p>
          ) : (
            visibleTables.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  setSelected(t.name);
                  setPage(1);
                }}
                className={`w-full text-left px-4 py-2 text-sm border-b border-slate-100 dark:border-slate-700/50 transition-colors ${
                  selected === t.name
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
                    : 'border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30'
                }`}
                title={t.name}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate font-mono text-[13px] ${
                      selected === t.name
                        ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t.name}
                  </span>
                  <StatusBadge
                    status={t.is_app_table ? 'app' : 'main'}
                    tone={t.is_app_table ? 'info' : 'success'}
                    withDot={false}
                    className="flex-shrink-0"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{fmtRows(t.rows)} rows</span>
                  {t.activity_at && (
                    <span className="flex items-center gap-1" title={`Last activity: ${fmtActivity(t.activity_at)}`}>
                      <Clock3 className="w-3 h-3" />
                      {fmtActivity(t.activity_at)}
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
            Select a table
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
                    {fmtRows(selectedInfo.rows)} rows
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
                    Structure
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
                    Data
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFull((v) => !v)}
                  title={isFull ? 'Exit fullscreen (Esc)' : 'Fullscreen this panel'}
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
                    Loading…
                  </div>
                ) : (
                  <SchemaTable columns={structure} />
                )}
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Rows / page
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
                    <span className="text-slate-400">(max {MAX_PER_PAGE})</span>
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
                      Loading…
                    </div>
                  ) : data ? (
                    <DataGrid columns={structure.length ? structure : []} rows={data.data} />
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
                Viewer is fullscreen — press Esc to return
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
          <div className={`${commonClasses.card} flex-1 flex flex-col min-w-0 overflow-hidden`}>
            {viewerInner}
          </div>
        );
      })()}
    </div>
  );
};

// ────────────────────────────── Import/Export tab ──────────────────────────────

const ImportExportTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
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
        setTable((prev) => (prev && list.some((t) => t.name === prev) ? prev : list[0]?.name ?? ''))
    }
  );
  const tableList = tables ?? [];

  const handleExport = async () => {
    if (!table) return;
    setBusy(true);
    // Export downloads via raw fetch (binary), so it bypasses the automatic
    // BaseAPI request logging — log the operation explicitly.
    logInfo('db-manager', `Export ${connection.key}.${table} as ${exportFormat.toUpperCase()}…`);
    try {
      await api.databaseManager.exportTable(table, connection.key, exportFormat);
      logSuccess('db-manager', `Export ${connection.key}.${table} done`);
      toast.success(`Exported ${table} as ${exportFormat.toUpperCase()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
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
      toast.success(`Imported ${result.imported}, skipped ${result.skipped}`);
      setFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      logError('db-manager', `Import ${connection.key}.${table} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label="Loading tables…" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Export */}
      <div className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Export table</h3>
        </div>
        <Field label="Table">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className={`${commonClasses.select} w-full`}
          >
            {tableList.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Format">
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
          Download
        </button>
      </div>

      {/* Import */}
      <div className={`${commonClasses.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Import file</h3>
        </div>
        <Field label="Table">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className={`${commonClasses.select} w-full`}
          >
            {tableList.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <select
              value={importFormat}
              onChange={(e) => setImportFormat(e.target.value as ExportFormat)}
              className={`${commonClasses.select} w-full`}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </Field>
          <Field label="Mode">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as ImportMode)}
              className={`${commonClasses.select} w-full`}
            >
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </select>
          </Field>
        </div>
        <Field label="File">
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
          Import
        </button>
      </div>

      <Modal
        isOpen={confirmImport}
        onClose={() => setConfirmImport(false)}
        title="Confirm import"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmImport(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
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
              {importMode === 'replace' ? 'Replace & import' : 'Import'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Import <strong>{file?.name}</strong> ({importFormat.toUpperCase()}) into{' '}
          <strong>{table}</strong> on <strong>{connection.name}</strong> in{' '}
          <strong>{importMode}</strong> mode.
          {importMode === 'replace' && (
            <span className="block mt-2 text-red-600 dark:text-red-400">
              Replace mode clears existing rows in this table first.
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
      toast.success(`Backup created (${backupMechanism(connection.driver)})`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backup failed';
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
        toast.success(res.message || 'Backup restored');
      } else {
        logError('db-manager', `Restore of ${target.file} failed — ${res.message || 'unknown error'}`);
        toast.error(res.message || 'Restore failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Restore failed';
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
        toast.success('Backup deleted');
        load();
      } else {
        logError('db-manager', `Delete of backup ${target.file} failed`);
        toast.error('Delete failed');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
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
      const msg = e instanceof Error ? e.message : 'Download failed';
      logError('db-manager', `Download of ${b.file} failed — ${msg}`);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mechanism for <strong>{connection.name}</strong>:{' '}
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
            Refresh
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            Create backup
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading backups…" />
      ) : backups.length === 0 ? (
        <div className={commonClasses.card}>
          <EmptyState icon={Save} message="No backups yet" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-700/50">
                {['File', 'Driver', 'Connection', 'Size', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
                  >
                    {h}
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
                    {b.size_human ?? `${b.size_bytes} B`}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{b.created_at}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Restore"
                        onClick={() => setRestoreTarget(b)}
                        disabled={busy}
                        className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Download"
                        onClick={() => handleDownload(b)}
                        className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete"
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
        title="Restore backup"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setRestoreTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRestore}
              className={`${commonClasses.button} bg-amber-600 hover:bg-amber-700 text-white`}
            >
              Restore
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Restore <strong>{restoreTarget?.file}</strong> onto <strong>{connection.name}</strong>?
          <span className="block mt-2 text-red-600 dark:text-red-400">
            This overwrites the current database with the backup contents.
          </span>
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete backup"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white`}
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Permanently delete <strong>{deleteTarget?.file}</strong>?
        </p>
      </Modal>
    </div>
  );
};

// ─────────────────────────────── Credentials tab ───────────────────────────────

const CredentialsTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
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
          toast.success('Password changed & synced to Laravel config');
        } else {
          logError('db-manager', `Password for ${res.user}@${connection.key} changed but NOT synced to Laravel config`);
          toast.error('Password changed, but Laravel config was NOT synced — connections may break until re-synced.');
        }
      } else {
        logSuccess('db-manager', `Password for account ${res.user}@${connection.key} changed`);
        toast.success(`Password changed for ${res.user}`);
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password change failed';
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
      toast.success(`Account ${res.username} created`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Account creation failed';
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
      toast.success(`Account ${username} dropped`);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Account drop failed';
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
        toast.success('Root password reset & synced to Laravel config');
      } else {
        logError('db-manager', `Root password for ${connection.key} reset but NOT synced to Laravel config`);
        toast.error('Password reset, but Laravel config was NOT synced — connections may break until re-synced.');
      }
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Password reset failed';
      logError('db-manager', `Root password reset for ${connection.key} failed — ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingBlock label="Loading credentials…" />;
  }

  if (!info) {
    return (
      <div className="py-4">
        <p className="text-red-600 dark:text-red-400 mb-3">Credentials unavailable</p>
        <button
          type="button"
          onClick={load}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
        >
          Retry
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
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Credentials</h3>
          <StatusBadge status={info.driver} tone={driverTone(info.driver)} withDot={false} className="ml-1" />
        </div>
        <StatRow label="Connection" value={info.connection} />
        <StatRow label="Superuser" value={info.superuser ?? '—'} />
        {supported && info.password !== null && (
          <StatRow
            label="Password"
            value={
              <span className="flex items-center gap-2 font-mono">
                <span className="select-all">
                  {showPassword ? info.password || '(empty)' : '•'.repeat(Math.min(16, Math.max(8, info.password.length)))}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <CopyButton text={info.password} label="Copy" variant="outline" />
              </span>
            }
          />
        )}
        <StatRow
          label="Password auth"
          value={
            <StatusBadge
              status={supported ? 'supported' : 'not applicable'}
              tone={supported ? 'success' : 'warning'}
              withDot={false}
            />
          }
        />
        {info.secret_key && <StatRow label="Secret key" value={info.secret_key} />}
      </div>

      {/* Re-sync explainer (pgsql/mysql) */}
      {supported ? (
        <AlertBox variant="info" icon={false}>
          <span className="flex gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Changing or resetting the password also re-syncs Laravel&apos;s own config (its
              credential store) so this connection keeps working afterward. Password auth applies to{' '}
              <strong>pgsql / mysql</strong> only.
            </span>
          </span>
        </AlertBox>
      ) : (
        <AlertBox variant="warning">
          {info.note || 'This file-based database has no password; credential controls are disabled.'}
        </AlertBox>
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Change password</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set a new password for <strong>{info.superuser ?? 'the user'}</strong>. Laravel&apos;s config is
            re-synced automatically.
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
            Change password
          </button>
        </div>

        <div className={`${commonClasses.card} p-4 space-y-3`}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Reset root password</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate a fresh strong password. It is shown <strong>once</strong> — record it
            immediately.
          </p>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            disabled={!supported || busy}
            className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50`}
          >
            <ShieldAlert className="w-4 h-4" />
            Reset root password
          </button>
        </div>
      </div>

      {/* Accounts (driver-aware: pgsql roles / mysql users; sqlite has none) */}
      {supported && (
        <div className={`${commonClasses.card} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Accounts</h3>
              <span className="text-xs text-slate-400">
                {info.driver === 'pgsql' ? 'PostgreSQL roles' : 'MySQL users'} ({info.users.length})
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
              Add account
            </button>
          </div>
          {info.users.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No accounts visible (catalog may require superuser privileges).
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Account</th>
                    {info.driver !== 'pgsql' && (
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Host</th>
                    )}
                    <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Flags</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">Actions</th>
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
                            <StatusBadge status="laravel" tone="info" withDot={false} className="ml-2" />
                          )}
                        </td>
                        {info.driver !== 'pgsql' && (
                          <td className="px-3 py-2 font-mono text-[13px] text-slate-500">{u.host ?? '—'}</td>
                        )}
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            {u.super && <StatusBadge status="super" tone="warning" withDot={false} />}
                            <StatusBadge
                              status={u.can_login ? 'login' : 'no-login'}
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
                            Change password
                          </button>
                          <button
                            type="button"
                            onClick={() => setDropTarget(u.name)}
                            disabled={busy || isConfigured}
                            title={isConfigured ? 'Laravel connects as this account — cannot drop' : `Drop ${u.name}`}
                            className="ml-1 px-2 py-1 text-xs rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40"
                          >
                            Drop
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
        title="Change password"
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
              Cancel
            </button>
            <button
              type="button"
              onClick={runChange}
              disabled={!passwordsMatch || busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} disabled:opacity-50`}
            >
              Change &amp; sync
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            New password for <strong>{changeTarget ?? info.superuser ?? 'the user'}</strong> on{' '}
            <strong>{connection.name}</strong>.
            {(changeTarget ?? info.superuser) === info.superuser
              ? ' This also re-syncs Laravel’s config.'
              : ' This account is not the one Laravel connects as — its credential store is untouched.'}
          </p>
          <Field label="New password">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={`${commonClasses.input} w-full`}
            />
          </Field>
          <Field
            label="Confirm password"
            error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match.' : undefined}
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
        title="Reset root password"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowReset(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runReset}
              disabled={busy}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white disabled:opacity-50`}
            >
              Reset &amp; generate
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Generate a new strong password for <strong>{info.superuser ?? 'the root user'}</strong> on{' '}
          <strong>{connection.name}</strong> and re-sync Laravel&apos;s config?
          <span className="block mt-2 text-red-600 dark:text-red-400">
            The current password stops working immediately. The new one is shown only once.
          </span>
        </p>
      </Modal>

      {/* Generated-password reveal modal (shown once) */}
      <Modal
        isOpen={generated !== null}
        onClose={() => setGenerated(null)}
        title="New password — store it now"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setGenerated(null)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              I&apos;ve stored it
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <AlertBox variant="error">
            <span>
              Store this password now — it will <strong>not be shown again</strong>.
            </span>
          </AlertBox>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-sm break-all select-all">
              {generated}
            </code>
            {generated && <CopyButton text={generated} label="Copy" variant="outline" />}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {generatedSynced
              ? 'This password was synced to Laravel’s credential store, so connections keep working.'
              : 'WARNING: this password was NOT synced to Laravel’s credential store — re-sync manually or connections will break.'}
          </p>
        </div>
      </Modal>

      {/* Add-account modal */}
      <Modal
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title="Add account"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddUser(false)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runAddUser}
              disabled={!addUsername.trim() || busy}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} disabled:opacity-50`}
            >
              Create account
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {info.driver === 'pgsql' ? (
              <>Creates a PostgreSQL <strong>LOGIN role</strong> with privileges on database{' '}
              <strong>{connection.database}</strong> (table-level grants stay with the operator).</>
            ) : (
              <>Creates a MySQL user <strong>@localhost</strong> with ALL privileges on schema{' '}
              <strong>{connection.database}</strong>.</>
            )}
          </p>
          <Field label="Username">
            <input
              type="text"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              placeholder="letters, digits, _ or -"
              className={`${commonClasses.input} w-full font-mono`}
            />
          </Field>
          <Field label="Password" hint="Leave empty to auto-generate a strong one.">
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
        title="Account created — store the password now"
        size="sm"
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setCreatedAccount(null)}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
            >
              I stored it
            </button>
          </div>
        }
      >
        {createdAccount && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Generated password for <strong className="font-mono">{createdAccount.username}</strong> —
              shown <strong>once</strong>, it is not retrievable again.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm break-all">
              <span className="flex-1 select-all">{createdAccount.password}</span>
              <CopyButton text={createdAccount.password} label="Copy" variant="outline" />
            </div>
          </div>
        )}
      </Modal>

      {/* Drop-account confirm */}
      <Modal
        isOpen={dropTarget !== null}
        onClose={() => setDropTarget(null)}
        title="Drop account"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDropTarget(null)}
              className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runDropUser}
              disabled={busy}
              className={`${commonClasses.button} bg-red-600 hover:bg-red-700 text-white disabled:opacity-50`}
            >
              Drop account
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Drop database account <strong className="font-mono">{dropTarget}</strong> on{' '}
          <strong>{connection.name}</strong>? Objects it owns may block the drop; this cannot be
          undone.
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
    return <LoadingBlock full size="lg" label="Loading connections…" />;
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={loadConnections}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <CenteredPage className="h-full flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DatabaseZap className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Database Manager</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Status, tables, import/export and backups across connections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className={`${commonClasses.select}`}
          >
            {connections.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name} {c.is_main ? '(main)' : '(app)'} · {c.driver}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <CenteredTabBar items={tabs.map((item) => ({ id: item.key, label: item.label }))} activeId={tab} onChange={(id) => setTab(id as TabKey)} />
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'sync' ? (
          <DataSyncTab />
        ) : !selected ? (
          <div className="text-slate-500 dark:text-slate-400 py-6">No connection selected</div>
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
