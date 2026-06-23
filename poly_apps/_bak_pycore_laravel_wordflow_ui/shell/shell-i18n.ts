/**
 * Shell i18n seam. The dashboard already initialises react-i18next in core/i18n
 * (en/zh). The shell keeps that single instance and lets each end register its
 * own locale namespace (lm / pc / wf) so the global language switch drives all
 * three. Full per-end locale dictionaries are loaded in a later phase.
 */
import i18n from '../core/i18n';

export type EndNamespace = 'lm' | 'pc' | 'wf';

/**
 * Register an end's translations under its namespace, for every language it ships.
 * `resources` is keyed by language code: { en: {...}, zh: {...}, ... }.
 */
export function registerEndLocales(ns: EndNamespace, resources: Record<string, Record<string, any>>): void {
  Object.keys(resources).forEach((lng) => {
    i18n.addResourceBundle(lng, ns, resources[lng], true, true);
  });
}

export default i18n;
