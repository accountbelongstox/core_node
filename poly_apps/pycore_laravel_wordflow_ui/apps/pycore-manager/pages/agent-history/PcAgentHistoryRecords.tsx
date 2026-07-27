import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { pycoreApi } from '../../../../core/api-libs/pycore/PycoreApi';
import { callRpc, connectPycoreWs } from '../../../../core/api-libs/pycore/PycoreWs';
import { pycoreEventBus } from '../../../../core/api-libs/pycore/PycoreEventBus';
import type { AgentHistoryArticleRecord } from '../../../../core/api-libs/pycore/pycoreTypes';

const PIPELINE_SCOPES = new Set(['agent_history', 'agent_history_pipeline']);

/** Lazy-load article audio via RPC base64 → data URL (no HTTP audio route). */
const RecordAudio: React.FC<{ recordId: string }> = ({ recordId }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requested = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setLoading(true);
    setErr(null);
    try {
      const url = await pycoreApi.getAgentHistoryArticleAudioDataUrl(recordId);
      setSrc(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Audio load failed');
      requested.current = false;
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void load();
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [load]);

  if (err) {
    return (
      <div ref={containerRef} className="text-[11px] text-rose-500 flex items-center gap-2">
        {err}
        <button type="button" onClick={() => void load()} className="underline">Retry</button>
      </div>
    );
  }
  if (!src) {
    return (
      <div ref={containerRef} className="text-[11px] text-slate-400">
        {loading ? 'Loading audio…' : 'Waiting…'}
      </div>
    );
  }
  return <audio controls preload="metadata" src={src} className="w-full h-8 mt-2" />;
};

function recordsFromSnapshot(data: any): AgentHistoryArticleRecord[] | null {
  if (Array.isArray(data?.records)) {
    return data.records as AgentHistoryArticleRecord[];
  }
  // Fallback: derive from completed/uploading operation items.
  const items = Array.isArray(data?.items) ? data.items : [];
  const out: AgentHistoryArticleRecord[] = [];
  for (const item of items) {
    const stage = String(item?.stage || '');
    const result = item?.result;
    if (!result || typeof result !== 'object') continue;
    if (!(stage === 'completed' || stage === 'uploading_laravel' || stage === 'saving_local_result')) {
      continue;
    }
    const recordId = result.record_id || result.id;
    if (!recordId) continue;
    out.push({
      id: String(recordId),
      created_at: String(result.created_at || ''),
      title_cn: String(result.article_cn?.title_cn || result.title_cn || ''),
      title_en: String(result.article_en?.title_en || result.title_en || ''),
      reference_cn: result.article_cn?.reference_cn || result.reference_cn,
      article_en: result.article_en?.article_en || result.article_en,
      word_count: Number(result.word_count || 0),
      openrouter_model: result.article_cn?.used_model || result.openrouter_model,
      translation_engine: result.translation_engine,
      audio_available: !!(result.audio || result.audio_available),
      uploaded: !!result.laravel_data || !!result.uploaded,
      uploaded_at: result.uploaded_at || null,
    });
  }
  return out.length ? out : null;
}

/** Generation records — hydrate from operation snapshot; refresh on operation.changed. */
const PcAgentHistoryRecords: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [records, setRecords] = useState<AgentHistoryArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await callRpc('ui.operation.snapshot', { scope: 'agent_history' });
      if (!mounted.current) return;
      if (res?.success && res.data) {
        const list = recordsFromSnapshot(res.data);
        if (list) {
          setRecords(list);
          setLoadError(null);
          return;
        }
      }
      // Fallback when no pipeline operation exists yet.
      const legacy = await pycoreApi.getAgentHistoryArticleRecords();
      if (!mounted.current) return;
      const list = legacy?.records ?? legacy?.data?.records;
      if (Array.isArray(list)) {
        setRecords(list);
        setLoadError(null);
      } else if ((legacy as { success?: boolean; error?: string })?.success === false) {
        setLoadError((legacy as { error?: string }).error || 'Failed to load records');
      }
    } catch (e) {
      if (mounted.current) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load records');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    connectPycoreWs();
    void load();
    const off = pycoreEventBus.subscribe('operation.changed', (payload: any) => {
      const scope = String(payload?.operation_scope || '');
      if (scope && !PIPELINE_SCOPES.has(scope)) return;
      void load();
    });
    return () => {
      mounted.current = false;
      off();
    };
  }, [load]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Disc3 className="w-3.5 h-3.5 text-indigo-500" />
          {tk('recordsTitle')}
          <span className="text-[11px] font-normal text-slate-400">{records.length}</span>
        </h2>
        {loading && <span className="text-[11px] text-slate-400">…</span>}
        {loadError && !loading && (
          <span className="text-[11px] text-amber-500" title={loadError}>{loadError}</span>
        )}
      </div>

      {records.length === 0 ? (
        <div className="text-xs text-slate-400">{tk('recordsEmpty')}</div>
      ) : (
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
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
                <span>{r.created_at}</span>
                <span>{Number(r.word_count ?? 0)} {tk('words')}</span>
                {r.openrouter_model && <span className="truncate">{r.openrouter_model}</span>}
                {r.translation_engine && <span>{r.translation_engine}</span>}
              </div>
              {r.audio_available && <RecordAudio recordId={String(r.id)} />}

              {(r.reference_cn || r.article_en) && (
                <details className="group mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-indigo-500 font-medium select-none list-none flex items-center gap-1">
                    <span className="group-open:hidden">▶ Show full text</span>
                    <span className="hidden group-open:inline">▼ Hide full text</span>
                  </summary>
                  <div className="mt-2 space-y-3 pl-2 border-l-2 border-indigo-200 dark:border-indigo-900 max-h-[300px] overflow-y-auto pr-2">
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
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PcAgentHistoryRecords;
