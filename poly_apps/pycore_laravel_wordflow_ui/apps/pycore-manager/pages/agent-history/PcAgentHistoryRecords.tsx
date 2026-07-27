import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { pycoreApi } from '../../../../core/api-libs/pycore/PycoreApi';
import type { AgentHistoryArticleRecord } from '../../../../core/api-libs/pycore/pycoreTypes';

const RECORDS_POLL_MS = 8_000;
const LS_CACHE_KEY = 'pc_agent_history_records_cache';

/** Last successful records payload, so the list renders instantly on mount. */
function readCachedRecords(): AgentHistoryArticleRecord[] {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

/** Generation records — polls article/records every 8s, stale-while-revalidate via localStorage. */
const PcAgentHistoryRecords: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [records, setRecords] = useState<AgentHistoryArticleRecord[]>(readCachedRecords);
  const [loading, setLoading] = useState(records.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await pycoreApi.getAgentHistoryArticleRecords();
      const list = res?.records ?? res?.data?.records;
      if (!mounted.current) return;
      if (Array.isArray(list)) {
        setRecords(list);
        setLoadError(null);
        try {
          localStorage.setItem(LS_CACHE_KEY, JSON.stringify(list));
        } catch { /* storage full / unavailable */ }
      } else if ((res as { success?: boolean; error?: string })?.success === false) {
        setLoadError((res as { error?: string }).error || 'Failed to load records');
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
    void load();
    const id = setInterval(() => void load(), RECORDS_POLL_MS);
    return () => { mounted.current = false; clearInterval(id); };
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
