/**
 * Central i18n layer – single source of truth for language and translations.
 *
 * DESIGN (follow this style for future i18n work):
 * - All UI copy is accessed via useTranslation().t('key') in React or i18n.t('key') outside React.
 * - No component should branch on language (e.g. lang === 'zh') for display text.
 * - Translation data lives in TRANSLATIONS (constants.tsx); this module initializes
 *   i18next so t('nav.media'), t('auth.login_hint') work. Add new keys in constants (en + zh).
 * - Current language is synced from app state in AppContent (i18n.changeLanguage(lang)).
 *
 * Usage:
 *   In components: const { t } = useTranslation(); return <span>{t('nav.media')}</span>;
 *   Outside React: import i18n from './apps/laravel-manager/i18n';
 *
 * Refs: https://react.i18next.com/, https://www.i18next.com/overview/configuration-options
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { TRANSLATIONS } from '../../constants';

// Re-export the key-based React hook from the Manager-owned i18n boundary.
export { useTranslation, Trans } from 'react-i18next';

const defaultLng = 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: TRANSLATIONS.en as Record<string, unknown> },
      zh: { translation: TRANSLATIONS.zh as Record<string, unknown> }
    },
    lng: defaultLng,
    fallbackLng: defaultLng,
    supportedLngs: ['en', 'zh'],
    showSupportNotice: false,
    keySeparator: '.',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;
