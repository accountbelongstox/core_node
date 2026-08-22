/** Composed Pycore Manager English locale. */
import { pcEnCore } from './PcEnCore';
import { pcEnFeatures } from './PcEnFeatures';

export const pcEn = {
  ...pcEnCore,
  ...pcEnFeatures,
} as const;

type PcDeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : PcDeepStringify<T[K]>;
};

export type PcTranslationDict = PcDeepStringify<typeof pcEn>;
