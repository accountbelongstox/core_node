/* [v4.1-Iris] WfLanguageCenter — i18n for the wordflow end.
 * Ported from poly_apps/qy_capacitor/i18n/LanguageCenter.ts but self-contained
 * and shell-driven: the active app language is owned by the shell
 * (useShell().lang), not a private subscription. This module only holds the
 * translation dictionaries + a pure `translate(lang, key)` lookup with English
 * fallback. The React-facing `useWfT()` / `t()` live in WfAppContext, bound to
 * useShell().lang so a shell language switch re-renders every consumer.
 *
 * Dictionaries live in ./wf-locales (one file per language, all seven
 * supported codes fully ported: en/zh/ja/ko/es/fr/de, key sets mirror ./en
 * 1:1). Fallback chain: requested language → English → the raw key. */

import { en } from './wf-locales/en';
import type { WfTranslationDict } from './wf-locales/en';
import { zh } from './wf-locales/zh';
import { ja } from './wf-locales/ja';
import { ko } from './wf-locales/ko';
import { es } from './wf-locales/es';
import { fr } from './wf-locales/fr';
import { de } from './wf-locales/de';

export type WfSupportedLanguage = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de';

export interface WfLanguageConfig {
  code: WfSupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const WF_LANGUAGE_CONFIGS: Record<WfSupportedLanguage, WfLanguageConfig> = {
  en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  zh: { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ko: { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
};

const TRANSLATIONS: Record<WfSupportedLanguage, WfTranslationDict> = {
  en,
  zh,
  ja,
  ko,
  es,
  fr,
  de,
};

function lookup(dict: any, keyPath: string): string | undefined {
  const keys = keyPath.split('.');
  let value: any = dict;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) value = value[key];
    else return undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

/** Pure lookup: active-language value → English fallback → the raw key. */
export function translate(
  lang: string,
  keyPath: string,
  replacements?: Record<string, string | number>
): string {
  const code = (isSupported(lang) ? lang : 'en') as WfSupportedLanguage;
  let value = lookup(TRANSLATIONS[code], keyPath) ?? lookup(en, keyPath) ?? keyPath;
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }
  return value;
}

export function isSupported(lang: string): boolean {
  return lang in WF_LANGUAGE_CONFIGS;
}

export function getSupportedLanguages(): WfLanguageConfig[] {
  return Object.values(WF_LANGUAGE_CONFIGS);
}

export function getLanguageConfig(lang: string): WfLanguageConfig {
  return WF_LANGUAGE_CONFIGS[(isSupported(lang) ? lang : 'en') as WfSupportedLanguage];
}
