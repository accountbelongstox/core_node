import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isRelayAuthorizationFailure, laravelRelayApi } from '../../../core/integrations/laravel/LaravelRelayAPI';
import { subscribeAuthSession } from '../../../core/auth/AuthSession';
import type { RelayRouteStats } from '../../../core/contracts/RelayContract';

const STATS_WINDOW_MINUTES = 15;
const STATS_REFRESH_MS = 15_000;
const PERCENT = 100;

/** Per-route relay latency percentiles (owner stats), shown inside the HTTP debugger. */
export const PcRelayStats: React.FC = () => {
  const { t } = useTranslation('pc');
  const [rows, setRows] = useState<RelayRouteStats[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (): Promise<boolean> => {
    try {
      setRows(await laravelRelayApi.getRelayStats(STATS_WINDOW_MINUTES));
      setFailed(false);
      return true;
    } catch (error) {
      setFailed(true);
      return !isRelayAuthorizationFailure(error);
    }
  }, []);

  // A 401/403 pauses polling until the shared auth session changes.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const pause = (): void => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const poll = (): void => {
      void load().then((authorized) => { if (!authorized) pause(); });
    };
    const resume = (): void => {
      pause();
      poll();
      timer = setInterval(poll, STATS_REFRESH_MS);
    };
    resume();
    const unsubscribe = subscribeAuthSession(resume);
    return () => {
      unsubscribe();
      pause();
    };
  }, [load]);

  if (failed && rows === null) {
    return <div className="p-3 text-[11px] text-rose-400">{t('httpDebug.relayUnavailable')}</div>;
  }
  if (rows === null || rows.length === 0) {
    return <div className="p-3 text-[11px] text-slate-600">{t('httpDebug.relayEmpty')}</div>;
  }
  return (
    <table className="w-full text-[11px] font-mono border-collapse">
      <thead>
        <tr className="text-slate-500 border-b border-white/5">
          <th className="px-2 py-1 text-left font-normal">{t('httpDebug.relayRoute')}</th>
          <th className="px-1.5 py-1 text-right font-normal">{t('httpDebug.relayCount')}</th>
          <th className="px-1.5 py-1 text-right font-normal">p50</th>
          <th className="px-1.5 py-1 text-right font-normal">p90</th>
          <th className="px-1.5 py-1 text-right font-normal">p99</th>
          <th className="px-2 py-1 text-right font-normal">{t('httpDebug.relayErrors')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.route_policy} className="border-b border-white/5">
            <td className="px-2 py-1 text-slate-200 truncate max-w-0">{row.route_policy}</td>
            <td className="px-1.5 py-1 text-right text-slate-400">{row.calls}</td>
            <td className="px-1.5 py-1 text-right text-cyan-400">{Math.round(row.p50_ms)}ms</td>
            <td className="px-1.5 py-1 text-right text-cyan-400">{Math.round(row.p90_ms)}ms</td>
            <td className={`px-1.5 py-1 text-right ${row.p99_ms > 1000 ? 'text-amber-400' : 'text-cyan-400'}`}>
              {Math.round(row.p99_ms)}ms
            </td>
            <td className={`px-2 py-1 text-right ${row.error_rate > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
              {(row.error_rate * PERCENT).toFixed(1)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PcRelayStats;
