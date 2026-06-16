/**
 * TranslationHistoryPanel — detailed processing history of word-translation
 * tasks (laravel-manager). Reads GET /ai_tools/translation/queue/history:
 * terminal global_tasks (completed + failed), newest first, with the per-task
 * result (translations + provider) and timing. Read-only + paginated.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Languages, RefreshCcw, ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { api } from '../../core/api';
import type { TranslationHistoryItem } from '../../core/api/modules/AppQyV1';

type StatusFilter = '' | 'completed' | 'failed';
const PAGE = 25;

const fmtDuration = (ms: number | null): string => {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m`;
};

const Row: React.FC<{ item: TranslationHistoryItem }> = ({ item }) => {
  const [open, setOpen] = useState(false);
  const ok = item.status === 'completed' || item.status === 'completed_demo';
  return (
    <div className="border-b border-slate-200/60 dark:border-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-500/5 transition">
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
        {ok
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
          {item.word_count} word(s) · {item.language || '?'} → {item.target_language || '?'}
        </span>
        {item.provider && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 shrink-0">{item.provider}</span>
        )}
        <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />{fmtDuration(item.duration_ms)}
        </span>
        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
          {item.completed_at ? new Date(item.completed_at).toLocaleString() : ''}
        </span>
      </button>
      {open && (
        <div className="px-9 pb-3 -mt-0.5">
          {item.error && <p className="text-[11px] text-rose-500 mb-2 break-words">Error: {item.error}{item.retry_count > 0 ? ` (after ${item.retry_count} retries)` : ''}</p>}
          {item.translations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {item.translations.map((t, i) => (
                <div key={i} className="flex items-baseline gap-2 text-[11px]">
                  <span className="font-mono text-slate-500 dark:text-slate-400 truncate">{t.word}</span>
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate">{t.translation}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] italic text-slate-400">No translation result recorded.</p>
          )}
        </div>
      )}
    </div>
  );
};

const TranslationHistoryPanel: React.FC = () => {
  const [items, setItems] = useState<TranslationHistoryItem[]>([]);
  const [status, setStatus] = useState<StatusFilter>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    setLoading(true);
    try {
      const res = await api.appQyV1.getTranslationHistory({ status, limit: PAGE, page: nextPage });
      const data = res?.data;
      const rows = data?.items ?? [];
      setItems((prev) => (replace ? rows : [...prev, ...rows]));
      setTotal(data?.pagination?.total ?? rows.length);
      setHasMore(data?.pagination?.has_more ?? false);
      setPage(nextPage);
      setError(res?.success === false ? (res?.message || 'Failed to load history') : null);
    } catch (e: any) {
      setError(e?.message || 'Laravel unreachable');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(1, true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Languages className="w-5 h-5 text-cyan-400" /> Translation History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Completed &amp; failed word-translation tasks — provider, result and timing. {total.toLocaleString()} total.
          </p>
        </div>
        <button
          onClick={() => load(1, true)}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-xs font-semibold flex items-center gap-1.5 transition">
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-1.5">
        {([['', 'All'], ['completed', 'Completed'], ['failed', 'Failed']] as [StatusFilter, string][]).map(([key, label]) => (
          <button
            key={key || 'all'}
            onClick={() => setStatus(key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              status === key ? 'bg-cyan-500/15 text-cyan-500' : 'bg-slate-500/5 text-slate-500 hover:bg-slate-500/10'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="text-xs rounded-xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-500">{error}</div>}

      <div className="rounded-2xl border border-slate-200/60 dark:border-white/5 overflow-hidden bg-white/40 dark:bg-white/5">
        {items.length === 0 && !loading ? (
          <p className="text-xs text-slate-400 text-center py-10">No translation history yet.</p>
        ) : (
          items.map((it) => <Row key={it.task_id} item={it} />)
        )}
      </div>

      {hasMore && (
        <button
          onClick={() => load(page + 1, false)}
          disabled={loading}
          className="w-full px-3 py-2 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-xs font-semibold transition disabled:opacity-50">
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
};

export default TranslationHistoryPanel;
