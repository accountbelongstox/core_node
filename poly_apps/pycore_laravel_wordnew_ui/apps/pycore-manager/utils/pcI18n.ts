import i18n from '../../../core/i18n/UiI18n';

/** Translate a `pc` key outside React render (event handlers, stores, providers). */
export function pcT(key: string, options: Record<string, unknown> = {}): string {
  return String(i18n.t(key, { ns: 'pc', ...options }));
}
