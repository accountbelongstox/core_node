/**
 * Book / CoreBook / queue response types for pycoreApi.
 */
import type {
  QueueItem,
} from './PycorePlatformTypes';
import { rewritePycoreEndpoint } from './pycoreTarget';
import type { BookChapter, BookSlot, BookTopWord } from '../../contracts/books';

export type { BookChapter, BookSlot, BookTopWord } from '../../contracts/books';

export interface QueueResponse {
  success: boolean;
  items?: QueueItem[];
  currentIndex?: number;
  enabled?: boolean;
  total?: number;
  nextOffset?: number | null;
  error?: string;
}

export interface RuntimeInfo { eventUrl: string; apiBase: string; }

// --- voice-subtitle snapshot mapping ------------------------------------- #
// pycore freeform category string -> React QueueItem category badge.
function mapCategory(c: string): QueueItem['category'] {
  const m: Record<string, QueueItem['category']> = {
    normal: 'Voice', voice: 'Voice', text: 'Voice',
    image: 'Image', file: 'File', task: 'Task', video: 'Video', window: 'Window',
  };
  return m[(c || '').toLowerCase()] || 'Voice';
}

/**
 * Map a raw pycore queue snapshot ({queue, current_index, enabled} — the shape
 * of both GET /voice-subtitle/queue and the `voice_subtitle_queue_update` HTTP
 * event) to the React QueueResponse. Indices are 0-BASED to stay aligned with
 * the backend's current_index / set-index / remove-items contract.
 */
export function mapQueueSnapshot(data: any): QueueResponse {
  const raw: any[] = Array.isArray(data?.queue) ? data.queue : [];
  const items: QueueItem[] = raw.map((it: any, i: number) => {
    const itemIndex = typeof it?.index === 'number' ? it.index : i;
    return {
      id: `item_${itemIndex}`,
      index: itemIndex,
      text: it?.text || '',
      category: mapCategory(it?.category),
      playCount: it?.play_count || 0,
      created: it?.created_at || '',
      // The pipeline fills audio_path when TTS synthesis finished; until then the
      // item is still being processed (no more hardcoded "completed").
      status: it?.audio_path ? 'completed' : 'processing',
      audioUrl: it?.audio_path
        ? rewritePycoreEndpoint(`/voice-subtitle/audio?path=${encodeURIComponent(it.audio_path)}`)
        : undefined,
      metadata: {
        lang: it?.lang,
        // Which AI produced this item's text (gateway attribution), if any.
        ai: it?.ai_provider
          ? `${it.ai_provider}${it.ai_model ? `/${it.ai_model}` : ''}`
          : undefined,
      },
    };
  });
  return {
    success: data?.success !== false,
    items,
    currentIndex: typeof data?.current_index === 'number' ? data.current_index : 0,
    enabled: data?.enabled === true,
    total: typeof data?.total === 'number' ? data.total : items.length,
    nextOffset: typeof data?.next_offset === 'number' ? data.next_offset : null,
  };
}

export interface SystemSettingsResponse {
  success: boolean;
  settings: Record<string, unknown> | null;
  error?: string;
}

// --- Books document analyze/preview (pycore /api/local/books) ------------- #
export interface BookLanguageRow { script: string; code: string; chars: number; ratio: number; }
export interface BookTextStats {
  char_count: number; char_count_no_space: number;
  word_count: number; unique_word_count: number;
  sentence_count: number; unique_sentence_count: number;
  line_count: number; paragraph_count: number;
  primary_language: string; languages: BookLanguageRow[];
  top_words: BookTopWord[]; truncated: boolean;
}
export interface BookFileEntry { path: string; rel: string; name: string; ext: string; size_bytes: number; }
export interface BooksScanResponse {
  success: boolean; root: string; mode: 'file' | 'folder' | '';
  files: BookFileEntry[]; count: number;
  formats: string[]; supported_formats: string[]; error?: string;
}
export interface BookFileAnalysis {
  path: string; rel: string; name: string; ext: string; size_bytes: number;
  stats: BookTextStats | null; preview: string; error?: string | null;
}
export interface BooksAnalyzeResponse {
  success: boolean; root: string; mode: 'file' | 'folder' | '';
  files: BookFileAnalysis[]; aggregate: BookTextStats | null;
  scanned: number; analyzed: number; truncated_files: boolean; error?: string;
}
export interface BooksSupportedFormatsResponse { success: boolean; formats: string[]; error?: string; }
export interface BooksAnalyzeOptions { formats?: string[]; language?: string; languages?: string[]; preview_chars?: number; max_files?: number; persist?: boolean; }

// --- Books chapter -> correspondence-slot tree (spec v3 §7/§9) ----------- #
// A book is rendered as Chapter[] -> Slot[]. Each slot is a single
// correspondence cell shared across the checked languages: `langs[code]` is the
// text for that language, or `null` where the book has no correspondence (the
// FE renders a blank). `grain` preserves the prior sentence typing (cue/sentence).
export interface BookSourceState {
  path: string; mode: string; source_key: string; language?: string | null;
  submission_state: 'draft' | 'synced'; added_at?: number | null;
  analyzed_at?: number | null; synced_at?: number | null;
  summary?: { scanned: number; analyzed: number; mode: string; aggregate: BookTextStats | null; files: any[] } | null;
}
export interface BooksStateResponse { success: boolean; sources: BookSourceState[]; last_options: Record<string, unknown>; error?: string; }
export interface BookSubmitItem { path: string; files: number; sentences: number; words: number; success: boolean; errors?: string[] | null; }
export interface BooksSubmitResponse { success: boolean; items: BookSubmitItem[]; total_sentences: number; total_words: number; error?: string; }
export interface BooksListResponse {
  success: boolean; kind: string; total: number; start: number; limit: number;
  items: any[]; totals: Record<string, number>;
  // When kind === 'chapters' the items are BookChapter[]; when listing sentences
  // scoped to a chapter the items are BookSlot[] (selected_languages echoes the
  // checked language set so the tree can render every column, blank where null).
  chapters?: BookChapter[];
  selected_languages?: string[];
  error?: string;
}

// --- CoreBook portable format (pycore /api/local/corebook) ---------------- #
export interface CoreBookCompletenessLang { text: number; audio: number; }
export interface CoreBookMissing { kind: 'language' | 'audio'; language: string; count: number; }
export interface CoreBookCompleteness {
  languages: Record<string, CoreBookCompletenessLang>;
  missing: CoreBookMissing[];
}
export interface CoreBookSummary {
  source_key?: string;
  source_type: string;
  title?: string;
  language?: string;
  selected_languages: string[];
  chapter_count: number;
  slot_count: number;
  completeness: CoreBookCompleteness;
  updated_at?: number;
}
export interface CoreBookListResponse { success: boolean; items: CoreBookSummary[]; error?: string; }
export interface CoreBookConvertRequest {
  path: string; language?: string; languages?: string[]; source_type?: string; text?: string;
}
export interface CoreBookConvertResponse { success: boolean; summary?: CoreBookSummary; error?: string; }
export interface CoreBookGetResponse {
  success: boolean; summary?: CoreBookSummary;
  source: Record<string, unknown>; chapters: BookChapter[]; slots: BookSlot[];
  total_slots: number; start: number; limit: number; error?: string;
}
export interface CoreBookDeleteResponse { success: boolean; removed: boolean; error?: string; }
export interface CoreBookAddLanguageRequest {
  source_key: string; target_language: string; source_language?: string;
  provider?: string; chunk_size?: number; grain?: string;
}
export interface CoreBookFillAudioRequest {
  source_key: string; languages: string[]; rate?: string; grain?: string;
}
export interface CoreBookEnrichResponse {
  success: boolean; result: Record<string, any>; summary?: CoreBookSummary; error?: string;
}
export interface CoreBookSubmitRequest {
  source_key: string; upload_audio?: boolean; request_assist?: boolean;
  assist_items?: { request_type: string; language?: string }[];
}
export interface CoreBookSubmitResponse { success: boolean; result: Record<string, any>; error?: string; }
