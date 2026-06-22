import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Unit, UnitStatus } from '../types';
import { useI18n } from '../services/i18n';

interface SystemStatsProps {
  units: Unit[];
  history: { time: string; active: number; load: number }[];
}

export const SystemStats: React.FC<SystemStatsProps> = ({ units, history }) => {
  const { t } = useI18n();
  const onlineCount = units.filter(u => u.status === UnitStatus.ONLINE).length;
  const criticalCount = units.filter(u => u.status === UnitStatus.CRITICAL).length;
  const avgLoad = Math.round(units.reduce((acc, u) => acc + u.cpuLoad, 0) / units.length) || 0;

  return (
    <div className="bg-nexus-800/50 border border-nexus-700 rounded-xl p-6 backdrop-blur-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="flex flex-col">
          <span className="text-sm text-slate-400">{t('system_stats.network_status')}</span>
          <span className="text-2xl font-bold text-nexus-success">{onlineCount} / {units.length} {t('system_stats.online')}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-slate-400">{t('system_stats.system_load')}</span>
          <span className={`text-2xl font-bold ${avgLoad > 80 ? 'text-nexus-danger' : 'text-nexus-accent'}`}>
            {avgLoad}%
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-slate-400">{t('system_stats.critical_alerts')}</span>
          <span className={`text-2xl font-bold ${criticalCount > 0 ? 'text-nexus-danger' : 'text-slate-200'}`}>
            {criticalCount} {t('system_stats.units')}
          </span>
        </div>
      </div>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history}>
            <defs>
              <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Area 
              type="monotone" 
              dataKey="load" 
              stroke="#0ea5e9" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorLoad)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
