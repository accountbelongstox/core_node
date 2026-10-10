import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, FilePlus2, ShieldCheck, Store } from 'lucide-react';
import { useTranslation } from '../../../../../core/i18n/UiI18n';
import { CmIcon } from '../../../components/CmImage';
import { CM_PROTECTED_ROUTE } from '../../../components/public-home/cmPublicRoutes';
import type { CmPagedList } from '../../../components/workspace/useCmPagedList';
import { useCmDashboard, type CmDashboardPreviewItem } from '../../../shared/useCmDashboard';
import {
  MobileButton,
  MobileCard,
  MobileChipRow,
  MobileEmptyState,
  MobileErrorState,
  MobileFab,
  MobileList,
  MobileListRow,
  MobileListState,
  MobileScreen,
  MobileSectionHeader,
  MobileSkeletonBlock,
  MobileStatChip,
  MobileStatusBadge,
} from '../../ui';

const METRIC_ICON_SIZE = 22;
const SHORTCUT_ICON_SIZE = 32;
const PRIMARY_ACTION_ICONS = {
  createProject: FilePlus2,
  browseMarketplace: Store,
  openReviews: ClipboardCheck,
  openVerification: ShieldCheck,
} as const;

const PreviewSection: React.FC<{
  titleKey: string;
  allRoute: string;
  emptyKey: string;
  list: CmPagedList<unknown>;
  rows: CmDashboardPreviewItem[];
}> = ({ titleKey, allRoute, emptyKey, list, rows }) => {
  const { t } = useTranslation('cm');
  return (
    <section className="cmm-section">
      <MobileSectionHeader title={t(titleKey)} actionLabel={t('dashboard.viewAll')} actionTo={allRoute} />
      <MobileListState
        loading={list.loading}
        error={list.error}
        empty={rows.length === 0}
        emptyTitle={t(emptyKey)}
        onRetry={list.retryable ? () => void list.reload() : undefined}
        skeletonRows={2}
      >
        <MobileList>
          {rows.map((row) => (
            <MobileListRow
              key={row.id}
              to={row.to}
              title={row.title}
              subtitle={row.meta}
              trailing={<MobileStatusBadge group={row.statusGroup} status={row.status} />}
            />
          ))}
        </MobileList>
      </MobileListState>
    </section>
  );
};

/** Mobile Home: greeting, onboarding step, key figures, shortcuts and open-work previews for the account's roles. */
const MobileHomeScreen: React.FC = () => {
  const { t } = useTranslation('cm');
  const dashboard = useCmDashboard();
  const { bootstrap, onboarding, notifications } = dashboard;

  if (!bootstrap) {
    return (
      <MobileScreen title={t('nav.dashboard')} onRefresh={dashboard.reloadAll}>
        {dashboard.loading || !dashboard.error
          ? <><MobileSkeletonBlock height={72} /><MobileSkeletonBlock height={96} /></>
          : <MobileErrorState message={t('errors.bootstrapFailed')} onRetry={dashboard.retryBootstrap} />}
      </MobileScreen>
    );
  }

  const PrimaryIcon = dashboard.primaryAction ? PRIMARY_ACTION_ICONS[dashboard.primaryAction.id] : null;
  const showFab = dashboard.primaryAction?.id === 'createProject' || dashboard.primaryAction?.id === 'browseMarketplace';

  return (
    <MobileScreen title={t('nav.dashboard')} onRefresh={dashboard.reloadAll}>
      <header className="cmm-greeting">
        <h2>{dashboard.displayName ? t('mobile.home.greeting', { name: dashboard.displayName }) : t('dashboard.title')}</h2>
        <p>{t('dashboard.subtitle')}</p>
        <div className="cmm-roles" aria-label={t('dashboard.rolesLabel')}>
          {dashboard.heldRoles.length === 0 && <span className="cmm-role">{bootstrap.is_admin ? t('dashboard.adminOnly') : t('dashboard.noRoles')}</span>}
          {dashboard.heldRoles.map((role) => (
            <span key={role} className="cmm-role">{t(`roles.${role}`)} <MobileStatusBadge group="role" status={bootstrap.roles[role]} /></span>
          ))}
        </div>
      </header>

      {onboarding && (
        <MobileCard tone="accent" className="cmm-onboarding">
          <span className="cmm-eyebrow">{t('dashboard.nextStepLabel')}</span>
          <h3>{t(`dashboard.stepTitles.${onboarding.nextStep}`, { defaultValue: t(`verification.steps.${onboarding.nextStep}`, { defaultValue: onboarding.nextStep }) })}</h3>
          <p>{t(`dashboard.stepHints.${onboarding.nextStep}`, { defaultValue: t('dashboard.stepHints.default') })}</p>
          <div className="cmm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={onboarding.progress} aria-label={t('dashboard.progressLabel', { done: onboarding.doneSteps, total: onboarding.totalSteps })}>
            <span style={{ width: `${onboarding.progress}%` }} />
          </div>
          <small>{t('dashboard.progressLabel', { done: onboarding.doneSteps, total: onboarding.totalSteps })}</small>
          <MobileButton variant="primary" block to={onboarding.route} icon={<ArrowRight aria-hidden="true" />}>{t('dashboard.continueStep')}</MobileButton>
        </MobileCard>
      )}

      {dashboard.metrics.length > 0 && (
        <MobileChipRow label={t('dashboard.metricsLabel')}>
          {dashboard.metrics.map((metric) => (
            <MobileStatChip
              key={metric.id}
              to={metric.route}
              tone={metric.tone}
              value={metric.value}
              label={t(`dashboard.metrics.${metric.id}`)}
              icon={<CmIcon name={metric.icon} size={METRIC_ICON_SIZE} decorative />}
            />
          ))}
        </MobileChipRow>
      )}

      {dashboard.shortcuts.length > 0 && (
        <section className="cmm-section">
          <MobileSectionHeader title={t('dashboard.shortcutsTitle')} />
          <div className="cmm-shortcuts">
            {dashboard.shortcuts.map((shortcut) => (
              <Link key={shortcut.id} to={shortcut.route} className="cmm-shortcut">
                <CmIcon name={shortcut.icon} size={SHORTCUT_ICON_SIZE} decorative />
                <span>{t(`dashboard.shortcuts.${shortcut.id}.title`)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {dashboard.showProjects && (
        <PreviewSection titleKey="dashboard.activeProjectsTitle" allRoute={CM_PROTECTED_ROUTE.projects} emptyKey="dashboard.noActiveProjects" list={dashboard.projects} rows={dashboard.projectItems} />
      )}
      {dashboard.showTasks && (
        <PreviewSection titleKey="dashboard.activeTasksTitle" allRoute={CM_PROTECTED_ROUTE.tasks} emptyKey="dashboard.noActiveTasks" list={dashboard.tasks} rows={dashboard.taskItems} />
      )}
      {dashboard.showReviews && (
        <PreviewSection titleKey="dashboard.reviewQueueTitle" allRoute={CM_PROTECTED_ROUTE.reviews} emptyKey="dashboard.noReviews" list={dashboard.reviews} rows={dashboard.reviewItems} />
      )}
      {!dashboard.showProjects && !dashboard.showTasks && !dashboard.showReviews && (
        <MobileEmptyState
          title={t('dashboard.noWorkTitle')}
          body={t('dashboard.noWorkBody')}
          action={<MobileButton variant="primary" to={CM_PROTECTED_ROUTE.verification}>{t('dashboard.openVerification')}</MobileButton>}
        />
      )}

      {dashboard.showNotifications && (
        <section className="cmm-section">
          <MobileSectionHeader title={t('dashboard.notificationsTitle')} actionLabel={t('dashboard.viewAll')} actionTo={CM_PROTECTED_ROUTE.notifications} />
          <MobileListState
            loading={notifications.loading}
            error={notifications.error}
            empty={dashboard.notificationItems.length === 0}
            emptyTitle={t('notifications.emptyTitle')}
            onRetry={notifications.retryable ? () => void notifications.reload() : undefined}
            skeletonRows={2}
          >
            <MobileList>
              {dashboard.notificationItems.map((item) => (
                <MobileListRow key={item.id} to={item.link ?? CM_PROTECTED_ROUTE.notifications} unread={!item.read} title={item.title} meta={item.time} />
              ))}
            </MobileList>
          </MobileListState>
        </section>
      )}

      {showFab && dashboard.primaryAction && PrimaryIcon && (
        <MobileFab to={dashboard.primaryAction.route} label={t(dashboard.primaryAction.labelKey)} icon={<PrimaryIcon aria-hidden="true" />} />
      )}
    </MobileScreen>
  );
};

export default MobileHomeScreen;
