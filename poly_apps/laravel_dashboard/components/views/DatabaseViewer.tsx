import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../core/api';
import {
  DbViewerTableStructureColumn,
  DbViewerTableDataResponse
} from '../../core/api/modules/DashboardDbViewerAPI';
import { commonClasses } from '../../styles/theme';
import { Database, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Language } from '../../types';

const PER_PAGE = 20;

interface DatabaseViewerProps {
  lang: Language;
}

const SchemaTable: React.FC<{ columns: DbViewerTableStructureColumn[] }> = ({ columns }) => {
  if (!columns.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 p-3">No columns</p>
    );
  }
  const headers = ['name', 'type', 'nullable', 'key', 'default', 'extra'];
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-700/50">
            {headers.map((h) => (
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
          {columns.map((col, i) => (
            <tr
              key={i}
              className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              {headers.map((h) => (
                <td
                  key={h}
                  className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate"
                  title={String((col as Record<string, unknown>)[h] ?? '')}
                >
                  {String((col as Record<string, unknown>)[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DataGrid: React.FC<{
  columns: { name: string }[];
  rows: Record<string, unknown>[];
}> = ({ columns, rows }) => {
  const keys = columns.map((c) => c.name);
  if (!keys.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 p-3">No columns</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-700/50">
            {keys.map((k) => (
              <th
                key={k}
                className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
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
                className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                {keys.map((k) => (
                  <td
                    key={k}
                    className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate"
                    title={String(row[k] ?? '')}
                  >
                    {String(row[k] ?? '')}
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

const DatabaseViewer: React.FC<DatabaseViewerProps> = ({ lang }) => {
  const [tables, setTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [structure, setStructure] = useState<DbViewerTableStructureColumn[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [dataResponse, setDataResponse] = useState<DbViewerTableDataResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    setTablesError(null);
    try {
      const list = await api.dashboardDbViewer.getTables();
      setTables(Array.isArray(list) ? list : []);
      setSelectedTable((prev) => (prev === null && list.length > 0 ? list[0] : prev));
    } catch (e: unknown) {
      setTablesError(e instanceof Error ? e.message : 'Failed to load tables');
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (!selectedTable) {
      setStructure([]);
      setDataResponse(null);
      return;
    }
    let cancelled = false;
    setStructureLoading(true);
    api.dashboardDbViewer
      .getStructure(selectedTable)
      .then((cols) => {
        if (!cancelled) setStructure(cols);
      })
      .finally(() => {
        if (!cancelled) setStructureLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTable]);

  useEffect(() => {
    if (!selectedTable) return;
    let cancelled = false;
    setDataLoading(true);
    api.dashboardDbViewer
      .getData(selectedTable, page, PER_PAGE)
      .then((res) => {
        if (!cancelled) setDataResponse(res);
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTable, page]);

  if (loadingTables) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading tables...</span>
        </div>
      </div>
    );
  }

  if (tablesError) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{tablesError}</p>
          <button
            type="button"
            onClick={loadTables}
            className={`${commonClasses.button} ${commonClasses.buttonPrimary}`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Database Viewer
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Laravel tables, structure and paginated data
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadTables}
          disabled={loadingTables}
          className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2`}
        >
          <RefreshCw className={`w-4 h-4 ${loadingTables ? 'animate-spin' : ''}`} />
          Refresh tables
        </button>
      </div>

      <div className="flex-1 flex min-h-0 gap-4">
        <div
          className={`${commonClasses.card} w-56 flex-shrink-0 flex flex-col overflow-hidden`}
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
            Tables
          </div>
          <div className="flex-1 overflow-auto">
            {tables.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No tables</p>
            ) : (
              tables.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSelectedTable(name);
                    setPage(1);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm truncate border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                    selectedTable === name
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                  title={name}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedTable ? (
            <div
              className={`${commonClasses.card} flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400`}
            >
              Select a table
            </div>
          ) : (
            <>
              <div className="mb-2 px-1 font-medium text-slate-700 dark:text-slate-300">
                {selectedTable}
              </div>
              <div className="flex-1 overflow-auto space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Structure
                  </h3>
                  {structureLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading…
                    </div>
                  ) : (
                    <SchemaTable columns={structure} />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Data
                  </h3>
                  {dataLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading…
                    </div>
                  ) : dataResponse ? (
                    <>
                      <DataGrid
                        columns={structure.length ? structure : []}
                        rows={dataResponse.data}
                      />
                      <div className="mt-3">
                        <PaginationBar
                          currentPage={dataResponse.current_page}
                          lastPage={dataResponse.last_page}
                          total={dataResponse.total}
                          perPage={dataResponse.per_page}
                          onPrev={() => setPage((p) => Math.max(1, p - 1))}
                          onNext={() =>
                            setPage((p) =>
                              Math.min(dataResponse.last_page, p + 1)
                            )
                          }
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DatabaseViewer;
