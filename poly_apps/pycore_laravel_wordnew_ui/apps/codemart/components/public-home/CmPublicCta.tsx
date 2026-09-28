import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuthSession } from '../../../../core/auth/useAuthSession';
import { useTranslation } from '../../../../core/i18n/UiI18n';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from './cmPublicRoutes';
import { useCmProtectedNavigate } from './useCmProtectedNavigate';

const DEFAULT_TITLE_KEY = 'publicHome.finalCta.title';
const DEFAULT_BODY_KEY = 'publicHome.finalCta.body';

export interface CmPublicCtaProps {
  titleKey?: string;
  bodyKey?: string;
}

/**
 * Closing call to action shared by every public page: start a project brief
 * (through sign-in when needed) and either create an account or, when signed
 * in, open the estimate calculator.
 */
export const CmPublicCta: React.FC<CmPublicCtaProps> = ({ titleKey = DEFAULT_TITLE_KEY, bodyKey = DEFAULT_BODY_KEY }) => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const openProtected = useCmProtectedNavigate();
  const authenticated = useAuthSession();
  const secondaryRoute = authenticated ? CM_PUBLIC_ROUTE.estimate : CM_PUBLIC_ROUTE.register;
  const secondaryLabel = authenticated ? t('publicHome.finalCta.estimate') : t('nav.register');

  return (
    <section className="cm-public-cta">
      <div className="cm-public-container">
        <h2>{t(titleKey)}</h2>
        <p>{t(bodyKey)}</p>
        <div className="cm-public-cta__actions">
          <button
            type="button"
            className="cm-public-button cm-public-button--primary"
            onClick={() => openProtected(CM_PROTECTED_ROUTE.projectCreate, 'project-create')}
          >
            {t('publicHome.finalCta.action')} <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" className="cm-public-button cm-public-button--outline" onClick={() => void navigate(secondaryRoute)}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    </section>
  );
};

export default CmPublicCta;
