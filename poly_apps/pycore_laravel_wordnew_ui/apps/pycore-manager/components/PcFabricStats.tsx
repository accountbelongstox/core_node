import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { laravelRelayApi } from '../../../core/integrations/laravel/LaravelRelayAPI';
import type { RelayFabricRouteStats } from '../../../core/contracts/RelayFabricContract';

const STATS_WINDOW_MINUTES = 15;
const STATS_REFRESH_MS = 15_000;
const PERCENT = 100;

/** Per-route fabric latency percentiles (owner stats), shown inside the HTTP debugger. */
export const PcFabricStats: React.FC = () => {
  const { t } = useTranslation('pc');
  const [rows, setRows] = useState<RelayFabricRouteStats[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await laravelRelayApi.getFabricStats(STATS_WINDOW_MINUTES));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), STATS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (failed && rows === null) {
    return <div className="p-3 text-[11px] text-rose-400">{t('httpDebug.fabricUnavailable')}</div>;
  }
  if (rows === null || rows.length === 0) {
    return <div className="p-3 text-[11px] text-slate-600">{t('httpDebug.fabricEmpty')}</div>;
  }
  return (
    <table className="w-full text-[11px] font-mono border-collapse">
      <thead>
        <tr className="text-slate-500 border-b border-white/5">
          <th className="px-2 py-1 text-left font-normal">{t('httpDebug.fabricRoute')}</th>
          <th className="px-1.5 py-1 text-right font-normal">{t('httpDebug.fabricCount')}</th>
          <th className="px-1.5 py-1 text-right font-normal">p50</th>
          <th className="px-1.5 py-1 text-right font-normal">p90</th>
          <th className="px-1.5 py-1 text-right font-normal">p99</th>
          <th className="px-2 py-1 text-right font-normal">{t('httpDebug.fabricErrors')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.route} className="border-b border-white/5">
            <td className="px-2 py-1 text-slate-200 truncate max-w-0">{row.route}</td>
            <td className="px-1.5 py-1 text-right text-slate-400">{row.count}</td>
            <td className="px-1.5 py-1 text-right text-cyan-400">{Math.round(row.p50)}ms</td>
            <td className="px-1.5 py-1 text-right text-cyan-400">{Math.round(row.p90)}ms</td>
            <td className={`px-1.5 py-1 text-right ${row.p99 > 1000 ? 'text-amber-400' : 'text-cyan-400'}`}>
              {Math.round(row.p99)}ms
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

export default PcFabricStats;
