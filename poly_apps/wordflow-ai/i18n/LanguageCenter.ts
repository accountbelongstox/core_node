/**
 * Language Center - Unified i18n Management
 * Centralized multi-language support with type safety
 */

import { en, TranslationKey } from './locales/en';
import { zh } from './locales/zh';
import { StorageCenter, StorageKey } from '../services/StorageCenter';

export type SupportedLanguage = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
};

const translations: Record<string, TranslationKey> = {
  en,
  zh,
  // Placeholders for other languages (fallback to English)
  ja: en,
  ko: en,
  es: en,
  fr: en,
  de: en,
};

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

type TranslationPath = NestedKeyOf<TranslationKey>;

class LanguageCenterClass {
  private currentLanguage: SupportedLanguage = 'en';
  private listeners: Array<(lang: SupportedLanguage) => void> = [];

  constructor() {
    // Load saved language from storage
    const savedLang = StorageCenter.language.getAppLanguage();
    if (savedLang && this.isSupported(savedLang as SupportedLanguage)) {
      this.currentLanguage = savedLang as SupportedLanguage;
    }
  }

  /**
   * Get translation by key path
   */
  t(keyPath: string, replacements?: Record<string, string | number>): string {
    const keys = keyPath.split('.');
    let value: any = translations[this.currentLanguage];

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        // Fallback to English if key not found
        console.warn(`[LanguageCenter] Translation key not found: ${keyPath} in ${this.currentLanguage}`);
        value = this.getEnglishFallback(keyPath);
        break;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`[LanguageCenter] Translation value is not a string: ${keyPath}`);
      return keyPath;
    }

    // Replace placeholders
    if (replacements) {
      Object.entries(replacements).forEach(([key, val]) => {
        value = value.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
      });
    }

    return value;
  }

  /**
   * Get English fallback
   */
  private getEnglishFallback(keyPath: string): string {
    const keys = keyPath.split('.');
    let value: any = en;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return keyPath;
      }
    }

    return typeof value === 'string' ? value : keyPath;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * Get language config
   */
  getLanguageConfig(lang?: SupportedLanguage): LanguageConfig {
    return LANGUAGE_CONFIGS[lang || this.currentLanguage];
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): LanguageConfig[] {
    return Object.values(LANGUAGE_CONFIGS);
  }

  /**
   * Check if language is supported
   */
  isSupported(lang: string): boolean {
    return lang in LANGUAGE_CONFIGS;
  }

  /**
   * Set current language
   */
  setLanguage(lang: SupportedLanguage): boolean {
    if (!this.isSupported(lang)) {
      console.error(`[LanguageCenter] Unsupported language: ${lang}`);
      return false;
    }

    this.currentLanguage = lang;
    StorageCenter.language.setAppLanguage(lang);

    // Notify listeners
    this.listeners.forEach(listener => listener(lang));

    return true;
  }

  /**
   * Subscribe to language changes
   */
  subscribe(listener: (lang: SupportedLanguage) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get translations for specific category
   */
  getCategory(category: keyof TranslationKey): Record<string, string> {
    return translations[this.currentLanguage][category] as any;
  }

  /**
   * Format number according to locale
   */
  formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
    const locale = this.getLocale();
    return new Intl.NumberFormat(locale, options).format(num);
  }

  /**
   * Format date according to locale
   */
  formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const locale = this.getLocale();
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, options).format(d);
  }

  /**
   * Format relative time
   */
  formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return this.t('common.justNow') || 'Just now';
    if (minutes < 60) return `${minutes} ${this.t('common.minutesAgo') || 'minutes ago'}`;
    if (hours < 24) return `${hours} ${this.t('common.hoursAgo') || 'hours ago'}`;
    if (days < 7) return `${days} ${this.t('common.daysAgo') || 'days ago'}`;

    return this.formatDate(d, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * Get locale string for Intl APIs
   */
  private getLocale(): string {
    const localeMap: Record<SupportedLanguage, string> = {
      en: 'en-US',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
    };
    return localeMap[this.currentLanguage] || 'en-US';
  }
}

export const LanguageCenter = new LanguageCenterClass();

// Export convenience hook for React components
export const useTranslation = () => {
  return {
    t: (keyPath: string, replacements?: Record<string, string | number>) =>
      LanguageCenter.t(keyPath, replacements),
    currentLanguage: LanguageCenter.getCurrentLanguage(),
    setLanguage: (lang: SupportedLanguage) => LanguageCenter.setLanguage(lang),
    languages: LanguageCenter.getSupportedLanguages(),
  };
};
