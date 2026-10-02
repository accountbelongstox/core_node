import React from 'react';

interface PcIndexBadgeProps {
  /** 1-based position of the active entry; nothing renders when it is not positive. */
  index: number;
  title?: string;
}

/** Small number badge pinned to the top-right corner of an icon (which API/endpoint is active). */
export const PcIndexBadge: React.FC<PcIndexBadgeProps> = ({ index, title }) => (
  index > 0 ? (
    <span
      title={title}
      className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-indigo-600 px-0.5 font-sans text-[9px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900"
    >
      {index}
    </span>
  ) : null
);
