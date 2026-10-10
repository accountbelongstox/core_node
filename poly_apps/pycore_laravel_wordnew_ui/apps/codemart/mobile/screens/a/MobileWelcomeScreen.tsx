import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Briefcase, Calculator, Code2, Compass, DraftingCompass, Info, LifeBuoy, ScrollText, Smartphone, Store, Workflow } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { useCmPublicHome } from '../../../api';
import { CmImage } from '../../../components/CmImage';
import { CM_PUBLIC_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import { useCmPageTitle } from '../../../components/public-home/useCmPageTitle';
import { useCmProtectedNavigate } from '../../../components/public-home/useCmProtectedNavigate';
import { CM_HOME_HERO_SLIDES, CM_HOME_PROCESS_STEPS, CM_HOME_ROLE_IDS } from '../../../shared/cmInfoContent';
import { useCmPlatformMetrics } from '../../../shared/useCmPlatformMetrics';
import { MobileButton, MobileChipRow, MobileErrorState, MobileList, MobileListRow, MobileScreen, MobileSectionHeader, MobileStatChip } from '../../ui';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  client: <Briefcase aria-hidden="true" />,
  developer: <Code2 aria-hidden="true" />,
  architect: <DraftingCompass aria-hidden="true" />,
  reviewer: <BadgeCheck aria-hidden="true" />,
};
const EXPLORE_LINKS: Array<{ to: string; labelKey: string; icon: React.ReactNode }> = [
  { to: CM_PUBLIC_ROUTE.showcaseOpenWork, labelKey: 'publicHome.footer.marketplace', icon: <Store aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.estimate, labelKey: 'publicHome.footer.estimate', icon: <Calculator aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.services, labelKey: 'publicHome.footer.services', icon: <Compass aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.delivery, labelKey: 'publicHome.footer.delivery', icon: <Workflow aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.about, labelKey: 'publicHome.footer.about', icon: <Info aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.download, labelKey: 'publicHome.footer.download', icon: <Smartphone aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.information, labelKey: 'publicHome.footer.information', icon: <LifeBuoy aria-hidden="true" /> },
  { to: CM_PUBLIC_ROUTE.terms, labelKey: 'publicHome.footer.terms', icon: <ScrollText aria-hidden="true" /> },
];

/** Signed-out mobile welcome: pitch, sign-in and register, live platform figures, process, roles, testimonials and links. */
const MobileWelcomeScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const openProtected = useCmProtectedNavigate();
  const publicHome = useCmPublicHome();
  const metrics = useCmPlatformMetrics(publicHome.data, publicHome.loading);
  const testimonials = publicHome.data?.testimonials ?? [];
  const statsFailed = publicHome.errorCode !== null && !publicHome.loading;
  useCmPageTitle('publicHome.meta.title', 'publicHome.meta.description');

  return (
    <MobileScreen onRefresh={publicHome.reload}>
      <section className="cmm-welcome">
        <CmImage name={CM_HOME_HERO_SLIDES[0].image} className="cmm-welcome__image" eager />
        <span className="cmm-eyebrow">{t('publicHome.eyebrow')}</span>
        <h2>{t(CM_HOME_HERO_SLIDES[0].titleKey)}</h2>
        <p>{t('mobile.welcome.lead')}</p>
        <div className="cmm-welcome__actions">
          <MobileButton variant="primary" block to={CM_PUBLIC_ROUTE.register}>{t('nav.register')}</MobileButton>
          <MobileButton block to={CM_PUBLIC_ROUTE.login}>{t('nav.login')}</MobileButton>
          <MobileButton block variant="ghost" to={CM_PUBLIC_ROUTE.showcase} icon={<Compass aria-hidden="true" />}>{t('mobile.welcome.browse')}</MobileButton>
        </div>
      </section>

      <div className="cmm-a-slides" role="list">
        {CM_HOME_HERO_SLIDES.slice(1).map((slide) => (
          <article key={slide.variant} className="cmm-a-slide" role="listitem">
            <CmImage name={slide.image} className="cmm-a-slide__image" />
            <h3>{t(slide.titleKey)}</h3>
            <p>{t(slide.subtitleKey)}</p>
          </article>
        ))}
      </div>

      <section className="cmm-section" aria-label={t('publicHome.metrics.regionLabel')}>
        {statsFailed ? (
          <MobileErrorState message={t('publicHome.metrics.loadFailed')} onRetry={publicHome.reload} />
        ) : (
          <>
            <MobileChipRow label={t('publicHome.metrics.regionLabel')}>
              {metrics.map((metric) => <MobileStatChip key={metric.key} value={metric.value} label={metric.label} />)}
            </MobileChipRow>
            <small className="cmm-muted">{t('publicHome.metrics.caption')}</small>
          </>
        )}
      </section>

      <section className="cmm-section">
        <MobileSectionHeader title={t('publicHome.process.sectionTitle')} />
        <p className="cmm-summary">{t('publicHome.process.lead')}</p>
        <MobileList>
          {CM_HOME_PROCESS_STEPS.map((step, index) => (
            <MobileListRow
              key={step.id}
              leading={<span className="cmm-a-num" aria-hidden="true">{index + 1}</span>}
              title={t(step.titleKey)}
              subtitle={t(step.bodyKey)}
              onClick={() => openProtected(step.route, 'welcome-process')}
              chevron
            />
          ))}
        </MobileList>
      </section>

      <section className="cmm-section">
        <MobileSectionHeader title={t('publicHome.roles.title')} />
        <MobileList>
          {CM_HOME_ROLE_IDS.map((id) => (
            <MobileListRow key={id} leading={ROLE_ICONS[id]} title={t(`publicHome.roles.${id}.title`)} subtitle={t(`publicHome.roles.${id}.body`)} />
          ))}
        </MobileList>
      </section>

      {testimonials.length > 0 && (
        <section className="cmm-section">
          <MobileSectionHeader title={t('publicHome.testimonials.title')} />
          <div className="cmm-a-slides" role="list">
            {testimonials.map((item) => (
              <figure key={item.id} className="cmm-a-quote" role="listitem">
                <blockquote>{item.quote}</blockquote>
                <figcaption><strong>{item.author_label}</strong><small>{item.role_label}</small></figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="cmm-section">
        <MobileSectionHeader title={t('publicHome.footer.platformTitle')} />
        <MobileList>
          {EXPLORE_LINKS.map((link) => <MobileListRow key={link.to} to={link.to} leading={link.icon} title={t(link.labelKey)} />)}
        </MobileList>
        <p className="cmm-a-fine"><Link to={CM_PUBLIC_ROUTE.privacy}>{t('publicHome.footer.privacy')}</Link></p>
      </section>
    </MobileScreen>
  );
};

export default MobileWelcomeScreen;
