import { lazy } from 'react';
import type { CmMobileScreenMap } from '../cmMobileScreenTypes';

/** Work package C: wallet, verification, profile, settings, admin-lite console. */
export const MOBILE_SCREENS_C: CmMobileScreenMap = {
  workspace: {
    settings: lazy(() => import('./MobileSettingsScreen')),
  },
  public: {},
  admin: {},
};
