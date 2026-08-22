import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PcQueueLogPaginationProps {
  page: number;
  pages: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}

export function PcQueueLogPagination({
  page,
  pages,
  total,
  loading,
  onPage,
}: PcQueueLogPaginationProps) {
  const { t } = useTranslation('pc');
  return (
    <div className="flex items-center gap-2 text-[10px] text-slate-400">
      <span>{t('queueCenter.logPagination.total', { total })}</span>
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={loading || page <= 1}
        title={t('queueCenter.logPagination.previous')}
        className="rounded bg-slate-700 p-1 text-slate-300 disabled:opacity-30">
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="font-mono">{t('queueCenter.logPagination.page', { page, pages })}</span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={loading || page >= pages}
        title={t('queueCenter.logPagination.next')}
        className="rounded bg-slate-700 p-1 text-slate-300 disabled:opacity-30">
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}
