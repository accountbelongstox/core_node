import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmChromeControls } from '../components/CmChromeControls';
import { CmBrand } from '../components/CmBrand';

interface CmInfoSection {
  headingKey: string;
  bodyKey: string;
}

/**
 * Shared renderer for the informational CodeMart pages (About, Delivery
 * process, Services, Privacy, Terms, Information). All copy lives in the
 * codemart i18n namespace under `infoPages.<id>`; nothing is hardcoded here.
 */
const CmInfoPage: React.FC<{ pageId: string; sections: CmInfoSection[] }> = ({ pageId, sections }) => {
  const { t } = useTranslation('cm');

  return (
    <main className="cm-info-page">
      <header className="cm-info-page__header">
        <div className="cm-info-page__header-inner">
          <Link to="/codemart" aria-label={t('brand.name')}><CmBrand /></Link>
          <CmChromeControls />
        </div>
      </header>
      <div className="cm-info-page__body">
        <Link to="/codemart" className="cm-info-page__back">
          <ArrowLeft aria-hidden="true" /> {t('common.backHome')}
        </Link>
        <h1>{t(`infoPages.${pageId}.title`)}</h1>
        <p className="cm-info-page__lead">{t(`infoPages.${pageId}.lead`)}</p>
        {sections.map((section) => (
          <section key={section.headingKey}>
            <h2>{t(section.headingKey)}</h2>
            <p>{t(section.bodyKey)}</p>
          </section>
        ))}
      </div>
    </main>
  );
};

const aboutSections: CmInfoSection[] = [
  { headingKey: 'infoPages.about.missionTitle', bodyKey: 'infoPages.about.missionBody' },
  { headingKey: 'infoPages.about.platformTitle', bodyKey: 'infoPages.about.platformBody' },
  { headingKey: 'infoPages.about.rolesTitle', bodyKey: 'infoPages.about.rolesBody' },
];

const deliverySections: CmInfoSection[] = [
  { headingKey: 'infoPages.delivery.requirementTitle', bodyKey: 'infoPages.delivery.requirementBody' },
  { headingKey: 'infoPages.delivery.planTitle', bodyKey: 'infoPages.delivery.planBody' },
  { headingKey: 'infoPages.delivery.fundingTitle', bodyKey: 'infoPages.delivery.fundingBody' },
  { headingKey: 'infoPages.delivery.deliveryTitle', bodyKey: 'infoPages.delivery.deliveryBody' },
  { headingKey: 'infoPages.delivery.warrantyTitle', bodyKey: 'infoPages.delivery.warrantyBody' },
];

const servicesSections: CmInfoSection[] = [
  { headingKey: 'infoPages.services.managedTitle', bodyKey: 'infoPages.services.managedBody' },
  { headingKey: 'infoPages.services.marketplaceTitle', bodyKey: 'infoPages.services.marketplaceBody' },
  { headingKey: 'infoPages.services.reviewTitle', bodyKey: 'infoPages.services.reviewBody' },
  { headingKey: 'infoPages.services.escrowTitle', bodyKey: 'infoPages.services.escrowBody' },
];

const privacySections: CmInfoSection[] = [
  { headingKey: 'infoPages.privacy.collectTitle', bodyKey: 'infoPages.privacy.collectBody' },
  { headingKey: 'infoPages.privacy.useTitle', bodyKey: 'infoPages.privacy.useBody' },
  { headingKey: 'infoPages.privacy.storageTitle', bodyKey: 'infoPages.privacy.storageBody' },
  { headingKey: 'infoPages.privacy.rightsTitle', bodyKey: 'infoPages.privacy.rightsBody' },
];

const termsSections: CmInfoSection[] = [
  { headingKey: 'infoPages.terms.accountsTitle', bodyKey: 'infoPages.terms.accountsBody' },
  { headingKey: 'infoPages.terms.deliveryTitle', bodyKey: 'infoPages.terms.deliveryBody' },
  { headingKey: 'infoPages.terms.paymentsTitle', bodyKey: 'infoPages.terms.paymentsBody' },
  { headingKey: 'infoPages.terms.conductTitle', bodyKey: 'infoPages.terms.conductBody' },
];

const informationSections: CmInfoSection[] = [
  { headingKey: 'infoPages.information.contactTitle', bodyKey: 'infoPages.information.contactBody' },
  { headingKey: 'infoPages.information.statusTitle', bodyKey: 'infoPages.information.statusBody' },
  { headingKey: 'infoPages.information.legalTitle', bodyKey: 'infoPages.information.legalBody' },
];

export const CmAboutPage: React.FC = () => <CmInfoPage pageId="about" sections={aboutSections} />;
export const CmDeliveryProcessPage: React.FC = () => <CmInfoPage pageId="delivery" sections={deliverySections} />;
export const CmServicesPage: React.FC = () => <CmInfoPage pageId="services" sections={servicesSections} />;
export const CmPrivacyPage: React.FC = () => <CmInfoPage pageId="privacy" sections={privacySections} />;
export const CmTermsPage: React.FC = () => <CmInfoPage pageId="terms" sections={termsSections} />;
export const CmInformationPage: React.FC = () => <CmInfoPage pageId="information" sections={informationSections} />;
