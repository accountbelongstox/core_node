/** Client-side orchestration (docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md). */
import type { OrchResourceKind } from '../../../../core/integrations/pycore';

export type OrchComposeStepType = 'sentence_en' | 'sentence_zh' | 'words_new' | 'words_all';
export type OrchComposeSource = 'vocab_book' | 'prompt_rewrite';
export type OrchComposeSegmentMode = 'count' | 'minutes';
export type OrchComposeLanguages = 'both' | 'en' | 'zh';
export type OrchComposeStatus = 'draft' | 'resolving' | 'ready' | 'partial';

export interface OrchComposeStep {
  type: OrchComposeStepType;
  times: number;
}

export interface OrchComposeBookRef {
  sourceKey: string;
  title: string;
  language: string;
  targetLanguage: string;
  chapterIndex: number | null;
}

/** Everything that shapes the plan; `plan_hash` is computed from it. */
export interface OrchComposeConfig {
  pattern: OrchComposeStep[];
  segmentMode: OrchComposeSegmentMode;
  segmentValue: number;
  newOnlyMaxReadCount: number;
  languages: OrchComposeLanguages;
  presetId: string;
  book: OrchComposeBookRef | null;
  /** Pasted text of a prompt composition (one sentence per line after split). */
  sourceText: string;
}

export interface OrchComposeTask {
  id: string;
  name: string;
  source: OrchComposeSource;
  language: string;
  config: OrchComposeConfig;
  status: OrchComposeStatus;
  planHash: string;
  segmentCount: number;
  itemCount: number;
  durationMs: number;
  deviceId: string;
  /** ISO time of the last local edit (sync ordering). */
  updatedAt: string;
  deleted: boolean;
  /** Pushed to Laravel with the current `updatedAt`. */
  synced: boolean;
}

export interface OrchComposeSentence {
  seq: number;
  text: string;
  language: string;
  languages: Record<string, string>;
  /** Laravel audio URL per language when the source already carries one. */
  audio: Record<string, string>;
}

export interface OrchComposeItem {
  kind: OrchResourceKind;
  language: string;
  text: string;
  /** Sentence position in the task's sentence list. */
  position: number;
  seq: number;
}

export interface OrchComposeSegment {
  index: number;
  start: number;
  end: number;
  estSeconds: number;
  items: OrchComposeItem[];
}

export interface OrchComposePlan {
  segments: OrchComposeSegment[];
  sentences: OrchComposeSentence[];
  /** Unique resources in first-use order. */
  resources: OrchComposeResource[];
}

export interface OrchComposeResource {
  key: string;
  kind: OrchResourceKind;
  language: string;
  text: string;
  /** Laravel URL known from the source (verse audio), if any. */
  laravelUrl: string | null;
}

export type OrchClipOrigin = 'device' | 'pycore' | 'laravel';

export interface OrchResolvedClip {
  key: string;
  /** Playable URL: device file, object URL, or the Laravel URL on the web. */
  url: string;
  origin: OrchClipOrigin;
  meaning: string;
}

export interface OrchResolveCounts {
  total: number;
  device: number;
  pycore: number;
  laravel: number;
  missing: number;
  pending: number;
}

/** Word read state from Laravel `learning/sentence-words`. */
export interface OrchWordState {
  word: string;
  readCount: number;
  audioUrl: string | null;
  meaning: string;
}
