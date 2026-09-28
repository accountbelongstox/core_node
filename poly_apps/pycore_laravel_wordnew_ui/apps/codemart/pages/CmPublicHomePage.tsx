import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Briefcase, Code2, DraftingCompass, ShieldCheck } from 'lucide-react';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { useCmPublicHome } from '../api';
import { CmDeliveryFlow } from '../components/public-home/CmDeliveryFlow';
import { CmHero } from '../components/public-home/CmHero';
import { CmPublicCardGrid, CmPublicSection, type CmPublicCardItem } from '../components/public-home/CmPublicBlocks';
import { CmPlatformStats } from '../components/public-home/CmPlatformStats';
import { CmPublicCta } from '../components/public-home/CmPublicCta';
import { CmPublicFooter } from '../components/public-home/CmPublicFooter';
import { CmPublicHeader } from '../components/public-home/CmPublicHeader';
import { CmTestimonials } from '../components/public-home/CmTestimonials';
import { CM_PROTECTED_ROUTE, CM_PUBLIC_ROUTE } from '../components/public-home/cmPublicRoutes';
import { useCmPageTitle } from '../components/public-home/useCmPageTitle';
import { useCmProtectedNavigate } from '../components/public-home/useCmProtectedNavigate';

const HOME_ROLES: CmPublicCardItem[] = [
  { id: 'client', icon: <Briefcase />, titleKey: 'publicHome.roles.client.title', bodyKey: 'publicHome.roles.client.body' },
  { id: 'developer', icon: <Code2 />, titleKey: 'publicHome.roles.developer.title', bodyKey: 'publicHome.roles.developer.body' },
  { id: 'architect', icon: <DraftingCompass />, titleKey: 'publicHome.roles.architect.title', bodyKey: 'publicHome.roles.architect.body' },
  { id: 'reviewer', icon: <BadgeCheck />, titleKey: 'publicHome.roles.reviewer.title', bodyKey: 'publicHome.roles.reviewer.body' },
];

const HOME_SERVICES: CmPublicCardItem[] = [
  { id: 'managed', image: 'service-managed', titleKey: 'publicHome.services.managed.title', bodyKey: 'publicHome.services.managed.body', to: `${CM_PUBLIC_ROUTE.services}#cm-service-managed`, actionKey: 'publicHome.services.more' },
  { id: 'marketplace', image: 'service-marketplace', titleKey: 'publicHome.services.marketplace.title', bodyKey: 'publicHome.services.marketplace.body', to: `${CM_PUBLIC_ROUTE.services}#cm-service-marketplace`, actionKey: 'publicHome.services.more' },
  { id: 'review', image: 'service-review', titleKey: 'publicHome.services.review.title', bodyKey: 'publicHome.services.review.body', to: `${CM_PUBLIC_ROUTE.services}#cm-service-review`, actionKey: 'publicHome.services.more' },
  { id: 'escrow', image: 'service-escrow', titleKey: 'publicHome.services.escrow.title', bodyKey: 'publicHome.services.escrow.body', to: `${CM_PUBLIC_ROUTE.services}#cm-service-escrow`, actionKey: 'publicHome.services.more' },
];

const CmPublicHomePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const navigate = useNavigate();
  const openProtected = useCmProtectedNavigate();
  const authenticated = useAuthSession();
  const publicHome = useCmPublicHome();
  const openProjectCreation = (): void => openProtected(CM_PROTECTED_ROUTE.projectCreate, 'project-create');
  const openShowcase = (): void => {
    void navigate(CM_PUBLIC_ROUTE.showcaseOpenWork);
  };
  const openRegister = authenticated ? undefined : (): void => {
    void navigate(CM_PUBLIC_ROUTE.register);
  };

  useCmPageTitle('publicHome.meta.title', 'publicHome.meta.description');

  return (
    <div className="cm-public-home" data-end="codemart">
      <CmPublicHeader />
      <main>
        <CmHero onPrimaryAction={openProjectCreation} onSecondaryAction={openShowcase} onRegister={openRegister} />
        <CmPlatformStats
          data={publicHome.data}
          loading={publicHome.loading}
          failed={publicHome.errorCode !== null}
          onRetry={publicHome.reload}
        />
        <CmPublicSection eyebrowKey="publicHome.roles.eyebrow" titleKey="publicHome.roles.title" leadKey="publicHome.roles.lead" tone="muted">
          <CmPublicCardGrid items={HOME_ROLES} columns={4} />
          <p className="cm-public-section__note"><ShieldCheck aria-hidden="true" /> {t('publicHome.roles.adminNote')}</p>
        </CmPublicSection>
        <CmDeliveryFlow />
        <CmPublicSection eyebrowKey="publicHome.services.eyebrow" titleKey="publicHome.services.title" leadKey="publicHome.services.lead" tone="muted">
          <CmPublicCardGrid items={HOME_SERVICES} columns={4} />
        </CmPublicSection>
        <CmTestimonials items={publicHome.data?.testimonials ?? []} />
        <CmPublicCta />
      </main>
      <CmPublicFooter />
    </div>
  );
};

export default CmPublicHomePage;
