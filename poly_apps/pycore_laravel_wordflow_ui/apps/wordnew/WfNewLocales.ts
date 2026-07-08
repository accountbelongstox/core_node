/* WordNew i18n - functionally modeled on apps/wordflow/WfLanguageCenter.ts
 * (the MECHANISM, not the UI): per-language flat-key dictionaries + a pure
 * translate(lang, key) lookup with English fallback. The active language is owned
 * by the shell (useShell().lang); this module only holds dictionaries + helpers.
 * Fallback chain: requested language -> English -> the raw key.
 *
 * Each language's dictionary lives in its own file under ./locales (keeps every
 * source file under the 800-line modular limit); this barrel composes them. */

import { enLocale } from './locales/en';
import { zhLocale } from './locales/zh';
import { jaLocale } from './locales/ja';
import { koLocale } from './locales/ko';

export const LOCALES: Record<string, Record<string, string>> = {
  en: enLocale,
  zh: zhLocale,
  ja: jaLocale,
  ko: koLocale,
};

// --- Language mechanism (mirrors WfLanguageCenter; en/zh/ja/ko only) ---------
export type WfNewSupportedLanguage = 'en' | 'zh' | 'ja' | 'ko';

export interface WfNewLanguageConfig {
  code: WfNewSupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const WF_NEW_LANGUAGE_CONFIGS: Record<WfNewSupportedLanguage, WfNewLanguageConfig> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
};

export function isSupported(lang: string): boolean {
  return lang in WF_NEW_LANGUAGE_CONFIGS;
}

export function getSupportedLanguages(): WfNewLanguageConfig[] {
  return Object.values(WF_NEW_LANGUAGE_CONFIGS);
}

export function getLanguageConfig(lang: string): WfNewLanguageConfig {
  return WF_NEW_LANGUAGE_CONFIGS[(isSupported(lang) ? lang : 'en') as WfNewSupportedLanguage];
}

/** Pure lookup: active-language value -> English fallback -> the raw key.
 * Supports {name} placeholder interpolation (same contract as WfLanguageCenter). */
export function translate(
  lang: string,
  key: string,
  replacements?: Record<string, string | number>
): string {
  const code = (isSupported(lang) ? lang : 'en') as WfNewSupportedLanguage;
  let value = LOCALES[code]?.[key] ?? LOCALES.en[key] ?? key;
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return value;
}
