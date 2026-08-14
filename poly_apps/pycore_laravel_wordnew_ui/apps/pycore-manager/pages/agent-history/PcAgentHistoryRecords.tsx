import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import { connectPycoreHttp } from '@/apps/pycore-manager/api';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { laravelMediaUrl } from '@/core/integrations/laravel/LaravelMediaUrl';
import type { AgentHistoryArticleRecord, AgentHistoryArticleRecordMetadata } from '@/apps/pycore-manager/api';
import { agentHistoryPageTableStore } from '@/apps/pycore-manager/persistence/AgentHistoryPageTableStore';
import { StorageManager } from '../../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';

const RECORD_PAGE_SIZE = 10;

/**
 * Article audio streams straight from Laravel: the record's audio_url rebased
 * onto the active Laravel endpoint. Queued audio (Laravel answers 202) shows
 * as "not ready" instead of a player.
 */
const RecordAudio: React.FC<{ record: AgentHistoryArticleRecord; tk: (k: string) => string }> = ({ record, tk }) => {
  if (record.audio_status !== 'ready' || !record.audio_url) {
    return <div className="text-[11px] text-slate-400">{tk('audioQueued')}</div>;
  }
  return (
    <audio
      controls
      preload="none"
      src={laravelMediaUrl(record.audio_url)}
      className="w-full h-8 mt-2"
    />
  );
};

/**
 * Generation records — DIFF read surface: the ID page table (IDs + status
 * metadata only) is cached in the frontend store and aligned by revision;
 * full record bodies are materialized lazily for the visible page.
 */
const PcAgentHistoryRecords: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [records, setRecords] = useState<AgentHistoryArticleRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(
    1,
    Number(StorageManager.get<number>(StorageKeys.PYCORE_AGENT_HISTORY_RECORD_PAGE, 1)),
  ));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const materializedKey = useRef('');

  useEffect(() => {
    StorageManager.set(StorageKeys.PYCORE_AGENT_HISTORY_RECORD_PAGE, page);
  }, [page]);

  const load = useCallback(async () => {
    try {
      const scope = `records|page=${page}`;
      const cached = agentHistoryPageTableStore.read<AgentHistoryArticleRecordMetadata>(scope);
      const res = await pycoreApi.getAgentHistoryArticleRecordIdPages({
        page,
        pageSize: RECORD_PAGE_SIZE,
        sinceRevision: cached?.revision,
      });
      if (!mounted.current) return;
      if (!res.success || !res.data) {
        setLoadError(res.error || 'Failed to load records');
        return;
      }
      let table = cached;
      if (!res.data.unchanged || !table) {
        table = { revision: res.data.revision, total: res.data.total, items: res.data.items || [], updatedAt: Date.now() };
        agentHistoryPageTableStore.write(scope, table);
      }
      setTotal(table.total);
      const nextMaterializedKey = `${scope}|${table.revision}`;
      if (res.data.unchanged && materializedKey.current === nextMaterializedKey) {
        setLoadError(null);
        return;
      }
      const ids = table.items.map((item) => item.id);
      if (ids.length === 0) {
        setRecords([]);
        setLoadError(null);
        materializedKey.current = nextMaterializedKey;
        return;
      }
      const rows = await pycoreApi.getAgentHistoryArticleRecordPage(ids);
      if (!mounted.current) return;
      if (rows.success && rows.data) {
        setRecords(rows.data.items || []);
        setLoadError(null);
        materializedKey.current = nextMaterializedKey;
      } else {
        setLoadError(rows.error || 'Failed to load records');
      }
    } catch (e) {
      if (mounted.current) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load records');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    mounted.current = true;
    connectPycoreHttp();
    void load();
    const off = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.articlePublished, () => {
      void load();
    });
    return () => {
      mounted.current = false;
      off();
    };
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / RECORD_PAGE_SIZE));

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Disc3 className="w-3.5 h-3.5 text-indigo-500" />
          {tk('recordsTitle')}
          <span className="text-[11px] font-normal text-slate-400">{total}</span>
        </h2>
        {loading && <span className="text-[11px] text-slate-400">…</span>}
        {loadError && !loading && (
          <span className="text-[11px] text-amber-500" title={loadError}>{loadError}</span>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-xs text-slate-400">{tk('recordsEmpty')}</div>
      ) : (
        <>
          <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {records.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200/80 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.title_en || r.title_cn}</div>
                    {r.title_cn && r.title_en && (
                      <div className="text-[11px] text-slate-400 truncate">{r.title_cn}</div>
                    )}
                  </div>
                  <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${r.uploaded
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                    }`}>
                    {r.uploaded ? tk('uploaded') : tk('pendingUpload')}
                  </span>
                  {r.uploaded && r.audio_available && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${r.audio_status === 'ready'
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                    }`}>
                      {r.audio_status === 'ready' ? tk('audioReady') : tk('audioQueued')}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
                  <span>{r.created_at}</span>
                  <span>{Number(r.word_count ?? 0)} {tk('words')}</span>
                  {r.openrouter_model && <span className="truncate">{r.openrouter_model}</span>}
                  {r.translation_engine && <span>{r.translation_engine}</span>}
                </div>
                {r.audio_available && <RecordAudio record={r} tk={tk} />}

                {(r.reference_cn || r.article_en) && (
                  <div className="mt-2 space-y-3 pl-2 border-l-2 border-indigo-200 dark:border-indigo-900 max-h-[300px] overflow-y-auto pr-2 text-sm">
                    {r.article_en && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">English</div>
                        <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{r.article_en}</div>
                      </div>
                    )}
                    {r.reference_cn && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Chinese (Reference)</div>
                        <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap text-[13px]">{r.reference_cn}</div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                className="px-3 py-1 rounded border text-sm disabled:opacity-40"
              >
                {tk('prev')}
              </button>
              <span className="text-xs text-slate-500">{page} / {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                className="px-3 py-1 rounded border text-sm disabled:opacity-40"
              >
                {tk('next')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PcAgentHistoryRecords;
