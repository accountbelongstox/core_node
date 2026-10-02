import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChipButton } from '@/shared/ui/ChipButton';

interface WfNewPagerProps {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  atLastPage?: boolean;
  loading?: boolean;
  onGoTo: (page: number) => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** `numbered`: windowed page buttons; `compact`: prev / "page of" label / next. */
  variant?: 'numbered' | 'compact';
}

const PAGE_WINDOW_SPAN = 2;

/** Pager: prev / (windowed page numbers) / next + "page of" indicator. */
export const WfNewPager: React.FC<WfNewPagerProps> = ({
  page, totalPages, atLastPage = page >= totalPages, loading = false, onGoTo, trans, variant = 'numbered',
}) => {
  const pageWindow = useMemo(() => {
    const span = PAGE_WINDOW_SPAN;
    const start = Math.max(1, Math.min(page - span, totalPages - (span * 2)));
    const end = Math.min(totalPages, start + span * 2);
    const out: number[] = [];
    for (let i = Math.max(1, start); i <= end; i += 1) out.push(i);
    return out;
  }, [page, totalPages]);

  const compact = variant === 'compact';
  if (compact ? totalPages <= 1 : (totalPages <= 1 && page <= 1)) return null;

  const pageOf = trans('content.pageOf', { page, total: totalPages });
  return (
    <div className={`flex ${compact ? 'items-center justify-center pt-1' : 'flex-col items-center gap-2 pt-2'}`}>
      <div className="flex items-center gap-1.5">
        <ChipButton onClick={() => onGoTo(page - 1)} disabled={page <= 1 || loading}>
          <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
        </ChipButton>
        {compact && <span className="px-3 text-[11px] font-mono text-zinc-400">{pageOf}</span>}
        {!compact && pageWindow.map((p) => (
          <ChipButton
            key={p}
            variant={p === page ? 'active' : 'default'}
            onClick={() => onGoTo(p)}
            disabled={loading}
            size="icon" className="min-w-[2rem] justify-center"
          >
            {p}
          </ChipButton>
        ))}
        <ChipButton onClick={() => onGoTo(page + 1)} disabled={atLastPage || loading}>
          {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
        </ChipButton>
      </div>
      {!compact && <span className="text-[10px] font-mono text-zinc-500">{pageOf}</span>}
    </div>
  );
};
