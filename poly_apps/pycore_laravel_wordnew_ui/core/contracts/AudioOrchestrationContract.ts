/**
 * Audio orchestration defaults shared with pycore (`orch_contract`): the one
 * source for the default output mode, segmentation and reading pattern of
 * every end (pycore, pycore-manager, the wordnew composer). The JSON is checked
 * against the value sets below when the module loads.
 */
import contract from '../../../../config/audio_orchestration_contract.json';

export const AUDIO_ORCH_STEP_TYPES = ['words_new', 'words_all', 'sentence_zh', 'sentence_en'] as const;
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
  /** Word steps: after each word, read its short Chinese meaning. */
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
  /** Clips a run moves to the head of Laravel's generation lanes (the next ones in play order). */
  laravelHeadMaxItems: contract.transfer.laravel_head_max_items,
  laravelWordBatch: contract.transfer.laravel_word_batch_max_items,
} as const;

/** A fresh copy of the default reading pattern. */
export function audioOrchDefaultPattern(): AudioOrchPatternStep[] {
  return DEFAULT_PATTERN.map((step) => ({ ...step }));
}
