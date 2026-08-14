import type {
  DictionaryWordFilter,
  DictionaryWordRow,
  DictionaryWordSort,
} from '@/apps/laravel-manager/api';

export type VocabularyLanguageKey =
  | 'english'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'french'
  | 'german'
  | 'spanish';

export interface VocabularyLanguageOption {
  key: VocabularyLanguageKey;
  code: string;
}

export class VocabularyWordsModel {
  static readonly languages: readonly VocabularyLanguageOption[] = [
    { key: 'english', code: 'en' },
    { key: 'chinese', code: 'zh' },
    { key: 'japanese', code: 'ja' },
    { key: 'korean', code: 'ko' },
    { key: 'french', code: 'fr' },
    { key: 'german', code: 'de' },
    { key: 'spanish', code: 'es' },
  ];

  static readonly sortableColumns: readonly DictionaryWordSort[] = [
    'word',
    'translation',
    'phonetic',
    'audio',
    'queries',
    'is_valid',
  ];

  static readonly filters: readonly DictionaryWordFilter[] = [
    'all',
    'with_translation',
    'without_translation',
    'with_audio',
    'without_audio',
    'valid',
    'invalid',
  ];

  static languageCode(language: string): string {
    return this.languages.find((item) => item.key === language)?.code ?? language.slice(0, 2);
  }

  static languageLabel(language: string, labels: Record<VocabularyLanguageKey, string>): string {
    const option = this.languages.find((item) => item.key === language);
    return option ? labels[option.key] : language;
  }

  static rawValidityValue(row: DictionaryWordRow): string {
    if (row.is_valid_value === null) return 'null';
    return String(row.is_valid_value ?? row.is_valid);
  }

  static format(template: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
      (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
      template,
    );
  }
}
