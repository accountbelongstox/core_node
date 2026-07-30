/** One high-frequency word in a book analysis result. */
export interface BookTopWord {
  word: string;
  count: number;
}

/** One chapter shared by the Laravel and Pycore book clients. */
export interface BookChapter {
  chapter_index: number;
  sentence_count?: number;
  title?: string | null;
  titles?: Record<string, string | null>;
}

/** One multilingual correspondence slot in a book. */
export interface BookSlot {
  corr_id: string;
  grain: 'cue' | 'sentence';
  seq: number;
  chapter_index?: number;
  primary_language?: string | null;
  langs: Record<string, string | null>;
}
