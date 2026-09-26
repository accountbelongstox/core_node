import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

interface CmPagerProps {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}

export const CmPager: React.FC<CmPagerProps> = ({ page, totalPages, disabled = false, onChange }) => {
  const { t } = useTranslation('cm');
  if (totalPages <= 1) return null;
  return (
    <nav className="cm-pager" aria-label={t('common.pagination')}>
      <button type="button" className="cm-workspace-button" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft aria-hidden="true" /> {t('common.previous')}
      </button>
      <span>{t('common.pageInfo', { page, pages: totalPages })}</span>
      <button type="button" className="cm-workspace-button" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
        {t('common.next')} <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
};

export default CmPager;
