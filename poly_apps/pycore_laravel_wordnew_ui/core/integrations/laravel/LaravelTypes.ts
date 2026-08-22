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

/** Relay plane contracts (pycore UI <-> machine relay through the central server). */

export interface RelayMachineRecord {
  machine_id: string;
  label: string;
  capabilities: string[];
  hostname?: string;
  platform?: string;
  registered_at?: string;
  last_heartbeat_at?: string;
}

export interface RelayCapabilityProvider {
  id: string;
  class: string;
  implemented: boolean;
  provides: string[];
}

export interface RelayMachinesResponse {
  machines: RelayMachineRecord[];
  capability_providers: RelayCapabilityProvider[];
  heartbeat_seconds: number;
}

export interface RelayHubToken {
  transport: string;
  hub_url: string;
  topics: string[];
  subscribe_url: string;
  token: string;
  token_ttl_seconds: number;
  cookie: string;
}

export interface RelayPairResponse {
  pair: { machine_id: string; session_id: string; expires_at: string };
  hub: RelayHubToken;
}

export interface RelayRequestFrame {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string | null;
  body_ref?: string | null;
}

export interface RelayRequestResponse {
  request: { request_id: string; method: string; path: string; size: number };
  poll_interval_ms: number;
}

export interface RelayStoredResponse {
  request_id: string;
  status: number;
  headers: Record<string, string>;
  body: string | null;
  body_ref: string | null;
}
