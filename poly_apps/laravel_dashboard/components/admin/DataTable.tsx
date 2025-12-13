'use client';

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, Filter, Download, RefreshCw } from 'lucide-react';

/**
 * Column Definition
 */
export interface DataTableColumn<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  headerAlign?: 'left' | 'center' | 'right';
}

/**
 * DataTable Props
 */
export interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  sorting?: {
    column: string;
    direction: 'asc' | 'desc';
    onSort: (column: string, direction: 'asc' | 'desc') => void;
  };
  search?: {
    value: string;
    placeholder?: string;
    onSearch: (value: string) => void;
  };
  selection?: {
    selectedRows: string[];
    onSelectionChange: (selectedRows: string[]) => void;
    rowKey: keyof T;
  };
  actions?: {
    onRefresh?: () => void;
    onExport?: () => void;
    customActions?: React.ReactNode;
  };
  emptyMessage?: string;
  className?: string;
  rowClassName?: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
}

/**
 * DataTable Component
 *
 * A powerful, reusable table component with:
 * - Sorting
 * - Pagination
 * - Search
 * - Row selection
 * - Custom rendering
 * - Loading state
 * - Export functionality
 */
export function DataTable<T = any>({
  columns,
  data,
  loading = false,
  pagination,
  sorting,
  search,
  selection,
  actions,
  emptyMessage = 'No data available',
  className = '',
  rowClassName,
  onRowClick
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState(search?.value || '');

  /**
   * Handle sort click
   */
  const handleSort = (columnKey: string) => {
    if (!sorting) return;

    const newDirection =
      sorting.column === columnKey && sorting.direction === 'asc'
        ? 'desc'
        : 'asc';

    sorting.onSort(columnKey, newDirection);
  };

  /**
   * Handle search change
   */
  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (search?.onSearch) {
      search.onSearch(value);
    }
  };

  /**
   * Handle row selection
   */
  const handleSelectAll = () => {
    if (!selection) return;

    const allKeys = data.map(row => String(row[selection.rowKey]));
    const isAllSelected = allKeys.every(key =>
      selection.selectedRows.includes(key)
    );

    selection.onSelectionChange(isAllSelected ? [] : allKeys);
  };

  const handleSelectRow = (rowKey: string) => {
    if (!selection) return;

    const newSelected = selection.selectedRows.includes(rowKey)
      ? selection.selectedRows.filter(key => key !== rowKey)
      : [...selection.selectedRows, rowKey];

    selection.onSelectionChange(newSelected);
  };

  /**
   * Pagination controls
   */
  const renderPagination = () => {
    if (!pagination) return null;

    const { page, pageSize, total, onPageChange, onPageSizeChange } = pagination;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize + 1;
    const endIndex = Math.min(page * pageSize, total);

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Showing {startIndex} to {endIndex} of {total} results
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={page === 1}
              className="px-2 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              First
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-2 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Toolbar */}
      {(search || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {search && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={search.placeholder || 'Search...'}
                  className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {actions?.customActions}
            {actions?.onRefresh && (
              <button
                onClick={actions.onRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {actions?.onExport && (
              <button
                onClick={actions.onExport}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {selection && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      data.length > 0 &&
                      data.every(row =>
                        selection.selectedRows.includes(String(row[selection.rowKey]))
                      )
                    }
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={`px-4 py-3 text-${column.headerAlign || column.align || 'left'} text-sm font-semibold text-gray-700`}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.title}</span>
                    {column.sortable && sorting && (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="hover:bg-gray-200 rounded p-1"
                      >
                        {sorting.column === column.key ? (
                          sorting.direction === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        ) : (
                          <ChevronDown className="w-4 h-4 opacity-30" />
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selection ? 1 : 0)}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const rowKey = selection ? String(row[selection.rowKey]) : String(index);
                const isSelected = selection?.selectedRows.includes(rowKey) || false;

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row, index)}
                    className={`
                      border-t hover:bg-gray-50 transition-colors
                      ${isSelected ? 'bg-blue-50' : ''}
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${rowClassName ? rowClassName(row, index) : ''}
                    `}
                  >
                    {selection && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowKey)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-${column.align || 'left'} text-sm`}
                      >
                        {column.render
                          ? column.render(row[column.key as keyof T], row, index)
                          : String(row[column.key as keyof T] || '-')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {renderPagination()}
    </div>
  );
}
