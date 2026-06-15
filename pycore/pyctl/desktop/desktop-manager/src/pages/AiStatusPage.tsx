import { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit, RefreshCcw, CheckCircle2, AlertTriangle, MinusCircle, Timer, KeyRound,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import { pycoreApi } from '../api/pycore';
import AiChatPanel from '../components/AiChatPanel';
import type { AiProvider } from '../types';

/**
 * AI Status — provider availability dashboard.
 *
 * On mount it probes the pycore backend (GET /api/local/ai/probe via the /pyapi
 * reverse proxy) and renders one row per AI provider with an availability badge,
 * the (already-masked) API key, model count and live latency. The Refresh button
 * re-probes with ?refresh=1 so the backend re-checks live instead of serving its
 * cached result. The probe contract is owned by the backend:
 *   { providers: [{ name, configured, available, key_masked, models, error, latency_ms }] }
 */

type Availability = 'available' | 'unavailable' | 'unconfigured';

function availabilityOf(p: AiProvider): Availability {
  if (!p.configured) return 'unconfigured';
  return p.available ? 'available' : 'unavailable';
}

export default function AiStatusPage() {
  const { settings, t } = useApp();
  const dark = settings.theme === 'dark';

  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [loading, setLoading] = useState(true);   // first paint = loading
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The provider whose chat-test panel is open (null = closed).
  const [chatProvider, setChatProvider] = useState<AiProvider | null>(null);

  const probe = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await pycoreApi.probeAi(refresh);
      const list = Array.isArray(r?.providers) ? r.providers : [];
      setProviders(list);
      setError(r?.error ?? null);
    } catch (e: any) {
      setError(e?.message || t.aiError);
      // keep the last good snapshot (if any) so a transient refresh failure
      // doesn't blank the panel.
      setProviders((prev) => prev);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.aiError]);

  useEffect(() => { probe(false); }, [probe]);

  // --- styling helpers (mirrors the other pages) ------------------------- #
  const card = `rounded-3xl p-6 border backdrop-blur-xl transition-all ${
    dark ? 'bg-slate-900/40 border-white/10' : 'bg-white border-slate-200 shadow-md'}`;
  const stat = `rounded-2xl p-4 border ${
    dark ? 'bg-white/5 border-white/5' : 'bg-slate-100/60 border-slate-300/35'}`;

  const badge = (p: AiProvider) => {
    const a = availabilityOf(p);
    const map = {
      available:    { cls: 'bg-emerald-500/15 text-emerald-500', Icon: CheckCircle2, label: t.aiAvailable },
      unavailable:  { cls: 'bg-amber-500/15 text-amber-500',     Icon: AlertTriangle, label: t.aiUnavailable },
      unconfigured: { cls: 'bg-slate-500/15 text-slate-400',     Icon: MinusCircle,  label: t.aiNotConfigured },
    }[a];
    const { Icon } = map;
    return (
      // The error (if any) surfaces as a native tooltip on hover.
      <span
        className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${map.cls}`}
        title={p.error || undefined}>
        <Icon className="w-3 h-3" /> {map.label}
      </span>
    );
  };

  const modelsLabel = (p: AiProvider): string => {
    const n = p.models?.length ?? 0;
    if (n === 0) return '-';
    if (n === 1) return p.models[0];
    return `${p.models[0]} +${n - 1}`;
  };

  const list = providers ?? [];

  return (
    <div className="space-y-5">
      <div className={card}>
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-sky-400" /> {t.aiStatus}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.aiStatusSubtitle}</p>
            {list.some((p) => availabilityOf(p) === 'available') && (
              <p className="text-[11px] text-sky-500 mt-0.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> {t.aiTestHint}
              </p>
            )}
          </div>
          <button onClick={() => probe(true)} disabled={loading || refreshing}
            className="px-3 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {t.aiRefresh}
          </button>
        </div>

        {/* error banner (shown alongside any cached snapshot) */}
        {error && (
          <div className="mb-4 flex items-start gap-2 text-xs rounded-2xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-500">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{t.aiError} {error}</span>
          </div>
        )}

        {/* states: loading / empty / list */}
        {loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" />
            {t.aiLoading}
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {t.aiEmpty}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {list.map((p) => {
              const clickable = availabilityOf(p) === 'available';
              return (
              <li
                key={p.name}
                onClick={clickable ? () => setChatProvider(p) : undefined}
                onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChatProvider(p); } } : undefined}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={clickable ? t.aiTestHint : (p.error || undefined)}
                className={`${stat} flex items-center gap-3 ${
                  clickable
                    ? 'cursor-pointer hover:border-sky-400/50 hover:bg-sky-500/5 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition'
                    : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-200 truncate">{p.name}</span>
                    {badge(p)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1" title={t.aiKey}>
                      <KeyRound className="w-3 h-3" />
                      <span className="font-mono">{p.key_masked || '-'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t.aiModels}>
                      <BrainCircuit className="w-3 h-3" />
                      <span className="font-mono">{modelsLabel(p)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title={t.aiLatency}>
                      <Timer className="w-3 h-3" />
                      <span className="font-mono">{p.latency_ms != null ? `${Math.round(p.latency_ms)} ms` : '-'}</span>
                    </span>
                  </div>
                </div>
                {clickable && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-500">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.aiChatTitle}</span>
                  </span>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {chatProvider && (
        <AiChatPanel provider={chatProvider} onClose={() => setChatProvider(null)} />
      )}
    </div>
  );
}
