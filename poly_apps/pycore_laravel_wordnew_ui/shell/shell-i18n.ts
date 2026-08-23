/**
 * Shell i18n seam. The host initializes react-i18next at its application boundary.
 * (en/zh). The shell keeps that single instance and lets each end register its
 * own locale namespace (lm / pc / wf) so the global language switch drives all
 * three. Full per-end locale dictionaries are loaded in a later phase.
 */
import i18n from '../core/i18n/UiI18n';

export type EndNamespace = 'lm' | 'pc' | 'wf' | 'pdd' | 'cm';

/**
 * Register an end's translations under its namespace, for every language it ships.
 * `resources` is keyed by language code: { en: {...}, zh: {...}, ... }.
 */
export function registerEndLocales(ns: EndNamespace, resources: Record<string, Record<string, any>>): void {
  Object.entries(resources).forEach(([language, resource]) => {
    if (!i18n.hasResourceBundle(language, ns)) {
      i18n.addResourceBundle(language, ns, resource, true, true);
      return;
    }
    i18n.addResourceBundle(language, ns, resource, true, true);
  });
}

export default i18n;
