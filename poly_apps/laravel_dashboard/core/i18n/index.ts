/**
 * i18n (Internationalization) Module
 *
 * Multi-language support system with React hooks and context
 */

// Languages
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguage,
  getLanguageName,
  detectBrowserLanguage,
  type Language
} from './languages';

// Translator
export {
  translate,
  t,
  getTranslations,
  hasTranslation,
  loadTranslation,
  preloadLanguages,
  getLoadedLanguages
} from './translator';

// React Context & Hooks
export {
  LanguageProvider,
  useTranslation,
  LanguageSelector
} from './LanguageContext';

// Types
export type { TranslationDictionary } from './locales/en';
