import { registerEndLocales } from '../../../shell/shell-i18n';
import { cmEn } from './en';
import { cmZh } from './zh';

export function registerCmLocales(): void {
  registerEndLocales('cm', { en: cmEn, zh: cmZh });
}

export { cmEn, cmZh };
export type { CmTranslationDict } from './en';
