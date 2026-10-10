import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CM_HOME_PROCESS_STEPS } from '../../shared/cmInfoContent';
import { CmProcessIllustration } from './CmProcessIllustration';
import { useCmProtectedNavigate } from './useCmProtectedNavigate';

export const CmDeliveryFlow: React.FC = () => {
  const { t } = useTranslation('cm');
  const openLink = useCmProtectedNavigate();

  return (
    <section id="cm-delivery-process" className="cm-delivery-flow">
      <header className="cm-public-section__header">
        <p className="cm-public-section__eyebrow">{t('publicHome.process.eyebrow')}</p>
        <h2>{t('publicHome.process.sectionTitle')}</h2>
        <p className="cm-public-section__lead">{t('publicHome.process.lead')}</p>
      </header>
      <div className="cm-delivery-flow__steps">
        {CM_HOME_PROCESS_STEPS.map((step, index) => (
          <article className="cm-delivery-step" key={step.id} data-direction={index % 2 === 0 ? 'text-first' : 'art-first'}>
            <div className="cm-delivery-step__copy">
              <span className="cm-delivery-step__number">{t('publicHome.process.stepLabel', { number: index + 1 })}</span>
              <h3>{t(step.titleKey)}</h3>
              <p>{t(step.bodyKey)}</p>
              <a
                href={step.route}
                onClick={(event) => {
                  event.preventDefault();
                  openLink(step.route);
                }}
              >
                {t(step.actionKey)} <ArrowRight aria-hidden="true" />
              </a>
            </div>
            <CmProcessIllustration step={step.id} />
          </article>
        ))}
      </div>
    </section>
  );
};

export default CmDeliveryFlow;
