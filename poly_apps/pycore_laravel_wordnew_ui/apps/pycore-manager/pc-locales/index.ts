/**
 * Pycore Manager locale bundles — registered under the shared `pc` i18next namespace.
 */
import { registerEndLocales } from '../../../shell/shell-i18n';
import { pcEn } from './en';
import { pcZh } from './zh';

/** Idempotent — safe to call from PcApp on every mount. */
export function registerPcLocales(): void {
  registerEndLocales('pc', { en: pcEn, zh: pcZh });
}

export { pcEn, pcZh };
export type { PcTranslationDict } from './en';
