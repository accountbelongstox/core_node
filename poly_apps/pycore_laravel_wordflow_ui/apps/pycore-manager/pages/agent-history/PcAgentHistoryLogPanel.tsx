import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { pycoreApi } from '../../../../core/api-libs/pycore/PycoreApi';

/** Live pipeline log panel - polls article logs every 4s while extraction is on. */
const PcAgentHistoryLogPanel: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await pycoreApi.getAgentHistoryArticleLogs();
      if (!mounted.current) return;
      if (res.success && res.data) {
        setData(res.data as Record<string, any>);
        setLoadError(null);
        setStale(false);
      } else {
        setLoadError(res.error || 'Failed to load agent history logs.');
        setStale(true);
      }
    } catch (e) {
      if (!mounted.current) return;
      // Keep prior data; mark stale instead of wiping the panel.
      setLoadError(e instanceof Error ? e.message : 'Failed to load agent history logs.');
      setStale(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const id = setInterval(() => void load(), 4_000);
    return () => { mounted.current = false; clearInterval(id); };
  }, [load]);

  const events: any[] = Array.isArray((data as any)?.events) ? (data as any).events : [];
  const progress = (data as any)?.progress || {};
  const ai = (data as any)?.ai_usage || {};
  const tick = (data as any)?.tick || {};
  const limits = ai.limits || {};
  const usage = ai.usage || {};
  const rpmLimit = typeof limits.rpm === 'number' ? limits.rpm : Infinity;
  const rpdLimit = typeof limits.rpd === 'number' ? limits.rpd : Infinity;
  const throttled = !!ai.enforced && (Number(usage.minute ?? 0) >= rpmLimit || Number(usage.day ?? 0) >= rpdLimit);

  const phaseColor: Record<string, string> = {
    backfill: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    done: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300',
    paused_quota: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300',
    idle: 'border-slate-300 dark:border-white/10 text-slate-500',
  };
  const levelDot: Record<string, string> = {
    info: 'bg-slate-400',
    success: 'bg-emerald-500',
    warn: 'bg-amber-500',
    error: 'bg-rose-500',
  };

  const req = ai.requests || {};
  const used = Number(req.used ?? usage.day ?? 0);
  const limit = typeof req.limit === 'number' ? req.limit : (typeof rpdLimit === 'number' ? rpdLimit : null);
  const remaining = typeof req.remaining === 'number'
    ? req.remaining
    : (limit != null ? Math.max(0, limit - used) : null);
  const resetS = req.resets_in_s ?? ai.resets_in?.day;
  const resetLabel = typeof resetS === 'number'
    ? `${Math.max(0, Math.round(resetS / 3600))}h`
    : null;

  const errAt = progress.last_error_at ? String(progress.last_error_at) : '';
  const errStale = (() => {
    if (!progress.last_error || !errAt) return false;
    try {
      const ts = Date.parse(errAt);
      if (!Number.isFinite(ts)) return false;
      return Date.now() - ts > 60 * 60 * 1000;
    } catch {
      return false;
    }
  })();

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-indigo-500" />
          {tk('logTitle')}
          {stale && (
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-600 dark:text-amber-300">
              {tk('dataStale')}
            </span>
          )}
        </h2>
        {loading && <span className="text-[11px] text-slate-400">…</span>}
        {loadError && !loading && (
          <span className="text-[11px] text-amber-500 max-w-[50%] truncate" title={loadError}>
            {loadError}
          </span>
        )}
      </div>

      {/* Progress row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
        <span className={`px-2 py-0.5 rounded border ${phaseColor[String(progress.phase || 'idle')] || phaseColor.idle}`}>
          {tk('phase')}: {String(progress.phase || 'idle')}
        </span>
        <span>{tk('pending')}: {Number(progress.pending_fragments ?? 0)}</span>
        <span>{tk('published')}: {Number(progress.published_count ?? 0)}</span>
        <span>{tk('heartbeatTicks')}: {Number(tick.tick_count ?? 0)}</span>
        <span>{tk('cursor')}: f#{Number(progress.cursor?.fragment_index ?? 0)} r#{Number(progress.cursor?.raw_index ?? 0)}</span>
        {progress.last_run_at && <span>{tk('lastRun')}: {String(progress.last_run_at).slice(11, 19)}</span>}
        {progress.last_error && (
          <span className={errStale ? 'text-slate-400' : 'text-rose-500'}>
            {tk('lastError')}: {String(progress.last_error)}
            {errAt ? ` @ ${errAt.slice(11, 19)}` : ''}
            {errStale ? ` (${tk('stale')})` : ''}
          </span>
        )}
      </div>

      {/* AI usage row — daily REQUESTS (CN + EN = 2 per article), not article count */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
        <span className="text-slate-400">{tk('aiUsageTitle')}</span>
        {ai.enforced ? (
          <>
            <span className={throttled ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}>
              {tk('rpm')}: {Number(usage.minute ?? 0)}/{rpmLimit === Infinity ? '?' : rpmLimit} {tk('requests')}
            </span>
            <span className={throttled ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-300'}>
              {tk('rpd')}: {used}/{limit == null ? '?' : limit} {tk('requests')}
            </span>
            {remaining != null && (
              <span className="text-slate-500">{tk('remaining')}: {remaining} {tk('requests')}</span>
            )}
            {resetLabel && (
              <span className="text-slate-500">{tk('resetsIn')}: {resetLabel}</span>
            )}
            <span className={throttled || String(progress.phase) === 'paused_quota' ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-300'}>
              {String(progress.phase) === 'paused_quota'
                ? tk('quotaPaused')
                : (throttled ? `${tk('throttled')} · ${tk('cooldown')}` : tk('ok'))}
            </span>
            {ai.as_of && (
              <span className="text-slate-400 ml-2">
                {tk('asOf') || 'As of'}: {new Date(ai.as_of * 1000).toTimeString().slice(0, 8)}
              </span>
            )}
          </>
        ) : loadError ? (
          <span className="text-amber-500">{loadError}</span>
        ) : loading ? (
          <span className="text-slate-400">{tk('loading') || 'Loading'}…</span>
        ) : (
          <span className="text-slate-400">{tk('noData')}</span>
        )}
      </div>

      {/* Event log (newest first) */}
      <ul className="space-y-1 max-h-[280px] overflow-y-auto pr-1 font-mono text-[11px]">
        {events.length === 0 ? (
          <li className="text-slate-400">{tk('logEmpty')}</li>
        ) : events.map((ev, i) => {
          const ts = new Date((Number(ev.at) || 0) * 1000).toTimeString().slice(0, 8);
          return (
            <li key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${levelDot[String(ev.level || 'info')] || levelDot.info}`} />
              <span className="text-slate-400 shrink-0">{ts}</span>
              <span className="break-all">{String(ev.message || '')}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PcAgentHistoryLogPanel;
