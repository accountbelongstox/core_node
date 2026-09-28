export const CM_ROUTE_BASE = '/codemart';

export const CM_PUBLIC_ROUTE = {
  home: '/codemart',
  about: '/codemart/about',
  delivery: '/codemart/delivery-process',
  services: '/codemart/services',
  estimate: '/codemart/estimate',
  download: '/codemart/download',
  privacy: '/codemart/privacy',
  terms: '/codemart/terms',
  information: '/codemart/information',
  showcase: '/codemart/showcase',
  showcaseOpenWork: '/codemart/showcase#cm-showcase-open-tasks',
  login: '/codemart/login',
  register: '/codemart/register',
  forgotPassword: '/codemart/forgot-password',
  passwordReset: '/codemart/password-reset',
} as const;

export const CM_PROTECTED_ROUTE = {
  dashboard: '/codemart/dashboard',
  verification: '/codemart/verification',
  profile: '/codemart/profile',
  marketplace: '/codemart/marketplace',
  projects: '/codemart/projects',
  projectCreate: '/codemart/projects/new',
  tasks: '/codemart/tasks',
  reviews: '/codemart/reviews',
  architect: '/codemart/architect',
  wallet: '/codemart/wallet',
  notifications: '/codemart/notifications',
} as const;

export const CM_ADMIN_ROUTE = {
  home: '/codemart/admin',
  users: '/codemart/admin/users',
  kyc: '/codemart/admin/kyc',
  deposits: '/codemart/admin/deposits',
  refunds: '/codemart/admin/refunds',
  withdrawals: '/codemart/admin/withdrawals',
  payments: '/codemart/admin/payments',
  projects: '/codemart/admin/projects',
  testimonials: '/codemart/admin/testimonials',
  reviewerApplications: '/codemart/admin/reviewer-applications',
  contactMessages: '/codemart/admin/contact-messages',
  activity: '/codemart/admin/activity',
} as const;

export const CM_TASK_QUERY_PARAM = 'task';

const PUBLIC_PATHS: readonly string[] = Object.values(CM_PUBLIC_ROUTE).map((route) => route.split('#')[0]);

type CmRouteQuery = Record<string, string | number | null | undefined>;

/** A route with its query string; empty values are left out. */
export function cmRouteWithQuery(route: string, query: CmRouteQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  });
  const search = params.toString();
  return search ? `${route}?${search}` : route;
}

/** Workspace route of a page declared in CM_PAGES (path relative to the app base). */
export function cmWorkspacePath(pagePath: string): string {
  return `${CM_ROUTE_BASE}/${pagePath}`;
}

export function cmProjectPath(projectId: number | string): string {
  return `${CM_PROTECTED_ROUTE.projects}/${projectId}`;
}

/** The task list, with the given task opened when an id is passed. */
export function cmTaskPath(taskId?: number | string | null): string {
  return taskId ? cmRouteWithQuery(CM_PROTECTED_ROUTE.tasks, { [CM_TASK_QUERY_PARAM]: taskId }) : CM_PROTECTED_ROUTE.tasks;
}

export function cmAdminUserPath(userId: number | string): string {
  return `${CM_ADMIN_ROUTE.users}/${userId}`;
}

/** Whether a CodeMart path renders without a session. */
export function isCmPublicPath(to: string): boolean {
  const path = to.split(/[?#]/)[0].replace(/\/+$/, '') || CM_ROUTE_BASE;
  if (!path.startsWith(CM_ROUTE_BASE)) return true;
  return PUBLIC_PATHS.some((publicPath) => path === publicPath || (publicPath === CM_PUBLIC_ROUTE.passwordReset && path.startsWith(`${publicPath}/`)));
}
