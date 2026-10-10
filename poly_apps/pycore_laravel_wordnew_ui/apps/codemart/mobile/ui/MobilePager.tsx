import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { useCmFormat } from '../../components/workspace/cmWorkspaceFormat';

interface MobilePagerProps {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}

export const MobilePager: React.FC<MobilePagerProps> = ({ page, totalPages, disabled = false, onChange }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  if (totalPages <= 1) return null;
  return (
    <nav className="cmm-pager" aria-label={t('mobile.ui.pager')}>
      <button type="button" className="cmm-icon-btn" disabled={disabled || page <= 1} aria-label={t('common.previous')} onClick={() => onChange(page - 1)}><ChevronLeft aria-hidden="true" /></button>
      <span>{t('common.pageInfo', { page: format.number(page), pages: format.number(totalPages) })}</span>
      <button type="button" className="cmm-icon-btn" disabled={disabled || page >= totalPages} aria-label={t('common.next')} onClick={() => onChange(page + 1)}><ChevronRight aria-hidden="true" /></button>
    </nav>
  );
};
