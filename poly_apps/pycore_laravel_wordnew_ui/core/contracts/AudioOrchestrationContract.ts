/**
 * Audio orchestration defaults shared with pycore (`orch_contract`): the one
 * source for the default output mode, segmentation and reading pattern of
 * every end (pycore, pycore-manager, the wordnew composer). The JSON is checked
 * against the value sets below when the module loads.
 */
import contract from '../../../../config/audio_orchestration_contract.json';

export const AUDIO_ORCH_STEP_TYPES = ['words_new', 'words_all', 'sentence_zh', 'sentence_en', 'phrases'] as const;
export const AUDIO_ORCH_OUTPUT_MODES = ['audio', 'video'] as const;
export const AUDIO_ORCH_SEGMENT_MODES = ['count', 'minutes'] as const;
export const AUDIO_ORCH_WORD_MODES = ['new_only', 'all'] as const;

export type AudioOrchStepType = (typeof AUDIO_ORCH_STEP_TYPES)[number];
export type AudioOrchOutputMode = (typeof AUDIO_ORCH_OUTPUT_MODES)[number];
export type AudioOrchSegmentMode = (typeof AUDIO_ORCH_SEGMENT_MODES)[number];
export type AudioOrchWordMode = (typeof AUDIO_ORCH_WORD_MODES)[number];

export interface AudioOrchPatternStep {
  type: AudioOrchStepType;
  times: number;
  /** Word and phrase steps: after each word / phrase, read its short Chinese meaning. */
  meaning?: boolean;
}

function member<T extends string>(values: readonly T[], value: string, field: string): T {
  if (!(values as readonly string[]).includes(value)) {
    throw new Error(`audio_orchestration_contract.json: ${field} "${value}" is not one of ${values.join(', ')}`);
  }
  return value as T;
}

if (contract.step_types.join() !== AUDIO_ORCH_STEP_TYPES.join()) {
  throw new Error('audio_orchestration_contract.json: step_types differ from AUDIO_ORCH_STEP_TYPES');
}

const DEFAULT_PATTERN: readonly AudioOrchPatternStep[] = contract.default_pattern.map((step) => ({
  type: member(AUDIO_ORCH_STEP_TYPES, step.type, 'default_pattern.type'),
  times: step.times,
  ...('meaning' in step && step.meaning ? { meaning: true } : {}),
}));

/** Phrase pipeline (contract `phrase_pipeline`, docs_fix/DESIGN_PHRASE_PIPELINE.md): identity, languages and the audio lane of phrase clips. */
export const AUDIO_ORCH_PHRASE_PIPELINE = {
  kind: contract.phrase_pipeline.kind,
  /** Sentence languages that get phrases. */
  languages: contract.phrase_pipeline.languages as readonly string[],
  /** Language of a phrase's meaning clip (a sentence-kind clip, like word meanings). */
  meaningLanguage: contract.phrase_pipeline.meaning_language,
  maxPhrasesPerSentence: contract.phrase_pipeline.extraction.max_phrases_per_sentence,
  phraseMaxWords: contract.phrase_pipeline.extraction.phrase_max_words,
  phraseMaxChars: contract.phrase_pipeline.extraction.phrase_max_chars,
  /** Work-lease / generate lane of phrase audio. */
  audioLane: contract.phrase_pipeline.audio.lane,
} as const;

/** Step types whose `meaning` option reads a Chinese meaning clip after each item (contract `step_options`). */
export const AUDIO_ORCH_MEANING_STEP_TYPES: readonly AudioOrchStepType[] = ['words_new', 'words_all', 'phrases'];

/** Book plan request flags the client derives from the pattern (contract `book_plan.plan_request`). */
export const AUDIO_ORCH_PLAN_REQUEST_FLAGS = {
  includeWords: 'include_words',
  includePhrases: 'include_phrases',
} as const satisfies Record<string, keyof typeof contract.book_plan.plan_request>;

export const AUDIO_ORCH_DEFAULT_OUTPUT_MODE = member(AUDIO_ORCH_OUTPUT_MODES, contract.default_output_mode, 'default_output_mode');
export const AUDIO_ORCH_DEFAULT_SEGMENT_MODE = member(AUDIO_ORCH_SEGMENT_MODES, contract.default_segment_mode, 'default_segment_mode');
export const AUDIO_ORCH_DEFAULT_WORD_MODE = member(AUDIO_ORCH_WORD_MODES, contract.default_word_mode, 'default_word_mode');
export const AUDIO_ORCH_DEFAULT_SEGMENT_VALUE: number = contract.default_segment_value;
export const AUDIO_ORCH_MAX_STEP_TIMES: number = contract.max_step_times;
export const AUDIO_ORCH_DEFAULT_MAX_READ_COUNT: number = contract.default_new_only_max_read_count;
export const AUDIO_ORCH_DEFAULT_VIRTUAL_BATCH: string = contract.default_virtual_batch;
/** Clip transfer limits (pycore bundle, Laravel URL batches). */
export const AUDIO_ORCH_TRANSFER = {
  bundleMaxItems: contract.transfer.pycore_bundle_max_items,
  bundleMaxBytes: contract.transfer.pycore_bundle_max_bytes,
  bundleMediaType: contract.transfer.pycore_bundle_media_type,
  laravelBundleMaxItems: contract.transfer.laravel_bundle_max_items,
  /** Default concurrent transfers per backend (a device setting overrides it). */
  parallelDefaults: { pycore: contract.transfer.parallel_defaults.pycore, laravel: contract.transfer.parallel_defaults.laravel },
  parallelMax: contract.transfer.parallel_max,
  laravelSentenceBatch: contract.transfer.laravel_sentence_batch_max_items,
  /** A bundle through the Laravel relay (frames ride the relay's blob store). */
  relayBundleMaxItems: contract.transfer.relay_bundle_max_items,
  /** Missing clips a run asks a pycore to generate (the next ones in play order). */
  generateMaxItems: contract.transfer.generate_max_items,
  /** While generated clips are awaited: check every N seconds, for at most M minutes. */
  generationRecheckMs: contract.transfer.generation_recheck_seconds * 1000,
  generationWatchMs: contract.transfer.generation_watch_minutes * 60_000,
  /** While the realtime stream is live, `clip.ready` wakes the waiters; this is only their safety re-check. */
  readyPushSafetyMs: contract.transfer.ready_push_safety_seconds * 1000,
  /** A channel's "absent" / "asked to generate" answer is trusted this long (the absence cursor). */
  absenceRecheckMs: contract.transfer.absence_recheck_minutes * 60_000,
  /** A failed transfer request is tried again this many times, after a growing delay (min..max). */
  retryAttempts: contract.transfer.retry_attempts,
  retryMinMs: contract.transfer.retry_min_seconds * 1000,
  retryMaxMs: contract.transfer.retry_max_seconds * 1000,
  /** A run whose transfers still failed runs again from its cursors after a growing delay (min..max). */
  rerunMinMs: contract.transfer.rerun_min_seconds * 1000,
  rerunMaxMs: contract.transfer.rerun_max_seconds * 1000,
  /** Clips a run moves to the head of Laravel's generation lanes (the next ones in play order). */
  laravelHeadMaxItems: contract.transfer.laravel_head_max_items,
  laravelWordBatch: contract.transfer.laravel_word_batch_max_items,
} as const;

/** Server-declared content updates of held clips (R14's only automatic exception). */
export const AUDIO_ORCH_CONTENT_UPDATE = {
  /** A device checks its held clips against the server versions this often. */
  checkIntervalMs: contract.content_update.check_interval_minutes * 60_000,
  /** Lookup batches (laravel_bundle_max_items clips each) one check run covers; the next run continues from its cursor. */
  batchesPerRun: contract.content_update.batches_per_run,
  /** Changed clips downloaded at the same time. */
  downloadParallel: contract.content_update.download_parallel,
} as const;

/** Server-owned book audio plan (contract `book_plan`): the client posts a plan once and follows its counters and ready ids by cursor. */
export const AUDIO_ORCH_BOOK_PLAN = {
  readyPageDefault: contract.book_plan.ready_page_default,
  readyPageMax: contract.book_plan.ready_page_max,
  /** A reading position this far from the posted one is posted again (the server re-raises priorities). */
  reprioritizeMinMove: contract.book_plan.reprioritize_min_move,
  /** Missing book clips the direct pycore may generate locally for immediate playback. */
  localHeadItems: contract.book_plan.local_head_items,
  statusPollMs: contract.book_plan.status_poll_seconds * 1000,
  /** One plan request (ready page, status, assignment post) that has not answered by then fails and is retried: a hung request never blocks the run or the heartbeat. */
  requestTimeoutMs: contract.book_plan.request_timeout_seconds * 1000,
  /** A run waits at most this long for the first ready-id sync before it continues; the sync finishes in the background. */
  ensureSyncWaitMs: contract.book_plan.ensure_sync_wait_seconds * 1000,
  /** Window sid of the app's direct pycore in an assignment (Laravel skips those rows in every node's claim). */
  directSid: contract.book_plan.direct_sid,
  /** The app re-posts its assignment this often while the plan is active (the plan heartbeat). */
  assignmentRefreshMs: contract.book_plan.assignment_refresh_seconds * 1000,
  /** Clips one assignment spreads over the nodes, per lane. */
  assignmentWindowMax: contract.book_plan.assignment_window_max,
  /** Most windows (node x lane) of one assignment. */
  assignmentWindowsMax: contract.book_plan.assignment_windows_max,
  /** Share of a machine's window the app keeps for its direct pycore when the machine is also a Laravel node. */
  /** A node's window is its items per hour over this horizon (at least `assignmentMinClips`). */
  assignmentHorizonMinutes: contract.book_plan.assignment_horizon_minutes,
  assignmentMinClips: contract.book_plan.assignment_min_clips,
  assignmentDirectFraction: contract.book_plan.assignment_direct_fraction,
  assignmentDirectMax: contract.book_plan.assignment_direct_max,
  fastPassEngine: contract.book_plan.fast_pass.engine,
  qualityEngine: contract.book_plan.fast_pass.quality_engine,
} as const;

/** A fresh copy of the default reading pattern. */
export function audioOrchDefaultPattern(): AudioOrchPatternStep[] {
  return DEFAULT_PATTERN.map((step) => ({ ...step }));
}
