import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, FilePlus2, ShieldCheck, Store } from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmBootstrap, CmNotification, CmProject, CmReviewSubmission, CmTask } from '../api/CmApiTypes';
import type { CmIconName } from '../assets/cmImageRegistry';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmIcon } from '../components/CmImage';
import { CM_PROTECTED_ROUTE, cmProjectPath, cmTaskPath } from '../components/public-home/cmPublicRoutes';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmEmptyState, CmErrorState, CmLoadingState } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmNotificationLink, cmNotificationParams } from '../components/workspace/cmNotificationFormat';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedSlice } from '../components/workspace/useCmPagedList';

const PREVIEW_SIZE = 5;
const METRIC_ICON_SIZE = 38;
const SHORTCUT_ICON_SIZE = 40;
const STEP_ROUTES: Record<string, string> = {
  account: CM_PROTECTED_ROUTE.profile,
  deposit: CM_PROTECTED_ROUTE.wallet,
};
const DEFAULT_STEP_ROUTE = CM_PROTECTED_ROUTE.verification;

interface CmShortcut {
  id: string;
  capability: string;
  route: string;
  icon: CmIconName;
  role?: string;
}

const SHORTCUTS: CmShortcut[] = [
  { id: 'createProject', capability: 'project.create', route: CM_PROTECTED_ROUTE.projectCreate, icon: 'nav-project-create', role: 'client' },
  { id: 'myProjects', capability: 'project.read', route: CM_PROTECTED_ROUTE.projects, icon: 'nav-projects', role: 'client' },
  { id: 'marketplace', capability: 'task.browse', route: CM_PROTECTED_ROUTE.marketplace, icon: 'nav-marketplace', role: 'developer' },
  { id: 'myTasks', capability: 'task.read', route: CM_PROTECTED_ROUTE.tasks, icon: 'nav-tasks', role: 'developer' },
  { id: 'architect', capability: 'architect.read', route: CM_PROTECTED_ROUTE.architect, icon: 'nav-architect', role: 'architect' },
  { id: 'reviews', capability: 'review.read', route: CM_PROTECTED_ROUTE.reviews, icon: 'nav-reviews', role: 'reviewer' },
  { id: 'wallet', capability: 'finance.read', route: CM_PROTECTED_ROUTE.wallet, icon: 'nav-wallet' },
  { id: 'verification', capability: 'onboarding.read', route: CM_PROTECTED_ROUTE.verification, icon: 'nav-verification' },
];

interface CmMetric {
  id: string;
  capability: string;
  route: string;
  icon: CmIconName;
  tone: string;
  value: (bootstrap: CmBootstrap, format: ReturnType<typeof useCmFormat>) => string;
  roles?: string[];
}

const METRICS: CmMetric[] = [
  { id: 'activeProjects', capability: 'project.read', roles: ['client', 'architect'], route: CM_PROTECTED_ROUTE.projects, icon: 'feature-active-projects', tone: 'blue', value: (b, f) => f.number(b.counters.active_projects) },
  { id: 'escrowFunds', capability: 'project.create', route: CM_PROTECTED_ROUTE.projects, icon: 'feature-escrow-funds', tone: 'green', value: (b, f) => f.money(b.counters.protected_funds, b.counters.currency) },
  { id: 'myOpenTasks', capability: 'task.read', route: CM_PROTECTED_ROUTE.tasks, icon: 'feature-open-tasks', tone: 'violet', value: (b, f) => f.number(b.counters.my_open_tasks) },
  { id: 'marketplaceTasks', capability: 'task.browse', route: CM_PROTECTED_ROUTE.marketplace, icon: 'feature-marketplace-tasks', tone: 'blue', value: (b, f) => f.number(b.counters.open_marketplace_tasks) },
  { id: 'pendingReviews', capability: 'review.read', roles: ['reviewer'], route: CM_PROTECTED_ROUTE.reviews, icon: 'feature-pending-reviews', tone: 'amber', value: (b, f) => f.number(b.counters.pending_reviews) },
  { id: 'walletBalance', capability: 'finance.read', route: CM_PROTECTED_ROUTE.wallet, icon: 'feature-wallet-balance', tone: 'green', value: (b, f) => f.money(b.counters.wallet_balance, b.counters.currency) },
  { id: 'unread', capability: 'notification.read', route: CM_PROTECTED_ROUTE.notifications, icon: 'feature-unread-notifications', tone: 'amber', value: (b, f) => f.number(b.counters.unread_notifications) },
];

interface CmPreviewRow {
  id: number;
  title: string;
  to: string;
  badge: React.ReactNode;
  meta?: string;
}

const CmPreviewList: React.FC<{
  titleKey: string;
  allRoute: string;
  emptyKey: string;
  loading: boolean;
  error: string | null;
  rows: CmPreviewRow[];
  onRetry: () => void;
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
                {row.badge}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const fetchProjects = (page: number) => cmApi.getProjects({ include_assigned: true, page });
const extractProjects = (data: { projects: CmProject[] }): CmPagedSlice<CmProject> => ({
  items: Array.isArray(data.projects) ? data.projects : [],
  totalPages: 1,
});
const fetchTasks = (page: number) => cmApi.getMyTasks(page);
const extractTasks = (data: { my_tasks: CmTask[] }): CmPagedSlice<CmTask> => ({
  items: Array.isArray(data.my_tasks) ? data.my_tasks : [],
  totalPages: 1,
});
const fetchReviews = (page: number) => cmApi.getReviewTasks(page);
const extractReviews = (data: { pending_reviews: CmReviewSubmission[] }): CmPagedSlice<CmReviewSubmission> => ({
  items: (Array.isArray(data.pending_reviews) ? data.pending_reviews : []).slice(0, PREVIEW_SIZE),
  totalPages: 1,
});
const fetchNotifications = (page: number) => cmApi.getNotifications(page);
const extractNotifications = (data: { items: CmNotification[] }): CmPagedSlice<CmNotification> => ({
  items: (Array.isArray(data.items) ? data.items : []).slice(0, PREVIEW_SIZE),
  totalPages: 1,
});

const CmDashboardPage: React.FC = () => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, loading, error, refresh, hasCapability, hasRole, roles, terminalStates } = useCmBootstrap();
  const retryBootstrap = useCallback(() => { void refresh(); }, [refresh]);

  const heldRoles = roles.filter((role) => hasRole(role));
  const showProjects = hasCapability('project.read') && (hasRole('client') || hasRole('architect'));
  const showTasks = hasCapability('task.read');
  const showReviews = hasCapability('review.read') && hasRole('reviewer', 'active');
  const showNotifications = hasCapability('notification.read');

  const projects = useCmPagedList(fetchProjects, extractProjects, 'projects.loadFailed', showProjects);
  const tasks = useCmPagedList(fetchTasks, extractTasks, 'tasks.loadFailed', showTasks);
  const reviews = useCmPagedList(fetchReviews, extractReviews, 'reviews.loadFailed', showReviews);
  const notifications = useCmPagedList(fetchNotifications, extractNotifications, 'notifications.loadFailed', showNotifications);

  const displayName = bootstrap?.user.name || bootstrap?.user.nickname || bootstrap?.user.username || '';
  const header = (
    <CmPageHeader
      eyebrowKey="dashboard.eyebrow"
      titleKey="dashboard.title"
      purposeKey="dashboard.subtitle"
      title={displayName ? t('dashboard.greeting', { name: displayName }) : undefined}
      actions={bootstrap ? <CmDashboardPrimaryAction hasCapability={hasCapability} /> : undefined}
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

  const onboarding = bootstrap.onboarding;
  const requiredSteps = onboarding.steps.filter((step) => !step.optional);
  const doneSteps = requiredSteps.filter((step) => step.completed).length;
  const progress = requiredSteps.length > 0 ? Math.round((doneSteps / requiredSteps.length) * 100) : 100;
  const nextStep = onboarding.next_step;
  const metrics = METRICS.filter((metric) => hasCapability(metric.capability) && (!metric.roles || metric.roles.some((role) => hasRole(role))));
  const shortcuts = SHORTCUTS.filter((shortcut) => hasCapability(shortcut.capability) && (!shortcut.role || hasRole(shortcut.role) || bootstrap.is_admin));

  const closedProjectStates = terminalStates('project');
  const closedTaskStates = terminalStates('task');
  const openProjects = projects.items.filter((project) => !closedProjectStates.includes(project.status)).slice(0, PREVIEW_SIZE);
  const openTasks = tasks.items.filter((task) => !closedTaskStates.includes(task.status)).slice(0, PREVIEW_SIZE);

  const projectRows: CmPreviewRow[] = openProjects.map((project) => ({
    id: project.id,
    title: project.title,
    to: cmProjectPath(project.id),
    meta: project.budget ? format.money(project.budget, project.currency) : undefined,
    badge: <CmStatusBadge group="project" status={project.status} />,
  }));
  const taskRows: CmPreviewRow[] = openTasks.map((task) => ({
    id: task.id,
    title: task.title,
    to: cmTaskPath(task.id),
    meta: task.due_date ? t('tasks.due', { date: format.date(task.due_date) }) : undefined,
    badge: <CmStatusBadge group="task" status={task.status} />,
  }));
  const reviewRows: CmPreviewRow[] = reviews.items.map((submission) => ({
    id: submission.id,
    title: submission.task?.title ?? t('reviews.submissionTitle', { id: submission.id }),
    to: CM_PROTECTED_ROUTE.reviews,
    meta: format.dateTime(submission.created_at),
    badge: <CmStatusBadge group="submission" status={submission.status} />,
  }));

  return (
    <main className="cm-workspace-page">
      {header}
      <div className="cm-role-chips" aria-label={t('dashboard.rolesLabel')}>
        {heldRoles.length === 0 && <span className="cm-role-chip">{bootstrap.is_admin ? t('dashboard.adminOnly') : t('dashboard.noRoles')}</span>}
        {heldRoles.map((role) => (
          <span key={role} className="cm-role-chip">
            {t(`roles.${role}`)} <CmStatusBadge group="role" status={bootstrap.roles[role]} />
          </span>
        ))}
      </div>

      {!onboarding.complete && nextStep && (
        <section className="cm-onboarding-card">
          <div className="cm-onboarding-card__text">
            <span>{t('dashboard.nextStepLabel')}</span>
            <h2>{t(`dashboard.stepTitles.${nextStep}`, { defaultValue: t(`verification.steps.${nextStep}`, { defaultValue: nextStep }) })}</h2>
            <p>{t(`dashboard.stepHints.${nextStep}`, { defaultValue: t('dashboard.stepHints.default') })}</p>
            <div className="cm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t('dashboard.progressLabel', { done: doneSteps, total: requiredSteps.length })}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{t('dashboard.progressLabel', { done: doneSteps, total: requiredSteps.length })}</small>
          </div>
          <Link to={STEP_ROUTES[nextStep] ?? DEFAULT_STEP_ROUTE} className="cm-workspace-button is-primary">
            {t('dashboard.continueStep')} <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      )}

      {metrics.length > 0 && (
        <section className="cm-metric-grid" aria-label={t('dashboard.metricsLabel')}>
          {metrics.map((metric) => (
            <Link key={metric.id} to={metric.route} className="cm-metric-card" data-tone={metric.tone}>
              <span><CmIcon name={metric.icon} size={METRIC_ICON_SIZE} decorative /></span>
              <div><strong>{metric.value(bootstrap, format)}</strong><small>{t(`dashboard.metrics.${metric.id}`)}</small></div>
            </Link>
          ))}
        </section>
      )}

      {shortcuts.length > 0 && (
        <section className="cm-dashboard-section">
          <h2>{t('dashboard.shortcutsTitle')}</h2>
          <div className="cm-shortcut-grid">
            {shortcuts.map((shortcut) => (
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
          {showProjects && (
            <CmPreviewList titleKey="dashboard.activeProjectsTitle" allRoute={CM_PROTECTED_ROUTE.projects} emptyKey="dashboard.noActiveProjects" loading={projects.loading} error={projects.error} rows={projectRows} onRetry={projects.retryable ? () => void projects.reload() : undefined} />
          )}
          {showTasks && (
            <CmPreviewList titleKey="dashboard.activeTasksTitle" allRoute={CM_PROTECTED_ROUTE.tasks} emptyKey="dashboard.noActiveTasks" loading={tasks.loading} error={tasks.error} rows={taskRows} onRetry={tasks.retryable ? () => void tasks.reload() : undefined} />
          )}
          {showReviews && (
            <CmPreviewList titleKey="dashboard.reviewQueueTitle" allRoute={CM_PROTECTED_ROUTE.reviews} emptyKey="dashboard.noReviews" loading={reviews.loading} error={reviews.error} rows={reviewRows} onRetry={reviews.retryable ? () => void reviews.reload() : undefined} />
          )}
          {!showProjects && !showTasks && !showReviews && (
            <CmEmptyState
              title={t('dashboard.noWorkTitle')}
              body={t('dashboard.noWorkBody')}
              action={<Link to={CM_PROTECTED_ROUTE.verification} className="cm-workspace-button is-primary">{t('dashboard.openVerification')}</Link>}
            />
          )}
        </div>
        {showNotifications && (
          <section className="cm-panel cm-dashboard-columns__side">
            <header className="cm-panel__header">
              <h2>{t('dashboard.notificationsTitle')}</h2>
              <Link to={CM_PROTECTED_ROUTE.notifications} className="cm-workspace-link">{t('dashboard.viewAll')} <ArrowRight aria-hidden="true" /></Link>
            </header>
            {notifications.loading ? (
              <CmLoadingState compact />
            ) : notifications.error ? (
              <CmErrorState compact message={notifications.error} onRetry={notifications.retryable ? () => void notifications.reload() : undefined} />
            ) : notifications.items.length === 0 ? (
              <CmEmptyState compact title={t('notifications.emptyTitle')} />
            ) : (
              <ul className="cm-preview-list">
                {notifications.items.map((item) => {
                  const params = cmNotificationParams(t, item);
                  const link = cmNotificationLink(item, showTasks) ?? CM_PROTECTED_ROUTE.notifications;
                  return (
                    <li key={item.id} className={item.read ? '' : 'is-unread'}>
                      <Link to={link}>
                        <span className="cm-preview-list__title">{t(item.title_key, { ...params, defaultValue: t('notifications.fallbackTitle') })}</span>
                        <span className="cm-preview-list__meta">{format.dateTime(item.created_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

const CmDashboardPrimaryAction: React.FC<{ hasCapability: (capability: string | null) => boolean }> = ({ hasCapability }) => {
  const { t } = useTranslation('cm');
  if (hasCapability('project.create')) {
    return <Link to={CM_PROTECTED_ROUTE.projectCreate} className="cm-workspace-button is-primary"><FilePlus2 aria-hidden="true" /> {t('dashboard.createProject')}</Link>;
  }
  if (hasCapability('task.browse')) {
    return <Link to={CM_PROTECTED_ROUTE.marketplace} className="cm-workspace-button is-primary"><Store aria-hidden="true" /> {t('dashboard.browseMarketplace')}</Link>;
  }
  if (hasCapability('review.read')) {
    return <Link to={CM_PROTECTED_ROUTE.reviews} className="cm-workspace-button is-primary"><ClipboardCheck aria-hidden="true" /> {t('dashboard.openReviews')}</Link>;
  }
  return <Link to={CM_PROTECTED_ROUTE.verification} className="cm-workspace-button is-primary"><ShieldCheck aria-hidden="true" /> {t('dashboard.openVerification')}</Link>;
};

export default CmDashboardPage;
