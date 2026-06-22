/**
 * AiUsagePanel — shared cross-runtime AI usage view (text / vision / probe).
 *
 * Self-contained read-only panel over the shared usage store
 * (GET /api/local/ai/usage). It renders a per-provider rollup (text / vision /
 * probe counters + last model) and a recent-records list (newest-first) where
 * each row carries a success/fail dot, a runtime badge (pycore vs laravel), an
 * uppercase kind tag, provider/model, source, latency and any error text.
 *
 * IMAGE generations are NOT shown here — they live in the image history
 * (AiImageHistoryPanel). This panel only covers text / vision / probe usage.
 *
 * The component is runtime-agnostic: it takes a `fetchUsage` callback that
 * returns the dashboard APIResponse envelope `{ success, data, error }`, so both
 * the laravel-manager (api.aiManagement.getUsage) and the pycore-manager
 * (pycoreApi.getAiUsage) can mount it unchanged. Refreshes on mount, on a
 * Refresh button, and on a 10s poll.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, RefreshCcw, AlertTriangle, Clock, Timer, Server,
} from 'lucide-react';
import ToolWrapper from '../universal/ToolWrapper';
import { commonClasses } from '../../styles/theme';
import { AiBentoCard, AiToolAlert } from './ui';

/** Per-kind counters for one provider in the rollup. */
interface UsageKindStat {
  calls: number;
  ok: number;
  failed: number;
}

/** Per-provider usage rollup (kinds + last call). */
interface UsageProviderStat {
  text?: UsageKindStat;
  vision?: UsageKindStat;
  probe?: UsageKindStat;
  last_ts?: number;
  last_model?: string;
}

/** One shared usage record (text / vision / probe). */
interface UsageRecord {
  ts: number;
  iso: string;
  runtime: string;
  kind: string;
  provider: string;
  model: string;
  source: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

/** Payload of GET /usage (the unwrapped `data`). */
interface UsageResponse {
  success: boolean;
  storage_path: string;
  stats: Record<string, UsageProviderStat>;
  entries: UsageRecord[];
}

interface AiUsagePanelProps {
  /** Returns the dashboard APIResponse envelope — read `res.success && res.data`. */
  fetchUsage: (limit?: number) => Promise<{ success: boolean; data: any | null; error: string | null }>;
  title?: string;
}

const RECORD_CAP = 120;
const POLL_MS = 10000;
const FETCH_LIMIT = 150;

const KIND_ORDER: Array<keyof Pick<UsageProviderStat, 'text' | 'vision' | 'probe'>> = ['text', 'vision', 'probe'];

const KIND_CLS: Record<string, string> = {
  text: 'bg-indigo-500/15 text-indigo-500',
  vision: 'bg-violet-500/15 text-violet-500',
  probe: 'bg-sky-500/15 text-sky-500',
};

/** Runtime pill — pycore (sky) vs laravel (rose), distinct colors. */
const RuntimeBadge: React.FC<{ runtime: string }> = ({ runtime }) => {
  const cls = runtime === 'pycore'
    ? 'bg-sky-500/15 text-sky-500'
    : runtime === 'laravel'
      ? 'bg-rose-500/15 text-rose-500'
      : 'bg-slate-500/15 text-slate-400';
  return (
    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {runtime || 'unknown'}
    </span>
  );
};

/** One kind chip: `kind calls (ok/failed)`. */
const KindChip: React.FC<{ kind: string; stat: UsageKindStat }> = ({ kind, stat }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${KIND_CLS[kind] ?? 'bg-slate-500/15 text-slate-400'}`}
    title={`${kind}: ${stat.calls} calls · ${stat.ok} ok · ${stat.failed} failed`}
  >
    <span className="uppercase tracking-wide">{kind}</span>
    <span className="font-mono font-normal">
      {stat.calls}
      <span className="text-emerald-500"> ({stat.ok}</span>
      <span className="text-slate-400">/</span>
      <span className="text-rose-500">{stat.failed})</span>
    </span>
  </span>
);

function fmtTime(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

/** True when a provider rollup row has any text/vision/probe activity. */
function hasActivity(stat: UsageProviderStat): boolean {
  return KIND_ORDER.some((k) => {
    const s = stat[k];
    return !!s && s.calls > 0;
  });
}

const AiUsagePanel: React.FC<AiUsagePanelProps> = ({ fetchUsage, title = 'AI Usage (shared)' }) => {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  // Keep the latest fetchUsage in a ref so `load` stays identity-stable even when
  // the parent passes an inline arrow (which changes every render) — otherwise the
  // poll interval below would tear down and restart on every parent re-render.
  const fetchRef = useRef(fetchUsage);
  fetchRef.current = fetchUsage;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRef.current(FETCH_LIMIT);
      if (!mounted.current) return;
      if (res.success && res.data) {
        setData(res.data as UsageResponse);
        setError(null);
      } else {
        setError(res.error || 'Usage history unavailable.');
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Usage backend unreachable.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = window.setInterval(() => { void load(); }, POLL_MS);
    return () => { mounted.current = false; window.clearInterval(id); };
  }, [load]);

  const stats = data?.stats ?? {};
  const providers = Object.keys(stats).filter((name) => hasActivity(stats[name]));
  const entries = (data?.entries ?? []).slice(0, RECORD_CAP);

  return (
    <ToolWrapper
      title={title}
      icon={Activity}
      gradient="indigo"
      description="Shared cross-runtime AI usage — text / vision / probe (images live in the image history)"
      actions={
        <button
          onClick={() => void load()}
          disabled={loading}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} text-xs flex items-center gap-1.5 disabled:opacity-50`}
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {error && (
          <AiToolAlert variant="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </span>
          </AiToolAlert>
        )}

        {loading && !data ? (
          <div className="text-xs text-slate-500 py-10 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> Loading usage…
          </div>
        ) : (
          <>
            {/* ===================== Per-provider rollup ===================== */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Providers
              </h3>
              {providers.length === 0 ? (
                <p className="text-[11px] italic text-slate-400">No provider usage yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {providers.map((name) => {
                    const s = stats[name];
                    return (
                      <li key={name}
                          className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{name}</span>
                          {s.last_model && (
                            <span className="shrink-0 text-[9px] font-mono text-slate-400 truncate max-w-[50%]" title={`last model: ${s.last_model}`}>
                              {s.last_model}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {KIND_ORDER.map((k) => {
                            const ks = s[k];
                            if (!ks || ks.calls === 0) return null;
                            return <KindChip key={k} kind={k} stat={ks} />;
                          })}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* ===================== Recent records ===================== */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Recent usage
              </h3>
              {entries.length === 0 ? (
                <AiBentoCard>
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400">No text / vision / probe usage recorded yet.</p>
                  </div>
                </AiBentoCard>
              ) : (
                <ul className="space-y-1 max-h-96 overflow-y-auto pr-1">
                  {entries.map((r, i) => (
                    <li key={`${r.ts}-${i}`}
                        className="rounded-xl px-3 py-1.5 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <RuntimeBadge runtime={r.runtime} />
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${KIND_CLS[r.kind] ?? 'bg-slate-500/15 text-slate-400'}`}>
                              {r.kind}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">
                              {r.provider}<span className="text-slate-400 font-normal">/{r.model || '-'}</span>
                            </span>
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-mono text-slate-400">
                            {r.latency_ms != null && (
                              <span className="inline-flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" />{Math.round(r.latency_ms)}ms</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-slate-400 mt-0.5">
                          <span className="truncate">{r.source || '-'}</span>
                          <span className="shrink-0 inline-flex items-center gap-0.5" title={fmtTime(r.ts)}>
                            <Clock className="w-2.5 h-2.5" />{fmtTime(r.ts)}
                          </span>
                        </div>
                        {!r.success && r.error && (
                          <p className="text-[9px] text-rose-500 truncate mt-0.5" title={r.error}>{r.error}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </ToolWrapper>
  );
};

export default AiUsagePanel;
