import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
const DEFAULT_LANGUAGE = 'en';

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources: {},
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: ['en', 'zh'],
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
