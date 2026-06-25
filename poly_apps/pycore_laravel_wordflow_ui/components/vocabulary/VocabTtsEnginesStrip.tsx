import React from 'react';
import { AudioLines, RefreshCw, AlertTriangle } from 'lucide-react';
import { commonClasses } from '../../styles/theme';
import { pycoreApi } from '../../core/api-libs/pycore';
import type { TtsStatus } from '../../core/api-libs/pycore';
import { useApiResource } from '../../hooks';

/**
 * Fetch + normalize pycore TTS engine status into the {success,data,error}
 * envelope useApiResource expects. Mirrors the original inline guard: a body is
 * only "valid" when success !== false AND engines is an array; otherwise we
 * surface error/detail (or a muted fallback) without crashing.
 */
const fetchTtsStatus = async (): Promise<{ success: boolean; data?: TtsStatus; error?: string }> => {
  const s: any = await pycoreApi.getTtsStatus();
  if (s && s.success !== false && Array.isArray(s.engines)) {
    return { success: true, data: s as TtsStatus };
  }
  return { success: false, error: s?.error || s?.detail || 'TTS engine status unavailable' };
};

/**
 * VocabTtsEnginesStrip — compact pycore TTS engine status strip.
 *
 * Mirrors the LOGIC of pycore-manager's PcTtsEnginesStrip (active engine +
 * fallback chain + edge cooldown), restyled with laravel-manager's
 * commonClasses. This is laravel-manager, so pycore (:59000) may not be local —
 * polls every ~8s and degrades to a muted "unavailable" line, never crashing.
 */
const VocabTtsEnginesStrip: React.FC = () => {
  const { data: status, loading, error: err, refresh } = useApiResource<TtsStatus>(fetchTtsStatus, { pollMs: 8000 });

  // Unavailable (pycore not local / offline): one muted line, never a broken
  // card — the rest of the page stays fully usable.
  if (!status) {
    return (
      <div className={`${commonClasses.card} p-3 mb-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400`}>
        <AudioLines className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="font-semibold text-slate-600 dark:text-slate-300">TTS Engines</span>
        <span className="truncate text-slate-400" title={err || undefined}>
          {err ? 'TTS engine status unavailable' : 'loading…'}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          title="Refresh TTS status"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  const engines = status.engines ?? [];
  const active = status.active ?? null;
  const cooldown = Math.round(status.edge_cooldown_remaining ?? 0);

  return (
    <div className={`${commonClasses.card} p-3 mb-4`}>
      <div className="flex items-center gap-2 flex-wrap">
        <AudioLines className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">TTS Engines</span>
        <span className="text-[11px] text-slate-400">Active:</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {active || 'none'}
        </span>
        <div className="flex items-center gap-1 flex-wrap" title="Fallback chain in priority order (tried left → right)">
          {engines.map((e, i) => (
            <React.Fragment key={e.name}>
              {i > 0 && <span className="text-slate-300 dark:text-slate-600 text-[11px]">→</span>}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                  e.name === active
                    ? 'bg-green-100 text-green-700 ring-1 ring-green-400/60 dark:bg-green-900/40 dark:text-green-300'
                    : e.available
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-400 line-through opacity-60 dark:bg-slate-800/60'
                }`}
                title={e.note || e.name}
              >
                {e.name}
                {e.name === 'edge' && (e.cooldown_remaining ?? 0) > 0 && (
                  <span className="font-mono text-amber-600 dark:text-amber-400">{Math.round(e.cooldown_remaining as number)}s</span>
                )}
              </span>
            </React.Fragment>
          ))}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0"
          title="Refresh TTS status"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {cooldown > 0 && (
        <p
          className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1"
          title="edge-tts failed recently; synthesis falls back to the offline engine until the cooldown elapses"
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Edge cooling down — falling back to <b>{active || 'offline'}</b> (<span className="font-mono">{cooldown}s</span> left)
        </p>
      )}
    </div>
  );
};

export default VocabTtsEnginesStrip;
