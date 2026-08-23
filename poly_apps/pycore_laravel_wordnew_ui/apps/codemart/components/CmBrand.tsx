import React from 'react';
import { Braces } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';

export interface CmBrandProps {
  inverse?: boolean;
  compact?: boolean;
}

export const CmBrand: React.FC<CmBrandProps> = ({ inverse = false, compact = false }) => {
  const { t } = useTranslation('cm');

  return (
    <span className={`cm-brand ${inverse ? 'cm-brand--inverse' : ''}`}>
      <span className="cm-brand__mark" aria-hidden="true">
        <Braces size={compact ? 18 : 22} strokeWidth={2.2} />
      </span>
      <span className="cm-brand__copy">
        <span className="cm-brand__name">{t('brand.name')}</span>
        {!compact && <span className="cm-brand__tagline">{t('brand.tagline')}</span>}
      </span>
    </span>
  );
};

export default CmBrand;
