
import React from 'react';
import { UptimePoint } from '../types';

const UptimeBar = ({ history, size = "h-4" }: { history: UptimePoint[], size?: string }) => (
  <div className={`flex gap-[2px] ${size} w-full items-center`}>
    {history.map((entry, idx) => (
      <div 
        key={idx} 
        className={`uptime-dot flex-1 ${
          entry.status === 'up' ? 'bg-green-500/40 hover:bg-green-400' : 
          entry.status === 'partial' ? 'bg-yellow-500/40 hover:bg-yellow-400' : 'bg-red-500/40 hover:bg-red-400'
        }`}
        title={`Status: ${entry.status.toUpperCase()} | Index -${history.length - 1 - idx}`}
      />
    ))}
  </div>
);

export default UptimeBar;

