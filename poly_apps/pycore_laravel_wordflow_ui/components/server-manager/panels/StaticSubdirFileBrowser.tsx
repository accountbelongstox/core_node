import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from 'lucide-react';
import { Modal } from '../../admin';
import { api } from '../../../core/api';
import type { Language, StaticResourceFileList } from '../../../types';
import { LoadingBlock, AlertBox } from '../../common';

type SortField = 'name' | 'size' | 'modified';
type SortOrder = 'asc' | 'desc';

interface StaticSubdirFileBrowserProps {
  open: boolean;
  onClose: () => void;
  relativePath: string;
  label: string;
  lang: Language;
}

const StaticSubdirFileBrowser: React.FC<StaticSubdirFileBrowserProps> = ({
  open,
  onClose,
  relativePath,
  label,
  lang
}) => {
  const isZh = lang === 'zh';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StaticResourceFileList | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortField>('name');
  const [order, setOrder] = useState<SortOrder>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setQuery(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadFiles = useCallback(async () => {
    if (!open || !relativePath) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.serverManagerV1.listStaticResourceFiles({
        path: relativePath,
        q: query,
        sort,
        order,
        page,
        per_page: 100,
      });
      if (res.success && res.data) {
        setData(res.data as StaticResourceFileList);
      } else {
        throw new Error(res.error || 'Failed to load files');
      }
    } catch (e: any) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [open, relativePath, query, sort, order, page]);

  useEffect(() => {
    if (open) {
      setPage(1);
      setSearchInput('');
      setQuery('');
      setSort('name');
      setOrder('asc');
    }
  }, [open, relativePath]);

  useEffect(() => {
    if (open) loadFiles();
  }, [open, loadFiles]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, order]);

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setOrder('asc');
    }
  };

  const sortLabel = (field: SortField, text: string) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
    >
      {text}
      {sort === field && (
        <ArrowUpDown className="w-3 h-3" />
      )}
      {sort === field && (
        <span className="text-[10px] uppercase">{order}</span>
      )}
    </button>
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`${label} — ${relativePath}`}
      size="xl"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={isZh ? '搜索文件名或路径…' : 'Search filename or path…'}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          {data && (
            <span className="text-xs text-slate-500">
              {isZh ? '共' : ''} {data.total.toLocaleString()} {isZh ? '个文件' : 'files'}
            </span>
          )}
        </div>

        {loading && !data && <LoadingBlock size="sm" />}
        {error && <AlertBox variant="error">{error}</AlertBox>}

        {data && (
          <>
            <div className="overflow-auto max-h-[55vh] border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                    <th className="p-2">{sortLabel('name', isZh ? '文件名' : 'Name')}</th>
                    <th className="p-2 text-right">{sortLabel('size', isZh ? '大小' : 'Size')}</th>
                    <th className="p-2">{sortLabel('modified', isZh ? '修改时间' : 'Modified')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.files.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-500">
                        {isZh ? '无匹配文件' : 'No matching files'}
                      </td>
                    </tr>
                  ) : (
                    data.files.map((file) => (
                      <tr key={file.path} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2">
                          <div className="font-mono text-xs break-all">{file.name}</div>
                          <div className="text-[10px] text-slate-400 break-all">{file.path}</div>
                        </td>
                        <td className="p-2 text-right whitespace-nowrap">{file.size_human}</td>
                        <td className="p-2 text-xs text-slate-500 whitespace-nowrap">{file.modified}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {(data.total_pages ?? 0) > 1 && (
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {isZh ? '上一页' : 'Prev'}
                </button>
                <span className="text-slate-500">
                  {isZh ? '第' : 'Page'} {data.page} / {data.total_pages}
                </span>
                <button
                  type="button"
                  disabled={page >= (data.total_pages ?? 1) || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
                >
                  {isZh ? '下一页' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default StaticSubdirFileBrowser;
