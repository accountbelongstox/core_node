import { useCallback, useMemo } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmBootstrap, CmNotification, CmProject, CmReviewSubmission, CmTask } from '../api/CmApiTypes';
import { CM_PROTECTED_ROUTE, cmProjectPath, cmTaskPath } from '../components/public-home/cmPublicRoutes';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList, type CmPagedSlice } from '../components/workspace/useCmPagedList';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import {
  CM_PREVIEW_SIZE,
  cmCollectOpenPreview,
  cmDashboardMetrics,
  cmDashboardOnboarding,
  cmDashboardPrimaryAction,
  cmDashboardShortcuts,
  type CmDashboardMetric,
  type CmDashboardOnboarding,
  type CmDashboardPrimaryAction,
  type CmDashboardShortcut,
} from './cmDashboardModel';
import { useCmNotificationPresenter, type CmNotificationView } from './useCmNotifications';

const STATE_KEY_SEPARATOR = ',';

/** One dashboard preview row without markup: the UI renders the status badge from group and status. */
export interface CmDashboardPreviewItem {
  id: number;
  title: string;
  to: string;
  meta?: string;
  statusGroup: string;
  status: string;
}

export interface CmDashboardNotificationItem extends CmNotificationView {
  read: boolean;
}

export interface CmDashboardModel {
  bootstrap: CmBootstrap | null;
  loading: boolean;
  error: string | null;
  retryBootstrap: () => void;
  displayName: string;
  heldRoles: string[];
  onboarding: CmDashboardOnboarding | null;
  metrics: CmDashboardMetric[];
  shortcuts: CmDashboardShortcut[];
  primaryAction: CmDashboardPrimaryAction | null;
  showProjects: boolean;
  showTasks: boolean;
  showReviews: boolean;
  showNotifications: boolean;
  projects: CmPagedList<CmProject>;
  tasks: CmPagedList<CmTask>;
  reviews: CmPagedList<CmReviewSubmission>;
  notifications: CmPagedList<CmNotification>;
  projectItems: CmDashboardPreviewItem[];
  taskItems: CmDashboardPreviewItem[];
  reviewItems: CmDashboardPreviewItem[];
  notificationItems: CmDashboardNotificationItem[];
  reloadAll: () => Promise<void>;
}

const sliceOf = <T,>(data: CmPagedSlice<T>): CmPagedSlice<T> => data;
const fetchReviews = (page: number) => cmApi.getReviewTasks(page);
const extractReviews = (data: { pending_reviews: CmReviewSubmission[] }): CmPagedSlice<CmReviewSubmission> => ({
  items: (Array.isArray(data.pending_reviews) ? data.pending_reviews : []).slice(0, CM_PREVIEW_SIZE),
  totalPages: 1,
});
const fetchNotifications = (page: number) => cmApi.getNotifications(page);
const extractNotifications = (data: { items: CmNotification[] }): CmPagedSlice<CmNotification> => ({
  items: (Array.isArray(data.items) ? data.items : []).slice(0, CM_PREVIEW_SIZE),
  totalPages: 1,
});

/** Role-aware dashboard: counters, onboarding step, shortcuts and open-work previews, for the web page and the mobile Home. */
export function useCmDashboard(): CmDashboardModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const present = useCmNotificationPresenter();
  const { bootstrap, loading, error, refresh, refreshUnread, hasCapability, hasRole, roles, terminalStates } = useCmBootstrap();
  const retryBootstrap = useCallback(() => { void refresh(); }, [refresh]);

  const showProjects = hasCapability('project.read') && (hasRole('client') || hasRole('architect'));
  const showTasks = hasCapability('task.read');
  const showReviews = hasCapability('review.read') && hasRole('reviewer', 'active');
  const showNotifications = hasCapability('notification.read');

  const closedProjectKey = terminalStates('project').join(STATE_KEY_SEPARATOR);
  const closedTaskKey = terminalStates('task').join(STATE_KEY_SEPARATOR);
  const fetchProjects = useCallback(() => cmCollectOpenPreview(
    (page) => cmApi.getProjects({ include_assigned: true, page }),
    (data) => (Array.isArray(data.projects) ? data.projects : []),
    (data) => data.pagination,
    (project: CmProject) => !closedProjectKey.split(STATE_KEY_SEPARATOR).includes(project.status),
  ), [closedProjectKey]);
  const fetchTasks = useCallback(() => cmCollectOpenPreview(
    (page) => cmApi.getMyTasks(page),
    (data) => (Array.isArray(data.my_tasks) ? data.my_tasks : []),
    (data) => data.pagination,
    (task: CmTask) => !closedTaskKey.split(STATE_KEY_SEPARATOR).includes(task.status),
  ), [closedTaskKey]);
  const projects = useCmPagedList(fetchProjects, sliceOf<CmProject>, 'projects.loadFailed', showProjects);
  const tasks = useCmPagedList(fetchTasks, sliceOf<CmTask>, 'tasks.loadFailed', showTasks);
  const reviews = useCmPagedList(fetchReviews, extractReviews, 'reviews.loadFailed', showReviews);
  const notifications = useCmPagedList(fetchNotifications, extractNotifications, 'notifications.loadFailed', showNotifications);

  const { reload: reloadProjects } = projects;
  const { reload: reloadTasks } = tasks;
  const { reload: reloadReviews } = reviews;
  const { reload: reloadNotifications } = notifications;

  const displayName = bootstrap?.user.name || bootstrap?.user.nickname || bootstrap?.user.username || '';
  const heldRoles = roles.filter((role) => hasRole(role));

  const projectItems = useMemo<CmDashboardPreviewItem[]>(() => projects.items.map((project) => ({
    id: project.id,
    title: project.title,
    to: cmProjectPath(project.id),
    meta: project.budget ? format.money(project.budget, project.currency) : undefined,
    statusGroup: 'project',
    status: project.status,
  })), [projects.items, format]);
  const taskItems = useMemo<CmDashboardPreviewItem[]>(() => tasks.items.map((task) => ({
    id: task.id,
    title: task.title,
    to: cmTaskPath(task.id),
    meta: task.due_date ? t('tasks.due', { date: format.date(task.due_date) }) : undefined,
    statusGroup: 'task',
    status: task.status,
  })), [tasks.items, format, t]);
  const reviewItems = useMemo<CmDashboardPreviewItem[]>(() => reviews.items.map((submission) => ({
    id: submission.id,
    title: submission.task?.title ?? t('reviews.submissionTitle', { id: submission.id }),
    to: CM_PROTECTED_ROUTE.reviews,
    meta: format.dateTime(submission.created_at),
    statusGroup: 'submission',
    status: submission.status,
  })), [reviews.items, format, t]);
  const notificationItems = useMemo<CmDashboardNotificationItem[]>(() => notifications.items.map((item) => {
    const view = present(item);
    return { ...view, link: view.link ?? CM_PROTECTED_ROUTE.notifications, read: item.read };
  }), [notifications.items, present]);

  const reloadAll = useCallback(async (): Promise<void> => {
    await Promise.all([
      refresh(),
      refreshUnread(),
      showProjects ? reloadProjects() : undefined,
      showTasks ? reloadTasks() : undefined,
      showReviews ? reloadReviews() : undefined,
      showNotifications ? reloadNotifications() : undefined,
    ]);
  }, [refresh, refreshUnread, showProjects, showTasks, showReviews, showNotifications, reloadProjects, reloadTasks, reloadReviews, reloadNotifications]);

  return {
    bootstrap,
    loading,
    error,
    retryBootstrap,
    displayName,
    heldRoles,
    onboarding: bootstrap ? cmDashboardOnboarding(bootstrap) : null,
    metrics: bootstrap ? cmDashboardMetrics(bootstrap, format, hasCapability, hasRole) : [],
    shortcuts: bootstrap ? cmDashboardShortcuts(bootstrap, hasCapability, hasRole) : [],
    primaryAction: bootstrap ? cmDashboardPrimaryAction(hasCapability) : null,
    showProjects,
    showTasks,
    showReviews,
    showNotifications,
    projects,
    tasks,
    reviews,
    notifications,
    projectItems,
    taskItems,
    reviewItems,
    notificationItems,
    reloadAll,
  };
}
