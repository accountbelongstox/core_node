import { lazy, type ComponentType } from 'react';

const CmAdminOverviewPage = lazy(() => import('./CmAdminPages').then((module) => ({ default: module.CmAdminOverviewPage })));
const CmAdminUsersPage = lazy(() => import('./CmAdminPages').then((module) => ({ default: module.CmAdminUsersPage })));
const CmAdminKycPage = lazy(() => import('./CmAdminPages').then((module) => ({ default: module.CmAdminKycPage })));
const CmAdminDepositsPage = lazy(() => import('./CmAdminFinancePages').then((module) => ({ default: module.CmAdminDepositsPage })));
const CmAdminRefundsPage = lazy(() => import('./CmAdminFinancePages').then((module) => ({ default: module.CmAdminRefundsPage })));
const CmAdminTasksPage = lazy(() => import('./CmAdminTasksPage'));
const CmAdminPolicyPage = lazy(() => import('./CmAdminPolicyPage'));
const CmAdminProjectsPage = lazy(() => import('./CmAdminFinancePages').then((module) => ({ default: module.CmAdminProjectsPage })));
const CmAdminUserDetailPage = lazy(() => import('./CmAdminUserDetailPage'));
const CmAdminWithdrawalsPage = lazy(() => import('./CmAdminFinancePages').then((module) => ({ default: module.CmAdminWithdrawalsPage })));
const CmAdminPaymentsPage = lazy(() => import('./CmAdminFinancePages').then((module) => ({ default: module.CmAdminPaymentsPage })));
const CmAdminTestimonialsPage = lazy(() => import('./CmAdminModerationPages').then((module) => ({ default: module.CmAdminTestimonialsPage })));
const CmAdminReviewerApplicationsPage = lazy(() => import('./CmAdminModerationPages').then((module) => ({ default: module.CmAdminReviewerApplicationsPage })));
const CmAdminContactMessagesPage = lazy(() => import('./CmAdminModerationPages').then((module) => ({ default: module.CmAdminContactMessagesPage })));
const CmAdminActivityPage = lazy(() => import('./CmAdminModerationPages').then((module) => ({ default: module.CmAdminActivityPage })));


export interface CmAdminRouteDef {
  id: string;
  /** Route path relative to the app base (`admin/users/:userId`). */
  path: string;
  Component: ComponentType;
}

/** Every administration console page; the web console and the mobile admin-lite console share these ids and paths. */
export const CM_ADMIN_ROUTES: CmAdminRouteDef[] = [
  { id: 'overview', path: 'admin', Component: CmAdminOverviewPage },
  { id: 'users', path: 'admin/users', Component: CmAdminUsersPage },
  { id: 'kyc', path: 'admin/kyc', Component: CmAdminKycPage },
  { id: 'deposits', path: 'admin/deposits', Component: CmAdminDepositsPage },
  { id: 'refunds', path: 'admin/refunds', Component: CmAdminRefundsPage },
  { id: 'projects', path: 'admin/projects', Component: CmAdminProjectsPage },
  { id: 'tasks', path: 'admin/tasks', Component: CmAdminTasksPage },
  { id: 'policy', path: 'admin/policy', Component: CmAdminPolicyPage },
  { id: 'user-detail', path: 'admin/users/:userId', Component: CmAdminUserDetailPage },
  { id: 'withdrawals', path: 'admin/withdrawals', Component: CmAdminWithdrawalsPage },
  { id: 'payments', path: 'admin/payments', Component: CmAdminPaymentsPage },
  { id: 'testimonials', path: 'admin/testimonials', Component: CmAdminTestimonialsPage },
  { id: 'reviewer-applications', path: 'admin/reviewer-applications', Component: CmAdminReviewerApplicationsPage },
  { id: 'contact-messages', path: 'admin/contact-messages', Component: CmAdminContactMessagesPage },
  { id: 'activity', path: 'admin/activity', Component: CmAdminActivityPage },
];

