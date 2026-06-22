/**
 * PDD Manager locale bundles — registered under the shared `pdd` i18next namespace.
 */
import { registerEndLocales } from '../../../shell/shell-i18n';
import { pddEn } from './en';
import { pddZh } from './zh';

let registered = false;

/** Idempotent — safe to call from PddApp on every mount. */
export function registerPddLocales(): void {
  if (registered) return;
  registerEndLocales('pdd', { en: pddEn, zh: pddZh });
  registered = true;
}

export { pddEn, pddZh };
export type { PddTranslationDict } from './en';
