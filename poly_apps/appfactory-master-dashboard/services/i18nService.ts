/**
 * i18n Internationalization Service
 * Provides multi-language support for the application
 */
import { en, TranslationKeys } from '../locales/en';
import { zh } from '../locales/zh';
import { ja } from '../locales/ja';

// Supported languages list
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Language resource mapping
const translations: Record<SupportedLanguage, TranslationKeys> = {
  en,
  zh,
  ja,
};

// Helper function to get nested property
function getNestedProperty(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path; // If not found, return original path
    }
  }

  return typeof result === 'string' ? result : path;
}

/**
 * i18n Service Class
 * Manages language switching and translation
 */
class I18nService {
  private currentLanguage: SupportedLanguage = 'zh';
  private listeners: Set<() => void> = new Set();

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Set current language
   */
  setLanguage(language: SupportedLanguage): void {
    if (this.currentLanguage !== language) {
      this.currentLanguage = language;
      this.notifyListeners();
    }
  }

  /**
   * Translate text
   * @param key - Translation key, supports dot-separated nested paths, e.g. 'dashboard.title'
   * @param params - Optional parameters object for placeholder replacement
   */
  t(key: string, params?: Record<string, string | number>): string {
    const translation = getNestedProperty(translations[this.currentLanguage], key);

    // If params exist, replace placeholders
    if (params) {
      return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
        return text.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, translation);
    }

    return translation;
  }

  /**
   * Add language change listener
   */
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove language change listener
   */
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): typeof SUPPORTED_LANGUAGES {
    return SUPPORTED_LANGUAGES;
  }
}

// Export singleton
export const i18nService = new I18nService();
