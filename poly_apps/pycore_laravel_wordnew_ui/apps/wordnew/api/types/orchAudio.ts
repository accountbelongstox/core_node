/** types/orchAudio.ts - orchestrated audio (pycore audio orchestration output
 * delivered to Laravel, `/api/app_qy_v1/orch_audio`) as read by the wordnew
 * listing and player pages. Contract: docs_fix/
 * DESIGN_AUDIO_ORCHESTRATION.md section 10. */

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

/** A play position in a composition (anchored on the clip it is in, so a newer edition still finds it). */
export interface WfNewOrchPlaybackPosition {
  segment: number;
  /** Seconds on the segment timeline. */
  time: number;
  /** Key of the clip at the position ('' when none). */
  anchor: string;
  /** Seconds into that clip. */
  offset: number;
  /** Text shown for the position (the card being spoken). */
  label: string;
  editionId: string;
  at: string;
}

export interface WfNewOrchPlaybackHistoryEntry extends WfNewOrchPlaybackPosition {
  id: string;
}

/** Per-user playback state of one client composition (Laravel `/orch_audio/client_playback`). */
export interface WfNewOrchClientPlaybackRow {
  clientTaskId: string;
  resume: WfNewOrchPlaybackPosition | null;
  history: WfNewOrchPlaybackHistoryEntry[];
  clientUpdatedAt: string;
}

export interface WfNewOrchClientPlaybackPage {
  items: WfNewOrchClientPlaybackRow[];
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

/** Per-node count of the plan clips a node generates now. */
export interface WfNewBookPlanNode {
  sid: string;
  label: string;
  platform: string;
  computeClass: string;
  count: number;
}

/** One window of an app-led assignment: `count` clips of `lane` in `language` for the node `sid` (or the direct pycore). */
export interface WfNewBookPlanWindow {
  sid: string;
  lane: string;
  language: string;
  count: number;
}

/** Per node and lane figures of the live assignment (contract book_plan.assignments_response). */
export interface WfNewBookPlanAssignmentWindow {
  sid: string;
  lane: string;
  assigned: number;
  generating: number;
  done: number;
}

export interface WfNewBookPlanAssignments {
  /** True while the app's heartbeat is live on the server (it honors the windows). */
  fresh: boolean;
  expiresIn: number;
  windows: WfNewBookPlanAssignmentWindow[];
}

/** Server counters of one book audio plan (contract book_plan.status_response). */
export interface WfNewBookPlanStatus {
  planId: string;
  state: 'building' | 'ready';
  total: number;
  ready: number;
  generating: number;
  queued: number;
  failed: number;
  /** Requested sentence languages that hold no clip yet on the server (empty when none). */
  emptyLanguages: string[];
  readyCursor: number;
  nodes: WfNewBookPlanNode[];
  fastPass: boolean;
  upgrade: { total: number; done: number };
  assignments: WfNewBookPlanAssignments;
  updatedAt: string;
}

export interface WfNewBookPlanRequest {
  sourceKey: string;
  chapterIndex: number | null;
  languages: string[];
  includeWords: boolean;
  /** Also the distinct phrases of the primary-language sentences (pattern with a `phrases` step). */
  includePhrases: boolean;
  position: number;
  planHash: string;
}

export interface WfNewBookPlanReadyPage {
  ids: string[];
  cursor: number;
  more: boolean;
}
