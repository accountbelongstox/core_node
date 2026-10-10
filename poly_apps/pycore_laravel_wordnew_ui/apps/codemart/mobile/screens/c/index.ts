import { lazy } from 'react';
import type { CmMobileScreenMap } from '../cmMobileScreenTypes';
import '../../styles/cm-mobile-c.css';

/** Work package C: wallet, verification, profile, settings, admin-lite console. */
export const MOBILE_SCREENS_C: CmMobileScreenMap = {
  workspace: {
    wallet: lazy(() => import('./MobileWalletScreen')),
    verification: lazy(() => import('./MobileVerificationScreen')),
    profile: lazy(() => import('./MobileProfileScreen')),
    settings: lazy(() => import('./MobileSettingsScreen')),
  },
  public: {},
  admin: {
    overview: lazy(() => import('./admin/MobileAdminOverviewScreens').then((module) => ({ default: module.MobileAdminOverviewScreen }))),
    policy: lazy(() => import('./admin/MobileAdminOverviewScreens').then((module) => ({ default: module.MobileAdminPolicyScreen }))),
    users: lazy(() => import('./admin/MobileAdminPeopleScreens').then((module) => ({ default: module.MobileAdminUsersScreen }))),
    'user-detail': lazy(() => import('./admin/MobileAdminPeopleScreens').then((module) => ({ default: module.MobileAdminUserDetailScreen }))),
    'reviewer-applications': lazy(() => import('./admin/MobileAdminPeopleScreens').then((module) => ({ default: module.MobileAdminReviewerApplicationsScreen }))),
    'contact-messages': lazy(() => import('./admin/MobileAdminPeopleScreens').then((module) => ({ default: module.MobileAdminContactMessagesScreen }))),
    kyc: lazy(() => import('./admin/MobileAdminKycScreen')),
    deposits: lazy(() => import('./admin/MobileAdminFinanceScreens').then((module) => ({ default: module.MobileAdminDepositsScreen }))),
    refunds: lazy(() => import('./admin/MobileAdminFinanceScreens').then((module) => ({ default: module.MobileAdminRefundsScreen }))),
    withdrawals: lazy(() => import('./admin/MobileAdminFinanceScreens').then((module) => ({ default: module.MobileAdminWithdrawalsScreen }))),
    payments: lazy(() => import('./admin/MobileAdminFinanceScreens').then((module) => ({ default: module.MobileAdminPaymentsScreen }))),
  },
};
