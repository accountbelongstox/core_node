import { lazy } from 'react';
import type { CmMobileScreenMap } from '../cmMobileScreenTypes';

/** Work package B: marketplace, projects, project detail, tasks, reviews, architect. */
export const MOBILE_SCREENS_B: CmMobileScreenMap = {
  workspace: {
    marketplace: lazy(() => import('./MobileMarketplaceScreen')),
  },
  public: {},
  admin: {},
};
