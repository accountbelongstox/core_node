import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WfNewPagerProps {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  atLastPage: boolean;
  loading?: boolean;
  onGoTo: (page: number) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

/** Numbered pager: prev / windowed page numbers / next + "page of" indicator. */
export const WfNewPager: React.FC<WfNewPagerProps> = ({
  page, totalPages, atLastPage, loading = false, onGoTo, trans,
}) => {
  const pageWindow = useMemo(() => {
    const span = 2;
    const start = Math.max(1, Math.min(page - span, totalPages - (span * 2)));
    const end = Math.min(totalPages, start + span * 2);
    const out: number[] = [];
    for (let i = Math.max(1, start); i <= end; i += 1) out.push(i);
    return out;
  }, [page, totalPages]);

  if (totalPages <= 1 && page <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onGoTo(page - 1)}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
        </button>
        {pageWindow.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onGoTo(p)}
            disabled={loading}
            className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition disabled:opacity-50 ${
              p === page
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onGoTo(page + 1)}
          disabled={atLastPage || loading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
        >
          {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="text-[10px] font-mono text-zinc-500">
        {trans('content.pageOf', { page, total: totalPages })}
      </span>
    </div>
  );
};
