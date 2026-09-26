import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  Code2,
  FilePlus2,
  ListTodo,
  ShieldCheck,
  Store,
  WalletCards,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmBootstrap, CmNotification, CmProject, CmReviewSubmission, CmTask } from '../api/CmApiTypes';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { CmPageHeader } from '../components/workspace/CmPageHeader';
import { CmEmptyState, CmErrorState, CmLoadingState } from '../components/workspace/CmStateViews';
import { CmStatusBadge } from '../components/workspace/CmStatusBadge';
import { cmNotificationLink, cmNotificationParams } from '../components/workspace/cmNotificationFormat';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedSlice } from '../components/workspace/useCmPagedList';

const ROLE_ORDER = ['client', 'developer', 'architect', 'reviewer'] as const;
const PREVIEW_SIZE = 5;
const CLOSED_PROJECT_STATUSES = new Set(['completed', 'cancelled', 'archived']);
const CLOSED_TASK_STATUSES = new Set(['completed', 'cancelled']);
const STEP_ROUTES: Record<string, string> = {
  account: '/codemart/profile',
  deposit: '/codemart/wallet',
};
const DEFAULT_STEP_ROUTE = '/codemart/verification';

interface CmShortcut {
  id: string;
  capability: string;
  route: string;
  Icon: LucideIcon;
  role?: string;
}

const SHORTCUTS: CmShortcut[] = [
  { id: 'createProject', capability: 'project.create', route: '/codemart/projects/new', Icon: FilePlus2, role: 'client' },
  { id: 'myProjects', capability: 'project.read', route: '/codemart/projects', Icon: BriefcaseBusiness, role: 'client' },
  { id: 'marketplace', capability: 'task.browse', route: '/codemart/marketplace', Icon: Store, role: 'developer' },
  { id: 'myTasks', capability: 'task.read', route: '/codemart/tasks', Icon: ListTodo, role: 'developer' },
  { id: 'architect', capability: 'architect.read', route: '/codemart/architect', Icon: Workflow, role: 'architect' },
  { id: 'reviews', capability: 'review.read', route: '/codemart/reviews', Icon: ClipboardCheck, role: 'reviewer' },
  { id: 'wallet', capability: 'finance.read', route: '/codemart/wallet', Icon: WalletCards },
  { id: 'verification', capability: 'onboarding.read', route: '/codemart/verification', Icon: ShieldCheck },
];

interface CmMetric {
  id: string;
  capability: string;
  route: string;
  Icon: LucideIcon;
  tone: string;
  value: (bootstrap: CmBootstrap, format: ReturnType<typeof useCmFormat>) => string;
  roles?: string[];
}

const METRICS: CmMetric[] = [
  { id: 'activeProjects', capability: 'project.read', roles: ['client', 'architect'], route: '/codemart/projects', Icon: BriefcaseBusiness, tone: 'blue', value: (b, f) => f.number(b.counters.active_projects) },
  { id: 'escrowFunds', capability: 'project.create', route: '/codemart/projects', Icon: ShieldCheck, tone: 'green', value: (b, f) => f.money(b.counters.protected_funds, b.counters.currency) },
  { id: 'myOpenTasks', capability: 'task.read', route: '/codemart/tasks', Icon: ListTodo, tone: 'violet', value: (b, f) => f.number(b.counters.my_open_tasks) },
  { id: 'marketplaceTasks', capability: 'task.browse', route: '/codemart/marketplace', Icon: Code2, tone: 'blue', value: (b, f) => f.number(b.counters.open_marketplace_tasks) },
  { id: 'pendingReviews', capability: 'review.read', route: '/codemart/reviews', Icon: ClipboardCheck, tone: 'amber', value: (b, f) => f.number(b.counters.pending_reviews) },
  { id: 'walletBalance', capability: 'finance.read', route: '/codemart/wallet', Icon: WalletCards, tone: 'green', value: (b, f) => f.money(b.counters.wallet_balance, b.counters.currency) },
  { id: 'unread', capability: 'notification.read', route: '/codemart/notifications', Icon: Bell, tone: 'amber', value: (b, f) => f.number(b.counters.unread_notifications) },
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
  items: (Array.isArray(data.projects) ? data.projects : []).filter((project) => !CLOSED_PROJECT_STATUSES.has(project.status)).slice(0, PREVIEW_SIZE),
  totalPages: 1,
});
const fetchTasks = (page: number) => cmApi.getMyTasks(page);
const extractTasks = (data: { my_tasks: CmTask[] }): CmPagedSlice<CmTask> => ({
  items: (Array.isArray(data.my_tasks) ? data.my_tasks : []).filter((task) => !CLOSED_TASK_STATUSES.has(task.status)).slice(0, PREVIEW_SIZE),
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
  const { bootstrap, loading, error, refresh, hasCapability, hasRole } = useCmBootstrap();
  const retryBootstrap = useCallback(() => { void refresh(); }, [refresh]);

  const heldRoles = ROLE_ORDER.filter((role) => hasRole(role));
  const showProjects = hasCapability('project.read') && (hasRole('client') || hasRole('architect'));
  const showTasks = hasCapability('task.read');
  const showReviews = hasCapability('review.read');
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
  const doneSteps = onboarding.steps.filter((step) => step.completed).length;
  const progress = onboarding.steps.length > 0 ? Math.round((doneSteps / onboarding.steps.length) * 100) : 100;
  const nextStep = onboarding.next_step;
  const metrics = METRICS.filter((metric) => hasCapability(metric.capability) && (!metric.roles || metric.roles.some((role) => hasRole(role))));
  const shortcuts = SHORTCUTS.filter((shortcut) => hasCapability(shortcut.capability) && (!shortcut.role || hasRole(shortcut.role) || bootstrap.is_admin));

  const projectRows: CmPreviewRow[] = projects.items.map((project) => ({
    id: project.id,
    title: project.title,
    to: `/codemart/projects/${project.id}`,
    meta: project.budget ? format.money(project.budget, project.currency) : undefined,
    badge: <CmStatusBadge group="project" status={project.status} />,
  }));
  const taskRows: CmPreviewRow[] = tasks.items.map((task) => ({
    id: task.id,
    title: task.title,
    to: `/codemart/tasks?task=${task.id}`,
    meta: task.due_date ? t('tasks.due', { date: format.date(task.due_date) }) : undefined,
    badge: <CmStatusBadge group="task" status={task.status} />,
  }));
  const reviewRows: CmPreviewRow[] = reviews.items.map((submission) => ({
    id: submission.id,
    title: submission.task?.title ?? t('reviews.submissionTitle', { id: submission.id }),
    to: '/codemart/reviews',
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
            <h2>{t(`verification.steps.${nextStep}`, { defaultValue: nextStep })}</h2>
            <p>{t(`dashboard.stepHints.${nextStep}`, { defaultValue: t('dashboard.stepHints.default') })}</p>
            <div className="cm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t('dashboard.progressLabel', { done: doneSteps, total: onboarding.steps.length })}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <small>{t('dashboard.progressLabel', { done: doneSteps, total: onboarding.steps.length })}</small>
          </div>
          <Link to={STEP_ROUTES[nextStep] ?? DEFAULT_STEP_ROUTE} className="cm-workspace-button is-primary">
            {t('dashboard.continueStep')} <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      )}

      {metrics.length > 0 && (
        <section className="cm-metric-grid" aria-label={t('dashboard.metricsLabel')}>
          {metrics.map((metric) => {
            const Icon = metric.Icon;
            return (
              <Link key={metric.id} to={metric.route} className="cm-metric-card" data-tone={metric.tone}>
                <span><Icon aria-hidden="true" /></span>
                <div><strong>{metric.value(bootstrap, format)}</strong><small>{t(`dashboard.metrics.${metric.id}`)}</small></div>
              </Link>
            );
          })}
        </section>
      )}

      {shortcuts.length > 0 && (
        <section className="cm-dashboard-section">
          <h2>{t('dashboard.shortcutsTitle')}</h2>
          <div className="cm-shortcut-grid">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.Icon;
              return (
                <Link key={shortcut.id} to={shortcut.route} className="cm-shortcut-card">
                  <span className="cm-shortcut-card__icon"><Icon aria-hidden="true" /></span>
                  <span className="cm-shortcut-card__text">
                    <strong>{t(`dashboard.shortcuts.${shortcut.id}.title`)}</strong>
                    <small>{t(`dashboard.shortcuts.${shortcut.id}.body`)}</small>
                  </span>
                  {shortcut.role && <span className="cm-shortcut-card__role">{t(`roles.${shortcut.role}`)}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="cm-dashboard-columns">
        <div className="cm-dashboard-columns__main">
          {showProjects && (
            <CmPreviewList titleKey="dashboard.activeProjectsTitle" allRoute="/codemart/projects" emptyKey="dashboard.noActiveProjects" loading={projects.loading} error={projects.error} rows={projectRows} onRetry={() => void projects.reload()} />
          )}
          {showTasks && (
            <CmPreviewList titleKey="dashboard.activeTasksTitle" allRoute="/codemart/tasks" emptyKey="dashboard.noActiveTasks" loading={tasks.loading} error={tasks.error} rows={taskRows} onRetry={() => void tasks.reload()} />
          )}
          {showReviews && (
            <CmPreviewList titleKey="dashboard.reviewQueueTitle" allRoute="/codemart/reviews" emptyKey="dashboard.noReviews" loading={reviews.loading} error={reviews.error} rows={reviewRows} onRetry={() => void reviews.reload()} />
          )}
          {!showProjects && !showTasks && !showReviews && (
            <CmEmptyState
              title={t('dashboard.noWorkTitle')}
              body={t('dashboard.noWorkBody')}
              action={<Link to="/codemart/verification" className="cm-workspace-button is-primary">{t('dashboard.openVerification')}</Link>}
            />
          )}
        </div>
        {showNotifications && (
          <section className="cm-panel cm-dashboard-columns__side">
            <header className="cm-panel__header">
              <h2>{t('dashboard.notificationsTitle')}</h2>
              <Link to="/codemart/notifications" className="cm-workspace-link">{t('dashboard.viewAll')} <ArrowRight aria-hidden="true" /></Link>
            </header>
            {notifications.loading ? (
              <CmLoadingState compact />
            ) : notifications.error ? (
              <CmErrorState compact message={notifications.error} onRetry={() => void notifications.reload()} />
            ) : notifications.items.length === 0 ? (
              <CmEmptyState compact title={t('notifications.emptyTitle')} />
            ) : (
              <ul className="cm-preview-list">
                {notifications.items.map((item) => {
                  const params = cmNotificationParams(t, item);
                  const link = cmNotificationLink(item) ?? '/codemart/notifications';
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
    return <Link to="/codemart/projects/new" className="cm-workspace-button is-primary"><FilePlus2 aria-hidden="true" /> {t('dashboard.createProject')}</Link>;
  }
  if (hasCapability('task.browse')) {
    return <Link to="/codemart/marketplace" className="cm-workspace-button is-primary"><Store aria-hidden="true" /> {t('dashboard.browseMarketplace')}</Link>;
  }
  if (hasCapability('review.read')) {
    return <Link to="/codemart/reviews" className="cm-workspace-button is-primary"><ClipboardCheck aria-hidden="true" /> {t('dashboard.openReviews')}</Link>;
  }
  return <Link to="/codemart/verification" className="cm-workspace-button is-primary"><ShieldCheck aria-hidden="true" /> {t('dashboard.openVerification')}</Link>;
};

export default CmDashboardPage;
