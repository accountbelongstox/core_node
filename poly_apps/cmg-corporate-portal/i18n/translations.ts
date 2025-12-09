/**
 * Unified i18n Translation System
 * Main entry point for all translations
 */

import { Language, Translations } from './types';
import { en } from './locales/en';
import { zh } from './locales/zh';

// Import other languages when ready
// import { lo } from './locales/lo';
// import { ja } from './locales/ja';

export const translations: Record<Language, Translations> = {
  en,
  zh,
  // Placeholder for future languages
  lo: en, // Temporary: use English until Lao translations are ready
  ja: en, // Temporary: use English until Japanese translations are ready
};

/**
 * Get nested translation value by dot-notation key
 * Example: t('nav.home') => 'Reserve'
 */
export function getTranslation(lang: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  // Fallback to English if language not found
  if (!value) {
    value = translations.en;
  }
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Try fallback to English
      if (lang !== 'en') {
        let fallbackValue: any = translations.en;
        for (const fallbackKey of keys.slice(0, keys.indexOf(k) + 1)) {
          if (fallbackValue && typeof fallbackValue === 'object' && fallbackKey in fallbackValue) {
            fallbackValue = fallbackValue[fallbackKey];
          } else {
            return key; // Return key if translation not found
          }
        }
        return typeof fallbackValue === 'string' ? fallbackValue : key;
      }
      return key; // Return key if translation not found
    }
  }
  
  return typeof value === 'string' ? value : key;
}
