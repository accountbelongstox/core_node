/**
 * PcQueueCenterPage — merged Queue Manager + Task Queue + Translation Queue
 * (tabbed), superseding the three separate pages (their old routes
 * /pycore-manager/queue, /task-queue and /translation-queue redirect here with
 * the matching ?tab= — see PcApp.tsx).
 *
 *   - Tab bar with live per-tab counts (rows / tasks / pending), reported up
 *     by the panels via onMeta. Only the ACTIVE tab's panel is mounted, so its
 *     polling/WS work is the only one running.
 *   - Shared refresh button (spins while the active panel is in flight) and an
 *     auto-refresh toggle: ONE interval that bumps `refreshTick` for the
 *     active tab only. Both the tab and the toggle persist in localStorage.
 *   - Compact "Assist Laravel" status strip: pycore's helper that drains
 *     Laravel's cover/tts/translation queues — enabled/running badges, circuit
 *     breaker warning, cycle counters, Laravel-side queue counts, last error,
 *     and a "Run cycle now" action (configure it in Settings → Assist Laravel).
 *
 * The panels keep their original data logic (see the three Pc*Page files, now
 * exporting panels). Local React state, pycoreApi, lucide-react and
 * Tailwind / `.pc-glass` only.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ListOrdered, Layers, ListChecks, Languages, RefreshCw, TimerReset,
  Handshake, AlertTriangle, Play, Loader2, Image as ImageIcon, AudioLines,
} from 'lucide-react';
import { pycoreApi, loadQueueCache } from '../../../core/api-libs/pycore';
import type { AssistStatus } from '../../../core/api-libs/pycore';
import PcQueueManagerPanel from './PcQueueManagerPage';
import PcTaskQueuePanel from './PcTaskQueuePage';
import PcTranslationQueuePanel from './PcTranslationQueuePage';

type QcTab = 'manager' | 'tasks' | 'translation';

const TAB_KEY = 'pc_qc_tab';
const AUTO_KEY = 'pc_qc_auto';
const AUTO_REFRESH_MS = 5000;
const ASSIST_POLL_MS = 15000;

const TABS: { key: QcTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'manager', label: 'Queue Manager', Icon: Layers },
  { key: 'tasks', label: 'Task Queue', Icon: ListChecks },
  { key: 'translation', label: 'Translation Queue', Icon: Languages },
];

const isTab = (v: string | null): v is QcTab =>
  v === 'manager' || v === 'tasks' || v === 'translation';

interface PanelMeta { count: number | null; loading: boolean; }

/** Loose 404/error bodies must not render as a status — shape-guard it. */
const isAssistStatus = (s: any): s is AssistStatus =>
  !!s && typeof s.enabled === 'boolean' && !!s.capabilities;

// --------------------------------------------------------------------------
// Assist Laravel status strip (compact; full config lives in PcSettingsPage).
// --------------------------------------------------------------------------
const PcAssistStrip: React.FC = () => {
  const [status, setStatus] = useState<AssistStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cycling, setCycling] = useState(false);
  const [cycleMsg, setCycleMsg] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getAssistStatus();
      if (!mounted.current) return;
      if (isAssistStatus(s)) { setStatus(s); setErr(null); }
      else setErr((s as any)?.error || (s as any)?.detail || 'assist status unavailable');
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'assist status unavailable');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = window.setInterval(fetchStatus, ASSIST_POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchStatus]);

  const runCycle = useCallback(async () => {
    if (cycling) return;
    setCycling(true);
    setCycleMsg(null);
    try {
      const r = await pycoreApi.runAssistCycle();
      if (!mounted.current) return;
      if (r?.ok) {
        setCycleMsg(`Cycle done — processed ${r.processed ?? 0}, submitted ${r.submitted ?? 0}, released ${r.released ?? 0}${
          Array.isArray(r.errors) && r.errors.length ? `, ${r.errors.length} error(s)` : ''}`);
      } else {
        setCycleMsg(`Cycle failed: ${(r as any)?.error || (r as any)?.detail || 'assist disabled?'}`);
      }
      await fetchStatus();
    } catch (e: any) {
      if (mounted.current) setCycleMsg(`Cycle failed: ${e?.message || 'pycore unreachable'}`);
    } finally {
      if (mounted.current) setCycling(false);
    }
  }, [cycling, fetchStatus]);

  // Unavailable (endpoint missing / pycore offline): one muted line, never a
  // broken strip — the queue tabs below stay fully usable.
  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <Handshake className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">Assist Laravel</span>
        {err ? (
          <span className="truncate text-slate-400" title={err}>status unavailable ({err})</span>
        ) : (
          <span className="text-slate-400">loading…</span>
        )}
        <button onClick={fetchStatus} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-50 shrink-0" title="Refresh assist status">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>
    );
  }

  const badge = (text: string, on: boolean, onCls: string, offCls = 'bg-slate-500/15 text-slate-400') => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${on ? onCls : offCls}`}>
      {text}
    </span>
  );
  const cov = status.laravel_status?.cover;
  const tts = status.laravel_status?.tts;
  const c = status.counters;

  return (
    <section className="pc-glass p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Handshake className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Assist Laravel</span>
        {badge(status.enabled ? 'Enabled' : 'Disabled', status.enabled, 'bg-emerald-500/15 text-emerald-500')}
        {badge(status.running ? 'Running' : 'Idle', status.running, 'bg-sky-500/15 text-sky-500')}
        {status.circuit?.open && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-500"
            title="Backed off after repeated failures">
            <AlertTriangle className="w-3 h-3" /> circuit open
            {status.circuit.cooldown_s > 0 && <span className="font-mono">{Math.round(status.circuit.cooldown_s)}s</span>}
          </span>
        )}
        {status.endpoint?.base_url && (
          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[14rem]"
            title={status.endpoint.label ? `${status.endpoint.label} — ${status.endpoint.base_url}` : status.endpoint.base_url}>
            → {status.endpoint.base_url}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button onClick={runCycle} disabled={!status.enabled || cycling}
            title={status.enabled ? 'Run one claim→process→submit pass now' : 'Enable assist in Settings → Assist Laravel first'}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-50">
            {cycling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run cycle now
          </button>
          <button onClick={fetchStatus} disabled={loading}
            className="p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-50" title="Refresh assist status">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[10px] font-mono text-slate-500">
        <span title="Assist worker counters (this process)">
          claimed <b className="text-slate-700 dark:text-slate-300">{c?.claimed ?? 0}</b>
          {' · '}submitted <b className="text-emerald-500">{c?.submitted ?? 0}</b>
          {' · '}released <b className="text-slate-700 dark:text-slate-300">{c?.released ?? 0}</b>
          {' · '}failures <b className={c?.failures ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>{c?.failures ?? 0}</b>
        </span>
        {cov && (
          <span className="inline-flex items-center gap-1" title="Laravel cover queue (pending / leased)">
            <ImageIcon className="w-3 h-3 text-indigo-400" />
            cover <b className="text-sky-500">{cov.pending}</b> pending · <b className="text-violet-500">{cov.leased}</b> leased
          </span>
        )}
        {tts && (
          <span className="inline-flex items-center gap-1" title="Laravel TTS queue (pending / leased)">
            <AudioLines className="w-3 h-3 text-indigo-400" />
            tts <b className="text-sky-500">{tts.pending}</b> pending · <b className="text-violet-500">{tts.leased}</b> leased
          </span>
        )}
        {status.last_cycle_at && (
          <span title="Last assist cycle">last cycle {new Date(status.last_cycle_at).toLocaleTimeString()}</span>
        )}
      </div>

      {status.last_error && (
        <p className="text-[11px] text-rose-500 break-words" title="Last assist error">
          <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />{status.last_error}
        </p>
      )}
      {cycleMsg && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{cycleMsg}</p>
      )}
    </section>
  );
};

// --------------------------------------------------------------------------
// The merged page.
// --------------------------------------------------------------------------
const PcQueueCenterPage: React.FC = () => {
  // Initial tab: ?tab= (set by the legacy-route redirects) wins over the
  // last-used tab persisted in localStorage.
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<QcTab>(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(TAB_KEY);
    return isTab(saved) ? saved : 'manager';
  });
  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

  // A legacy-slug redirect can land here while the page is ALREADY mounted
  // (only ?tab= changes, no remount) — keep the tab in sync with the URL.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) setTab(fromUrl);
  }, [searchParams]);

  const switchTab = useCallback((next: QcTab) => {
    setTab(next);
    // Keep the URL shareable/deep-linkable without growing history.
    setSearchParams({ tab: next }, { replace: true });
  }, [setSearchParams]);

  // Shared refresh: bumping the tick refreshes the ACTIVE panel (the only one
  // mounted). The auto-refresh toggle drives one interval over the same tick.
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(() => localStorage.getItem(AUTO_KEY) === '1');
  useEffect(() => { localStorage.setItem(AUTO_KEY, auto ? '1' : '0'); }, [auto]);
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setTick((t) => t + 1), AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto]);

  // Per-tab meta (count + loading) reported by the panels. Inactive tabs keep
  // their last-known count; the manager count is seeded from the queue cache.
  const [meta, setMeta] = useState<Record<QcTab, PanelMeta>>(() => ({
    manager: { count: loadQueueCache()?.length ?? null, loading: false },
    tasks: { count: null, loading: false },
    translation: { count: null, loading: false },
  }));
  const reportMeta = useCallback((key: QcTab, m: PanelMeta) => {
    setMeta((prev) =>
      prev[key].count === m.count && prev[key].loading === m.loading
        ? prev
        : { ...prev, [key]: m });
  }, []);
  const onManagerMeta = useCallback((m: PanelMeta) => reportMeta('manager', m), [reportMeta]);
  const onTasksMeta = useCallback((m: PanelMeta) => reportMeta('tasks', m), [reportMeta]);
  const onTranslationMeta = useCallback((m: PanelMeta) => reportMeta('translation', m), [reportMeta]);

  const activeLoading = meta[tab].loading;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* header + tabs + shared refresh controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <ListOrdered className="w-5 h-5 text-indigo-500" /> Queue Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            All pycore queues in one place — system operations, voice-subtitle tasks, Laravel translations.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl pc-glass overflow-hidden">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                  tab === key
                    ? 'bg-indigo-500/15 text-indigo-500'
                    : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
                {meta[key].count != null && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    tab === key ? 'bg-indigo-500/15 text-indigo-500' : 'bg-slate-500/10 text-slate-400'}`}>
                    {meta[key].count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAuto((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              auto
                ? 'bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30'
                : 'pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
            }`}
            title={auto ? `Auto-refresh on — the active tab refreshes every ${AUTO_REFRESH_MS / 1000}s` : 'Auto-refresh off'}>
            <TimerReset className="w-3.5 h-3.5" />
            Auto {auto ? 'on' : 'off'}
          </button>
          <button
            onClick={() => setTick((t) => t + 1)}
            disabled={activeLoading}
            className="p-2 rounded-xl pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
            title="Refresh the active tab">
            <RefreshCw className={`w-4 h-4 ${activeLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Assist Laravel status strip (configure in Settings → Assist Laravel) */}
      <PcAssistStrip />

      {/* Only the active tab is mounted, so its polling is the only one running. */}
      {tab === 'manager' && <PcQueueManagerPanel refreshTick={tick} onMeta={onManagerMeta} />}
      {tab === 'tasks' && <PcTaskQueuePanel refreshTick={tick} onMeta={onTasksMeta} />}
      {tab === 'translation' && <PcTranslationQueuePanel refreshTick={tick} onMeta={onTranslationMeta} />}
    </div>
  );
};

export default PcQueueCenterPage;
