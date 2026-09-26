import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmProcessIllustration, type CmProcessStepId } from './CmProcessIllustration';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from './cmPublicRoutes';
import { useCmProtectedNavigate } from './useCmProtectedNavigate';

const PROCESS_STEPS: Array<{
  id: CmProcessStepId;
  titleKey: string;
  bodyKey: string;
  actionKey: string;
  route: string;
}> = [
  { id: 'brief', titleKey: 'publicHome.process.briefTitle', bodyKey: 'publicHome.process.briefBody', actionKey: 'publicHome.process.briefAction', route: CM_PROTECTED_ROUTE.projectCreate },
  { id: 'proposal', titleKey: 'publicHome.process.proposalTitle', bodyKey: 'publicHome.process.proposalBody', actionKey: 'publicHome.process.proposalAction', route: CM_PROTECTED_ROUTE.projects },
  { id: 'funding', titleKey: 'publicHome.process.fundingTitle', bodyKey: 'publicHome.process.fundingBody', actionKey: 'publicHome.process.fundingAction', route: CM_PUBLIC_ROUTE.services },
  { id: 'marketplace', titleKey: 'publicHome.process.marketplaceTitle', bodyKey: 'publicHome.process.marketplaceBody', actionKey: 'publicHome.process.marketplaceAction', route: CM_PUBLIC_ROUTE.showcaseOpenWork },
  { id: 'review', titleKey: 'publicHome.process.reviewTitle', bodyKey: 'publicHome.process.reviewBody', actionKey: 'publicHome.process.reviewAction', route: CM_PUBLIC_ROUTE.delivery },
];

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
        {PROCESS_STEPS.map((step, index) => (
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
