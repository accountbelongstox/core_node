/**
 * PcTtsEnginesStrip — active TTS engine + fallback chain (Queue Center).
 * Reads TTS status from the SHARED Queue Center hub (useQueueCenterHub) — no
 * self-polling; the refresh button re-polls the whole hub.
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, AudioLines, RefreshCw } from 'lucide-react';
import { ttsEngineUiState, ttsConcurrencyAnnotation } from '@/apps/pycore-manager/api';
import type { TtsStatus } from '@/apps/pycore-manager/api';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

export const PcTtsEnginesStrip: React.FC = () => {
  const hub = useQueueCenterHub();
  const [qwenNotice, setQwenNotice] = useState<{ failed: boolean; text: string } | null>(null);
  const raw = hub.tts as any;
  const status = raw && raw.success !== false && Array.isArray(raw.engines) ? (raw as TtsStatus) : null;
  const loading = hub.loading;
  const err = hub.pycoreReachable ? null : hub.error;

  useEffect(() => {
    let timer: number | undefined;
    const show = (payload: any, failed: boolean) => {
      const job = payload?.job ?? payload ?? {};
      const label = String(job.text_summary || payload?.job_id || 'Qwen job').slice(0, 64);
      const error = String(payload?.error || job.error || 'synthesis failed');
      setQwenNotice({ failed, text: failed ? `${label} — ${error}` : `${label} completed` });
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => setQwenNotice(null), 6_000);
    };
    const offCompleted = pycoreEventBus.subscribe(
      PYCORE_EVENT_TOPICS.qwenJobCompleted, (payload) => show(payload, false),
    );
    const offFailed = pycoreEventBus.subscribe(
      PYCORE_EVENT_TOPICS.qwenJobFailed, (payload) => show(payload, true),
    );
    return () => {
      offCompleted();
      offFailed();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  if (!status) {
    return (
      <section className="pc-glass p-3 flex items-center gap-2 text-xs text-slate-500">
        <AudioLines className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="font-bold text-slate-600 dark:text-slate-300">TTS Engines</span>
        {err ? (
          <span className="truncate text-slate-400" title={err}>status unavailable ({err})</span>
        ) : loading ? (
          <span className="text-slate-400">loading…</span>
        ) : null}
        <button onClick={() => hub.refreshHub()} disabled={loading}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50 shrink-0" title="Refresh TTS status">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </section>
    );
  }

  const engines = status.engines ?? [];
  const active = status.active ?? null;
  const cooldown = Math.round(status.edge_cooldown_remaining ?? 0);
  const edgeEngine = engines.find((e) => e.name === 'edge');
  const edgeErr = edgeEngine?.probe_error || null;
  const edgePending = !!edgeEngine?.probe_pending;
  const qwenEngine = engines.find((e) => e.name === 'qwen3tts');
  const qwenQueue = qwenEngine?.queue;
  const qwenCounts = qwenQueue?.counts ?? {};
  const qwenRecent = (qwenQueue?.jobs ?? [])
    .filter((job) => ['done', 'failed', 'cancelled'].includes(job.status))
    .slice(0, 4);

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
          {engines.map((e, i) => {
            const uiState = ttsEngineUiState(e.installed, e.available);
            const chipClass =
              e.name === active
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40'
                : uiState === 'ready'
                  ? 'bg-slate-500/10 text-slate-500'
                  : uiState === 'setup'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-slate-500/10 text-slate-400 opacity-50 line-through';
            const title = [e.note, e.disabled_reason].filter(Boolean).join(' — ') || e.name;
            const concurrency = ttsConcurrencyAnnotation(e.concurrency, e.name);
            return (
            <React.Fragment key={e.name}>
              {i > 0 && <span className="text-slate-300 dark:text-slate-600 text-[10px]">→</span>}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide ${chipClass}`}
                title={concurrency ? `${title} · ${concurrency}` : title}>
                {e.name}
                {e.name === 'edge' && (e.cooldown_remaining ?? 0) > 0 && (
                  <span className="font-mono text-amber-500">{Math.round(e.cooldown_remaining as number)}s</span>
                )}
                {uiState === 'setup' && (
                  <span className="font-mono text-amber-500/90">setup</span>
                )}
                {e.server_engine && e.server_running && (
                  <span className="font-mono text-emerald-500/80 text-[9px]">svc</span>
                )}
                {concurrency && (
                  <span className="font-mono font-normal text-[9px] opacity-75">{concurrency}</span>
                )}
              </span>
            </React.Fragment>
            );
          })}
        </div>
        <button onClick={() => hub.refreshHub()} disabled={loading}
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

      {qwenEngine && (
        <div className="pt-1.5 border-t border-slate-300/30 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="font-bold text-slate-500">Qwen queue</span>
            {qwenEngine.server_running ? (
              <>
                {qwenQueue ? (
                  <>
                    <span className="text-sky-500">pending {qwenCounts.pending ?? 0}</span>
                    <span className="text-amber-500">running {qwenCounts.running ?? 0}</span>
                    <span className="text-emerald-500">done {qwenCounts.done ?? 0}</span>
                    <span className="text-rose-500">failed {qwenCounts.failed ?? 0}</span>
                    <span className="text-slate-400">cancelled {qwenCounts.cancelled ?? 0}</span>
                  </>
                ) : (
                  <span className="text-amber-500">queue status unavailable</span>
                )}
                {qwenEngine.server_url && (
                  <a href={qwenEngine.server_url} target="_blank" rel="noreferrer"
                    className="ml-auto text-indigo-500 hover:text-indigo-400 underline underline-offset-2">
                    Open local console
                  </a>
                )}
              </>
            ) : (
              <span className="text-slate-400">service offline</span>
            )}
          </div>
          {qwenRecent.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {qwenRecent.map((job) => (
                <span key={job.job_id}
                  className={`text-[10px] ${job.status === 'failed' ? 'text-rose-500' : 'text-slate-400'}`}
                  title={job.error || job.text_summary || job.job_id}>
                  {job.status} · {(job.text_summary || job.job_id).slice(0, 36)}
                  {job.error ? ` — ${job.error}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {qwenNotice && (
        <div className={`text-[11px] rounded-lg px-2 py-1 ${
          qwenNotice.failed
            ? 'bg-rose-500/10 text-rose-500'
            : 'bg-emerald-500/10 text-emerald-500'
        }`}>
          {qwenNotice.text}
        </div>
      )}
    </section>
  );
};

export default PcTtsEnginesStrip;
