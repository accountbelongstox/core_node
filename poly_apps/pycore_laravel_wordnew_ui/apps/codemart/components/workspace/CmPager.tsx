import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmFormat } from './cmWorkspaceFormat';

export type CmPagerVariant = 'workspace' | 'admin' | 'public';

const PAGER_CLASS: Record<CmPagerVariant, string> = {
  workspace: 'cm-pager',
  admin: 'cm-admin-pager',
  public: 'cm-showcase-pager',
};
const BUTTON_CLASS = 'cm-workspace-button';

interface CmPagerProps {
  page: number;
  totalPages: number;
  /** Record count: the summary includes it and the pager stays visible on a single page. */
  total?: number;
  disabled?: boolean;
  variant?: CmPagerVariant;
  onChange: (page: number) => void;
}

/** One pager for workspace, admin and public lists; the variant only picks the surface style. */
export const CmPager: React.FC<CmPagerProps> = ({ page, totalPages, total, disabled = false, variant = 'workspace', onChange }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  if (total === undefined ? totalPages <= 1 : total === 0) return null;

  const iconOnly = variant === 'public';
  const pages = { page: format.number(page), pages: format.number(totalPages) };
  const summary = total === undefined
    ? t('common.pageInfo', pages)
    : t('common.pageSummary', { ...pages, total: format.number(total) });
  const previous = (
    <button
      type="button"
      className={iconOnly ? undefined : BUTTON_CLASS}
      disabled={disabled || page <= 1}
      aria-label={iconOnly ? t('common.previous') : undefined}
      onClick={() => onChange(page - 1)}
    >
      <ChevronLeft aria-hidden="true" />{iconOnly ? null : ` ${t('common.previous')}`}
    </button>
  );
  const next = (
    <button
      type="button"
      className={iconOnly ? undefined : BUTTON_CLASS}
      disabled={disabled || page >= totalPages}
      aria-label={iconOnly ? t('common.next') : undefined}
      onClick={() => onChange(page + 1)}
    >
      {iconOnly ? null : `${t('common.next')} `}<ChevronRight aria-hidden="true" />
    </button>
  );

  return (
    <nav className={PAGER_CLASS[variant]} aria-label={t('common.pagination')}>
      {total === undefined ? (
        <>{previous}<span>{summary}</span>{next}</>
      ) : (
        <>
          <span>{summary}</span>
          {totalPages > 1 && <div>{previous}{next}</div>}
        </>
      )}
    </nav>
  );
};

export default CmPager;
