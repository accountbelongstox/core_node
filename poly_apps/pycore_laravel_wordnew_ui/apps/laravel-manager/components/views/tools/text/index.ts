/** Text workbench registry. */
import { lazy } from 'react';
import type { ToolWorkbenchMap } from '../toolWorkbenchTypes';

export const TEXT_WORKBENCHES: ToolWorkbenchMap = {
  regexTester: lazy(() => import('./RegexTesterWorkbench')),
  urlParser: lazy(() => import('./UrlParserWorkbench')),
  loremIpsumGenerator: lazy(() => import('./LoremIpsumWorkbench')),
  emailNormalizer: lazy(() => import('./EmailNormalizerWorkbench')),
  numeronymGenerator: lazy(() => import('./NumeronymWorkbench')),
  textDiff: lazy(() => import('./TextDiffWorkbench')),
  asciiArtGenerator: lazy(() => import('./AsciiArtWorkbench')),
  crontabParser: lazy(() => import('./CrontabWorkbench')),
  phoneParser: lazy(() => import('./PhoneParserWorkbench')),
  ibanValidator: lazy(() => import('./IbanValidatorWorkbench')),
  safelinkEncoder: lazy(() => import('./SafelinkWorkbench')),
  emojiPicker: lazy(() => import('./EmojiPickerWorkbench')),
  gitMemoGenerator: lazy(() => import('./GitMemoWorkbench')),
  textObfuscator: lazy(() => import('./TextObfuscatorWorkbench')),
  textStatistics: lazy(() => import('./TextStatisticsWorkbench')),
};
