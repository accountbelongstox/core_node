import { en } from './locales/en';
import { zh } from './locales/zh';
import { TranslationDictionary } from './locales/en';
import { DEFAULT_LANGUAGE } from './languages';

/**
 * All translation dictionaries
 */
const translations: Record<string, TranslationDictionary> = {
  en,
  zh
  // More languages will be lazy-loaded
};

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate variables in translation string
 * Example: "Hello {{name}}" with {name: "World"} => "Hello World"
 */
function interpolate(str: string, vars: Record<string, any> = {}): string {
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}

/**
 * Translation function
 */
export function translate(
  key: string,
  language: string = DEFAULT_LANGUAGE,
  vars?: Record<string, any>
): string {
  const dict = translations[language] || translations[DEFAULT_LANGUAGE];
  const value = getNestedValue(dict, key);

  if (!value) {
    console.warn(`Translation missing for key: ${key} in language: ${language}`);
    return key;
  }

  return vars ? interpolate(value, vars) : value;
}

/**
 * Shorthand for translate
 */
export const t = translate;

/**
 * Get translation dictionary for a language
 */
export function getTranslations(language: string): TranslationDictionary {
  return translations[language] || translations[DEFAULT_LANGUAGE];
}

/**
 * Check if translation exists
 */
export function hasTranslation(key: string, language: string = DEFAULT_LANGUAGE): boolean {
  const dict = translations[language] || translations[DEFAULT_LANGUAGE];
  return getNestedValue(dict, key) !== undefined;
}

/**
 * Load translation dynamically (for lazy loading)
 */
export async function loadTranslation(language: string): Promise<void> {
  if (translations[language]) {
    return; // Already loaded
  }

  try {
    const module = await import(`./locales/${language}.ts`);
    translations[language] = module[language];
  } catch (error) {
    console.error(`Failed to load translation for language: ${language}`, error);
  }
}

/**
 * Preload commonly used languages
 */
export async function preloadLanguages(languages: string[]): Promise<void> {
  await Promise.all(languages.map(loadTranslation));
}

/**
 * Get all loaded languages
 */
export function getLoadedLanguages(): string[] {
  return Object.keys(translations);
}
