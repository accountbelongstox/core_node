import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Previous / next pager of a keyset list (`useKeysetPages`). */
export function PcCursorPager({
  pageIndex,
  hasMore,
  loading,
  onPrevious,
  onNext,
}: {
  pageIndex: number;
  hasMore: boolean;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation('pc');
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
      <button
        type="button"
        onClick={onPrevious}
        disabled={loading || pageIndex <= 1}
        title={t('common.previousPage')}
        className="rounded bg-slate-700 p-1 text-slate-300 disabled:opacity-30">
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="font-mono">{t('common.pageNumber', { page: pageIndex })}</span>
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      <button
        type="button"
        onClick={onNext}
        disabled={loading || !hasMore}
        title={t('common.nextPage')}
        className="rounded bg-slate-700 p-1 text-slate-300 disabled:opacity-30">
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
