/** Composed Pycore Manager Simplified Chinese locale. */
import type { PcTranslationDict } from './en';
import { pcZhCore } from './PcZhCore';
import { pcZhFeatures } from './PcZhFeatures';
import { pcZhPages } from './PcZhPages';
import { aiHubZh } from './PcAiHubLocales';
import { meshLoginZh } from './PcMeshLoginLocales';
import { networkRouterZh } from './PcNetworkRouterLocales';

export const pcZh: PcTranslationDict = {
  ...pcZhCore,
  ...pcZhFeatures,
  ...pcZhPages,
  aiHub: aiHubZh,
  meshLogin: meshLoginZh,
  networkRouter: networkRouterZh,
};
