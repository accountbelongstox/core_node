import React, { lazy } from 'react';
import type { CmIconName } from './assets/cmImageRegistry';

const CmDashboardPage = lazy(() => import('./pages/CmDashboardPage'));
const CmMarketplacePage = lazy(() => import('./pages/CmMarketplacePage'));
const CmProjectsPage = lazy(() => import('./pages/CmProjectsPage'));
const CmProjectCreatePage = lazy(() => import('./pages/CmProjectsPage').then((module) => ({ default: module.CmProjectCreatePage })));
const CmTasksPage = lazy(() => import('./pages/CmTasksPage'));
const CmReviewsPage = lazy(() => import('./pages/CmReviewsPage'));
const CmArchitectPage = lazy(() => import('./pages/CmArchitectPage'));
const CmWalletPage = lazy(() => import('./pages/CmWalletPage'));
const CmVerificationPage = lazy(() => import('./pages/CmVerificationPage'));
const CmProfilePage = lazy(() => import('./pages/CmProfilePage'));
const CmNotificationsPage = lazy(() => import('./pages/CmNotificationsPage'));
const CmSettingsPage = lazy(() => import('./pages/CmSettingsPage'));

export interface CmPageDef {
  id: string;
  path: string;
  labelKey: string;
  capability: string | null;
  applyCapability?: string;
  applyLabelKey?: string;
  icon: CmIconName;
  Component: React.ComponentType;
  group: 'primary' | 'account';
}

export const CM_PAGES: CmPageDef[] = [
  { id: 'dashboard', path: 'dashboard', labelKey: 'nav.dashboard', capability: null, icon: 'nav-dashboard', Component: CmDashboardPage, group: 'primary' },
  { id: 'marketplace', path: 'marketplace', labelKey: 'nav.marketplace', capability: 'task.browse', icon: 'nav-marketplace', Component: CmMarketplacePage, group: 'primary' },
  { id: 'projects', path: 'projects', labelKey: 'nav.myProjects', capability: 'project.read', icon: 'nav-projects', Component: CmProjectsPage, group: 'primary' },
  { id: 'project-create', path: 'projects/new', labelKey: 'nav.createProject', capability: 'project.create', icon: 'nav-project-create', Component: CmProjectCreatePage, group: 'primary' },
  { id: 'tasks', path: 'tasks', labelKey: 'nav.tasks', capability: 'task.read', icon: 'nav-tasks', Component: CmTasksPage, group: 'primary' },
  { id: 'reviews', path: 'reviews', labelKey: 'nav.reviews', capability: 'review.read', applyCapability: 'task.browse', applyLabelKey: 'nav.reviewerApply', icon: 'nav-reviews', Component: CmReviewsPage, group: 'primary' },
  { id: 'architect', path: 'architect', labelKey: 'nav.architect', capability: 'architect.read', applyCapability: 'task.browse', applyLabelKey: 'nav.architectApply', icon: 'nav-architect', Component: CmArchitectPage, group: 'primary' },
  { id: 'wallet', path: 'wallet', labelKey: 'nav.wallet', capability: 'finance.read', icon: 'nav-wallet', Component: CmWalletPage, group: 'primary' },
  { id: 'verification', path: 'verification', labelKey: 'nav.verification', capability: 'onboarding.read', icon: 'nav-verification', Component: CmVerificationPage, group: 'account' },
  { id: 'profile', path: 'profile', labelKey: 'nav.profile', capability: 'profile.read', icon: 'nav-profile', Component: CmProfilePage, group: 'account' },
  { id: 'notifications', path: 'notifications', labelKey: 'nav.notifications', capability: 'notification.read', icon: 'nav-notifications', Component: CmNotificationsPage, group: 'account' },
  { id: 'settings', path: 'settings', labelKey: 'nav.settings', capability: null, icon: 'nav-settings', Component: CmSettingsPage, group: 'account' },
];
