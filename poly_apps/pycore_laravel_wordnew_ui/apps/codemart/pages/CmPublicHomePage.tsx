import React from 'react';
import { useNavigate } from 'react-router-dom';
import { requestAuthLogin } from '../../../core/auth/AuthRequestCenter';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { useCmPublicHome } from '../api';
import { CmDeliveryFlow } from '../components/public-home/CmDeliveryFlow';
import { CmHero } from '../components/public-home/CmHero';
import { CmPlatformStats } from '../components/public-home/CmPlatformStats';
import { CmPublicCta } from '../components/public-home/CmPublicCta';
import { CmPublicFooter } from '../components/public-home/CmPublicFooter';
import { CmPublicHeader } from '../components/public-home/CmPublicHeader';
import { CmTestimonials } from '../components/public-home/CmTestimonials';
import '../styles/cm-public-home.css';

const CmPublicHomePage: React.FC = () => {
  const navigate = useNavigate();
  const authenticated = useAuthSession();
  const publicHome = useCmPublicHome();
  const openProjectCreation = (): void => {
    if (authenticated) {
      navigate('/codemart/projects/new');
      return;
    }
    requestAuthLogin({ source: 'codemart', reason: 'project-create' });
  };
  const openMarketplace = (): void => navigate('/codemart/marketplace');

  return (
    <div className="cm-public-home" data-end="codemart">
      <CmPublicHeader />
      <main>
        <CmHero onPrimaryAction={openProjectCreation} onSecondaryAction={openMarketplace} />
        <CmPlatformStats data={publicHome.data} loading={publicHome.loading} />
        <CmDeliveryFlow />
        <CmTestimonials items={publicHome.data?.testimonials ?? []} />
        <CmPublicCta onAction={openProjectCreation} />
      </main>
      <CmPublicFooter />
    </div>
  );
};

export default CmPublicHomePage;
