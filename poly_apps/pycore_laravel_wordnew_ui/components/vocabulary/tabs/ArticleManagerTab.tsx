import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw, Trash2, Volume2 } from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import type { APIResponse } from '../../../apps/laravel-manager/types';
import type { ArticleBatchDeleteResult, ArticleDeleteResult, ArticleItem } from '@/apps/laravel-manager/api';
import { requestGlobalLogin } from '../../../core/api-libs/laravel/transport/LoginRequestBridge';
import { commonClasses } from '../../../styles/theme';
import { useAppState } from '../../../contexts/AppStateContext';
import { useUserRole } from '../../../hooks/useUserRole';
import { Modal, useToast } from '../../admin';
import EmptyState from '../../common/EmptyState';

const PAGE_SIZE = 50;
const DELETE_CONFIRMATIONS = new Set(['yes', 'delete']);

const ArticleManagerTab: React.FC = () => {
  const toast = useToast();
  const { isLoggedIn } = useAppState();
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<ArticleItem[]>([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewId, setViewId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.articles.list({
        limit: PAGE_SIZE,
        offset,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
      });
      if (!response.success || !response.data) {
        setError(response.error || 'Articles could not be loaded.');
        return;
      }
      setItems(response.data.items);
      setTotal(response.data.total);
      setCategories(response.data.categories || {});
    } catch (loadError: any) {
      setError(loadError?.message || 'Articles could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [offset, selectedCategory]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const viewIndex = useMemo(() => items.findIndex((item) => item.id === viewId), [items, viewId]);
  const viewedItem = viewIndex >= 0 ? items[viewIndex] : null;
  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const changeCategory = useCallback((category: string) => {
    setSelectedCategory(category);
    setOffset(0);
    setSelectedIds(new Set());
    setViewId(null);
  }, []);

  const toggleSelection = useCallback((articleId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  }, []);

  const togglePageSelection = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const selectPage = !items.every((item) => next.has(item.id));
      items.forEach((item) => {
        if (selectPage) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  }, [items]);

  const requireDeleteConfirmation = useCallback((count: number): boolean => {
    const answer = window.prompt(
      `Deleting ${count} article${count === 1 ? '' : 's'} is an administrator operation. Type yes or delete to confirm.`,
    );
    if (answer === null) return false;
    if (!DELETE_CONFIRMATIONS.has(answer.trim().toLowerCase())) {
      toast.error('Deletion cancelled. Enter yes or delete exactly.');
      return false;
    }
    return true;
  }, [toast]);

  const handleAuthFailure = useCallback((status?: number): boolean => {
    if (status === 401) {
      toast.error('Deleting articles requires an administrator login.');
      requestGlobalLogin();
      return true;
    }
    if (status === 403) {
      toast.error('This operation requires administrator access.');
      return true;
    }
    return false;
  }, [toast]);

  const deleteArticles = useCallback(async (articleIds: string[]) => {
    let response: APIResponse<ArticleDeleteResult | ArticleBatchDeleteResult>;

    if (articleIds.length === 0) return;
    if (!isLoggedIn) {
      toast.error('Deleting articles requires an administrator login.');
      requestGlobalLogin();
      return;
    }
    if (!isAdmin) {
      toast.error('This operation requires administrator access.');
      return;
    }
    if (!requireDeleteConfirmation(articleIds.length)) return;

    setDeleting(true);
    try {
      response = articleIds.length === 1
        ? await api.articles.remove(articleIds[0])
        : await api.articles.removeMany(articleIds);
      if (!response.success) {
        if (!handleAuthFailure(response.status)) {
          toast.error(response.error || 'Articles could not be deleted.');
        }
        return;
      }
      toast.success(`${articleIds.length} article${articleIds.length === 1 ? '' : 's'} deleted.`);
      setSelectedIds(new Set());
      setViewId(null);
      await loadItems();
    } catch (deleteError: any) {
      if (!handleAuthFailure(deleteError?.status)) {
        toast.error(deleteError?.message || 'Articles could not be deleted.');
      }
    } finally {
      setDeleting(false);
    }
  }, [handleAuthFailure, isAdmin, isLoggedIn, loadItems, requireDeleteConfirmation, toast]);

  const categoryEntries = Object.entries(categories);
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);

  return (
    <div className={`${commonClasses.card} p-4 space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Articles</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manage all stored articles by category</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => void deleteArticles(Array.from(selectedIds))}
              disabled={deleting}
              className={`${commonClasses.button} flex items-center gap-2 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50`}
            >
              <Trash2 className="w-4 h-4" /> Delete selected ({selectedIds.size})
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadItems()}
            disabled={loading}
            className={`${commonClasses.button} ${commonClasses.buttonSecondary} flex items-center gap-2 disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => changeCategory('all')} className={`${commonClasses.button} ${selectedCategory === 'all' ? commonClasses.buttonPrimary : commonClasses.buttonSecondary}`}>All</button>
        {categoryEntries.map(([category, count]) => (
          <button key={category} type="button" onClick={() => changeCategory(category)} className={`${commonClasses.button} ${selectedCategory === category ? commonClasses.buttonPrimary : commonClasses.buttonSecondary}`}>
            {category} ({count})
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} className="h-4 w-4 rounded border-slate-300" />
          Select this page
        </label>
      )}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Loading articles…</div>
      ) : items.length === 0 ? (
        <EmptyState icon={BookOpen} title="No articles" message="No articles match the selected category." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} className="mt-1 h-4 w-4 rounded border-slate-300" aria-label={`Select ${item.title_en}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.title_en}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.category === 'daily' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{item.category}</span>
                    </div>
                    {item.title_cn && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.title_cn}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{item.reading_date || item.created_at || 'Date unavailable'}</span>
                      <span>{item.word_count ?? 0} words</span>
                      <span>{item.sentence_count ?? 0} sentences</span>
                      {item.language && <span>{item.language}</span>}
                      {item.source && <span>source: {item.source}</span>}
                      {item.audio_url && <span className="inline-flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" />Audio</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setViewId(item.id)} className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}>View</button>
                  <button type="button" onClick={() => void deleteArticles([item.id])} disabled={deleting} className={`${commonClasses.button} flex items-center gap-1 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50`}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span>{pageStart}-{pageEnd} of {total}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); setSelectedIds(new Set()); }} disabled={offset === 0 || loading} className={`${commonClasses.button} ${commonClasses.buttonSecondary} p-2 disabled:opacity-40`} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => { setOffset(offset + PAGE_SIZE); setSelectedIds(new Set()); }} disabled={offset + PAGE_SIZE >= total || loading} className={`${commonClasses.button} ${commonClasses.buttonSecondary} p-2 disabled:opacity-40`} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <Modal
        isOpen={viewedItem !== null}
        onClose={() => setViewId(null)}
        title={viewedItem?.title_en || 'Article'}
        size="xl"
        footer={viewedItem && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => setViewId(items[viewIndex - 1]?.id || null)} disabled={viewIndex <= 0} className={`${commonClasses.button} ${commonClasses.buttonSecondary} disabled:opacity-40`}><ChevronLeft className="h-4 w-4" /> Previous</button>
              <button type="button" onClick={() => setViewId(items[viewIndex + 1]?.id || null)} disabled={viewIndex < 0 || viewIndex >= items.length - 1} className={`${commonClasses.button} ${commonClasses.buttonSecondary} disabled:opacity-40`}>Next <ChevronRight className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => void deleteArticles([viewedItem.id])} disabled={deleting} className={`${commonClasses.button} flex items-center gap-1 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50`}><Trash2 className="h-4 w-4" /> Delete article</button>
          </div>
        )}
      >
        {viewedItem && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400"><span>{viewedItem.category}</span><span>{viewedItem.language}</span><span>{viewedItem.word_count ?? 0} words</span><span>{viewedItem.sentence_count ?? 0} sentences</span></div>
            {viewedItem.audio_url && <audio controls preload="none" src={viewedItem.audio_url} className="w-full" />}
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Article</h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-100">{viewedItem.article_en || 'No article content.'}</p>
            </section>
            <section className="border-t border-slate-200 pt-5 dark:border-slate-700">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Translation</h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-100">{viewedItem.reference_cn || 'No translation available.'}</p>
            </section>
            <p className="break-all text-xs text-slate-400">ID: {viewedItem.id}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ArticleManagerTab;
