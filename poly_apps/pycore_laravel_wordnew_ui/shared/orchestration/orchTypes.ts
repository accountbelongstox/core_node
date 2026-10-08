/**
 * Client-side orchestration types, shared by every end that composes (wordnew
 * on the phone / web, the pycore UI). docs_fix/DESIGN_WORDNEW_CLIENT.md
 */
import type { OrchResourceKind } from '../../core/integrations/pycore';
import type { OrchClipIdentity } from './orchClipIdentity';
import type { AudioOrchStepType } from '../../core/contracts/AudioOrchestrationContract';

/** Step types of the shared contract (config/audio_orchestration_contract.json). */
export type OrchComposeStepType = AudioOrchStepType;
/** `passages`: a composition made of short-passage entries only (no book, no prompt). */
export type OrchComposeSource = 'vocab_book' | 'prompt_rewrite' | 'passages';
export type OrchComposeSegmentMode = 'count' | 'minutes';
export type OrchComposeLanguages = 'both' | 'en' | 'zh';
export type OrchComposeStatus = 'draft' | 'resolving' | 'ready' | 'partial';

export interface OrchComposeStep {
  type: OrchComposeStepType;
  times: number;
  /** Word and phrase steps: after each word / phrase, read its short Chinese meaning. */
  meaning?: boolean;
}

export interface OrchComposeBookRef {
  sourceKey: string;
  title: string;
  language: string;
  targetLanguage: string;
  chapterIndex: number | null;
}

/** A prompt-rewrite result held by the API side (Laravel orch_audio task, source prompt_rewrite). */
export interface OrchComposePromptRef {
  taskKey: string;
  title: string;
  language: string;
}

/** Where a short passage comes from: an agent / daily-reading article, or a prompt-rewrite result. */
export type OrchPassageStore = 'article' | 'prompt';

/**
 * One short-passage entry of a composition. The entries follow the book / prompt source in order; each
 * entry is a segment of its own. An `article` entry keeps its text with the entry (the passage is
 * self-contained on every device and in the Laravel copy); a `prompt` entry is loaded by its task key.
 */
export interface OrchComposePassageRef {
  store: OrchPassageStore;
  /** Article id, or the prompt-rewrite task key. */
  id: string;
  title: string;
  language: string;
  /** `article` entries: the passage text in `language`. */
  text?: string;
  /** `article` entries: the Chinese reference text. */
  textZh?: string;
  /**
   * Chinese lines of the entry's sentences that have none (machine translation, by sentence content id),
   * filled when the inputs load; a sentence the translation could not answer maps to ''.
   */
  zh?: Record<string, string>;
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
  prompt: OrchComposePromptRef | null;
  /** Short-passage entries appended after the book / prompt (each is one segment). */
  passages: OrchComposePassageRef[];
  /** Word group whose read counts decide new words (null: the user's default group). */
  wordGroupId: string | null;
  /**
   * Which read counts decide new words: `virtual` - the task's own API-side
   * virtual read batch (`orch-<task id>`) overlaid on the group counts;
   * `history` - an existing batch picked from the user's list; `real` - the
   * group read counts only.
   */
  readState: OrchComposeReadState;
  /** Virtual read batch of `virtual` / `history` (ignored for `real`). */
  virtualBatch: string;
}

export type OrchComposeReadState = 'virtual' | 'history' | 'real';

/** Summary of a task's own resolution (kept with the task, mirrored to Laravel - never interpreted there). */
export interface OrchTaskProgressSummary {
  planHash: string;
  phase: string;
  done: number;
  total: number;
  updatedAt: string;
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
  /** Progress of the last resolution of `planHash` (null before the first run). */
  progress: OrchTaskProgressSummary | null;
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
  /** Short-passage entry the sentence belongs to (`orchPassageKey`); absent for the book / prompt source. */
  passage?: string;
}

export interface OrchComposeItem {
  kind: OrchResourceKind;
  language: string;
  text: string;
  /** Sentence position in the task's sentence list. */
  position: number;
  seq: number;
  /** A meaning clip: the word / phrase it explains (shown as that card's meaning line). */
  meaningOf?: string;
  /** What `meaningOf` is: a phrase (listed on its sentence's card) or, when absent, a word (its own card). */
  meaningKind?: 'phrase';
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
  /** Per sentence language the pattern reads: how many sentences have no text in it (their steps are skipped). */
  skippedLanguages: Record<string, number>;
}

export interface OrchComposeResource extends OrchClipIdentity {
  /** The store key on every end (= resourceId). */
  key: string;
  /** Laravel URL known from the source (verse audio), if any. */
  laravelUrl: string | null;
}

/** Where a clip came from: the local store, or the clip source that fetched it. */
export type OrchClipOrigin = 'device' | 'pycore' | 'laravel';

/**
 * Network channel of a clip: the selected pycore reached directly, a paired
 * pycore reached through the Laravel relay, or Laravel itself.
 */
export type OrchChannelId = 'pycore' | 'relay' | 'laravel';

export interface OrchResolvedClip {
  key: string;
  /** Playable URL: stored file, object URL, or a remote URL. */
  url: string;
  origin: OrchClipOrigin;
  meaning: string;
  /** Bytes transferred to obtain it (absent: nothing was transferred). */
  bytes?: number;
  /** Channel it came over (absent for the device store). */
  via?: OrchChannelId;
}

export interface OrchResolveCounts {
  total: number;
  device: number;
  pycore: number;
  laravel: number;
  missing: number;
  /** Missing clips a backend was asked to generate (a subset of `missing`). */
  generating: number;
  pending: number;
}

/** What a composition is made of, independent of the task record that holds it. */
export interface OrchComposeSpec {
  source: OrchComposeSource;
  language: string;
  config: OrchComposeConfig;
}

/** One phrase of a sentence as Laravel `phrases_by_sentences` reports it (meaning: the Chinese gloss, '' when none). */
export interface OrchPhraseText {
  text: string;
  meaning: string;
}

/**
 * Phrases per plan sentence, keyed by the sentence content id (`orchSentenceContentId`).
 * A sentence without an entry has no phrases (yet); entry order is the reading order.
 */
export type OrchPhrasesBySentence = ReadonlyMap<string, readonly OrchPhraseText[]>;

/** Word read state from Laravel `learning/sentence-words` (with the virtual read overlay). */
export interface OrchWordState {
  word: string;
  /** Effective read count: group read count + virtual read count. */
  readCount: number;
  groupReadCount: number;
  virtualReadCount: number;
  /** Laravel dictionary word id (recording virtual reads); 0 when unknown. */
  wordId: number;
  audioUrl: string | null;
  meaning: string;
}
