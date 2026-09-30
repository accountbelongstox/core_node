import React from 'react';

/** One sparkline for every vortex surface; direction from isPositive or the series itself. */
export const Sparkline: React.FC<{ series: number[]; isPositive?: boolean }> = ({ series, isPositive }) => {
  if (!series || series.length < 2) return null;
  const width = 120;
  const height = 36;
  const pad = 2;
  const hi = Math.max(...series);
  const lo = Math.min(...series);
  const span = hi - lo || 1;
  const n = series.length;
  const x = (i: number) => pad + (i / (n - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - 2 * pad);
  const points = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const up = isPositive ?? series[n - 1] >= series[0];
  const stroke = up ? '#10b981' : '#f43f5e';
  const fill = up ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';
  const fillPoints = `${pad},${height} ${points} ${width - pad},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible pointer-events-none">
      <polygon fill={fill} points={fillPoints} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};
