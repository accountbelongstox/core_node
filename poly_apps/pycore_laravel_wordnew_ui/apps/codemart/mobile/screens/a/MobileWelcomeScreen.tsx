import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CmImage } from '../../../components/CmImage';
import { CM_PUBLIC_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { MobileButton, MobileCard, MobileScreen } from '../../ui';

const VALUE_POINTS = ['slide1', 'slide2', 'slide3'] as const;

/** Signed-out mobile welcome: what CodeMart is, sign in or register, browse the showcase. */
const MobileWelcomeScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  return (
    <MobileScreen>
      <section className="cmm-welcome">
        <CmImage name="auth-welcome" className="cmm-welcome__image" eager />
        <span className="cmm-eyebrow">{t('publicHome.eyebrow')}</span>
        <h2>{t('brand.tagline')}</h2>
        <p>{t('mobile.welcome.lead')}</p>
        <div className="cmm-welcome__actions">
          <MobileButton variant="primary" block to={CM_PUBLIC_ROUTE.login}>{t('nav.login')}</MobileButton>
          <MobileButton block to={CM_PUBLIC_ROUTE.register} icon={<ArrowRight aria-hidden="true" />}>{t('nav.register')}</MobileButton>
        </div>
      </section>
      <MobileCard>
        <ul className="cmm-points">
          {VALUE_POINTS.map((point) => (
            <li key={point}>
              <strong>{t(`publicHome.hero.${point}Title`)}</strong>
            </li>
          ))}
        </ul>
      </MobileCard>
      <MobileButton block variant="ghost" to={CM_PUBLIC_ROUTE.showcase} icon={<Compass aria-hidden="true" />}>{t('mobile.welcome.browse')}</MobileButton>
    </MobileScreen>
  );
};

export default MobileWelcomeScreen;
