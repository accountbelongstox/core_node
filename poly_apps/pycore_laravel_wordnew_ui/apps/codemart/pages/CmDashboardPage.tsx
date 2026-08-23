import React from 'react';
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, Code2, Store, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../../core/i18n/UiI18n';

const METRIC_CARDS = [
  { key: 'dashboard.activeProjects', Icon: BriefcaseBusiness, tone: 'blue' },
  { key: 'dashboard.openTasks', Icon: Code2, tone: 'violet' },
  { key: 'dashboard.pendingReviews', Icon: ClipboardCheck, tone: 'amber' },
  { key: 'dashboard.protectedFunds', Icon: WalletCards, tone: 'green' },
] as const;

const DELIVERY_LANES = [
  { titleKey: 'dashboard.clientLane', bodyKey: 'dashboard.clientLaneBody', route: '/codemart/projects', Icon: BriefcaseBusiness },
  { titleKey: 'dashboard.developerLane', bodyKey: 'dashboard.developerLaneBody', route: '/codemart/marketplace', Icon: Code2 },
  { titleKey: 'dashboard.reviewerLane', bodyKey: 'dashboard.reviewerLaneBody', route: '/codemart/reviews', Icon: ClipboardCheck },
] as const;

const CmDashboardPage: React.FC = () => {
  const { t } = useTranslation('cm');

  return (
    <main className="cm-workspace-page">
      <header className="cm-workspace-hero">
        <div>
          <span>{t('dashboard.eyebrow')}</span>
          <h1>{t('dashboard.title')}</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        <div className="cm-workspace-hero__actions">
          <Link to="/codemart/projects/new" className="cm-workspace-button is-primary">{t('dashboard.createProject')}</Link>
          <Link to="/codemart/marketplace" className="cm-workspace-button"><Store aria-hidden="true" /> {t('dashboard.browseMarketplace')}</Link>
        </div>
      </header>
      <section className="cm-metric-grid" aria-label={t('dashboard.title')}>
        {METRIC_CARDS.map((metric) => {
          const Icon = metric.Icon;
          return (
            <article key={metric.key} className="cm-metric-card" data-tone={metric.tone}>
              <span><Icon aria-hidden="true" /></span>
              <div><strong>{t('common.unavailable')}</strong><small>{t(metric.key)}</small></div>
            </article>
          );
        })}
      </section>
      <p className="cm-contract-note">{t('dashboard.noData')}</p>
      <section className="cm-dashboard-section">
        <h2>{t('dashboard.lanesTitle')}</h2>
        <div className="cm-lane-grid">
          {DELIVERY_LANES.map((lane) => {
            const Icon = lane.Icon;
            return (
              <Link key={lane.titleKey} to={lane.route} className="cm-lane-card">
                <span className="cm-lane-card__icon"><Icon aria-hidden="true" /></span>
                <h3>{t(lane.titleKey)}</h3>
                <p>{t(lane.bodyKey)}</p>
                <span className="cm-lane-card__arrow"><ArrowRight aria-hidden="true" /></span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default CmDashboardPage;
