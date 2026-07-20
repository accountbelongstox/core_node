/**
 * PcTtsEnginesStrip — active TTS engine + fallback chain (Queue Center).
 * Reads TTS status from the SHARED Queue Center hub (useQueueCenterHub) — no
 * self-polling; the refresh button re-polls the whole hub.
 */
import React from 'react';
import { AlertTriangle, AudioLines, RefreshCw } from 'lucide-react';
import { ttsEngineUiState, ttsConcurrencyAnnotation } from '../../../core/api-libs/pycore';
import type { TtsStatus } from '../../../core/api-libs/pycore';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

export const PcTtsEnginesStrip: React.FC = () => {
  const hub = useQueueCenterHub();
  const raw = hub.tts as any;
  const status = raw && raw.success !== false && Array.isArray(raw.engines) ? (raw as TtsStatus) : null;
  const loading = hub.loading;
  const err = hub.pycoreReachable ? null : hub.error;

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
    </section>
  );
};

export default PcTtsEnginesStrip;
