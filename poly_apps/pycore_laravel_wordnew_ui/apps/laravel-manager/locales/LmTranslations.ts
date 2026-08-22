/** Laravel Manager identity and composed translation resources. */
import { lmEnCore } from './LmEnCore';
import { lmEnOperations } from './LmEnOperations';
import { lmZhCore } from './LmZhCore';
import { lmZhOperations } from './LmZhOperations';

export const APP_NAME = 'NEXUS // ORBIT';
export const APP_VERSION = 'v3.4.0-beta';

export const TRANSLATIONS = {
  en: {
    ...lmEnCore,
    ...lmEnOperations,
  },
  zh: {
    ...lmZhCore,
    ...lmZhOperations,
  },
} as const;

