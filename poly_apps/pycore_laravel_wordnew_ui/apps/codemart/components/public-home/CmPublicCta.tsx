import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';

export const CmPublicCta: React.FC<{ onAction: () => void }> = ({ onAction }) => {
  const { t } = useTranslation('cm');

  return (
    <section className="cm-public-cta">
      <div className="cm-public-container">
        <h2>{t('publicHome.finalCta.title')}</h2>
        <p>{t('publicHome.finalCta.body')}</p>
        <button type="button" className="cm-public-button cm-public-button--primary" onClick={onAction}>
          {t('publicHome.finalCta.action')} <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default CmPublicCta;
