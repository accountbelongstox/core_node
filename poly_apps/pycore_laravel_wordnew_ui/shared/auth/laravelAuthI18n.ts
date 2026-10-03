import i18n from '../../core/i18n/UiI18n';
import { LARAVEL_AUTH_NS, LARAVEL_AUTH_RESOURCES } from './LaravelAuthLocales';

(['en', 'zh'] as const).forEach((language) => {
  i18n.addResourceBundle(language, LARAVEL_AUTH_NS, LARAVEL_AUTH_RESOURCES[language], true, true);
});

export { LARAVEL_AUTH_NS };
export { useTranslation } from '../../core/i18n/UiI18n';
export default i18n;

/** Localized text of a login refusal: the server's `error_code` first, then its message, then the generic text. */
export function laravelAuthErrorText(errorCode: string | undefined, message: string): string {
  const key = `${LARAVEL_AUTH_NS}:login.errors.${errorCode ?? ''}`;
  if (errorCode && i18n.exists(key)) return i18n.t(key);
  return message || i18n.t(`${LARAVEL_AUTH_NS}:login.errors.default`);
}
