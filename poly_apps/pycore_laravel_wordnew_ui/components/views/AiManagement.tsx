/**
 * AiManagement — laravel-manager page over laravel_main's unified AI gateway.
 *
 * One page for every AI provider laravel_main can dispatch to:
 *   - Provider grid  : catalog renders instantly (no probe); per-card live
 *                      "Test" + one-click "Test All"; status / tier / vision /
 *                      masked key / models / limits / live rate budget.
 *   - Rate meters    : minute / day / month usage vs limits with reset
 *                      countdowns; polled every 5s (the backend tick resets the
 *                      windows, we just reflect them — no quota spend).
 *   - Gateway        : per-provider call counters / cooldown + the recent call
 *                      record list (which provider/model handled each task).
 *   - Chat test      : a compact box to send one message through the gateway
 *                      (Auto smart-dispatch or a specific provider).
 *
 * A failing section never blanks the others — the last good snapshot is kept.
 * BaseAPI auto-logs every request; notable user actions also append to the
 * global log store.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit, RefreshCcw, CheckCircle2, AlertTriangle, MinusCircle, Timer, KeyRound,
  Snowflake, Activity, Gauge, Eye, ImageIcon, Send, Radio, Server, Clock,
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { useToast } from '../admin';
import { appendLog } from '../../core/logstore/logStore';
import type {
  AiProvider, AiRateStatus, AiGatewayProvider, AiGatewayRecord, AiChatResult,
} from '@/apps/laravel-manager/api';
import AiUsagePanel from '../ai-tools/AiUsagePanel';
import AiKeysPanel from '../ai-tools/AiKeysPanel';

const TIER_CLS: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-500',
  balance: 'bg-sky-500/15 text-sky-500',
  paid: 'bg-amber-500/15 text-amber-500',
};

/** Shared glass-card surface used across the laravel-manager views. */
const CARD = 'rounded-2xl ring-1 ring-slate-200/60 dark:ring-white/5 bg-white/70 dark:bg-white/[0.025] backdrop-blur-md shadow-sm';

function modelsLabel(models: string[]): string {
  const n = models?.length ?? 0;
  if (n === 0) return '-';
  if (n === 1) return models[0];
  return `${models[0]} +${n - 1}`;
}

/** Split a registry limits string into display chips (semicolon-separated). */
const LimitChips: React.FC<{ limits: string }> = ({ limits }) => {
  const parts = limits.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {parts.map((part, i) => (
        <span
          key={i}
          title={part}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium
                     bg-indigo-500/8 border border-indigo-400/20 text-slate-500 dark:text-slate-400"
        >
          <Gauge className="w-3 h-3 text-indigo-400/70 shrink-0" />
          <span className="leading-snug">{part}</span>
        </span>
      ))}
    </div>
  );
};

/** Local rate-budget bars for one provider (minute / day / month usage vs limit). */
const RateBudget: React.FC<{ rate?: AiRateStatus | null }> = ({ rate }) => {
  if (!rate) return null;
  if (!rate.enforced) {
    return <p className="text-[10px] font-mono text-slate-400 mt-2">{rate.note || 'no local rate limit'}</p>;
  }
  const lim = rate.limits;
  const use = rate.usage;
  const resetSecs = [rate.resets_in?.minute, rate.resets_in?.day, rate.resets_in?.month]
    .filter((s): s is number => typeof s === 'number' && s > 0);
  const soonestReset = resetSecs.length ? Math.min(...resetSecs) : null;
  const fmtReset = (s: number) =>
    s < 90 ? `${Math.ceil(s)}s`
      : s < 5400 ? `${Math.ceil(s / 60)}m`
        : s < 172800 ? `${Math.ceil(s / 3600)}h`
          : `${Math.ceil(s / 86400)}d`;
  const cell = (label: string, used?: number, max?: number | null) => {
    if (max == null || used == null) return null;
    const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
    const bar = pct >= 85 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <div key={label} className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
          <span className="uppercase tracking-wide">{label}</span><span>{used}/{max}</span>
        </div>
        <div className="h-1 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden mt-0.5">
          <div className={`h-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };
  const cells = [
    cell('min', use?.minute, lim?.rpm),
    cell('day', use?.day, lim?.rpd),
    cell('mo', use?.month, lim?.rpm_month),
  ].filter(Boolean);
  return (
    <div className="mt-2" title={`local rate budget · auto-resets by the AI rate window${rate.last_updated ? ` · limits verified ${rate.last_updated}` : ''}`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <Gauge className="w-3 h-3 text-indigo-400/70" /> Rate budget
        </span>
        {soonestReset != null && (
          <span className="text-[9px] font-mono text-slate-400" title="Time until the soonest budget reset (minute window / local midnight / 1st of month)">
            resets in {fmtReset(soonestReset)}
          </span>
        )}
      </div>
      {cells.length > 0
        ? <div className="flex gap-2">{cells}</div>
        : <p className="text-[10px] font-mono text-slate-400">{lim?.note || 'enforced'}</p>}
    </div>
  );
};

const ProviderBadge: React.FC<{ p: AiProvider }> = ({ p }) => {
  let key: 'available' | 'unavailable' | 'unconfigured' | 'untested' | 'ratelimited';
  if (!p.configured) key = 'unconfigured';
  else if (p.rate_limited) key = 'ratelimited';
  else if (!p.tested) key = 'untested';
  else key = p.available ? 'available' : 'unavailable';
  const map = {
    available:    { cls: 'bg-emerald-500/15 text-emerald-500', Icon: CheckCircle2,  label: 'Available' },
    unavailable:  { cls: 'bg-amber-500/15 text-amber-500',     Icon: AlertTriangle, label: 'Unavailable' },
    unconfigured: { cls: 'bg-slate-500/15 text-slate-400',     Icon: MinusCircle,   label: 'Unconfigured' },
    untested:     { cls: 'bg-slate-500/10 text-slate-400',     Icon: MinusCircle,   label: 'Untested' },
    ratelimited:  { cls: 'bg-rose-500/15 text-rose-500',       Icon: Snowflake,     label: 'Rate limited' },
  }[key];
  const { Icon } = map;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${map.cls}`}
          title={p.error || undefined}>
      <Icon className="w-3 h-3" /> {map.label}
    </span>
  );
};

const AiManagement: React.FC = () => {
  const toast = useToast();

  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [testing, setTesting] = useState<Set<string>>(new Set());

  const [gateway, setGateway] = useState<{ providers: AiGatewayProvider[]; records: AiGatewayRecord[] } | null>(null);

  // Chat test box state.
  const [chatProvider, setChatProvider] = useState('auto');
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatReply, setChatReply] = useState<AiChatResult | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  // --- catalog (instant grid, no probe) ----------------------------------- #
  const loadCatalog = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.aiManagement.getCatalog();
      if (res.success && res.data) {
        setProviders(Array.isArray(res.data.providers) ? res.data.providers : []);
        setError(res.data.error ?? null);
        setUnreachable(false);
      } else {
        setUnreachable(true);
        setError(res.error || 'laravel_main unreachable');
      }
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'laravel_main unreachable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadGateway = useCallback(async () => {
    try {
      const res = await api.aiManagement.getGateway();
      if (res.success && res.data) {
        setGateway({
          providers: Array.isArray(res.data.providers) ? res.data.providers : [],
          records: Array.isArray(res.data.records) ? res.data.records : [],
        });
      }
    } catch { /* keep last */ }
  }, []);

  // Merge ONLY the live rate snapshot into each provider (keeps availability /
  // models / etc.) so the budget bars visibly auto-reset as the backend tick
  // prunes expired windows — no provider call, no quota spend.
  const refreshRates = useCallback(async () => {
    try {
      const res = await api.aiManagement.getRateLimits();
      const list = res.success && res.data ? res.data.providers : [];
      const byName = new Map((list ?? []).map((rt) => [rt.provider, rt]));
      if (byName.size === 0) return;
      setProviders((prev) => {
        if (!prev) return prev;
        return prev.map((p) => {
          const rt = byName.get(p.name);
          return rt ? { ...p, rate: rt } : p;
        });
      });
    } catch { /* keep last */ }
  }, []);

  // Replace one provider row in place (after a single-provider test) — order unchanged.
  const mergeProvider = useCallback((rec: AiProvider) => {
    setProviders((prev) => {
      const list = prev ? [...prev] : [];
      const i = list.findIndex((p) => p.name === rec.name);
      if (i >= 0) list[i] = rec; else list.push(rec);
      return list;
    });
  }, []);

  // Merge a probe-all array, preserving the current display order.
  const mergeProviders = useCallback((incoming: AiProvider[]) => {
    setProviders((prev) => {
      const order = prev ?? [];
      const byName = new Map(incoming.map((p) => [p.name, p]));
      const merged = order.map((p) => byName.get(p.name) ?? p);
      for (const p of incoming) {
        if (!order.some((op) => op.name === p.name)) merged.push(p);
      }
      return merged;
    });
  }, []);

  const testOne = useCallback(async (name: string) => {
    setTesting((s) => { const n = new Set(s); n.add(name); return n; });
    try {
      const res = await api.aiManagement.probeOne(name);
      if (res.success && res.data && res.data.name) {
        const rec = res.data;
        mergeProvider(rec);
        if (rec.rate_limited) {
          toast.warning(`${name} is rate limited`, 'AI test');
        } else if (rec.available) {
          toast.success(`${name} OK · ${Math.round(rec.latency_ms ?? 0)} ms`, 'AI test');
        } else {
          toast.error(rec.error || `${name} unavailable`, 'AI test');
        }
        appendLog(rec.available ? 'success' : 'warn', 'ai',
          `Probe ${name} → ${rec.available ? `available (${Math.round(rec.latency_ms ?? 0)}ms)` : (rec.error || 'unavailable')}`);
      } else {
        toast.error(res.error || `${name} probe failed`, 'AI test');
      }
    } catch (e: any) {
      toast.error(e?.message || `${name} probe failed`, 'AI test');
    } finally {
      setTesting((s) => { const n = new Set(s); n.delete(name); return n; });
    }
  }, [mergeProvider, toast]);

  const testAll = useCallback(async () => {
    setTestingAll(true);
    appendLog('info', 'ai', 'Testing all AI providers…');
    try {
      const res = await api.aiManagement.probeAll(true);
      if (res.success && res.data && Array.isArray(res.data.providers)) {
        mergeProviders(res.data.providers);
        const ok = res.data.providers.filter((p) => p.available).length;
        toast.success(`Tested ${res.data.providers.length} providers · ${ok} available`, 'AI test all');
        appendLog('success', 'ai', `Test all → ${ok}/${res.data.providers.length} available`);
        setError(res.data.error ?? null);
        setUnreachable(false);
      } else {
        toast.error(res.error || 'Test all failed', 'AI test all');
        setError(res.error || 'probe failed');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Test all failed', 'AI test all');
      setError(e?.message || 'probe failed');
    } finally {
      setTestingAll(false);
    }
  }, [mergeProviders, toast]);

  const refreshAll = useCallback(() => {
    void loadCatalog(true);
    void refreshRates();
    void loadGateway();
  }, [loadCatalog, refreshRates, loadGateway]);

  // --- chat test ----------------------------------------------------------- #
  const sendChat = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || chatSending) return;
    setChatSending(true);
    setChatError(null);
    setChatReply(null);
    appendLog('info', 'ai', `Chat test → ${chatProvider} : ${message.slice(0, 80)}`);
    try {
      const res = await api.aiManagement.chat({
        provider: chatProvider,
        message,
        source: 'ai-management',
      });
      if (res.success && res.data && res.data.success) {
        setChatReply(res.data);
        appendLog('success', 'ai',
          `Chat reply via ${res.data.provider}/${res.data.model} (${Math.round(res.data.latency_ms ?? 0)}ms)`);
      } else {
        const msg = res.data?.error || res.error || 'Chat request failed';
        const retry = res.data?.retry_after_s;
        setChatError(retry != null ? `${msg} (retry in ${retry}s)` : msg);
        toast.error(msg, 'Chat test');
        appendLog('error', 'ai', `Chat test failed: ${msg}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Chat request failed';
      setChatError(msg);
      toast.error(msg, 'Chat test');
    } finally {
      setChatSending(false);
    }
  }, [chatInput, chatProvider, chatSending, toast]);

  // --- lifecycle ----------------------------------------------------------- #
  useEffect(() => {
    void loadCatalog(false);
    void refreshRates();
    void loadGateway();
  }, [loadCatalog, refreshRates, loadGateway]);

  // Rate budgets + gateway records poll slowly (the backend owns the resets;
  // we just reflect the live snapshot — no provider call, no quota spend).
  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshRates();
      void loadGateway();
    }, 5000);
    return () => window.clearInterval(id);
  }, [refreshRates, loadGateway]);

  const list = providers ?? [];
  const configuredProviders = useMemo(
    () => list.filter((p) => p.configured).map((p) => p.name),
    [list],
  );

  return (
    <div className="p-6 md:p-8 space-y-5 min-w-0 max-w-full">
      {/* Sticky page chrome — title + actions pinned while scrolling. */}
      <div className="sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-3 -mt-6 md:-mt-8 mb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl">
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <BrainCircuit className="w-5 h-5 text-indigo-500" /> AI Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            laravel_main unified AI gateway — providers, live rate budgets, gateway activity and a chat test.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 self-end sm:self-auto">
          <button
            onClick={testAll}
            disabled={testingAll || loading || list.length === 0}
            title="Run a live availability test against every configured provider"
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
            <Activity className={`w-3.5 h-3.5 ${testingAll ? 'animate-pulse' : ''}`} /> {testingAll ? 'Testing…' : 'Test All'}
          </button>
          <button
            onClick={refreshAll}
            disabled={loading || refreshing}
            title="Reload the provider catalog, rate budgets and gateway activity"
            className="px-3 py-2 ring-1 ring-slate-200/60 dark:ring-white/10 bg-white/60 dark:bg-white/5 hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50 text-slate-700 dark:text-slate-200">
            <RefreshCcw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {(unreachable || error) && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            {unreachable ? 'laravel_main is unreachable.' : 'AI gateway reported a problem.'}
            {error ? ` (${error})` : ''}
          </span>
        </div>
      )}

      {/* ===================== Provider grid ===================== */}
      <section className={`${CARD} p-5`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> AI Providers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              The catalog lists every provider instantly. A live availability test runs only when you click Test / Test All.
            </p>
          </div>
        </div>

        {loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> Loading providers…
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            No providers reported by the gateway.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {list.map((p) => {
              const busy = testing.has(p.name);
              return (
                <div key={p.name}
                     className={`rounded-2xl p-4 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col gap-2 ${!p.configured ? 'opacity-60' : ''}`}>
                  {/* header: name + tier/vision/image + availability */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                      {p.tier && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${TIER_CLS[p.tier] ?? ''}`}>{p.tier}</span>
                      )}
                      {p.vision && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-violet-500/15 text-violet-500">
                          <Eye className="w-3 h-3" /> vision
                        </span>
                      )}
                      {p.image && (
                        <span
                          title={p.image_model ? `image model: ${p.image_model}${p.image_ready ? '' : ' (not ready)'}` : (p.image_ready ? 'image ready' : 'image capable (not ready)')}
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            p.image_ready
                              ? 'bg-pink-500/15 text-pink-500'
                              : 'border border-pink-400/30 text-pink-400/70'
                          }`}
                        >
                          <ImageIcon className="w-3 h-3" /> image{p.image_model ? ` · ${p.image_model}` : ''}
                        </span>
                      )}
                    </div>
                    <ProviderBadge p={p} />
                  </div>

                  {/* key / models / latency */}
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 font-mono truncate" title="API key (masked)">
                      <KeyRound className="w-3 h-3 shrink-0" />{p.key_masked || 'no key'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono truncate" title="Models">
                      <BrainCircuit className="w-3 h-3 shrink-0" />{modelsLabel(p.models ?? [])}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono" title="Latency of the last availability test">
                      <Timer className="w-3 h-3 shrink-0" />{p.tested && p.latency_ms != null ? `${Math.round(p.latency_ms)} ms` : 'not tested'}
                    </span>
                  </div>

                  {p.limits && <LimitChips limits={p.limits} />}
                  <RateBudget rate={p.rate} />

                  {p.tested && p.configured && !p.available && p.error && (
                    <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-snug flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="break-words">{p.error}</span>
                    </p>
                  )}

                  {/* per-card on-demand test */}
                  <button
                    onClick={() => testOne(p.name)}
                    disabled={busy || testingAll || !p.configured}
                    title={p.configured ? (p.tested ? 'Re-test this provider' : 'Test this provider') : 'No API key configured'}
                    className={`mt-auto self-start px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      p.tested && p.available
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                        : p.tested && p.configured && !p.available
                          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                          : 'ring-1 ring-slate-200/60 dark:ring-white/10 bg-white/60 dark:bg-white/5 hover:bg-indigo-500/10 text-indigo-500'
                    }`}>
                    {busy ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                    {busy ? 'Testing…' : p.tested ? 'Re-test' : 'Test'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================== Provider API keys ===================== */}
      <section className={`${CARD} p-2 sm:p-3`}>
        <AiKeysPanel />
      </section>

      {/* ===================== Gateway activity ===================== */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Radio className="w-4 h-4 text-indigo-500" /> Gateway Activity
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Per-provider dispatch counters and the most recent gateway calls (which provider/model handled each task).
        </p>

        {!gateway ? (
          <p className="text-[11px] italic text-slate-400">Gateway activity unavailable.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* per-provider counters */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Providers
              </h3>
              {gateway.providers.length === 0 ? (
                <p className="text-[11px] italic text-slate-400">No provider activity yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {gateway.providers.map((gp) => (
                    <li key={gp.name}
                        className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{gp.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {gp.tier && (
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${TIER_CLS[gp.tier] ?? ''}`}>{gp.tier}</span>
                          )}
                          {gp.cooldown_s > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-rose-500" title="Cooling down after a rate-limit / failure">
                              <Snowflake className="w-3 h-3" /> {gp.cooldown_s}s
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-400">
                        <span title="Total calls">calls {gp.calls}</span>
                        <span className="text-emerald-500" title="Successful calls">ok {gp.ok}</span>
                        <span className="text-rose-500" title="Failed calls">failed {gp.failed}</span>
                      </div>
                      {gp.last_error && (
                        <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 mt-1 truncate" title={gp.last_error}>
                          {gp.last_error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* recent records */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Recent calls
              </h3>
              {gateway.records.length === 0 ? (
                <p className="text-[11px] italic text-slate-400">No recent gateway calls.</p>
              ) : (
                <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {gateway.records.map((r, i) => (
                    <li key={`${r.ts}-${i}`}
                        className="rounded-xl px-3 py-1.5 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">
                            {r.provider}<span className="text-slate-400 font-normal">/{r.model || '-'}</span>
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 shrink-0">
                            {r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400">
                          <span className="uppercase">{r.kind}</span>
                          {r.source && <span className="truncate">· {r.source}</span>}
                        </div>
                        {!r.success && r.error && (
                          <p className="text-[9px] text-rose-500 truncate" title={r.error}>{r.error}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ===================== AI Usage (shared) ===================== */}
      <section className={`${CARD} p-2 sm:p-3`}>
        <AiUsagePanel
          title="AI Usage (shared)"
          fetchUsage={(limit) => api.aiManagement.getUsage(limit)}
        />
      </section>

      {/* ===================== Chat test ===================== */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Send className="w-4 h-4 text-indigo-500" /> Chat test
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Send one message through the gateway. Auto uses smart free→balance→paid dispatch; pick a provider to force it.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={chatProvider}
            onChange={(e) => setChatProvider(e.target.value)}
            disabled={chatSending}
            className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium border bg-white/60 dark:bg-white/5 border-slate-300/40 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50">
            <option value="auto">Auto (smart dispatch)</option>
            {configuredProviders.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
            placeholder="Type a test prompt…"
            disabled={chatSending}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs border bg-white/60 dark:bg-white/5 border-slate-300/40 dark:border-white/10 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50"
          />
          <button
            onClick={() => void sendChat()}
            disabled={chatSending || !chatInput.trim()}
            className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
            {chatSending ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {chatSending ? 'Sending…' : 'Send'}
          </button>
        </div>

        {chatError && (
          <div className="mt-3 flex items-start gap-2 text-xs rounded-xl p-3 border bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{chatError}</span>
          </div>
        )}

        {chatReply && (
          <div className="mt-3 rounded-xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {chatReply.nickname || chatReply.provider}
                <span className="text-slate-400 font-normal font-mono"> · {chatReply.provider}/{chatReply.model}</span>
              </span>
              {chatReply.latency_ms != null && (
                <span className="text-[10px] font-mono text-slate-400 shrink-0">{Math.round(chatReply.latency_ms)} ms</span>
              )}
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
              {chatReply.text}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default AiManagement;
