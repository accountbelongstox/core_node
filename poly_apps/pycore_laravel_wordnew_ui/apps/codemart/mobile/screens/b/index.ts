import { lazy } from 'react';
import type { CmMobileScreenMap } from '../cmMobileScreenTypes';

/** Work package B: marketplace, projects, project detail, tasks, reviews, architect. */
export const MOBILE_SCREENS_B: CmMobileScreenMap = {
  workspace: {
    marketplace: lazy(() => import('./MobileMarketplaceScreen')),
    projects: lazy(() => import('./MobileProjectsScreen')),
    'project-create': lazy(() => import('./MobileProjectCreateScreen')),
    'project-detail': lazy(() => import('./MobileProjectDetailScreen')),
    tasks: lazy(() => import('./MobileTasksScreen')),
    reviews: lazy(() => import('./MobileReviewsScreen')),
    architect: lazy(() => import('./MobileArchitectScreen')),
  },
  public: {},
  admin: {},
};
