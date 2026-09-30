/** types/orchAudio.ts - orchestrated audio (pycore audio orchestration output
 * delivered to Laravel, `/api/app_qy_v1/orch_audio`) as read by the wordnew
 * listing and player pages. Contract: docs_fix/
 * REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md "W5 contract". */

/** Source ids come from the backend (`sources`); known ids get presentation. */
export type WfNewOrchAudioSource = 'vocab_book' | 'prompt_rewrite' | (string & {});

export interface WfNewOrchAudioSourceCount {
  id: WfNewOrchAudioSource;
  count: number;
}

export interface WfNewOrchAudioItem {
  /** Public task key. */
  id: string;
  taskId: string;
  source: WfNewOrchAudioSource;
  title: string;
  language: string;
  status: string;
  segmentCount: number;
  segmentsReady: number;
  sentenceCount: number;
  durationSec: number | null;
  previewText: string;
  sourceRef: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WfNewOrchAudioPage {
  items: WfNewOrchAudioItem[];
  total: number;
  page: number;
  perPage: number;
  sources: WfNewOrchAudioSourceCount[];
}

export interface WfNewOrchAudioTimelineEntry {
  seq: number | null;
  type: 'sentence' | 'word';
  startMs: number;
  endMs: number;
}

export interface WfNewOrchAudioSegment {
  index: number;
  /** Null until the segment mp3 is ready on Laravel. */
  url: string | null;
  /** Inclusive sentence positions (indexes into the ordered sentence list). */
  start: number;
  end: number;
  durationSec: number | null;
  /** Exact item offsets inside the mp3 ([] when pycore sent none). */
  timeline: WfNewOrchAudioTimelineEntry[];
}

export interface WfNewOrchAudioSentence {
  seq: number;
  /** 0-based index in the task's sentence list (segment start/end refer to it). */
  position: number;
  language: string;
  text: string;
  languages: Record<string, string>;
  audioUrl: string | null;
}

export interface WfNewOrchAudioSentencePage {
  items: WfNewOrchAudioSentence[];
  page: number;
  perPage: number;
  total: number;
}

export interface WfNewOrchAudioWord {
  word: string;
  language: string;
  audioUrl: string | null;
  audioStatus: string | null;
}

export interface WfNewOrchAudioDetail {
  item: WfNewOrchAudioItem;
  segments: WfNewOrchAudioSegment[];
  /** Sentence page 1; further pages load on demand (getOrchAudioSentencePage). */
  firstSentencePage: WfNewOrchAudioSentencePage;
  words: WfNewOrchAudioWord[];
  /** Original prompt / source text (prompt_rewrite). */
  sourceText: string | null;
}

/** Laravel copy of one client composition (`/orch_audio/client_tasks`). The
 * `config` document is owned by the wordnew composer and stored verbatim. */
export interface WfNewOrchClientTaskRow {
  clientTaskId: string;
  name: string;
  source: string;
  language: string;
  sourceRef: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  /** The client's progress summary (stored by Laravel, never interpreted). */
  progress: Record<string, unknown> | null;
  planHash: string;
  status: string;
  segmentCount: number;
  itemCount: number;
  durationMs: number;
  deviceId: string;
  clientUpdatedAt: string;
  deleted: boolean;
}

export interface WfNewOrchClientTaskPage {
  items: WfNewOrchClientTaskRow[];
  total: number;
  page: number;
  perPage: number;
  serverTime: string | null;
}

export interface WfNewOrchClientTaskWrite {
  row: WfNewOrchClientTaskRow;
  /** False when Laravel held a newer edit; `row` is then the stored one. */
  applied: boolean;
}
