/**
 * PcWorkerStatusStrip — PyHeartbeat callback on/off, run counts, aux toggles.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cpu, RefreshCw, Loader2, AlertTriangle, Power, Check, Radio, Eye,
} from 'lucide-react';
import { pycoreApi, getPycoreHealth } from '../../../core/api-libs/pycore';
import type { HeartbeatWorkersStatus, HeartbeatCallbackRow } from '../../../core/api-libs/pycore';
import { pnaBlockedReason, pycoreEffectiveHost } from '../../../core/api-libs/pycore/pycoreTarget';

const POLL_MS = 12000;
const AUX_KEYS = ['translation_queue_monitor', 'translation_ws_client'] as const;

const PcWorkerStatusStrip: React.FC<{ refreshTick?: number }> = ({ refreshTick = 0 }) => {
  const { t } = useTranslation('pc');
  const [data, setData] = useState<HeartbeatWorkersStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const s = await pycoreApi.getHeartbeatWorkersStatus();
      if (!mounted.current) return;
      if (s && Array.isArray(s.callbacks)) {
        setData(s);
        setErr(null);
      } else {
        setErr(t('queueCenter.heartbeatWorkers.unavailable'));
      }
    } catch (e: any) {
      if (!mounted.current) return;
      const pna = pnaBlockedReason(pycoreEffectiveHost());
      setErr(pna || e?.message || t('queueCenter.heartbeatWorkers.unavailable'));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [t]);

  useEffect(() => {
    void fetchStatus(false);
    const id = window.setInterval(() => { void fetchStatus(true); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchStatus]);

  const fetchRef = useRef(fetchStatus);
  fetchRef.current = fetchStatus;
  useEffect(() => { void fetchRef.current(true); }, [refreshTick]);

  const toggleAux = async (name: string) => {
    if (!data || busy) return;
    const row = data.callbacks.find((c) => c.name === name);
    if (!row) return;
    setBusy(name);
    try {
      await pycoreApi.setHeartbeatWorkerConfig(name, !row.enabled);
      await fetchStatus(true);
    } catch (e: any) {
      if (mounted.current) setErr(e?.message || 'toggle failed');
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const chip = (c: HeartbeatCallbackRow) => (
    <span
      key={c.name}
      title={`${c.name} · interval ${c.interval}s · runs ${c.run_count}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono ${
        c.enabled
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'bg-slate-500/10 text-slate-400'
      }`}>
      {c.enabled ? <Check className="w-3 h-3" /> : <Power className="w-3 h-3 opacity-50" />}
      {c.name.replace(/_/g, ' ')}
      <span className="text-slate-400">({c.run_count})</span>
    </span>
  );

  const pycoreDown = getPycoreHealth().up === false;

  return (
    <section className="pc-glass p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Cpu className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {t('queueCenter.heartbeatWorkers.title')}
        </span>
        <span className="text-[10px] text-slate-400">{t('queueCenter.heartbeatWorkers.subtitle')}</span>
        <button onClick={() => fetchStatus(!!data)} disabled={(loading && !data) || !!busy}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-violet-500/10 text-violet-500 transition disabled:opacity-50 shrink-0"
          title={t('queueCenter.refreshActive')}>
          <RefreshCw className={`w-3.5 h-3.5 ${(loading && !data) || refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data && !err && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> {t('queueCenter.heartbeatWorkers.loading')}
        </p>
      )}

      {data && (
        <div className="flex flex-wrap gap-1.5">
          {data.callbacks.map(chip)}
        </div>
      )}

      {data && (
        <div className="flex flex-wrap gap-2 items-center text-[10px]">
          {AUX_KEYS.map((key) => {
            const row = data.callbacks.find((c) => c.name === key);
            if (!row) return null;
            const Icon = key.includes('ws') ? Radio : Eye;
            return (
              <button
                key={key}
                type="button"
                disabled={!!busy}
                onClick={() => toggleAux(key)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl font-bold transition disabled:opacity-50 ${
                  row.enabled
                    ? 'bg-sky-500/15 text-sky-600'
                    : 'pc-glass text-slate-500 hover:bg-sky-500/10'
                }`}>
                <Icon className="w-3 h-3" />
                {t(`queueCenter.heartbeatWorkers.${key}` as const)} {row.enabled ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
              </button>
            );
          })}
        </div>
      )}

      {(err || pycoreDown) && (
        <p className="text-[11px] text-rose-500 break-words">
          <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
          {err || t('queueCenter.heartbeatWorkers.unavailable')}
        </p>
      )}
    </section>
  );
};

export default PcWorkerStatusStrip;
