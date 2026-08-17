/** Contracts owned by Laravel-facing UI operations. */

import type {
  PcQueueCategory,
  PcQueueHandler,
  PcQueueWorker,
} from '../../contracts/QueueCenterContract';

export interface LaravelVocabTranslateRequest {
  text: string;
  source_language?: string;
  target_language: string;
  [key: string]: unknown;
}

export interface LaravelVocabTtsGenerateRequest {
  text: string;
  language?: string;
  [key: string]: unknown;
}

export interface LaravelSentenceVoiceVariant {
  lang: string;
  variant_key: string;
  accent: string | null;
  gender: string;
  is_primary: boolean;
}

export interface LaravelTranslationStackItem {
  word: string;
  status: 'queued' | 'moved_to_front' | 'already_translated' | 'skipped_invalid' | string;
  task_id?: string | null;
}

export interface LaravelTranslationStackResult {
  success?: boolean;
  error?: string;
  moved: number;
  queued: number;
  skipped: number;
  task_ids: string[];
  results: LaravelTranslationStackItem[];
}

/** Vocabulary contracts (Laravel native response shapes). */

export interface VocabLanguageInfo {
  code: string;
  name: string;
  native?: string;
}

/** One dictionary word row (the Words tab table). */
export interface VocabDictionaryWordRow {
  md5?: string;
  content?: string;
  word?: string;
  language?: string;
  has_translation?: boolean;
  has_audio?: boolean;
  /** Validity flag; AI-verified rows may carry a string marker (validity source). */
  is_valid?: boolean | string;
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
  /** Validity flag; AI-verified rows may carry a string marker (validity source). */
  is_valid?: boolean | string;
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

export type VocabAssistCategory = PcQueueCategory;

/** Shared Laravel assist overview contracts. */
export type AssistQueueHandler = PcQueueHandler;
export type AssistQueueCategory = PcQueueCategory;
export type AssistQueueWorker = PcQueueWorker;

export interface AssistOverviewResponse {
  success: boolean;
  generated_at?: string;
  categories: AssistQueueCategory[];
  workers: AssistQueueWorker[];
  error?: string;
}

export interface AssistCategoryItemsResponse {
  success: boolean;
  category: string;
  status?: string | null;
  total: number;
  start: number;
  limit: number;
  items: any[];
  error?: string;
}
