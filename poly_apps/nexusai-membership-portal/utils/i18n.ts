import { translations, TranslationKey } from '../i18n';
import { Language } from '../types';

/**
 * I18n utility for non-React code
 * Provides translation access outside of React components
 */
class I18nService {
  private currentLanguage: Language = 'en';

  /**
   * Set current language
   */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
  }

  /**
   * Get current language
   */
  getLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Get translation for a key
   */
  t(key: TranslationKey): string {
    const translation = translations[this.currentLanguage];
    if (!translation) {
      console.warn(`Translation not found for language: ${this.currentLanguage}`);
      return translations.en[key] || key;
    }
    return translation[key] || translations.en[key] || key;
  }

  /**
   * Get all translations for current language
   */
  getAll(): typeof translations.en {
    return translations[this.currentLanguage] || translations.en;
  }
}

// Singleton instance
export const i18n = new I18nService();

