import React, { useEffect, useState } from 'react';
import { ChevronsUpDown, ChevronUp } from 'lucide-react';

/**
 * Shared folded-number pager: quick 1/2/3-style page jumps with ellipsis
 * folding plus a typed page-number jump. Used by every paged agent-history
 * surface (sessions, prompts, generation records) so paging looks and
 * behaves identically everywhere.
 *
 * Collapsed shows the folded window (first/last page, current ±1, '…' gaps).
 * Expanding (toggle button or clicking a '…' gap) lists EVERY page number in
 * a wrapped, scrollable strip - each one directly clickable. Collapsing
 * again returns to the folded view.
 */

/** Page list with folded gaps: always 1 and the last page, a window around
 * the current page, and '...' markers where numbers were collapsed. */
export const pageWindow = (current: number, total: number): Array<number | '...'> => {
  const page = Math.min(Math.max(1, current), Math.max(1, total));
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const wanted = new Set<number>([1, total, page - 1, page, page + 1]);
  const numbers = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | '...'> = [];
  let previous = 0;
  for (const n of numbers) {
    if (previous && n - previous > 1) {
      out.push('...');
    }
    out.push(n);
    previous = n;
  }
  return out;
};

const PcPager: React.FC<{
  page: number;
  totalPages: number;
  onChange: (next: number) => void;
  tk: (k: string) => string;
}> = ({ page, totalPages, onChange, tk }) => {
  const [jumpValue, setJumpValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));

  useEffect(() => {
    setJumpValue('');
  }, [safePage]);

  const jump = () => {
    const parsed = Number.parseInt(jumpValue, 10);
    if (Number.isNaN(parsed)) {
      setJumpValue('');
      return;
    }
    onChange(Math.min(Math.max(1, parsed), totalPages));
  };

  if (totalPages <= 1) {
    return null;
  }

  const btnCls = 'min-w-[28px] h-7 px-1.5 rounded-md border text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const idleCls = 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10';
  const activeCls = 'border-indigo-500 bg-indigo-600 text-white';
  const pageBtn = (n: number) => (
    <button
      key={n}
      type="button"
      onClick={() => onChange(n)}
      aria-current={n === safePage ? 'page' : undefined}
      className={`${btnCls} ${n === safePage ? activeCls : idleCls}`}
    >
      {n}
    </button>
  );

  return (
    <div className="pt-2 space-y-1.5">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onChange(Math.max(1, safePage - 1))}
          className={`px-2.5 h-7 rounded-md border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${idleCls}`}
        >
          {tk('prev')}
        </button>
        {expanded ? (
          <span className="px-1 text-xs font-mono text-slate-500 select-none">
            {safePage} / {totalPages}
          </span>
        ) : (
          pageWindow(safePage, totalPages).map((item, index) =>
            item === '...' ? (
              <button
                key={`gap-${index}`}
                type="button"
                onClick={() => setExpanded(true)}
                title={tk('expandPages')}
                aria-label={tk('expandPages')}
                className="px-1 h-7 text-xs text-slate-400 hover:text-indigo-500 select-none"
              >
                …
              </button>
            ) : (
              pageBtn(item)
            ),
          )
        )}
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onChange(Math.min(totalPages, safePage + 1))}
          className={`px-2.5 h-7 rounded-md border text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${idleCls}`}
        >
          {tk('next')}
        </button>
        <span className="ml-1 flex items-center gap-1">
          <input
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') jump();
            }}
            inputMode="numeric"
            placeholder={tk('jumpPage')}
            title={tk('jumpPage')}
            aria-label={tk('jumpPage')}
            className="w-14 h-7 px-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-mono text-center"
          />
          <button
            type="button"
            onClick={jump}
            className="h-7 px-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 text-xs text-indigo-600 dark:text-indigo-300 transition-colors hover:bg-indigo-500/20"
          >
            {tk('go')}
          </button>
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? tk('collapsePages') : tk('expandPages')}
          aria-label={expanded ? tk('collapsePages') : tk('expandPages')}
          className="h-7 px-1.5 rounded-md border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5" />
            : <ChevronsUpDown className="w-3.5 h-3.5" />}
        </button>
      </div>
      {expanded && (
        <div className="flex flex-wrap justify-center gap-1.5 max-h-[120px] overflow-y-auto px-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageBtn)}
        </div>
      )}
    </div>
  );
};

export default PcPager;
