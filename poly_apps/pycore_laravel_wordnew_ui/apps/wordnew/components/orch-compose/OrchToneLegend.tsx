import React from 'react';
import { TONE_BAR, TONE_TEXT, type StatusTone } from '@/shared/ui/statusTone';

export interface OrchLegendItem {
  key: string;
  tone: StatusTone;
  text: string;
}

/** One coloured count per bar segment (the key under a stacked progress bar). */
export const OrchToneLegend: React.FC<{ items: readonly OrchLegendItem[]; dots?: boolean; className?: string }> = ({ items, dots = false, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] ${className}`}>
    {items.map((item) => (
      <span key={item.key} className={`inline-flex items-center gap-1 ${TONE_TEXT[item.tone]}`}>
        {dots && <span className={`h-1.5 w-1.5 rounded-full ${TONE_BAR[item.tone]}`} aria-hidden />}
        {item.text}
      </span>
    ))}
  </div>
);
