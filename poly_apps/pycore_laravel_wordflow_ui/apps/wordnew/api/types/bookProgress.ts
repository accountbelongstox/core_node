/** Book reading progress stored server-side per (user, source_key). */
export interface WfNewBookReadingProgress {
  sourceKey: string;
  chapterIndex: number | null;
  verseSeq: number;
  grain: string;
  page: number;
  updatedAt?: string | null;
}

/** One step in the bilingual playback sequence (lang + repeat count). */
export interface WfNewReaderPlayStep {
  lang: string;
  repeat: number;
}

export type WfNewReaderDisplayMode = 'stacked' | 'interleaved';
