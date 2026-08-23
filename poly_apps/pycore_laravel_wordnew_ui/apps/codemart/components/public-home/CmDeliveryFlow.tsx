import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CmProcessIllustration, type CmProcessStepId } from './CmProcessIllustration';

const PROCESS_STEPS: Array<{
  id: CmProcessStepId;
  titleKey: string;
  bodyKey: string;
  actionKey: string;
  route: string;
}> = [
  { id: 'requirement', titleKey: 'publicHome.process.requirementTitle', bodyKey: 'publicHome.process.requirementBody', actionKey: 'publicHome.process.requirementAction', route: '/codemart/projects/new' },
  { id: 'cooperation', titleKey: 'publicHome.process.cooperationTitle', bodyKey: 'publicHome.process.cooperationBody', actionKey: 'publicHome.process.cooperationAction', route: '/codemart/projects' },
  { id: 'funding', titleKey: 'publicHome.process.fundingTitle', bodyKey: 'publicHome.process.fundingBody', actionKey: 'publicHome.process.fundingAction', route: '/codemart/wallet' },
  { id: 'delivery', titleKey: 'publicHome.process.deliveryTitle', bodyKey: 'publicHome.process.deliveryBody', actionKey: 'publicHome.process.deliveryAction', route: '/codemart/marketplace' },
  { id: 'warranty', titleKey: 'publicHome.process.warrantyTitle', bodyKey: 'publicHome.process.warrantyBody', actionKey: 'publicHome.process.warrantyAction', route: '/codemart/dashboard' },
];

export const CmDeliveryFlow: React.FC = () => {
  const { t } = useTranslation('cm');

  return (
    <section id="cm-delivery-process" className="cm-delivery-flow">
      <h2>{t('publicHome.process.sectionTitle')}</h2>
      <div className="cm-delivery-flow__steps">
        {PROCESS_STEPS.map((step, index) => (
          <article className="cm-delivery-step" key={step.id} data-direction={index % 2 === 0 ? 'text-first' : 'art-first'}>
            <div className="cm-delivery-step__copy">
              <span className="cm-delivery-step__number">{t('publicHome.process.stepLabel', { number: index + 1 })}</span>
              <h3>{t(step.titleKey)}</h3>
              <p>{t(step.bodyKey)}</p>
              <Link to={step.route}>{t(step.actionKey)} <ArrowRight aria-hidden="true" /></Link>
            </div>
            <CmProcessIllustration step={step.id} />
          </article>
        ))}
      </div>
    </section>
  );
};

export default CmDeliveryFlow;
