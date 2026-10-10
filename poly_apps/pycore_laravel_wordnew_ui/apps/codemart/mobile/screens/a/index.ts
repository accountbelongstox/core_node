import { lazy } from 'react';
import type { CmMobileScreenMap } from '../cmMobileScreenTypes';

/** Work package A: public and auth screens, dashboard/home, notifications. */
export const MOBILE_SCREENS_A: CmMobileScreenMap = {
  workspace: {
    dashboard: lazy(() => import('./MobileHomeScreen')),
    notifications: lazy(() => import('./MobileNotificationsScreen')),
  },
  public: {
    home: lazy(() => import('./MobileWelcomeScreen')),
  },
  admin: {},
};
