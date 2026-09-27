import React from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CM_BRAND_ICON_URL } from '../cmFlavor';

const MARK_SIZE = 40;
const COMPACT_MARK_SIZE = 32;

export interface CmBrandProps {
  inverse?: boolean;
  compact?: boolean;
}

export const CmBrand: React.FC<CmBrandProps> = ({ inverse = false, compact = false }) => {
  const { t } = useTranslation('cm');
  const markSize = compact ? COMPACT_MARK_SIZE : MARK_SIZE;

  return (
    <span className={`cm-brand ${inverse ? 'cm-brand--inverse' : ''}`}>
      {CM_BRAND_ICON_URL && (
        <span className="cm-brand__mark" aria-hidden="true">
          <img src={CM_BRAND_ICON_URL} alt="" width={markSize} height={markSize} decoding="async" />
        </span>
      )}
      <span className="cm-brand__copy">
        <span className="cm-brand__name">{t('brand.name')}</span>
        {!compact && <span className="cm-brand__tagline">{t('brand.tagline')}</span>}
      </span>
    </span>
  );
};

export default CmBrand;
