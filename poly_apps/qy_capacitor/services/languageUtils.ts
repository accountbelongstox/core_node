/**
 * Language Utilities
 * Shared helper functions for language detection and processing
 */

/**
 * Infer language from word characters
 * Detects language based on Unicode character ranges
 *
 * @param words - Array of word objects with 'word' property
 * @returns Language code ('zh'|'ja'|'ko'|'en') or null if cannot determine
 */
export function inferLanguageFromWords(words: any[]): string | null {
  if (!words || words.length === 0) return null;

  // Check first word for language detection
  const firstWord = words[0]?.word || '';

  if (!firstWord) return null;

  // Chinese: U+4E00 to U+9FFF
  if (/[\u4e00-\u9fa5]/.test(firstWord)) return 'zh';

  // Japanese: Hiragana (U+3040-U+309F) or Katakana (U+30A0-U+30FF)
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(firstWord)) return 'ja';

  // Korean: Hangul (U+AC00-U+D7AF)
  if (/[\uac00-\ud7af]/.test(firstWord)) return 'ko';

  // Default to English for Latin characters
  return 'en';
}

/**
 * Backend Group Response Type
 * Defines the structure of group data returned from backend API
 */
export interface BackendGroupData {
  gid: string;
  gname: string;
  total_words?: number;
  gwords?: any[];
  words_frequency?: Record<string, number>;
  created_at?: string;
  updated_at?: string;
  // Optional fields that may be added in future
  type?: 'system' | 'user' | 'document';
  progress?: number;
  language?: string;
  cover_image?: string;
  description?: string;
}

/**
 * Backend Groups API Response Type
 * The complete response structure from /query_all_groups endpoint
 */
export interface BackendGroupsResponse {
  success: boolean;
  data: {
    uid: string;
    total: number;
    groups: BackendGroupData[];
  };
  message?: string;
}
