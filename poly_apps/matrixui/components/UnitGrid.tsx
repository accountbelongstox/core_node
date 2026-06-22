import React from 'react';
import { Unit, UnitStatus } from '../types';
import { Cpu, Battery, Activity, WifiOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useI18n } from '../services/i18n';

interface UnitGridProps {
  units: Unit[];
}

const getStatusColor = (status: UnitStatus) => {
  switch (status) {
    case UnitStatus.ONLINE: return 'text-nexus-success border-nexus-success/50 bg-nexus-success/10';
    case UnitStatus.IDLE: return 'text-slate-400 border-slate-500/50 bg-slate-500/10';
    case UnitStatus.WARNING: return 'text-nexus-warning border-nexus-warning/50 bg-nexus-warning/10';
    case UnitStatus.CRITICAL: return 'text-nexus-danger border-nexus-danger/50 bg-nexus-danger/10';
    case UnitStatus.MAINTENANCE: return 'text-purple-400 border-purple-500/50 bg-purple-500/10';
    default: return 'text-slate-600 border-slate-700 bg-slate-800';
  }
};

const getStatusIcon = (status: UnitStatus) => {
  switch (status) {
    case UnitStatus.ONLINE: return <Activity className="w-4 h-4" />;
    case UnitStatus.WARNING: return <AlertTriangle className="w-4 h-4" />;
    case UnitStatus.CRITICAL: return <AlertTriangle className="w-4 h-4 animate-pulse" />;
    case UnitStatus.OFFLINE: return <WifiOff className="w-4 h-4" />;
    case UnitStatus.MAINTENANCE: return <ShieldCheck className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4 opacity-50" />;
  }
};

export const UnitGrid: React.FC<UnitGridProps> = ({ units }) => {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 p-4 overflow-y-auto h-full pb-24">
      {units.map((unit) => (
        <div 
          key={unit.id}
          className={`relative p-4 rounded-lg border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${getStatusColor(unit.status)}`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-sm font-bold tracking-wider font-mono">{unit.id}</h3>
              <span className="text-xs opacity-70">{unit.type}</span>
            </div>
            <div className={`p-1 rounded-full`}>
              {getStatusIcon(unit.status)}
            </div>
          </div>

          <div className="space-y-2">
            {/* CPU Bar */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 opacity-70"><Cpu size={12} /> {t('unit_grid.load')}</span>
              <span className={unit.cpuLoad > 80 ? 'text-nexus-danger' : ''}>{unit.cpuLoad}%</span>
            </div>
            <div className="w-full bg-slate-900/50 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${unit.cpuLoad > 80 ? 'bg-nexus-danger' : 'bg-nexus-accent'}`} 
                style={{ width: `${unit.cpuLoad}%` }}
              ></div>
            </div>

            {/* Battery Bar */}
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="flex items-center gap-1 opacity-70"><Battery size={12} /> {t('unit_grid.power')}</span>
              <span className={unit.battery < 20 ? 'text-nexus-danger' : ''}>{unit.battery}%</span>
            </div>
            <div className="w-full bg-slate-900/50 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${unit.battery < 20 ? 'bg-nexus-danger' : 'bg-nexus-success'}`} 
                style={{ width: `${unit.battery}%` }}
              ></div>
            </div>
          </div>
          
          {unit.status === UnitStatus.CRITICAL && (
             <div className="absolute inset-0 border-2 border-nexus-danger/30 rounded-lg animate-pulse pointer-events-none"></div>
          )}
        </div>
      ))}
    </div>
  );
};
