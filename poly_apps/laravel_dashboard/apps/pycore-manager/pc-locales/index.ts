/**
 * Pycore Manager locale bundles — registered under the shared `pc` i18next namespace.
 */
import { registerEndLocales } from '../../../shell/shell-i18n';
import { pcEn } from './en';
import { pcZh } from './zh';

let registered = false;

/** Idempotent — safe to call from PcApp on every mount. */
export function registerPcLocales(): void {
  if (registered) return;
  registerEndLocales('pc', { en: pcEn, zh: pcZh });
  registered = true;
}

export { pcEn, pcZh };
export type { PcTranslationDict } from './en';
