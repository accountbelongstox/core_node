import { registerEndLocales } from '../../../shell/shell-i18n';
import { cmEn } from './en';
import { cmZh } from './zh';
import { cmMobileEn, cmMobileZh } from './mobile';

/** Languages CodeMart has translations for; the switcher offers only these. */
export const CM_LANGUAGES: readonly string[] = ['en', 'zh'];

export function registerCmLocales(): void {
  registerEndLocales('cm', { en: { ...cmEn, mobile: cmMobileEn }, zh: { ...cmZh, mobile: cmMobileZh } });
}

export { cmEn, cmZh };
export type { CmTranslationDict } from './en';
