import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Radio, RefreshCw } from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type { AiUsageInFlight, AiUsageRecord, AiUsageResponse } from '@/apps/pycore-manager/api';
import PcFloatingPanel from './PcFloatingPanel';
import PcPager from '../pages/agent-history/PcPager';

/**
 * Generic paged AI request records panel (floating). Reusable by any AI
 * surface: the caller scopes the listing via provider/sources/kind. Shows
 * in-flight calls with live elapsed time, a day filter, and paged records;
 * expanding a row reveals the captured prompt/response detail. Records come
 * from the shared cross-runtime usage store (ui/ai_probe/usage, paged mode).
 */

const PAGE_SIZE = 20;
const POLL_MS = 4000;

// English fallbacks for consumers whose tk does not define the panel keys
// (the pycore-manager `agentHistory` namespace defines all of them).
const FALLBACKS: Record<string, string> = {
  recordsPanelTitle: 'AI request records',
  recordsPanelAllProviders: 'All providers',
  recordsPanelDay: 'Day',
  recordsPanelAllDays: 'All days',
  recordsPanelInFlight: 'In flight',
  recordsPanelElapsed: 'elapsed',
  recordsPanelPrompt: 'Prompt sent',
  recordsPanelResponse: 'Response content',
  recordsPanelEmpty: 'No records match the current filters.',
  recordsPanelTotal: 'records',
  succeeded: 'succeeded',
  failed: 'failed',
  close: 'Close',
  loading: 'Loading…',
  loadError: 'Load failed',
  prev: 'Prev',
  next: 'Next',
  jumpPage: 'Page #',
  go: 'Go',
  expandPages: 'Show all pages',
  collapsePages: 'Fold pages',
};

function fmtTime(value: string | number): string {
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : String(value || '');
}

const PcAiUsageRecordsPanel: React.FC<{
  open: boolean;
  onClose: () => void;
  tk: (k: string) => string;
  title?: string;
  /** Scope filters; omit to list every provider/source. */
  provider?: string;
  sources?: string[];
  kind?: string;
  /** Preselected day filter applied every time the panel opens. */
  defaultDay?: string;
}> = ({ open, onClose, tk, title, provider, sources, kind, defaultDay }) => {
  const tl = useCallback((k: string): string => {
    const v = tk(k);
    return v && !v.includes('.') ? v : (FALLBACKS[k] || k);
  }, [tk]);

  const [page, setPage] = useState(1);
  const [day, setDay] = useState('');
  const [data, setData] = useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pycoreApi.getAiUsage({
        kind: kind || 'text',
        provider: provider || undefined,
        sources: sources?.length ? sources : undefined,
        page,
        pageSize: PAGE_SIZE,
        day: day || undefined,
      });
      if (!mounted.current) return;
      if (res.success && res.data) {
        setData(res.data);
        setError('');
      } else {
        setError(res.error || tl('loadError'));
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : tl('loadError'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [day, kind, page, provider, sources, tl]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setDay(String(defaultDay || ''));
    setPage(1);
    setExpandedId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, load]);

  const entries = data?.entries || [];
  const inFlight = data?.in_flight || [];
  const total = Number(data?.total ?? entries.length);
  const totalPages = Math.max(1, Number(data?.page_count || 1));

  const recordKey = (r: AiUsageRecord, index: number) =>
    `${r.iso}|${r.provider}|${r.model}|${r.source}|${index}`;

  return (
    <PcFloatingPanel
      open={open}
      onClose={onClose}
      closeLabel={tl('close')}
      widthClass="max-w-5xl"
      title={title || tl('recordsPanelTitle')}
      subtitle={`${total} ${tl('recordsPanelTotal')}${provider ? ` · ${provider}` : ''}`}
      footer={<PcPager page={page} totalPages={totalPages} onChange={setPage} tk={tl} />}
    >
      <div className="space-y-3 -m-1 p-1">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            {tl('recordsPanelDay')}:
            <input
              type="date"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setPage(1);
              }}
              className="h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 text-xs"
            />
          </label>
          {day && (
            <button
              type="button"
              onClick={() => { setDay(''); setPage(1); }}
              className="h-7 px-2 rounded-md border border-slate-200 dark:border-white/10 text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              {tl('recordsPanelAllDays')}
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 text-[11px] text-indigo-600 dark:text-indigo-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {tl('go')}
          </button>
        </div>

        {inFlight.length > 0 && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
              <Radio className="w-3 h-3 animate-pulse" />
              {tl('recordsPanelInFlight')} ({inFlight.length})
            </div>
            {inFlight.map((call: AiUsageInFlight) => (
              <div key={call.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{call.provider}/{call.model || '-'}</span>
                <span className="text-slate-400">{call.source || '-'}</span>
                <span className="text-indigo-500">{Math.round(call.elapsed_ms)} ms {tl('recordsPanelElapsed')}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="text-[11px] text-rose-500">{error}</div>}

        {!loading && entries.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">{tl('recordsPanelEmpty')}</div>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((r, index) => {
              const key = recordKey(r, index);
              const expanded = expandedId === key;
              return (
                <li key={key} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? '' : key)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                  >
                    {expanded
                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">
                      {r.provider}/{r.model || '-'}
                      <span className="text-slate-400"> · {r.source || '-'}</span>
                    </span>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${r.success
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}
                    >
                      {r.success ? tl('succeeded') : tl('failed')}
                    </span>
                    <span className="shrink-0 text-[10px] font-mono text-slate-400">
                      {r.latency_ms != null ? `${Math.round(r.latency_ms)} ms` : ''}
                    </span>
                    <span className="shrink-0 text-[10px] font-mono text-slate-400">{fmtTime(r.iso || r.ts)}</span>
                  </button>
                  {expanded && (
                    <div className="border-t border-slate-200 dark:border-white/10 px-3 py-2.5 space-y-2.5">
                      {r.error && (
                        <pre className="whitespace-pre-wrap break-all rounded-lg bg-rose-500/10 p-2.5 text-[11px] text-rose-600 dark:text-rose-300">{r.error}</pre>
                      )}
                      {r.prompt && (
                        <section>
                          <h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{tl('recordsPanelPrompt')}</h5>
                          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 dark:bg-white/5 p-2.5 text-[11px] text-slate-700 dark:text-slate-300">{r.prompt}</pre>
                        </section>
                      )}
                      {r.response && (
                        <section>
                          <h5 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{tl('recordsPanelResponse')}</h5>
                          <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 dark:bg-white/5 p-2.5 text-[11px] text-slate-700 dark:text-slate-300">{r.response}</pre>
                        </section>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PcFloatingPanel>
  );
};

export default PcAiUsageRecordsPanel;
