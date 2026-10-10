import React from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CM_BRAND_FORMS } from '../assets/brand/cmBrandDefault.generated';

export type CmLogoForm = keyof typeof CM_BRAND_FORMS;

export interface CmLogoProps {
  form?: CmLogoForm;
  height: number;
  className?: string;
  decorative?: boolean;
}

/** Embedded default logo as inline SVG: it follows the text color, so one asset serves light, dark and inverse surfaces. */
export const CmLogo: React.FC<CmLogoProps> = ({ form = 'lockup', height, className, decorative = false }) => {
  const { t } = useTranslation('cm');
  const spec = CM_BRAND_FORMS[form];
  const width = Math.round((height * spec.width) / spec.height);

  return (
    <svg
      className={`cm-logo cm-logo--${form} ${className ?? ''}`}
      viewBox={spec.viewBox}
      width={width}
      height={height}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : t('brand.name')}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: spec.body }}
    />
  );
};

export default CmLogo;
