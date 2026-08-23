import React, { lazy } from 'react';
import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  FilePlus2,
  LayoutDashboard,
  ListTodo,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  WalletCards,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

const CmDashboardPage = lazy(() => import('./pages/CmDashboardPage'));
const CmMarketplacePage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmMarketplacePage })));
const CmProjectsPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmProjectsPage })));
const CmProjectCreatePage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmProjectCreatePage })));
const CmTasksPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmTasksPage })));
const CmReviewsPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmReviewsPage })));
const CmArchitectPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmArchitectPage })));
const CmWalletPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmWalletPage })));
const CmVerificationPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmVerificationPage })));
const CmProfilePage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmProfilePage })));
const CmNotificationsPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmNotificationsPage })));
const CmSettingsPage = lazy(() => import('./pages/CmDomainPages').then((module) => ({ default: module.CmSettingsPage })));

export interface CmPageDef {
  id: string;
  path: string;
  labelKey: string;
  capability: string | null;
  Icon: LucideIcon;
  Component: React.ComponentType;
  group: 'primary' | 'account';
}

export const CM_PAGES: CmPageDef[] = [
  { id: 'dashboard', path: 'dashboard', labelKey: 'nav.dashboard', capability: null, Icon: LayoutDashboard, Component: CmDashboardPage, group: 'primary' },
  { id: 'marketplace', path: 'marketplace', labelKey: 'nav.marketplace', capability: 'task.browse', Icon: Store, Component: CmMarketplacePage, group: 'primary' },
  { id: 'projects', path: 'projects', labelKey: 'nav.myProjects', capability: 'project.read', Icon: BriefcaseBusiness, Component: CmProjectsPage, group: 'primary' },
  { id: 'project-create', path: 'projects/new', labelKey: 'nav.createProject', capability: 'project.create', Icon: FilePlus2, Component: CmProjectCreatePage, group: 'primary' },
  { id: 'tasks', path: 'tasks', labelKey: 'nav.tasks', capability: 'task.read', Icon: ListTodo, Component: CmTasksPage, group: 'primary' },
  { id: 'reviews', path: 'reviews', labelKey: 'nav.reviews', capability: 'review.read', Icon: ClipboardCheck, Component: CmReviewsPage, group: 'primary' },
  { id: 'architect', path: 'architect', labelKey: 'nav.architect', capability: 'architect.read', Icon: Workflow, Component: CmArchitectPage, group: 'primary' },
  { id: 'wallet', path: 'wallet', labelKey: 'nav.wallet', capability: 'finance.read', Icon: WalletCards, Component: CmWalletPage, group: 'primary' },
  { id: 'verification', path: 'verification', labelKey: 'nav.verification', capability: 'onboarding.read', Icon: ShieldCheck, Component: CmVerificationPage, group: 'account' },
  { id: 'profile', path: 'profile', labelKey: 'nav.profile', capability: 'profile.read', Icon: UserRound, Component: CmProfilePage, group: 'account' },
  { id: 'notifications', path: 'notifications', labelKey: 'nav.notifications', capability: 'notification.read', Icon: Bell, Component: CmNotificationsPage, group: 'account' },
  { id: 'settings', path: 'settings', labelKey: 'nav.settings', capability: null, Icon: Settings, Component: CmSettingsPage, group: 'account' },
];
