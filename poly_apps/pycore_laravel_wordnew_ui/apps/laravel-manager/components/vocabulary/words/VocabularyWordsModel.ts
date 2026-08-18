import type {
  DictionaryWordFilter,
  DictionaryWordSort,
} from '@/apps/laravel-manager/api';
import {
  isWordRowValid,
  wordValidityDisplay,
  type WordValidityFields,
} from '@/core/integrations/laravel/wordValidity';

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

/** Minimal structural shape every validity-bearing row satisfies. */
export type ValidityFields = WordValidityFields;

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

  /**
   * Normalize the validity flag (boolean OR string marker). Delegates to the
   * shared core implementation — see core/integrations/laravel/wordValidity.
   */
  static isWordValid(row: ValidityFields): boolean {
    return isWordRowValid(row);
  }

  /**
   * Human-facing validity value: the string source marker (e.g. 'ai_ensure')
   * when present, otherwise the raw boolean stringified.
   */
  static rawValidityValue(row: ValidityFields): string {
    return wordValidityDisplay(row);
  }

  static format(template: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
      (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
      template,
    );
  }
}
