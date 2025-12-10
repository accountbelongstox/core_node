/**
 * i18n Type Definitions
 */

export type Language = 'en' | 'zh' | 'lo' | 'ja';

export interface Translations {
  [key: string]: string | Translations;
}

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

export const languages: LanguageInfo[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
  },
  {
    code: 'lo',
    name: 'Lao',
    nativeName: 'ລາວ',
    flag: '🇱🇦',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
  },
];

