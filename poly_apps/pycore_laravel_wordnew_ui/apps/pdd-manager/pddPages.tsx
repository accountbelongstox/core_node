/**
 * pdd-manager page registry — single source of truth for the sidebar + router.
 * Mirrors apps/pycore-manager/pcPages.tsx; routes resolve to /pdd-manager/<id>.
 * Add a page by appending one entry (see PddApp.tsx, which generates the routes).
 */
import React, { lazy } from 'react';
import {
  LayoutDashboard, Users, Wallet, BadgeCheck, CreditCard, type LucideIcon,
} from 'lucide-react';

export const PddDashboardPage = lazy(() => import('./pages/PddDashboardPage'));
export const PddUsersPage = lazy(() => import('./pages/PddUsersPage'));
export const PddRechargePage = lazy(() => import('./pages/PddRechargePage'));
export const PddMembershipPage = lazy(() => import('./pages/PddMembershipPage'));
export const PddPaymentSettingsPage = lazy(() => import('./pages/PddPaymentSettingsPage'));

export interface PddPageDef {
  id: string;
  /** i18n key under the `pdd` namespace (e.g. nav.dashboard). */
  labelKey: string;
  Icon: LucideIcon;
  Component: React.ComponentType;
  index?: boolean;
  bottom?: boolean;
}

export const PDD_PAGES: PddPageDef[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard, Component: PddDashboardPage, index: true },
  { id: 'users', labelKey: 'nav.users', Icon: Users, Component: PddUsersPage },
  { id: 'recharge', labelKey: 'nav.recharge', Icon: Wallet, Component: PddRechargePage },
  { id: 'membership', labelKey: 'nav.membership', Icon: BadgeCheck, Component: PddMembershipPage },
  { id: 'payment-settings', labelKey: 'nav.paymentSettings', Icon: CreditCard, Component: PddPaymentSettingsPage, bottom: true },
];
