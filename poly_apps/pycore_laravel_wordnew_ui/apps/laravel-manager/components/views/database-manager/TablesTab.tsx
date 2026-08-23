import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, DbConnectionInfo, DbStatus, DbTableInfo, DbStructureColumn, DbTableDataResponse } from '@/apps/laravel-manager/api';
import { commonClasses } from '@/shared/styles/theme';
import { Modal } from '../../admin/Modal';
import { LoadingBlock, InlineSpinner, AlertBox, EmptyState, StatusBadge } from '../../common';
import type { StatusTone } from '../../common';
import { useApiResource } from '@/apps/laravel-manager/hooks';
import { RefreshCw, ChevronLeft, ChevronRight, Search, ArrowUp, ArrowDown, ArrowUpDown, Columns3, Table2, Clock3, Maximize2, Minimize2 } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z } from '@/shared/styles/overlay';
import { logInfo, logSuccess, logError } from '@/core/logstore/logStore';

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
export const StatusStrip: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
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

export const TablesTab: React.FC<{ connection: DbConnectionInfo }> = ({ connection }) => {
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
