import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
const DEFAULT_LANGUAGE = 'en';

/** UI languages with full translations; drives i18next supportedLngs and the shell switcher. */
export const UI_SUPPORTED_LANGUAGES = ['en', 'zh'] as const;
export type UiLanguage = (typeof UI_SUPPORTED_LANGUAGES)[number];

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources: {},
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: [...UI_SUPPORTED_LANGUAGES],
      showSupportNotice: false,
      keySeparator: '.',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
}

export { Trans, useTranslation } from 'react-i18next';
export default i18n;
