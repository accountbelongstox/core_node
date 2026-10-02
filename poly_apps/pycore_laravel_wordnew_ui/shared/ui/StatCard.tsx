import React from 'react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Value text colour class. */
  tone?: string;
}

/** KPI tile: big value over a small uppercase caption. */
export const StatCard: React.FC<StatCardProps> = ({ label, value, tone = 'text-slate-100' }) => (
  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
    <p className={`text-xl font-black font-mono ${tone}`}>{value}</p>
    <p className="text-[10px] font-mono text-zinc-500 uppercase mt-0.5">{label}</p>
  </div>
);
