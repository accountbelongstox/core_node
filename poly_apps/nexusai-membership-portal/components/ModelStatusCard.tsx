
import React from 'react';
import { SystemStatus } from '../types';
import UptimeBar from './UptimeBar';

interface ModelStatusCardProps {
  service: SystemStatus;
}

const ModelStatusCard: React.FC<ModelStatusCardProps> = ({ service }) => (
  <div className="glass p-5 rounded-[2rem] border-white/5 hover:border-blue-500/20 transition-all group">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${service.status === 'operational' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
        <span className="text-[10px] font-black uppercase tracking-widest dark:text-slate-300 text-slate-700">{service.name}</span>
      </div>
      <span className="text-[9px] font-black text-blue-500 tabular-nums">{service.latency}</span>
    </div>
    <UptimeBar history={service.history} size="h-3" />
  </div>
);

export default ModelStatusCard;

