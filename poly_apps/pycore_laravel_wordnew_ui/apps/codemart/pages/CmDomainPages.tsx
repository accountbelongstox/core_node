import React, { useState } from 'react';
import { CalendarDays, CircleDollarSign, FileText, Inbox, Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';

interface CmDomainPageProps {
  titleKey: string;
}

const DOMAIN_PAGE_KEYS = {
  projects: 'nav.myProjects',
  tasks: 'nav.tasks',
  reviews: 'nav.reviews',
  architect: 'nav.architect',
  wallet: 'nav.wallet',
  verification: 'nav.verification',
  profile: 'nav.profile',
  notifications: 'nav.notifications',
  settings: 'nav.settings',
} as const;

const CmDomainPage: React.FC<CmDomainPageProps> = ({ titleKey }) => {
  const { t } = useTranslation('cm');

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('workspace.contractPending')}</span>
        <h1>{t(titleKey)}</h1>
        <p>{t('workspace.description')}</p>
      </header>
      <section className="cm-domain-grid">
        {[t('workspace.primaryPanel'), t('workspace.activityPanel'), t('workspace.policyPanel')].map((title, index) => (
          <article className="cm-domain-panel" key={title}>
            <span className="cm-domain-panel__icon" aria-hidden="true">
              {index === 0 ? <Inbox /> : index === 1 ? <FileText /> : <SlidersHorizontal />}
            </span>
            <h2>{title}</h2>
            <strong>{t('workspace.emptyTitle')}</strong>
            <p>{t('workspace.emptyBody')}</p>
          </article>
        ))}
      </section>
    </main>
  );
};

export const CmMarketplacePage: React.FC = () => {
  const { t } = useTranslation('cm');
  const [search, setSearch] = useState('');

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('workspace.contractPending')}</span>
        <h1>{t('nav.marketplace')}</h1>
        <p>{t('workspace.description')}</p>
      </header>
      <section className="cm-marketplace-toolbar">
        <label>
          <span>{t('marketplace.searchLabel')}</span>
          <div><Search aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('marketplace.searchPlaceholder')} /></div>
        </label>
        <label>
          <span>{t('marketplace.statusLabel')}</span>
          <select><option>{t('marketplace.allStatuses')}</option></select>
        </label>
        <label>
          <span>{t('marketplace.sortLabel')}</span>
          <select><option>{t('marketplace.newest')}</option></select>
        </label>
      </section>
      <section className="cm-marketplace-empty">
        <Inbox aria-hidden="true" />
        <h2>{t('workspace.emptyTitle')}</h2>
        <p>{t('workspace.emptyBody')}</p>
        <div><span><CircleDollarSign aria-hidden="true" /> {t('marketplace.budget')}</span><span><CalendarDays aria-hidden="true" /> {t('marketplace.deadline')}</span></div>
      </section>
    </main>
  );
};

export const CmProjectCreatePage: React.FC = () => {
  const { t } = useTranslation('cm');

  return (
    <main className="cm-workspace-page">
      <header className="cm-page-heading">
        <span>{t('workspace.contractPending')}</span>
        <h1>{t('projectCreate.title')}</h1>
        <p>{t('projectCreate.subtitle')}</p>
      </header>
      <form className="cm-project-form" onSubmit={(event) => event.preventDefault()}>
        <label><span>{t('projectCreate.projectTitle')}</span><input placeholder={t('projectCreate.projectTitlePlaceholder')} /></label>
        <label className="is-wide"><span>{t('projectCreate.summary')}</span><textarea rows={7} placeholder={t('projectCreate.summaryPlaceholder')} /></label>
        <label><span>{t('projectCreate.budget')}</span><input disabled placeholder={t('projectCreate.budgetPlaceholder')} /></label>
        <label><span>{t('projectCreate.deliveryDate')}</span><input type="date" /></label>
        <label className="is-wide"><span>{t('projectCreate.technology')}</span><input placeholder={t('projectCreate.technologyPlaceholder')} /></label>
        <div className="cm-project-form__attachments">
          <FileText aria-hidden="true" />
          <div><strong>{t('projectCreate.attachments')}</strong><p>{t('projectCreate.attachmentsHint')}</p></div>
        </div>
        <p className="cm-contract-note is-wide">{t('projectCreate.contractNotice')}</p>
        <div className="cm-project-form__actions">
          <button type="button" disabled>{t('projectCreate.saveDraft')}</button>
          <button type="submit" className="is-primary" disabled>{t('projectCreate.analyze')}</button>
        </div>
      </form>
    </main>
  );
};

export const CmProjectsPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.projects} />;
export const CmTasksPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.tasks} />;
export const CmReviewsPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.reviews} />;
export const CmArchitectPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.architect} />;
export const CmWalletPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.wallet} />;
export const CmVerificationPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.verification} />;
export const CmProfilePage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.profile} />;
export const CmNotificationsPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.notifications} />;
export const CmSettingsPage: React.FC = () => <CmDomainPage titleKey={DOMAIN_PAGE_KEYS.settings} />;
