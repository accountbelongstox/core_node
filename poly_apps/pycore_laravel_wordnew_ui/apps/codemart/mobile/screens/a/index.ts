import { lazy } from 'react';
import type { CmMobileScreenMap } from '../cmMobileScreenTypes';
import '../../styles/cm-mobile-a.css';

/** Work package A: public and auth screens, dashboard/home, notifications. */
export const MOBILE_SCREENS_A: CmMobileScreenMap = {
  workspace: {
    dashboard: lazy(() => import('./MobileHomeScreen')),
    notifications: lazy(() => import('./MobileNotificationsScreen')),
  },
  public: {
    home: lazy(() => import('./MobileWelcomeScreen')),
    login: lazy(() => import('./MobileLoginScreen')),
    register: lazy(() => import('./MobileRegisterScreen')),
    'forgot-password': lazy(() => import('./MobilePasswordRecoveryScreens').then((module) => ({ default: module.MobileForgotPasswordScreen }))),
    'password-reset': lazy(() => import('./MobilePasswordRecoveryScreens').then((module) => ({ default: module.MobilePasswordResetScreen }))),
    showcase: lazy(() => import('./MobileShowcaseScreen')),
    estimate: lazy(() => import('./MobileEstimateScreen')),
    download: lazy(() => import('./MobileDownloadScreen')),
    about: lazy(() => import('./MobileInfoScreens').then((module) => ({ default: module.MobileAboutScreen }))),
    'delivery-process': lazy(() => import('./MobileInfoScreens').then((module) => ({ default: module.MobileDeliveryProcessScreen }))),
    services: lazy(() => import('./MobileInfoScreens').then((module) => ({ default: module.MobileServicesScreen }))),
    privacy: lazy(() => import('./MobileInfoScreens').then((module) => ({ default: module.MobilePrivacyScreen }))),
    terms: lazy(() => import('./MobileInfoScreens').then((module) => ({ default: module.MobileTermsScreen }))),
    information: lazy(() => import('./MobileInfoScreens').then((module) => ({ default: module.MobileInformationScreen }))),
  },
  admin: {},
};
