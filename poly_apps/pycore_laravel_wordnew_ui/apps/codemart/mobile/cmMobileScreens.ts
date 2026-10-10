import type { ComponentType } from 'react';
import { MOBILE_SCREENS_A } from './screens/a';
import { MOBILE_SCREENS_B } from './screens/b';
import { MOBILE_SCREENS_C } from './screens/c';
import type { CmMobileScreenMap } from './screens/cmMobileScreenTypes';

const PACKAGES: CmMobileScreenMap[] = [MOBILE_SCREENS_A, MOBILE_SCREENS_B, MOBILE_SCREENS_C];

const merge = (pick: (screens: CmMobileScreenMap) => Record<string, ComponentType>): Record<string, ComponentType> => (
  Object.assign({}, ...PACKAGES.map(pick))
);

/** Single screen registry: each work package owns its own `screens/<pkg>/index.ts` map. */
export const MOBILE_WORKSPACE_SCREENS = merge((screens) => screens.workspace);
export const MOBILE_PUBLIC_SCREENS = merge((screens) => screens.public);
export const MOBILE_ADMIN_SCREENS = merge((screens) => screens.admin);
