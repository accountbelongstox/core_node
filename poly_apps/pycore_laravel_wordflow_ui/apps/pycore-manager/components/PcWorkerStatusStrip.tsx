/**
 * PcWorkerStatusStrip — PyHeartbeat callback state and run counts.
 *
 * Reads worker status from the shared Queue Center hub. Worker lifecycle is
 * owned by the section switches so this component never creates a second
 * control path.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cpu, RefreshCw, Loader2, AlertTriangle, Power, Check,
} from 'lucide-react';
import { getPycoreHealth } from '../../../core/api-libs/pycore';
import type { HeartbeatCallbackRow } from '../../../core/api-libs/pycore';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

const PcWorkerStatusStrip: React.FC<{ refreshTick?: number }> = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const data = hub.workers;
  const loading = hub.loading;
  const err = hub.pycoreReachable ? null : hub.error;

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
        <button onClick={() => hub.refreshHub()} disabled={loading && !data}
          className="ml-auto p-1.5 rounded-lg pc-glass hover:bg-violet-500/10 text-violet-500 transition disabled:opacity-50 shrink-0"
          title={t('queueCenter.refreshActive')}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
