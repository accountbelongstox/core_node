/** Composed Pycore Manager Simplified Chinese locale. */
import type { PcTranslationDict } from './en';
import { pcZhCore } from './PcZhCore';
import { pcZhFeatures } from './PcZhFeatures';
import { pcZhPages } from './PcZhPages';

export const pcZh: PcTranslationDict = {
  ...pcZhCore,
  ...pcZhFeatures,
  ...pcZhPages,
};
