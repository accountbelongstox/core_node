/**
 * PcAssistStrip — compact Assist Laravel status (Queue Center shared strip).
 * GET /api/local/assist/status + hub task-center reachability.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Handshake, AlertTriangle, Play, Loader2, AudioLines, Power, RefreshCw, Check, WifiOff,
  Image as ImageIcon, Film,
} from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { AssistStatus, AssistCapabilities, PcTaskRecord } from '../../../core/api-libs/pycore';
import { humanBytes } from '../utils/pcFormat';
import { QC_ASSIST_POLL_MS } from '../utils/pcQueueCenterTypes';
import { useQueueCenterHub, laravelLiveSyncOffline, laravelEndpointMismatch } from '../hooks/useQueueCenterHub';

type AssistCapKey = keyof AssistCapabilities;
const ASSIST_CAP_KEYS: AssistCapKey[] = ['translation', 'ai_translate', 'tts', 'subtitle', 'stt'];
const ASSIST_POLL_MS = QC_ASSIST_POLL_MS;

const isAssistStatus = (s: unknown): s is AssistStatus =>
  !!s && typeof (s as AssistStatus).enabled === 'boolean' && !!(s as AssistStatus).capabilities;

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

export const PcAssistStrip: React.FC = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
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

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const s = await pycoreApi.getAssistStatus();
      if (isAssistStatus(s)) { setStatus(s); setErr(null); }
      else setErr((s as any)?.error || (s as any)?.detail || 'assist status unavailable');
    } catch (e: any) {
      setErr(e?.message || 'assist status unavailable');
    } finally {
      setLoading(false);
    }
    try {
      const r = await pycoreApi.getRecentTasks({ limit: 1, worker: 'assist' });
      setLastTask(r?.records?.[0] ?? null);
    } catch {
      setLastTask(null);
    }
  }, []);

  const fetchRef = useRef(fetchStatus);
  fetchRef.current = fetchStatus;
  useEffect(() => {
    void fetchRef.current(false);
    const id = window.setInterval(() => { void fetchRef.current(true); }, ASSIST_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

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
      await fetchStatus(true);
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
      await fetchStatus(true);
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
    const caps: Partial<AssistCapabilities> = cap === 'tts'
      ? { tts: next, sentence_audio: next }
      : { [cap]: next };
    try {
      const r = await pycoreApi.setAssistConfig({ capabilities: caps });
      if (!mounted.current) return;
      if ((r as any)?.success === false) {
        setCycleMsg(`Toggle failed: ${(r as any)?.error || (r as any)?.detail || 'unavailable'}`);
      }
      await fetchStatus(true);
    } catch (e: any) {
      if (mounted.current) setCycleMsg(`Toggle failed: ${e?.message || 'pycore unreachable'}`);
    } finally {
      if (mounted.current) setCapBusy(false);
    }
  }, [capBusy, status, fetchStatus]);

  // Degraded strip while assist status loads — never block the queue tabs below.
  const liveSyncOffline = laravelLiveSyncOffline(hub);
  const endpointMismatch = laravelEndpointMismatch(hub);
  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <Handshake className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">Assist Laravel</span>
        {hub.laravelReachable === true && hub.translationPending != null && (
          <span className="text-slate-400">
            Laravel sync OK · translation pending {hub.translationPending}
          </span>
        )}
        {liveSyncOffline && (
          <span className="truncate text-amber-500" title={hub.laravelStoredEndpoint ?? undefined}>
            Laravel live sync paused{hub.laravelStoredEndpoint ? ` (selected ${hub.laravelStoredEndpoint})` : ''}
          </span>
        )}
        {endpointMismatch && (
          <span className="truncate text-sky-500" title={`Active ${hub.laravelActiveEndpoint}`}>
            using {hub.laravelActiveEndpoint}
          </span>
        )}
        {err ? (
          <span className="truncate text-slate-400" title={err}>assist status loading ({err})</span>
        ) : loading ? (
          <span className="text-slate-400">loading…</span>
        ) : null}
        <button onClick={() => fetchStatus(false)} disabled={loading}
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
        {(status.laravel_reachable === false || liveSyncOffline) && hub.laravelReachable !== true && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-500">
            <WifiOff className="w-3 h-3" /> Laravel live sync paused
          </span>
        )}
        {endpointMismatch && (
          <span className="text-[10px] font-mono text-sky-500 truncate max-w-[14rem]"
            title={`Selected ${hub.laravelStoredEndpoint} · active ${hub.laravelActiveEndpoint}`}>
            active → {hub.laravelActiveEndpoint}
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
          <button onClick={() => fetchStatus(false)} disabled={loading}
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
        {cov && false && (
          <span className="inline-flex items-center gap-1" title="Cover — delegated to apps/mcp-chrome (hidden)">
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
        {poster && false && (
          <span className="inline-flex items-center gap-1"
            title="Poster — delegated to apps/mcp-chrome (hidden)">
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
            const on = cap === 'tts'
              ? !!(status.capabilities?.tts || status.capabilities?.sentence_audio)
              : !!status.capabilities?.[cap];
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

export default PcAssistStrip;
