/**
 * Shared vocabulary service contracts exposed by Pycore.
 *
 * Pycore HTTP API vocabulary routes proxy Laravel server-side, so these shapes
 * mirror Laravel's native responses (the
 * backend-confirmed response shapes. Every
 * response carries a `success` flag; when laravel is unreachable pycore returns
 * {success:false, error} and the HTTP client surfaces it (the page try/catches).
 */

import type { PcQueueCategory } from './QueueCenterContract';

/** Base envelope every proxied response shares. */
export interface VocabProxyEnvelope {
  success: boolean;
  error?: string;
  [k: string]: unknown;
}

export interface VocabLanguageInfo {
  code: string;
  name: string;
  native?: string;
}
export type VocabLanguagesResponse = VocabProxyEnvelope & { languages?: VocabLanguageInfo[] };

export interface VocabTranslateRequest {
  text: string;
  source_language?: string;
  target_language: string;
  [k: string]: unknown;
}
export interface VocabTranslateResponse {
  success: boolean;
  translated_text?: string;
  original_text?: string;
  source_language?: string;
  target_language?: string;
  detected_language?: string;
  error?: string;
}

export interface VocabTtsGenerateRequest {
  text: string;
  language?: string;
  [k: string]: unknown;
}
export interface VocabTtsGenerateResponse {
  success: boolean;
  audio_url?: string;
  audio_base64?: string;
  mime?: string;
  provider?: string;
  error?: string;
  [k: string]: unknown;
}

/** One dictionary word row (the Words tab table). */
export interface VocabDictionaryWordRow {
  md5?: string;
  content?: string;
  word?: string;
  language?: string;
  has_translation?: boolean;
  has_audio?: boolean;
  is_valid?: boolean;
  translations?: string[];
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
  audio_url?: string;
  audio_available?: boolean;
  query_count?: number;
  validity_note?: string;
  validity_source?: string;
  tts_status?: string;
  tts_provider?: string;
  translation_provider?: string;
  [k: string]: unknown;
}
export interface VocabDictionaryWordsResponse {
  success: boolean;
  total?: number;
  start?: number;
  limit?: number;
  items?: VocabDictionaryWordRow[];
  error?: string;
}

export interface VocabLibrary {
  id: number;
  name: string;
  language?: string;
  word_count?: number;
  difficulty?: string;
  cover_url?: string;
  cover_status?: string;
  [k: string]: unknown;
}
export type VocabLibrariesResponse = VocabProxyEnvelope & {
  libraries?: VocabLibrary[];
  data?: VocabLibrary[];
};

export interface VocabLibraryWordRow {
  word?: string;
  md5?: string;
  translations?: string[];
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
  explanation?: string;
  audio_url?: string;
  audio_available?: boolean;
  has_translation?: boolean;
  has_audio?: boolean;
  has_image?: boolean;
  is_valid?: boolean;
  validity_note?: string;
  [k: string]: unknown;
}
export interface VocabLibraryWordsResponse {
  success: boolean;
  words?: VocabLibraryWordRow[];
  data?: VocabLibraryWordRow[];
  stats?: {
    total?: number;
    translated?: number;
    with_audio?: number;
    with_image?: number;
    invalid?: number;
  };
  pagination?: {
    current_page?: number;
    per_page?: number;
    total?: number;
    last_page?: number;
    has_more?: boolean;
  };
  error?: string;
}

export interface VocabStatisticsResponse {
  success: boolean;
  summary?: {
    total_languages?: number;
    total_libraries?: number;
    total_words?: number;
    tts_percentage?: number;
  };
  languages?: Array<Record<string, unknown>>;
  error?: string;
  [k: string]: unknown;
}

export interface VocabLanguageBreakdownRow {
  language?: string;
  words?: number;
  translations?: number;
  audio?: number;
  invalid?: number;
  [k: string]: unknown;
}
export type VocabLanguageBreakdownResponse = VocabProxyEnvelope & {
  languages?: VocabLanguageBreakdownRow[];
  breakdown?: VocabLanguageBreakdownRow[];
};

export interface VocabTtsQueueStats {
  success: boolean;
  by_status?: { pending?: number; processing?: number; completed?: number; failed?: number };
  by_type?: { word?: number; sentence?: number; article?: number };
  total?: number;
  current_concurrent?: number;
  total_success?: number;
  total_retries?: number;
  error?: string;
  [k: string]: unknown;
}
export type VocabTtsQueueItemsResponse = VocabProxyEnvelope & {
  items?: Array<Record<string, unknown>>;
  data?: Array<Record<string, unknown>>;
};

export type VocabAssistCategory = PcQueueCategory;
export interface VocabAssistOverviewResponse {
  success: boolean;
  generated_at?: string;
  categories?: VocabAssistCategory[];
  workers?: Array<Record<string, unknown>>;
  error?: string;
}
