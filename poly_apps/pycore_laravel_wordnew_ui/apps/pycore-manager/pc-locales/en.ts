/** Composed Pycore Manager English locale. */
import { pcEnCore } from './PcEnCore';
import { pcEnFeatures } from './PcEnFeatures';
import { pcEnPages } from './PcEnPages';
import { aiHubEn } from './PcAiHubLocales';
import { meshLoginEn } from './PcMeshLoginLocales';

export const pcEn = {
  ...pcEnCore,
  ...pcEnFeatures,
  ...pcEnPages,
  aiHub: aiHubEn,
  meshLogin: meshLoginEn,
} as const;

type PcDeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : PcDeepStringify<T[K]>;
};

export type PcTranslationDict = PcDeepStringify<typeof pcEn>;
