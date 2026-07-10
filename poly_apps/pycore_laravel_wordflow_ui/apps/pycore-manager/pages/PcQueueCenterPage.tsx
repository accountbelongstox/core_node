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
import { useTranslation } from 'react-i18next';
import {
  ListOrdered, Layers, ListChecks, Languages, RefreshCw, TimerReset,
  Handshake, AlertTriangle, Play, Loader2, Image as ImageIcon, AudioLines,
  Mic, Snowflake, Check, MessageSquareText, Film, Power,
  LayoutGrid, SlidersHorizontal, X, ChevronUp, ChevronDown, ChevronRight,
  Globe, Cpu, Sparkles, Chrome, Users, Save, Server, Wifi, WifiOff,
  History, CheckCircle2, XCircle, MinusCircle, Trash2,
} from 'lucide-react';
import { pycoreApi, loadQueueCache, loadOverviewCache, saveOverviewCache } from '../../../core/api-libs/pycore';
import type {
  AssistStatus, AssistCapabilities, TtsStatus,
  PcQueueOverview, PcQueueCategory, PcQueueWorker, PcQueueHandler,
  PcCapabilitySettings, PcCapabilityBlock, PcCapabilityKey,
  PcTaskRecord, PcTaskRecentStats, SentenceAudioAutoStatus,
} from '../../../core/api-libs/pycore';
import PcQueueManagerPanel from './PcQueueManagerPage';
import PcTaskQueuePanel from './PcTaskQueuePage';
import PcTranslationQueuePanel from './PcTranslationQueuePage';

type QcTab = 'overview' | 'manager' | 'tasks' | 'translation' | 'recent';

const TAB_KEY = 'pc_qc_tab';
const AUTO_KEY = 'pc_qc_auto';
const DRAWER_KEY = 'pc_qc_drawer';
const AUTO_REFRESH_MS = 5000;
const ASSIST_POLL_MS = 15000;
const TTS_POLL_MS = 8000;
const SENTENCE_AUDIO_POLL_MS = 12000;

const TAB_DEFS: { key: QcTab; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', Icon: LayoutGrid },
  { key: 'manager', Icon: Layers },
  { key: 'tasks', Icon: ListChecks },
  { key: 'translation', Icon: Languages },
  { key: 'recent', Icon: History },
];

const isTab = (v: string | null): v is QcTab =>
  v === 'overview' || v === 'manager' || v === 'tasks' ||
  v === 'translation' || v === 'recent';

const CAP_KEYS: PcCapabilityKey[] = ['stt', 'tts', 'image', 'translation'];

// Per-capability assist toggles surfaced in the assist strip (each is an
// independent ON/OFF switch on top of the master `enabled`). Order = display.
type AssistCapKey = keyof AssistCapabilities;
const ASSIST_CAP_KEYS: AssistCapKey[] = [
  'translation', 'ai_translate', 'cover', 'poster', 'image',
  'tts', 'sentence_audio', 'subtitle', 'stt',
];

interface PanelMeta { count: number | null; loading: boolean; }

/** Loose 404/error bodies must not render as a status — shape-guard it. */
const isAssistStatus = (s: any): s is AssistStatus =>
  !!s && typeof s.enabled === 'boolean' && !!s.capabilities;

// --------------------------------------------------------------------------
// Compact one-line summary of a single task record (for the assist strip).
// e.g. "tts 'hello' → audio 21.3KB · posted-back" or "translation 'x' failed".
// --------------------------------------------------------------------------
const lastTaskTitle = (rec: PcTaskRecord): string =>
  `${rec.task_type} '${rec.title}' — ${rec.status}${rec.error ? `: ${rec.error}` : ''}`;

const lastTaskSummary = (rec: PcTaskRecord): string => {
  const head = `${rec.task_type} '${rec.title || '—'}'`;
  if (!rec.success && rec.error) return `${head} failed: ${rec.error}`;
  const d = rec.detail ?? {};
  const out: string[] = [];
  if (typeof d.audio_bytes === 'number') out.push(`audio ${humanBytes(d.audio_bytes)}`);
  if (typeof d.image_bytes === 'number') out.push(`image ${humanBytes(d.image_bytes)}`);
  if (d.translation) out.push(`→ ${d.translation}`);
  const tail = out.length ? ` → ${out.join(' · ')}` : '';
  return `${head}${tail} · ${rec.posted_back ? 'posted-back' : 'not returned'}`;
};

// --------------------------------------------------------------------------
// Assist Laravel status strip (compact; full config lives in PcSettingsPage).
// --------------------------------------------------------------------------
const PcAssistStrip: React.FC = () => {
  const { t } = useTranslation('pc');
  const [status, setStatus] = useState<AssistStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cycling, setCycling] = useState(false);
  const [cycleMsg, setCycleMsg] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  // A per-capability toggle is in flight; disables the whole grid until done.
  const [capBusy, setCapBusy] = useState(false);
  // The single most recent assist task (compact one-line summary). Degrades
  // silently to null when the recent-task endpoint is unavailable.
  const [lastTask, setLastTask] = useState<PcTaskRecord | null>(null);
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
    // Pull the latest assist task on the same cadence; never surface its error.
    try {
      const r = await pycoreApi.getRecentTasks({ limit: 1, worker: 'assist' });
      if (mounted.current) setLastTask(r?.records?.[0] ?? null);
    } catch {
      if (mounted.current) setLastTask(null);
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

  // Auto-On: the master enable toggle. When on, the worker polls Laravel every
  // ~30s and assists (per the per-capability switches) without manual cycles.
  const toggleEnabled = useCallback(async () => {
    if (toggling || !status) return;
    setToggling(true);
    setCycleMsg(null);
    try {
      const r = await pycoreApi.setAssistConfig({ enabled: !status.enabled });
      if (!mounted.current) return;
      if ((r as any)?.success === false) {
        setCycleMsg(`Toggle failed: ${(r as any)?.error || (r as any)?.detail || 'unavailable'}`);
      }
      await fetchStatus();
    } catch (e: any) {
      if (mounted.current) setCycleMsg(`Toggle failed: ${e?.message || 'pycore unreachable'}`);
    } finally {
      if (mounted.current) setToggling(false);
    }
  }, [toggling, status, fetchStatus]);

  // Flip a single assist capability ON/OFF (independent of the master enable).
  const toggleCap = useCallback(async (cap: AssistCapKey) => {
    if (capBusy || !status) return;
    setCapBusy(true);
    setCycleMsg(null);
    const next = !status.capabilities?.[cap];
    try {
      const r = await pycoreApi.setAssistConfig({ capabilities: { [cap]: next } });
      if (!mounted.current) return;
      if ((r as any)?.success === false) {
        setCycleMsg(`Toggle failed: ${(r as any)?.error || (r as any)?.detail || 'unavailable'}`);
      }
      await fetchStatus();
    } catch (e: any) {
      if (mounted.current) setCycleMsg(`Toggle failed: ${e?.message || 'pycore unreachable'}`);
    } finally {
      if (mounted.current) setCapBusy(false);
    }
  }, [capBusy, status, fetchStatus]);

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
  const poster = status.laravel_status?.poster;
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
          <button onClick={toggleEnabled} disabled={toggling}
            title={status.enabled
              ? 'Auto-assist is ON — pycore polls Laravel (~30s) and drains cover/tts/poster. Click to turn off.'
              : 'Turn Auto-assist ON — pycore starts draining Laravel cover/tts/poster queues automatically.'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50 ${
              status.enabled
                ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                : 'pc-glass text-slate-500 hover:bg-emerald-500/10'}`}>
            {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            {status.enabled ? 'Auto On' : 'Auto Off'}
          </button>
          <button onClick={runCycle} disabled={!status.enabled || cycling}
            title={status.enabled ? 'Run one claim→process→submit pass now' : 'Turn Auto On first (or it stays idle)'}
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
        {poster && (
          <span className="inline-flex items-center gap-1"
            title="Laravel movie-poster queue for Books/Subtitles (pending / leased / ready). pycore fetches via TMDB→OMDB.">
            <Film className="w-3 h-3 text-indigo-400" />
            poster <b className="text-sky-500">{poster.pending}</b> pending · <b className="text-violet-500">{poster.leased}</b> leased · <b className="text-emerald-500">{poster.ready}</b> ready
          </span>
        )}
        {status.last_cycle_at && (
          <span title="Last assist cycle">last cycle {new Date(status.last_cycle_at).toLocaleTimeString()}</span>
        )}
      </div>

      <div className="pt-0.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
          {t('queueCenter.assist.capabilities')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {ASSIST_CAP_KEYS.map((cap) => {
            const on = !!status.capabilities?.[cap];
            return (
              <button key={cap} onClick={() => toggleCap(cap)} disabled={capBusy}
                title={t(`queueCenter.assist.cap.${cap}` as const)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50 ${
                  on
                    ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                    : 'pc-glass text-slate-500 hover:bg-emerald-500/10'}`}>
                {on ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Power className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{t(`queueCenter.assist.cap.${cap}` as const)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {lastTask && (
        <p className="text-[10px] font-mono text-slate-400 truncate" title={lastTaskTitle(lastTask)}>
          last: {lastTaskSummary(lastTask)}
        </p>
      )}

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
// TTS engines strip: which engine the next synth ACTUALLY uses + the fallback
// chain (edge -> sherpa -> melotts -> gptsovits) + the edge-tts cooldown.
// --------------------------------------------------------------------------
const PcTtsEnginesStrip: React.FC = () => {
  const [status, setStatus] = useState<TtsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getTtsStatus();
      if (!mounted.current) return;
      if (s && (s as any).success !== false && Array.isArray((s as any).engines)) {
        setStatus(s as TtsStatus); setErr(null);
      } else {
        setErr((s as any)?.error || (s as any)?.detail || 'tts status unavailable');
      }
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'tts status unavailable');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = window.setInterval(fetchStatus, TTS_POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchStatus]);

  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <AudioLines className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">TTS Engines</span>
        {err ? (
          <span className="truncate text-slate-400" title={err}>status unavailable ({err})</span>
        ) : (
          <span className="text-slate-400">loading…</span>
        )}
        <button onClick={fetchStatus} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50 shrink-0" title="Refresh TTS status">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>
    );
  }

  const engines = status.engines ?? [];
  const active = status.active ?? null;
  const cooldown = Math.round(status.edge_cooldown_remaining ?? 0);
  const edgeErr = status.providers?.[0]?.error || null;
  // The periodic poll never blocks on a live edge probe; a background probe
  // fills the cache, so until it lands the edge result is "pending".
  const edgePending = !!status.providers?.[0]?.pending;

  return (
    <section className="pc-glass p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <AudioLines className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">TTS Engines</span>
        <span className="text-[10px] text-slate-400">active</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
          {active || 'none'}
        </span>
        <div className="flex items-center gap-1 flex-wrap" title="Fallback chain in priority order (tried left → right)">
          {engines.map((e, i) => (
            <React.Fragment key={e.name}>
              {i > 0 && <span className="text-slate-300 dark:text-slate-600 text-[10px]">→</span>}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide ${
                  e.name === active
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40'
                    : e.available
                      ? 'bg-slate-500/10 text-slate-500'
                      : 'bg-slate-500/10 text-slate-400 opacity-50 line-through'}`}
                title={e.note || e.name}>
                {e.name}
                {e.name === 'edge' && (e.cooldown_remaining ?? 0) > 0 && (
                  <span className="font-mono text-amber-500">{Math.round(e.cooldown_remaining as number)}s</span>
                )}
              </span>
            </React.Fragment>
          ))}
        </div>
        <button onClick={fetchStatus} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50 shrink-0" title="Refresh TTS status">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {cooldown > 0 ? (
        <p className="text-[11px] text-amber-500 flex items-center gap-1"
          title="edge-tts failed recently; synthesis falls back to the offline engine until the cooldown elapses">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Edge cooling down — falling back to <b>{active || 'offline'}</b> (<span className="font-mono">{cooldown}s</span> left)
        </p>
      ) : edgeErr ? (
        <p className="text-[11px] text-slate-400 break-words" title="last edge-tts probe error">{edgeErr}</p>
      ) : edgePending ? (
        <p className="text-[11px] text-slate-400 flex items-center gap-1"
          title="A background probe is checking edge-tts; the periodic poll never blocks on it.">
          <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> Probing edge-tts availability…
        </p>
      ) : null}
    </section>
  );
};

// --------------------------------------------------------------------------
// Sentence Audio strip: Laravel queue counts + pycore auto-start toggle.
// One poll to pycore /sentence-audio/status (includes cached Laravel counts).
// --------------------------------------------------------------------------
const PcSentenceAudioStrip: React.FC<{ refreshTick?: number }> = ({ refreshTick = 0 }) => {
  const { t } = useTranslation('pc');
  const [status, setStatus] = useState<SentenceAudioAutoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await pycoreApi.getSentenceAudioAutoStatus();
      if (!mounted.current) return;
      if (s && typeof s.auto_start === 'boolean') {
        setStatus(s); setErr(null);
      } else {
        setErr((s as any)?.error || 'sentence audio status unavailable');
      }
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'sentence audio status unavailable');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = window.setInterval(fetchStatus, SENTENCE_AUDIO_POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchStatus, refreshTick]);

  const toggleAuto = async () => {
    if (!status || busy) return;
    setBusy(true);
    try {
      const next = !status.auto_start;
      const s = await pycoreApi.setSentenceAudioAutoConfig(next);
      if (mounted.current && s && typeof s.auto_start === 'boolean') setStatus(s);
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'toggle failed');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const runOnce = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await pycoreApi.runSentenceAudioOnce();
      await fetchStatus();
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'run-once failed');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const pending = status?.laravel?.pending ?? 0;
  const leased = status?.laravel?.leased ?? 0;
  const localQueued = status?.worker?.queued ?? 0;
  const autoOn = !!status?.auto_start;

  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <MessageSquareText className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.sentenceAudio.title')}</span>
        {err ? (
          <span className="truncate text-slate-400" title={err}>{err}</span>
        ) : (
          <span className="text-slate-400">{t('queueCenter.overview.loading')}</span>
        )}
        <button onClick={fetchStatus} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-teal-500/10 text-teal-500 transition disabled:opacity-50 shrink-0"
          title={t('queueCenter.refreshActive')}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>
    );
  }

  return (
    <section className="pc-glass p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquareText className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('queueCenter.sentenceAudio.title')}</span>
        <span className="text-[10px] text-slate-400">{t('queueCenter.sentenceAudio.subtitle')}</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500" title="Laravel sentence library queue">
          <AudioLines className="w-3 h-3 text-teal-400" />
          <b className="text-sky-500">{pending}</b> {t('queueCenter.overview.pending')}
          {' · '}<b className="text-violet-500">{leased}</b> {t('queueCenter.overview.leased')}
          {localQueued > 0 && (
            <span title="In-process priority heap on pycore">
              {' · '}<b className="text-amber-500">{localQueued}</b> local
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={toggleAuto}
          disabled={busy}
          title={autoOn ? t('queueCenter.sentenceAudio.autoOffTitle') : t('queueCenter.sentenceAudio.autoOnTitle')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition disabled:opacity-50 ${
            autoOn
              ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
              : 'pc-glass text-slate-500 hover:bg-teal-500/10 hover:text-teal-500'
          }`}>
          {autoOn ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Power className="w-3.5 h-3.5 shrink-0" />}
          {t('queueCenter.sentenceAudio.autoStart')} {autoOn ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
        </button>
        <button
          type="button"
          onClick={runOnce}
          disabled={busy}
          title={t('queueCenter.sentenceAudio.runOnceTitle')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold pc-glass text-teal-600 hover:bg-teal-500/10 transition disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {t('queueCenter.sentenceAudio.runOnce')}
        </button>
        <button onClick={fetchStatus} disabled={loading || busy}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-teal-500/10 text-teal-500 transition disabled:opacity-50 shrink-0"
          title={t('queueCenter.refreshActive')}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {status.worker?.processing && (
        <p className="text-[10px] font-mono text-slate-400 truncate">
          {t('queueCenter.sentenceAudio.processing')}: {status.worker.processing}
        </p>
      )}
      {err && (
        <p className="text-[11px] text-rose-500 break-words">
          <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />{err}
        </p>
      )}
    </section>
  );
};

// --------------------------------------------------------------------------
// Pending-Assist overview: ALL 8 categories as cards + the workers registry.
// Reads GET /api/local/queue/overview on the shared refresh tick. Each card
// shows the handler (chrome/pycore/ai), pending/processing/leased/total, an
// optional by-language mini-breakdown and a few sample rows on expand. The
// MISSING-TRANSLATION (chrome) and word-image queues are shown too even though
// chrome handles them, so the UI surfaces every end that assists.
// --------------------------------------------------------------------------
const HANDLER_STYLE: Record<PcQueueHandler, { chip: string; Icon: React.FC<{ className?: string }> }> = {
  chrome: { chip: 'bg-amber-500/15 text-amber-500', Icon: Chrome },
  pycore: { chip: 'bg-indigo-500/15 text-indigo-500', Icon: Cpu },
  ai: { chip: 'bg-violet-500/15 text-violet-500', Icon: Sparkles },
};

const PcQueueOverviewPanel: React.FC<{
  refreshTick: number;
  onMeta: (m: { count: number | null; loading: boolean }) => void;
}> = ({ refreshTick, onMeta }) => {
  const { t } = useTranslation('pc');
  const [data, setData] = useState<PcQueueOverview | null>(() => loadOverviewCache());
  const [loading, setLoading] = useState(() => !loadOverviewCache());
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    onMeta({ count: null, loading: true });
    try {
      const r = await pycoreApi.getQueueOverview();
      if (!mounted.current) return;
      if (r && (r as any).success !== false && Array.isArray(r.categories)) {
        setData(r); setErr(null);
        saveOverviewCache(r);
        const pending = r.categories.reduce((s, c) => s + (c.pending || 0), 0);
        onMeta({ count: pending, loading: false });
      } else {
        setErr((r as any)?.error || 'queue overview unavailable');
        onMeta({ count: null, loading: false });
      }
    } catch (e: any) {
      if (mounted.current) { setErr(e?.message || 'queue overview unavailable'); onMeta({ count: null, loading: false }); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [onMeta]);

  useEffect(() => { fetchOverview(); }, [fetchOverview, refreshTick]);

  if (!data) {
    return (
      <section className="pc-glass p-6 text-xs text-slate-500 flex items-center gap-2">
        {loading
          ? (<><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.overview.loading')}</>)
          : (<><AlertTriangle className="w-4 h-4 text-amber-400" /> {err || t('queueCenter.overview.unavailable')}</>)}
      </section>
    );
  }

  const categories = data.categories ?? [];
  const workers = data.workers ?? [];

  const num = (n: number, cls: string, label: string) => (
    <span className="inline-flex flex-col items-center px-2 py-1 rounded-lg bg-slate-500/5">
      <span className={`text-sm font-mono font-bold ${n > 0 ? cls : 'text-slate-400'}`}>{n}</span>
      <span className="text-[9px] uppercase tracking-wide text-slate-400">{label}</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* header + reachability */}
      <section className="pc-glass p-4 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <LayoutGrid className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.overview.title')}</h2>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${
            data.laravel_reachable ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
            {data.laravel_reachable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {data.laravel_reachable ? t('queueCenter.overview.reachable') : t('queueCenter.overview.backendOffline')}
          </span>
          {data.generated_at && (
            <span className="ml-auto text-[10px] font-mono text-slate-400" title={data.generated_at}>
              {t('queueCenter.overview.generatedAt', { time: new Date(data.generated_at).toLocaleTimeString() })}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.overview.hint')}</p>
        {!data.laravel_reachable && (
          <p className="text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 shrink-0" /> {t('queueCenter.overview.backendOffline')}
          </p>
        )}
      </section>

      {/* category cards */}
      {categories.length === 0 ? (
        <section className="pc-glass p-6 text-xs text-slate-500">{t('queueCenter.overview.empty')}</section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((c: PcQueueCategory) => {
            const hs = HANDLER_STYLE[c.handler] ?? HANDLER_STYLE.pycore;
            const HIcon = hs.Icon;
            const langs = c.by_language ? Object.entries(c.by_language).filter(([, n]) => n > 0) : [];
            const samples = c.sample ?? [];
            const isOpen = !!expanded[c.key];
            return (
              <div key={c.key} className="rounded-2xl p-3 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={c.label}>{c.label}</span>
                  <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide shrink-0 ${hs.chip}`}
                    title={t(`queueCenter.overview.handlerTitle.${c.handler}` as const)}>
                    <HIcon className="w-3 h-3" /> {t(`queueCenter.overview.handler.${c.handler}` as const)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {num(c.pending, 'text-sky-500', t('queueCenter.overview.pending'))}
                  {num(c.processing, 'text-amber-500', t('queueCenter.overview.processing'))}
                  {num(c.leased, 'text-violet-500', t('queueCenter.overview.leased'))}
                  {num(c.total, 'text-slate-600 dark:text-slate-300', t('queueCenter.overview.total'))}
                </div>
                {langs.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="text-[9px] uppercase tracking-wide text-slate-400">{t('queueCenter.overview.byLanguage')}</div>
                    <div className="flex flex-wrap gap-1">
                      {langs.map(([lang, n]) => (
                        <span key={lang} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-500/10 text-[10px] font-mono text-slate-500">
                          <Globe className="w-2.5 h-2.5 text-slate-400" />{lang}<b className="text-slate-700 dark:text-slate-300">{n}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {samples.length > 0 && (
                  <div>
                    <button onClick={() => setExpanded((p) => ({ ...p, [c.key]: !isOpen }))}
                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition">
                      {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {isOpen ? t('queueCenter.overview.hideSamples') : t('queueCenter.overview.showSamples')} ({samples.length})
                    </button>
                    {isOpen && (
                      <ul className="mt-1 space-y-0.5">
                        {samples.map((s, i) => (
                          <li key={i} className="text-[10px] font-mono text-slate-500 truncate"
                            title={s.word || s.title || s.source_key || String(s.id ?? '')}>
                            • {s.word || s.title || s.source_key || String(s.id ?? '—')}
                            {s.language ? <span className="text-slate-400"> · {s.language}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* workers registry */}
      <section className="pc-glass p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.workers.title')}</h2>
          <span className="text-[11px] text-slate-400">{t('queueCenter.workers.hint')}</span>
        </div>
        {workers.length === 0 ? (
          <p className="text-xs text-slate-500">{t('queueCenter.workers.none')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {workers.map((w: PcQueueWorker) => {
              const WIcon = w.kind === 'chrome' ? Chrome : Cpu;
              return (
                <div key={w.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
                  <WIcon className={`w-3.5 h-3.5 ${w.kind === 'chrome' ? 'text-amber-500' : 'text-indigo-500'}`} />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[10rem]" title={w.id}>{w.id}</span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                    w.online ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${w.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {w.online ? t('queueCenter.workers.online') : t('queueCenter.workers.offline')}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {t('queueCenter.workers.claimed')} <b className="text-violet-500">{w.claimed}</b>
                  </span>
                  {w.processor_types?.length > 0 && (
                    <span className="text-[9px] font-mono text-slate-400 truncate max-w-[12rem]" title={w.processor_types.join(', ')}>
                      {t('queueCenter.workers.processes')}: {w.processor_types.join(', ')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

// --------------------------------------------------------------------------
// Recent Tasks panel: a unified, newest-first log of finished task units across
// both ends (pycore workers + the chrome MCP host). Reads GET
// /api/local/tasks/recent on mount + the shared tick. Client-side end/worker
// filter chips, a stats summary row, click-to-expand rows showing the full
// per-task detail, and a "Clear history" action.
// --------------------------------------------------------------------------
const humanBytes = (n?: number | null): string => {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

const relativeTime = (iso: string): string => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
};

/** Status icon: green check for success, amber for released/skipped, red x else. */
const RecentStatusIcon: React.FC<{ rec: PcTaskRecord }> = ({ rec }) => {
  if (rec.success) return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (rec.status === 'released' || rec.status === 'skipped')
    return <MinusCircle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
};

const PcRecentTasksPanel: React.FC<{
  refreshTick: number;
  onMeta: (m: { count: number | null; loading: boolean }) => void;
}> = ({ refreshTick, onMeta }) => {
  const { t } = useTranslation('pc');
  const [records, setRecords] = useState<PcTaskRecord[]>([]);
  const [stats, setStats] = useState<PcTaskRecentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [endFilter, setEndFilter] = useState<string>('all');
  const [workerFilter, setWorkerFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    onMeta({ count: null, loading: true });
    try {
      // Pass the active filters server-side so the backend returns only matching
      // records (less data per poll). The client-side `filtered` filter below
      // stays as a fallback for the already-loaded list between fetches.
      const r = await pycoreApi.getRecentTasks({
        limit: 200,
        worker: workerFilter !== 'all' ? workerFilter : undefined,
        end: endFilter !== 'all' ? endFilter : undefined,
      });
      if (!mounted.current) return;
      if (r && (r as any).success !== false && Array.isArray(r.records)) {
        setRecords(r.records);
        setStats(r.stats ?? null);
        setErr(null);
        onMeta({ count: r.stats?.total ?? r.count ?? r.records.length, loading: false });
      } else {
        setErr((r as any)?.error || t('queueCenter.recent.unavailable'));
        onMeta({ count: null, loading: false });
      }
    } catch (e: any) {
      if (mounted.current) {
        setErr(e?.message || t('queueCenter.recent.unavailable'));
        onMeta({ count: null, loading: false });
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [onMeta, t, workerFilter, endFilter]);

  useEffect(() => { fetchRecent(); }, [fetchRecent, refreshTick]);

  const clearHistory = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    setClearMsg(null);
    try {
      const r = await pycoreApi.clearRecentTasks();
      if (!mounted.current) return;
      if (r?.ok) setClearMsg(t('queueCenter.recent.cleared'));
      else setClearMsg(t('queueCenter.recent.clearFailed', { error: (r as any)?.error || 'unavailable' }));
      await fetchRecent();
    } catch (e: any) {
      if (mounted.current) setClearMsg(t('queueCenter.recent.clearFailed', { error: e?.message || 'pycore unreachable' }));
    } finally {
      if (mounted.current) setClearing(false);
    }
  }, [clearing, fetchRecent, t]);

  // Distinct workers seen (for the worker filter chips).
  const workers = Array.from(new Set(records.map((r) => r.worker).filter(Boolean)));
  const filtered = records.filter((r) =>
    (endFilter === 'all' || r.end === endFilter) &&
    (workerFilter === 'all' || r.worker === workerFilter));

  if (!stats && records.length === 0) {
    return (
      <section className="pc-glass p-6 text-xs text-slate-500 flex items-center gap-2">
        {loading
          ? (<><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.recent.loading')}</>)
          : err
            ? (<><AlertTriangle className="w-4 h-4 text-amber-400" /> {err}</>)
            : (<><History className="w-4 h-4 text-slate-400" /> {t('queueCenter.recent.empty')}</>)}
      </section>
    );
  }

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
      active
        ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-inset ring-indigo-500/30'
        : 'pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'}`;

  const ends = ['all', 'pycore', 'chrome'];

  return (
    <div className="space-y-4">
      {/* header + summary + clear */}
      <section className="pc-glass p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <History className="w-4 h-4 text-indigo-500 shrink-0" />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('queueCenter.recent.title')}</h2>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button onClick={clearHistory} disabled={clearing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold pc-glass hover:bg-rose-500/10 text-rose-500 transition disabled:opacity-50"
              title={t('queueCenter.recent.clear')}>
              {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {clearing ? t('queueCenter.recent.clearing') : t('queueCenter.recent.clear')}
            </button>
            <button onClick={fetchRecent} disabled={loading}
              className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
              title={t('queueCenter.recent.refresh')}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.recent.hint')}</p>
        {stats && (
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] font-mono text-slate-500">
            <span>{t('queueCenter.recent.total')} <b className="text-slate-700 dark:text-slate-300">{stats.total}</b></span>
            <span>{t('queueCenter.recent.success')} <b className="text-emerald-500">{stats.success}</b></span>
            <span>{t('queueCenter.recent.failed')} <b className={stats.failed ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>{stats.failed}</b></span>
            <span>{t('queueCenter.recent.postedBack')} <b className="text-sky-500">{stats.posted_back}</b></span>
          </div>
        )}
        {clearMsg && <p className="text-[11px] text-slate-500 dark:text-slate-400">{clearMsg}</p>}
        {err && <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{err}</p>}
      </section>

      {/* filter chips */}
      <section className="pc-glass p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">{t('queueCenter.recent.filterEnd')}</span>
          {ends.map((e) => (
            <button key={e} onClick={() => setEndFilter(e)} className={chip(endFilter === e)}>
              {e === 'all' ? t('queueCenter.recent.all') : e}
            </button>
          ))}
        </div>
        {workers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">{t('queueCenter.recent.filterWorker')}</span>
            <button onClick={() => setWorkerFilter('all')} className={chip(workerFilter === 'all')}>
              {t('queueCenter.recent.all')}
            </button>
            {workers.map((w) => (
              <button key={w} onClick={() => setWorkerFilter(w)} className={chip(workerFilter === w)}>{w}</button>
            ))}
          </div>
        )}
      </section>

      {/* table */}
      {filtered.length === 0 ? (
        <section className="pc-glass p-6 text-xs text-slate-500">{t('queueCenter.recent.empty')}</section>
      ) : (
        <section className="pc-glass p-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-2 py-1.5 font-semibold w-8"></th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colWorker')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colTitle')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colLanguage')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colSource')}</th>
                <th className="px-2 py-1.5 font-semibold">{t('queueCenter.recent.colPosted')}</th>
                <th className="px-2 py-1.5 font-semibold text-right">{t('queueCenter.recent.colLatency')}</th>
                <th className="px-2 py-1.5 font-semibold text-right">{t('queueCenter.recent.colTime')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => {
                const rowKey = `${rec.end}:${rec.seq}:${rec.task_id}`;
                const isOpen = !!expanded[rowKey];
                return (
                  <React.Fragment key={rowKey}>
                    <tr onClick={() => setExpanded((p) => ({ ...p, [rowKey]: !isOpen }))}
                      className="border-t border-slate-200/40 dark:border-white/5 hover:bg-slate-100/50 dark:hover:bg-white/5 cursor-pointer">
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1">
                          {isOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                          <RecentStatusIcon rec={rec} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1 min-w-0">
                          {rec.end === 'chrome'
                            ? <Chrome className="w-3 h-3 text-amber-500 shrink-0" />
                            : <Cpu className="w-3 h-3 text-indigo-500 shrink-0" />}
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate" title={`${rec.end}/${rec.worker}:${rec.task_type}`}>
                            {rec.worker}<span className="text-slate-400">:{rec.task_type}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className="text-xs text-slate-700 dark:text-slate-200 truncate block max-w-[16rem]" title={rec.title}>{rec.title || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className="text-[11px] font-mono text-slate-500">{rec.language || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className="text-[11px] font-mono text-slate-400 truncate block max-w-[12rem]" title={rec.source_api}>{rec.source_api || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide ${
                          rec.posted_back ? 'bg-sky-500/15 text-sky-500' : 'bg-slate-500/15 text-slate-400'}`}>
                          {rec.posted_back ? t('queueCenter.recent.posted') : t('queueCenter.recent.notReturned')}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-middle text-right">
                        <span className="text-[11px] font-mono text-slate-500">{rec.latency_ms != null ? `${rec.latency_ms}ms` : '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 align-middle text-right">
                        <span className="text-[11px] font-mono text-slate-400" title={rec.ts}>{relativeTime(rec.ts)}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-100/40 dark:bg-white/[0.03]">
                        <td colSpan={8} className="px-4 py-3">
                          <PcRecentTaskDetail rec={rec} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

/** Expanded detail for one recent-task row. */
const PcRecentTaskDetail: React.FC<{ rec: PcTaskRecord }> = ({ rec }) => {
  const { t } = useTranslation('pc');
  const d = rec.detail ?? {};
  const field = (label: string, value: React.ReactNode) => (
    <div key={label} className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-[11px] text-slate-700 dark:text-slate-300 break-words">{value}</div>
    </div>
  );
  const fields: React.ReactNode[] = [];
  const push = (label: string, value: React.ReactNode) => { if (value != null && value !== '') fields.push(field(label, value)); };

  push(t('queueCenter.recent.text'), d.text);
  push(t('queueCenter.recent.translation'), d.translation);
  push(t('queueCenter.recent.provider'), d.provider);
  push(t('queueCenter.recent.model'), d.model);
  push(t('queueCenter.recent.engine'), d.engine);
  push(t('queueCenter.recent.voice'), d.voice);
  push(t('queueCenter.recent.audioAddress'),
    d.audio_path ? <span className="font-mono break-all" title={d.audio_path}>{d.audio_path}</span> : undefined);
  push(t('queueCenter.recent.audioSize'), typeof d.audio_bytes === 'number' ? humanBytes(d.audio_bytes) : undefined);
  push(t('queueCenter.recent.imageSize'), typeof d.image_bytes === 'number' ? humanBytes(d.image_bytes) : undefined);
  push(t('queueCenter.recent.wordCount'), typeof d.word_count === 'number' ? String(d.word_count) : undefined);
  push(t('queueCenter.recent.audioOk'), typeof d.audio_ok === 'number' ? String(d.audio_ok) : undefined);
  push(t('queueCenter.recent.audioFailed'), typeof d.audio_failed === 'number' ? String(d.audio_failed) : undefined);
  push(t('queueCenter.recent.mediaType'), d.media_type);
  push(t('queueCenter.recent.year'), d.year != null ? String(d.year) : undefined);
  push(t('queueCenter.recent.filename'), d.filename ? <span className="font-mono break-all">{d.filename}</span> : undefined);
  push(t('queueCenter.recent.taskId'), <span className="font-mono break-all">{rec.task_id}</span>);

  // Generic catch-all: every detail key NOT already rendered specially above.
  // Surfaces producer-specific fields (chrome bing/notebooklm/gemini, cover
  // prompt/size, tts speed, …) so non-assist tasks aren't near-empty on expand.
  // Keys rendered specially above. NOTE: 'mime'/'size'/'translated'/'skipped'
  // are intentionally NOT listed so the generic catch-all below surfaces them
  // (cover size, poster/gemini mime, word_translation translated/skipped counts,
  // chrome bing's translated flag) instead of swallowing them.
  const HANDLED_KEYS = new Set<string>([
    'text', 'translation', 'provider', 'model', 'engine', 'voice',
    'audio_path', 'audio_bytes', 'image_bytes', 'word_count',
    'audio_ok', 'audio_failed', 'media_type', 'year',
    'filename', 'words', 'translations', 'failed_words',
  ]);
  const otherDetail: [string, string][] = [];
  for (const [k, v] of Object.entries(d)) {
    if (HANDLED_KEYS.has(k) || v == null || v === '') continue;
    let text: string;
    if (Array.isArray(v)) text = `[${v.length}]`;
    else if (typeof v === 'object') text = JSON.stringify(v).slice(0, 120);
    else text = String(v);
    if (text !== '') otherDetail.push([k, text]);
  }

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">{fields}</div>
      )}

      {Array.isArray(d.words) && d.words.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">{t('queueCenter.recent.words')}</div>
          <div className="flex flex-wrap gap-1">
            {d.words.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-500/10 text-[10px] font-mono text-slate-500"
                title={w.engine ? `${w.word} · ${w.engine}` : w.word}>
                {w.word}
                {typeof w.audio_bytes === 'number' && <b className="text-slate-700 dark:text-slate-300">{humanBytes(w.audio_bytes)}</b>}
              </span>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(d.translations) && d.translations.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">{t('queueCenter.recent.translations')}</div>
          <ul className="space-y-0.5">
            {d.translations.map((tr, i) => (
              <li key={i} className="text-[10px] font-mono text-slate-500 truncate">
                <span className="text-slate-700 dark:text-slate-300">{tr.word}</span> → {tr.translation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(d.failed_words) && d.failed_words.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-rose-400 mb-1">{t('queueCenter.recent.failedWords')}</div>
          <div className="flex flex-wrap gap-1">
            {d.failed_words.map((w, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-[10px] font-mono text-rose-500">{w}</span>
            ))}
          </div>
        </div>
      )}

      {otherDetail.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1">{t('queueCenter.recent.otherDetail')}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            {otherDetail.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <div className="text-[9px] uppercase tracking-wide text-slate-400 break-all">{k}</div>
                <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {rec.error && (
        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <div className="text-[9px] uppercase tracking-wide font-semibold text-rose-500 mb-0.5">{t('queueCenter.recent.error')}</div>
          <div className="text-[11px] font-mono text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-all">{rec.error}</div>
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------------------------
// Right-side capability settings drawer: STT / TTS / Image / Translation. Each
// section shows the engine PRIORITY as a re-orderable list (up/down) with
// availability indicators + the capability's options (TTS: synth_timeout_s +
// edge_cooldown_s). Saving calls saveCapabilitySettings and reflects the
// returned block. Reads GET on open; degrades to a muted note when offline.
// --------------------------------------------------------------------------
const CAP_ICON: Record<PcCapabilityKey, React.FC<{ className?: string }>> = {
  stt: Mic, tts: AudioLines, image: ImageIcon, translation: Languages,
};
// Sensible default chains shown before/instead of a GET (spec §4 defaults).
const CAP_DEFAULT_PRIORITY: Record<PcCapabilityKey, string[]> = {
  stt: ['whisper', 'ai', 'vosk'],
  tts: ['edge', 'sherpa', 'melotts', 'gptsovits', 'azure'],
  image: ['zhipuai', 'dashscope', 'pollinations'],
  translation: ['ecdict', 'wordnet', 'google', 'ai'],
};

const PcCapabilityDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t } = useTranslation('pc');
  const [settings, setSettings] = useState<PcCapabilitySettings | null>(null);
  // Local editable copy (priority order + options) per capability.
  const [draft, setDraft] = useState<Record<PcCapabilityKey, PcCapabilityBlock>>(() =>
    CAP_KEYS.reduce((acc, k) => {
      acc[k] = { priority: [...CAP_DEFAULT_PRIORITY[k]], available: {}, options: {} };
      return acc;
    }, {} as Record<PcCapabilityKey, PcCapabilityBlock>));
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingCap, setSavingCap] = useState<PcCapabilityKey | null>(null);
  const [notice, setNotice] = useState<{ cap: PcCapabilityKey; ok: boolean; text: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async () => {
    setAvailable(null);
    setLoading(true);
    try {
      const r = await pycoreApi.getCapabilitySettings();
      if (!mounted.current) return;
      if (!r || (r as any).success === false || !r.tts) throw new Error((r as any)?.error || 'unavailable');
      setSettings(r);
      setDraft(CAP_KEYS.reduce((acc, k) => {
        const b = (r as any)[k] as PcCapabilityBlock | undefined;
        acc[k] = {
          priority: Array.isArray(b?.priority) && b!.priority.length ? [...b!.priority] : [...CAP_DEFAULT_PRIORITY[k]],
          available: b?.available ?? {},
          options: b?.options ?? {},
        };
        return acc;
      }, {} as Record<PcCapabilityKey, PcCapabilityBlock>));
      setAvailable(true);
    } catch {
      if (mounted.current) setAvailable(false);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  // Load once when the drawer is first opened (and on explicit reload).
  useEffect(() => { if (open && available === null) load(); }, [open, available, load]);

  const move = (cap: PcCapabilityKey, idx: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const list = [...prev[cap].priority];
      const j = idx + dir;
      if (j < 0 || j >= list.length) return prev;
      [list[idx], list[j]] = [list[j], list[idx]];
      return { ...prev, [cap]: { ...prev[cap], priority: list } };
    });
  };

  const setOption = (cap: PcCapabilityKey, key: string, value: number) => {
    setDraft((prev) => ({ ...prev, [cap]: { ...prev[cap], options: { ...prev[cap].options, [key]: value } } }));
  };

  const save = useCallback(async (cap: PcCapabilityKey) => {
    setSavingCap(cap);
    setNotice(null);
    try {
      const r = await pycoreApi.saveCapabilitySettings(cap, {
        priority: draft[cap].priority,
        options: draft[cap].options,
      });
      if (!mounted.current) return;
      if (!r || (r as any).success === false) throw new Error((r as any)?.error || 'save rejected');
      // Reflect the returned block (server may have appended omitted engines).
      setDraft((prev) => ({
        ...prev,
        [cap]: {
          priority: Array.isArray(r.priority) && r.priority.length ? [...r.priority] : prev[cap].priority,
          available: r.available ?? prev[cap].available,
          options: r.options ?? prev[cap].options,
        },
      }));
      setNotice({ cap, ok: true, text: t('queueCenter.drawer.saved', { cap: t(`queueCenter.drawer.cap.${cap}` as const) }) });
    } catch (e: any) {
      if (mounted.current) setNotice({ cap, ok: false, text: t('queueCenter.drawer.saveFailed', { error: e?.message || 'pycore unreachable' }) });
    } finally {
      if (mounted.current) setSavingCap(null);
    }
  }, [draft, t]);

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose}
        className={`fixed inset-0 z-[120] bg-slate-900/30 backdrop-blur-[1px] transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      {/* panel */}
      <aside
        className={`fixed top-0 right-0 z-[121] h-full w-full max-w-md pc-glass shadow-2xl border-l border-slate-300/40 dark:border-white/10 transition-transform duration-200 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center gap-2 p-4 border-b border-slate-300/30 dark:border-white/10">
          <SlidersHorizontal className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('queueCenter.drawer.title')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('queueCenter.drawer.subtitle')}</p>
          </div>
          <button onClick={load} disabled={loading}
            className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50" title={t('queueCenter.drawer.reload')}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose}
            className="p-1.5 rounded-lg pc-glass hover:bg-rose-500/10 text-rose-500 transition" title={t('queueCenter.drawer.close')}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {available === false && (
            <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{t('queueCenter.drawer.unavailable')}</span>
            </div>
          )}
          {available === null && loading && (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> {t('queueCenter.drawer.loading')}
            </p>
          )}

          {CAP_KEYS.map((cap) => {
            const CIcon = CAP_ICON[cap];
            const block = draft[cap];
            const avail = block.available ?? {};
            const isTts = cap === 'tts';
            return (
              <section key={cap} className="rounded-2xl p-3 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <CIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{t(`queueCenter.drawer.cap.${cap}` as const)}</h3>
                  <button onClick={() => save(cap)} disabled={savingCap === cap}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition shrink-0">
                    {savingCap === cap ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {savingCap === cap ? t('queueCenter.drawer.saving') : t('queueCenter.drawer.save')}
                  </button>
                </div>

                {/* engine priority (re-orderable) */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('queueCenter.drawer.priority')}</div>
                  <p className="text-[10px] text-slate-400 mb-1.5">{t('queueCenter.drawer.priorityHint')}</p>
                  <ul className="space-y-1">
                    {block.priority.map((engine, idx) => {
                      const isAvail = avail[engine] !== false;
                      return (
                        <li key={engine} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/60 dark:bg-white/5 border border-slate-300/40 dark:border-white/5">
                          <span className="text-[10px] font-mono text-slate-400 w-4 text-center shrink-0">{idx + 1}</span>
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate">{engine}</span>
                          <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                            isAvail ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isAvail ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isAvail ? t('queueCenter.drawer.available') : t('queueCenter.drawer.unavailableEngine')}
                          </span>
                          <div className="flex flex-col shrink-0">
                            <button onClick={() => move(cap, idx, -1)} disabled={idx === 0}
                              className="p-0.5 rounded text-slate-400 hover:text-indigo-500 disabled:opacity-30 transition" title={t('queueCenter.drawer.moveUp')}>
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => move(cap, idx, 1)} disabled={idx === block.priority.length - 1}
                              className="p-0.5 rounded text-slate-400 hover:text-indigo-500 disabled:opacity-30 transition" title={t('queueCenter.drawer.moveDown')}>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* options (TTS tuning only; others note "no options") */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('queueCenter.drawer.options')}</div>
                  {isTts ? (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <label className="block">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5" title={t('queueCenter.drawer.synthTimeoutHint')}>
                          {t('queueCenter.drawer.synthTimeout')}
                        </span>
                        <input type="number" min={5} max={120} step={1}
                          value={typeof block.options.synth_timeout_s === 'number' ? block.options.synth_timeout_s : 20}
                          onChange={(e) => setOption('tts', 'synth_timeout_s', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5" title={t('queueCenter.drawer.edgeCooldownHint')}>
                          {t('queueCenter.drawer.edgeCooldown')}
                        </span>
                        <input type="number" min={0} max={3600} step={5}
                          value={typeof block.options.edge_cooldown_s === 'number' ? block.options.edge_cooldown_s : 300}
                          onChange={(e) => setOption('tts', 'edge_cooldown_s', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300/50 dark:border-white/10 bg-white/60 dark:bg-white/5 text-slate-700 dark:text-zinc-200" />
                      </label>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1">{t('queueCenter.drawer.noOptions')}</p>
                  )}
                </div>

                {notice && notice.cap === cap && (
                  <p className={`text-[11px] ${notice.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{notice.text}</p>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </>
  );
};

// --------------------------------------------------------------------------
// The merged page.
// --------------------------------------------------------------------------
const PcQueueCenterPage: React.FC = () => {
  const { t } = useTranslation('pc');
  // Initial tab: ?tab= (set by the legacy-route redirects) wins over the
  // last-used tab persisted in localStorage.
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<QcTab>(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(TAB_KEY);
    return isTab(saved) ? saved : 'overview';
  });
  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

  // Capability settings drawer (toggle on the right edge); state persisted.
  const [drawerOpen, setDrawerOpen] = useState(() => localStorage.getItem(DRAWER_KEY) === '1');
  useEffect(() => { localStorage.setItem(DRAWER_KEY, drawerOpen ? '1' : '0'); }, [drawerOpen]);

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
    overview: { count: null, loading: false },
    manager: { count: loadQueueCache()?.length ?? null, loading: false },
    tasks: { count: null, loading: false },
    translation: { count: null, loading: false },
    recent: { count: null, loading: false },
  }));
  const reportMeta = useCallback((key: QcTab, m: PanelMeta) => {
    setMeta((prev) =>
      prev[key].count === m.count && prev[key].loading === m.loading
        ? prev
        : { ...prev, [key]: m });
  }, []);
  const onOverviewMeta = useCallback((m: PanelMeta) => reportMeta('overview', m), [reportMeta]);
  const onManagerMeta = useCallback((m: PanelMeta) => reportMeta('manager', m), [reportMeta]);
  const onTasksMeta = useCallback((m: PanelMeta) => reportMeta('tasks', m), [reportMeta]);
  const onTranslationMeta = useCallback((m: PanelMeta) => reportMeta('translation', m), [reportMeta]);
  const onRecentMeta = useCallback((m: PanelMeta) => reportMeta('recent', m), [reportMeta]);

  const activeLoading = meta[tab].loading;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* header + tabs + shared refresh controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <ListOrdered className="w-5 h-5 text-indigo-500" /> {t('queueCenter.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('queueCenter.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl pc-glass overflow-hidden">
            {TAB_DEFS.map(({ key, Icon }) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                  tab === key
                    ? 'bg-indigo-500/15 text-indigo-500'
                    : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {t(`queueCenter.tabs.${key}` as const)}
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
            title={auto ? t('queueCenter.autoOnTitle', { sec: AUTO_REFRESH_MS / 1000 }) : t('queueCenter.autoOffTitle')}>
            <TimerReset className="w-3.5 h-3.5" />
            {t('queueCenter.auto')} {auto ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
          </button>
          <button
            onClick={() => setTick((t) => t + 1)}
            disabled={activeLoading}
            className="p-2 rounded-xl pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
            title={t('queueCenter.refreshActive')}>
            <RefreshCw className={`w-4 h-4 ${activeLoading ? 'animate-spin' : ''}`} />
          </button>
          {/* capability settings drawer toggle */}
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
              drawerOpen
                ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-inset ring-indigo-500/30'
                : 'pc-glass text-slate-500 hover:bg-indigo-500/10 hover:text-indigo-500'
            }`}
            title={t('queueCenter.drawer.openTitle')}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t('queueCenter.drawer.open')}
          </button>
        </div>
      </div>

      {/* Pending-assist overview: ALL 8 categories + workers (its own poll on the
          shared tick). The strips below are redundant with it, so they only
          show on the per-queue tabs. */}
      {tab === 'overview' && <PcQueueOverviewPanel refreshTick={tick} onMeta={onOverviewMeta} />}

      {/* Live status strips belong with the per-queue tabs; the overview already
          shows the assist/worker state and Recent Tasks is a finished-history
          log, so neither needs the strips. */}
      {(tab === 'manager' || tab === 'tasks' || tab === 'translation') && (
        <>
          {/* Assist Laravel status strip (configure in Settings → Assist Laravel) */}
          <PcAssistStrip />

          {/* TTS engines: active engine + fallback chain + edge cooldown countdown */}
          <PcTtsEnginesStrip />

          {/* Sentence-library auxiliary audio queue + auto-start */}
          <PcSentenceAudioStrip refreshTick={tick} />
        </>
      )}

      {/* Only the active tab is mounted, so its polling is the only one running. */}
      {tab === 'manager' && <PcQueueManagerPanel refreshTick={tick} onMeta={onManagerMeta} />}
      {tab === 'tasks' && <PcTaskQueuePanel refreshTick={tick} onMeta={onTasksMeta} />}
      {tab === 'translation' && <PcTranslationQueuePanel refreshTick={tick} onMeta={onTranslationMeta} />}
      {tab === 'recent' && <PcRecentTasksPanel refreshTick={tick} onMeta={onRecentMeta} />}

      {/* right-side expandable capability settings drawer */}
      <PcCapabilityDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};

export default PcQueueCenterPage;
