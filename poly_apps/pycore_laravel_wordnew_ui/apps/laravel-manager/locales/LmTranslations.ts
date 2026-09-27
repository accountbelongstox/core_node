/** Laravel Manager identity and composed translation resources. */
import { lmEnCore } from './LmEnCore';
import { lmEnOperations } from './LmEnOperations';
import { lmZhCore } from './LmZhCore';
import { lmZhOperations } from './LmZhOperations';

export const APP_NAME = 'NEXUS // ORBIT';
export const APP_VERSION = 'v3.4.0-beta';

const lmEn = {
  ...lmEnCore,
  ...lmEnOperations,
} as const;

type LmDeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : LmDeepStringify<T[K]>;
};

/** Every locale carries the full English key tree. */
export type LmTranslationDict = LmDeepStringify<typeof lmEn>;

const lmZh: LmTranslationDict = {
  ...lmZhCore,
  ...lmZhOperations,
};

export const TRANSLATIONS = {
  en: lmEn,
  zh: lmZh,
} as const;

