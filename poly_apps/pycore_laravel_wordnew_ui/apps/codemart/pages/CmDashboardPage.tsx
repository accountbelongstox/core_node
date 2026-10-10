import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, FilePlus2, ShieldCheck, Store } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { CmIcon } from '../components/CmImage';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmEmptyState, CmErrorState, CmLoadingState } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { type CmDashboardPrimaryAction } from '../shared/cmDashboardModel';
import { useCmDashboard, type CmDashboardPreviewItem } from '../shared/useCmDashboard';

const METRIC_ICON_SIZE = 38;
const SHORTCUT_ICON_SIZE = 40;
const PRIMARY_ACTION_ICONS = {
  createProject: FilePlus2,
  browseMarketplace: Store,
  openReviews: ClipboardCheck,
  openVerification: ShieldCheck,
} as const;

const CmPreviewList: React.FC<{
  titleKey: string;
  allRoute: string;
  emptyKey: string;
  loading: boolean;
  error: string | null;
  rows: CmDashboardPreviewItem[];
  onRetry?: () => void;
}> = ({ titleKey, allRoute, emptyKey, loading, error, rows, onRetry }) => {
  const { t } = useTranslation('cm');
  return (
    <section className="cm-panel">
      <header className="cm-panel__header">
        <h2>{t(titleKey)}</h2>
        <Link to={allRoute} className="cm-workspace-link">{t('dashboard.viewAll')} <ArrowRight aria-hidden="true" /></Link>
      </header>
      {loading ? (
        <CmLoadingState compact />
      ) : error ? (
        <CmErrorState compact message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <CmEmptyState compact title={t(emptyKey)} />
      ) : (
        <ul className="cm-preview-list">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={row.to}>
                <span className="cm-preview-list__title">{row.title}</span>
                {row.meta && <span className="cm-preview-list__meta">{row.meta}</span>}
                <CmStatusBadge group={row.statusGroup} status={row.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const CmDashboardPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const dashboard = useCmDashboard();
  const { bootstrap, loading, error, retryBootstrap, onboarding, projects, tasks, reviews, notifications } = dashboard;

  const header = (
    <CmPageHeader
      eyebrowKey="dashboard.eyebrow"
      titleKey="dashboard.title"
      purposeKey="dashboard.subtitle"
      title={dashboard.displayName ? t('dashboard.greeting', { name: dashboard.displayName }) : undefined}
      actions={dashboard.primaryAction ? <CmDashboardPrimaryActionLink action={dashboard.primaryAction} /> : undefined}
    />
  );

  if (!bootstrap) {
    return (
      <main className="cm-workspace-page">
        {header}
        {loading || !error ? <CmLoadingState /> : <CmErrorState message={t('errors.bootstrapFailed')} onRetry={retryBootstrap} />}
      </main>
    );
  }

  return (
    <main className="cm-workspace-page">
      {header}
      <div className="cm-role-chips" aria-label={t('dashboard.rolesLabel')}>
        {dashboard.heldRoles.length === 0 && <span className="cm-role-chip">{bootstrap.is_admin ? t('dashboard.adminOnly') : t('dashboard.noRoles')}</span>}
        {dashboard.heldRoles.map((role) => (
          <span key={role} className="cm-role-chip">
            {t(`roles.${role}`)} <CmStatusBadge group="role" status={bootstrap.roles[role]} />
          </span>
        ))}
      </div>

      {onboarding && (
        <section className="cm-onboarding-card">
          <div className="cm-onboarding-card__text">
            <span>{t('dashboard.nextStepLabel')}</span>
            <h2>{t(`dashboard.stepTitles.${onboarding.nextStep}`, { defaultValue: t(`verification.steps.${onboarding.nextStep}`, { defaultValue: onboarding.nextStep }) })}</h2>
            <p>{t(`dashboard.stepHints.${onboarding.nextStep}`, { defaultValue: t('dashboard.stepHints.default') })}</p>
            <div className="cm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={onboarding.progress} aria-label={t('dashboard.progressLabel', { done: onboarding.doneSteps, total: onboarding.totalSteps })}>
              <span style={{ width: `${onboarding.progress}%` }} />
            </div>
            <small>{t('dashboard.progressLabel', { done: onboarding.doneSteps, total: onboarding.totalSteps })}</small>
          </div>
          <Link to={onboarding.route} className="cm-workspace-button is-primary">
            {t('dashboard.continueStep')} <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      )}

      {dashboard.metrics.length > 0 && (
        <section className="cm-metric-grid" aria-label={t('dashboard.metricsLabel')}>
          {dashboard.metrics.map((metric) => (
            <Link key={metric.id} to={metric.route} className="cm-metric-card" data-tone={metric.tone}>
              <span><CmIcon name={metric.icon} size={METRIC_ICON_SIZE} decorative /></span>
              <div><strong>{metric.value}</strong><small>{t(`dashboard.metrics.${metric.id}`)}</small></div>
            </Link>
          ))}
        </section>
      )}

      {dashboard.shortcuts.length > 0 && (
        <section className="cm-dashboard-section">
          <h2>{t('dashboard.shortcutsTitle')}</h2>
          <div className="cm-shortcut-grid">
            {dashboard.shortcuts.map((shortcut) => (
              <Link key={shortcut.id} to={shortcut.route} className="cm-shortcut-card">
                <span className="cm-shortcut-card__icon"><CmIcon name={shortcut.icon} size={SHORTCUT_ICON_SIZE} decorative /></span>
                <span className="cm-shortcut-card__text">
                  <strong>{t(`dashboard.shortcuts.${shortcut.id}.title`)}</strong>
                  <small>{t(`dashboard.shortcuts.${shortcut.id}.body`)}</small>
                </span>
                {shortcut.role && <span className="cm-shortcut-card__role">{t(`roles.${shortcut.role}`)}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="cm-dashboard-columns">
        <div className="cm-dashboard-columns__main">
          {dashboard.showProjects && (
            <CmPreviewList titleKey="dashboard.activeProjectsTitle" allRoute={CM_PROTECTED_ROUTE.projects} emptyKey="dashboard.noActiveProjects" loading={projects.loading} error={projects.error} rows={dashboard.projectItems} onRetry={projects.retryable ? () => void projects.reload() : undefined} />
          )}
          {dashboard.showTasks && (
            <CmPreviewList titleKey="dashboard.activeTasksTitle" allRoute={CM_PROTECTED_ROUTE.tasks} emptyKey="dashboard.noActiveTasks" loading={tasks.loading} error={tasks.error} rows={dashboard.taskItems} onRetry={tasks.retryable ? () => void tasks.reload() : undefined} />
          )}
          {dashboard.showReviews && (
            <CmPreviewList titleKey="dashboard.reviewQueueTitle" allRoute={CM_PROTECTED_ROUTE.reviews} emptyKey="dashboard.noReviews" loading={reviews.loading} error={reviews.error} rows={dashboard.reviewItems} onRetry={reviews.retryable ? () => void reviews.reload() : undefined} />
          )}
          {!dashboard.showProjects && !dashboard.showTasks && !dashboard.showReviews && (
            <CmEmptyState
              title={t('dashboard.noWorkTitle')}
              body={t('dashboard.noWorkBody')}
              action={<Link to={CM_PROTECTED_ROUTE.verification} className="cm-workspace-button is-primary">{t('dashboard.openVerification')}</Link>}
            />
          )}
        </div>
        {dashboard.showNotifications && (
          <section className="cm-panel cm-dashboard-columns__side">
            <header className="cm-panel__header">
              <h2>{t('dashboard.notificationsTitle')}</h2>
              <Link to={CM_PROTECTED_ROUTE.notifications} className="cm-workspace-link">{t('dashboard.viewAll')} <ArrowRight aria-hidden="true" /></Link>
            </header>
            {notifications.loading ? (
              <CmLoadingState compact />
            ) : notifications.error ? (
              <CmErrorState compact message={notifications.error} onRetry={notifications.retryable ? () => void notifications.reload() : undefined} />
            ) : dashboard.notificationItems.length === 0 ? (
              <CmEmptyState compact title={t('notifications.emptyTitle')} />
            ) : (
              <ul className="cm-preview-list">
                {dashboard.notificationItems.map((item) => (
                  <li key={item.id} className={item.read ? '' : 'is-unread'}>
                    <Link to={item.link ?? CM_PROTECTED_ROUTE.notifications}>
                      <span className="cm-preview-list__title">{item.title}</span>
                      <span className="cm-preview-list__meta">{item.time}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

const CmDashboardPrimaryActionLink: React.FC<{ action: CmDashboardPrimaryAction }> = ({ action }) => {
  const { t } = useTranslation('cm');
  const Icon = PRIMARY_ACTION_ICONS[action.id];
  return <Link to={action.route} className="cm-workspace-button is-primary"><Icon aria-hidden="true" /> {t(action.labelKey)}</Link>;
};

export default CmDashboardPage;
