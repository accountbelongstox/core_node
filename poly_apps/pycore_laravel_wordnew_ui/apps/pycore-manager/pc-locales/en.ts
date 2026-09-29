/** Composed Pycore Manager English locale. */
import { pcEnCore } from './PcEnCore';
import { pcEnFeatures } from './PcEnFeatures';
import { pcEnPages } from './PcEnPages';

export const pcEn = {
  ...pcEnCore,
  ...pcEnFeatures,
  ...pcEnPages,
} as const;

type PcDeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : PcDeepStringify<T[K]>;
};

export type PcTranslationDict = PcDeepStringify<typeof pcEn>;
