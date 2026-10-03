/** Laravel Manager identity and composed translation resources. */
import { lmEnCore } from './LmEnCore';
import { lmEnOperations } from './LmEnOperations';
import { lmZhCore } from './LmZhCore';
import { lmZhOperations } from './LmZhOperations';
import { lmEnUiSettings } from './LmUiSettingsEn';
import { lmZhUiSettings } from './LmUiSettingsZh';
import { lmEnUiServer } from './LmUiServerEn';
import { lmZhUiServer } from './LmUiServerZh';
import { lmEnUiVocab } from './LmUiVocabEn';
import { lmZhUiVocab } from './LmUiVocabZh';
import { lmEnUiTask } from './LmUiTaskEn';
import { lmZhUiTask } from './LmUiTaskZh';
import { lmEnUiAi } from './LmUiAiEn';
import { lmZhUiAi } from './LmUiAiZh';
import { lmEnUiTools } from './LmUiToolsEn';
import { lmZhUiTools } from './LmUiToolsZh';
import { lmEnToolsCrypto } from './tools/LmToolsCryptoEn';
import { lmZhToolsCrypto } from './tools/LmToolsCryptoZh';
import { lmEnToolsConvert } from './tools/LmToolsConvertEn';
import { lmZhToolsConvert } from './tools/LmToolsConvertZh';
import { lmEnToolsWeb } from './tools/LmToolsWebEn';
import { lmZhToolsWeb } from './tools/LmToolsWebZh';
import { lmEnToolsText } from './tools/LmToolsTextEn';
import { lmZhToolsText } from './tools/LmToolsTextZh';
import { lmEnToolsMedia } from './tools/LmToolsMediaEn';
import { lmZhToolsMedia } from './tools/LmToolsMediaZh';
import { lmEnToolsCalc } from './tools/LmToolsCalcEn';
import { lmZhToolsCalc } from './tools/LmToolsCalcZh';
import { lmEnToolsOps } from './tools/LmToolsOpsEn';
import { lmZhToolsOps } from './tools/LmToolsOpsZh';
import { lmEnUiCommon } from './LmUiCommonEn';
import { lmZhUiCommon } from './LmUiCommonZh';

export const APP_NAME = 'NEXUS // ORBIT';
export const APP_VERSION = 'v3.4.0-beta';

const lmEn = {
  ...lmEnCore,
  ...lmEnOperations,
  ...lmEnUiSettings,
  ...lmEnUiServer,
  ...lmEnUiVocab,
  ...lmEnUiTask,
  ...lmEnUiAi,
  ...lmEnUiTools,
  ...lmEnToolsCrypto,
  ...lmEnToolsConvert,
  ...lmEnToolsWeb,
  ...lmEnToolsText,
  ...lmEnToolsMedia,
  ...lmEnToolsCalc,
  ...lmEnToolsOps,
  ...lmEnUiCommon,
} as const;

type LmDeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : LmDeepStringify<T[K]>;
};

/** Every locale carries the full English key tree. */
export type LmTranslationDict = LmDeepStringify<typeof lmEn>;

const lmZh: LmTranslationDict = {
  ...lmZhCore,
  ...lmZhOperations,
  ...lmZhUiSettings,
  ...lmZhUiServer,
  ...lmZhUiVocab,
  ...lmZhUiTask,
  ...lmZhUiAi,
  ...lmZhUiTools,
  ...lmZhToolsCrypto,
  ...lmZhToolsConvert,
  ...lmZhToolsWeb,
  ...lmZhToolsText,
  ...lmZhToolsMedia,
  ...lmZhToolsCalc,
  ...lmZhToolsOps,
  ...lmZhUiCommon,
};

export const TRANSLATIONS = {
  en: lmEn,
  zh: lmZh,
} as const;

