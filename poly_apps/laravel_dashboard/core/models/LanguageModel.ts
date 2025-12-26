import { Language } from '../../types';
import { StorageManager, StorageKeys } from '../storage';

/**
 * LanguageModel
 * Centralized language and translation management
 * Handles language switching and translation retrieval
 */
export class LanguageModel {
  private currentLanguage: Language;
  private translations: any = null;

  constructor() {
    this.currentLanguage = this.loadLanguageFromStorage();
  }

  /**
   * Load language from storage
   */
  private loadLanguageFromStorage(): Language {
    return StorageManager.get<Language>(StorageKeys.LANGUAGE, 'en');
  }

  /**
   * Save language to storage
   */
  private saveLanguageToStorage(lang: Language): void {
    StorageManager.set(StorageKeys.LANGUAGE, lang);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): Language {
    return this.currentLanguage;
  }

  /**
   * Set language
   */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    this.saveLanguageToStorage(lang);
    console.log('[LanguageModel] Language changed to:', lang);
  }

  /**
   * Toggle language (en <-> zh)
   */
  toggleLanguage(): Language {
    const newLang: Language = this.currentLanguage === 'en' ? 'zh' : 'en';
    this.setLanguage(newLang);
    return newLang;
  }

  /**
   * Load translations from constants
   * This should be called after TRANSLATIONS is imported
   */
  loadTranslations(translations: any): void {
    this.translations = translations;
    console.log('[LanguageModel] Translations loaded');
  }

  /**
   * Get translations for current language
   */
  getTranslations(): any {
    if (!this.translations) {
      console.warn('[LanguageModel] Translations not loaded yet');
      return {};
    }
    return this.translations[this.currentLanguage] || this.translations['en'] || {};
  }

  /**
   * Get translations for specific language
   */
  getTranslationsForLanguage(lang: Language): any {
    if (!this.translations) {
      console.warn('[LanguageModel] Translations not loaded yet');
      return {};
    }
    return this.translations[lang] || this.translations['en'] || {};
  }

  /**
   * Get translation value by path
   *
   * @example
   * getTranslation('header.titles.media') // "Static Resources - Media Browser"
   */
  getTranslation(path: string): string {
    const t = this.getTranslations();
    const keys = path.split('.');
    let value: any = t;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        console.warn(`[LanguageModel] Translation not found: ${path}`);
        return path;
      }
    }

    return typeof value === 'string' ? value : path;
  }

  /**
   * Check if translations are loaded
   */
  isLoaded(): boolean {
    return this.translations !== null;
  }
}

export const languageModel = new LanguageModel();
