/**
 * Vortex locale bundles — registered under the shared `vx` i18next namespace.
 */
import { registerEndLocales } from '../../../shell/shell-i18n';
import { vxEn } from './en';
import { vxZh } from './zh';

export const vxLocales = { en: vxEn, zh: vxZh };

/** Idempotent — safe to call from VortexApp on every mount. */
export function registerVxLocales(): void {
  registerEndLocales('vx', vxLocales);
}

export { vxEn, vxZh };
export type { VxTranslationDict } from './en';
