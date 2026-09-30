/** PcOriginLine — "provider · model · latency" attribution line of a generated result. */
import React from 'react';

export const PcOriginLine: React.FC<{ provider?: string; model?: string; latencyMs?: number | null }> = ({
  provider, model, latencyMs,
}) => (
  <span className="text-[10px] font-mono text-slate-400 truncate">
    {provider || '—'}{model ? ` · ${model}` : ''}
    {latencyMs != null ? ` · ${Math.round(latencyMs)} ms` : ''}
  </span>
);
