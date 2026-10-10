import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import type { CmBootstrap, CmPagination } from '../api/CmApiTypes';
import type { CmIconName } from '../assets/cmImageRegistry';
import { CM_PROTECTED_ROUTE } from '../components/public-home/cmPublicRoutes';
import type { CmFormatters } from '../components/workspace/cmWorkspaceFormat';
import type { CmPagedSlice } from '../components/workspace/useCmPagedList';

export const CM_PREVIEW_SIZE = 5;
const MAX_PREVIEW_PAGES = 5;
const DEFAULT_STEP_ROUTE = CM_PROTECTED_ROUTE.verification;
const STEP_ROUTES: Record<string, string> = {
  account: CM_PROTECTED_ROUTE.profile,
  deposit: CM_PROTECTED_ROUTE.wallet,
};

export interface CmDashboardShortcut {
  id: string;
  capability: string;
  route: string;
  icon: CmIconName;
  role?: string;
}

export const CM_DASHBOARD_SHORTCUTS: CmDashboardShortcut[] = [
  { id: 'createProject', capability: 'project.create', route: CM_PROTECTED_ROUTE.projectCreate, icon: 'nav-project-create', role: 'client' },
  { id: 'myProjects', capability: 'project.read', route: CM_PROTECTED_ROUTE.projects, icon: 'nav-projects', role: 'client' },
  { id: 'marketplace', capability: 'task.browse', route: CM_PROTECTED_ROUTE.marketplace, icon: 'nav-marketplace', role: 'developer' },
  { id: 'myTasks', capability: 'task.read', route: CM_PROTECTED_ROUTE.tasks, icon: 'nav-tasks', role: 'developer' },
  { id: 'architect', capability: 'architect.read', route: CM_PROTECTED_ROUTE.architect, icon: 'nav-architect', role: 'architect' },
  { id: 'reviews', capability: 'review.read', route: CM_PROTECTED_ROUTE.reviews, icon: 'nav-reviews', role: 'reviewer' },
  { id: 'wallet', capability: 'finance.read', route: CM_PROTECTED_ROUTE.wallet, icon: 'nav-wallet' },
  { id: 'verification', capability: 'onboarding.read', route: CM_PROTECTED_ROUTE.verification, icon: 'nav-verification' },
];

interface CmMetricDefinition {
  id: string;
  capability: string;
  route: string;
  icon: CmIconName;
  tone: string;
  value: (bootstrap: CmBootstrap, format: CmFormatters) => string;
  roles?: string[];
}

const METRIC_DEFINITIONS: CmMetricDefinition[] = [
  { id: 'activeProjects', capability: 'project.read', roles: ['client', 'architect'], route: CM_PROTECTED_ROUTE.projects, icon: 'feature-active-projects', tone: 'blue', value: (b, f) => f.number(b.counters.active_projects) },
  { id: 'escrowFunds', capability: 'project.create', route: CM_PROTECTED_ROUTE.projects, icon: 'feature-escrow-funds', tone: 'green', value: (b, f) => f.money(b.counters.protected_funds, b.counters.currency) },
  { id: 'myOpenTasks', capability: 'task.read', route: CM_PROTECTED_ROUTE.tasks, icon: 'feature-open-tasks', tone: 'violet', value: (b, f) => f.number(b.counters.my_open_tasks) },
  { id: 'marketplaceTasks', capability: 'task.browse', route: CM_PROTECTED_ROUTE.marketplace, icon: 'feature-marketplace-tasks', tone: 'blue', value: (b, f) => f.number(b.counters.open_marketplace_tasks) },
  { id: 'pendingReviews', capability: 'review.read', roles: ['reviewer'], route: CM_PROTECTED_ROUTE.reviews, icon: 'feature-pending-reviews', tone: 'amber', value: (b, f) => f.number(b.counters.pending_reviews) },
  { id: 'walletBalance', capability: 'finance.read', route: CM_PROTECTED_ROUTE.wallet, icon: 'feature-wallet-balance', tone: 'green', value: (b, f) => f.money(b.counters.wallet_balance, b.counters.currency) },
  { id: 'unread', capability: 'notification.read', route: CM_PROTECTED_ROUTE.notifications, icon: 'feature-unread-notifications', tone: 'amber', value: (b, f) => f.number(b.counters.unread_notifications) },
];

export interface CmDashboardMetric {
  id: string;
  route: string;
  icon: CmIconName;
  tone: string;
  value: string;
}

export interface CmDashboardOnboarding {
  nextStep: string;
  route: string;
  progress: number;
  doneSteps: number;
  totalSteps: number;
}

export interface CmDashboardPrimaryAction {
  id: 'createProject' | 'browseMarketplace' | 'openReviews' | 'openVerification';
  route: string;
  labelKey: string;
}

type CmHasCapability = (capability: string | null) => boolean;
type CmHasRole = (roleType: string, status?: string) => boolean;

export function cmDashboardMetrics(bootstrap: CmBootstrap, format: CmFormatters, hasCapability: CmHasCapability, hasRole: CmHasRole): CmDashboardMetric[] {
  return METRIC_DEFINITIONS
    .filter((metric) => hasCapability(metric.capability) && (!metric.roles || metric.roles.some((role) => hasRole(role))))
    .map((metric) => ({ id: metric.id, route: metric.route, icon: metric.icon, tone: metric.tone, value: metric.value(bootstrap, format) }));
}

export function cmDashboardShortcuts(bootstrap: CmBootstrap, hasCapability: CmHasCapability, hasRole: CmHasRole): CmDashboardShortcut[] {
  return CM_DASHBOARD_SHORTCUTS.filter((shortcut) => (
    hasCapability(shortcut.capability) && (!shortcut.role || hasRole(shortcut.role) || bootstrap.is_admin)
  ));
}

/** Next required onboarding step with its progress; null once onboarding is complete. */
export function cmDashboardOnboarding(bootstrap: CmBootstrap): CmDashboardOnboarding | null {
  const onboarding = bootstrap.onboarding;
  const nextStep = onboarding.next_step;
  if (onboarding.complete || !nextStep) return null;
  const requiredSteps = onboarding.steps.filter((step) => !step.optional);
  const doneSteps = requiredSteps.filter((step) => step.completed).length;
  const progress = requiredSteps.length > 0 ? Math.round((doneSteps / requiredSteps.length) * 100) : 100;
  return { nextStep, route: STEP_ROUTES[nextStep] ?? DEFAULT_STEP_ROUTE, progress, doneSteps, totalSteps: requiredSteps.length };
}

export function cmDashboardPrimaryAction(hasCapability: CmHasCapability): CmDashboardPrimaryAction {
  if (hasCapability('project.create')) return { id: 'createProject', route: CM_PROTECTED_ROUTE.projectCreate, labelKey: 'dashboard.createProject' };
  if (hasCapability('task.browse')) return { id: 'browseMarketplace', route: CM_PROTECTED_ROUTE.marketplace, labelKey: 'dashboard.browseMarketplace' };
  if (hasCapability('review.read')) return { id: 'openReviews', route: CM_PROTECTED_ROUTE.reviews, labelKey: 'dashboard.openReviews' };
  return { id: 'openVerification', route: CM_PROTECTED_ROUTE.verification, labelKey: 'dashboard.openVerification' };
}

/**
 * Walks the server pages (newest first) until enough still-open items are
 * collected, so closed items on page 1 never hide open work on later pages.
 */
export async function cmCollectOpenPreview<R, T>(
  fetchPage: (page: number) => Promise<APIResponse<R>>,
  itemsOf: (data: R) => T[],
  paginationOf: (data: R) => CmPagination | undefined,
  isOpen: (item: T) => boolean,
): Promise<APIResponse<CmPagedSlice<T>>> {
  const open: T[] = [];
  let response = await fetchPage(1);
  let page = 1;
  while (response.success && response.data) {
    open.push(...itemsOf(response.data).filter(isOpen));
    const totalPages = paginationOf(response.data)?.totalPages ?? 1;
    if (open.length >= CM_PREVIEW_SIZE || page >= totalPages || page >= MAX_PREVIEW_PAGES) break;
    page += 1;
    const next = await fetchPage(page);
    if (!next.success || !next.data) break;
    response = next;
  }
  const data = response.success && response.data ? { items: open.slice(0, CM_PREVIEW_SIZE), totalPages: 1 } : null;
  return { ...response, data };
}
