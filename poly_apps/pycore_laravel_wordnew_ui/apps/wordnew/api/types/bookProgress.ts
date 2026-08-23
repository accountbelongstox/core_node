/** Book reading progress stored server-side per (user, source_key). */
export interface WfNewBookReadingProgress {
  sourceKey: string;
  chapterIndex: number | null;
  verseSeq: number;
  grain: string;
  page: number;
  updatedAt?: string | null;
}

export type WfNewDailyReadingSelectionMode = 'latest' | 'resume' | 'random';

export interface WfNewDailyReadingProgress {
  articleId: string | null;
  selectionMode: WfNewDailyReadingSelectionMode;
  updatedAt?: string | null;
}

export interface WfNewDailyReadingResourcePreviewSettings {
  playbackMode: 'sequential' | 'repeat-all' | 'repeat-one' | 'shuffle';
  wordMode: 'off' | 'new' | 'all';
  wordOrder: 'sentence' | 'shuffle' | 'alpha';
  newOnlyMaxReadCount: number;
  underlineCurrentSentence: boolean;
  bilingual: boolean;
  sentenceRate: number;
  wordRate: number;
  playbackPattern: Array<{
    id: string;
    type: 'sentence' | 'words';
    lang?: 'en' | 'cn';
    times: number;
  }>;
}

export interface WfNewDailyReadingResourcePreview {
  user: { id: number; username: string };
  article: {
    id: string;
    title_en: string;
    title_cn: string | null;
    language: string;
    word_count: number;
  };
  target_word_group: {
    id: string;
    name: string;
    language: string;
    is_language_default: boolean;
  } | null;
  settings: WfNewDailyReadingResourcePreviewSettings;
  resources: {
    new_words: Array<Record<string, unknown>>;
    selected_words: Array<Record<string, unknown>>;
    sentence_table: Array<Record<string, unknown>>;
    audio: Record<string, unknown>;
    playback_items: Array<Record<string, unknown>>;
  };
}

export interface WfNewDailyReadingResourcePreviewResult {
  resource: WfNewDailyReadingResourcePreview;
  apiUrl: string;
  expiresAt: string;
}

/** One step in the bilingual playback sequence (lang + repeat count). */
export interface WfNewReaderPlayStep {
  lang: string;
  repeat: number;
}

export type WfNewReaderDisplayMode = 'stacked' | 'interleaved';
