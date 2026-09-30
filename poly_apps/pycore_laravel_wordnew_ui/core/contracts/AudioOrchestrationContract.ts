/**
 * Audio orchestration defaults shared with pycore (`orch_contract`): the one
 * source for the default output mode, segmentation and reading pattern of
 * every end (pycore, pycore-manager, the wordnew composer).
 */
import contract from '../../../../config/audio_orchestration_contract.json';

export type AudioOrchStepType = (typeof contract.step_types)[number];
export type AudioOrchOutputMode = (typeof contract.output_modes)[number];
export type AudioOrchSegmentMode = (typeof contract.segment_modes)[number];

export interface AudioOrchPatternStep {
  type: AudioOrchStepType;
  times: number;
}

export const AUDIO_ORCH_STEP_TYPES = contract.step_types as readonly AudioOrchStepType[];
export const AUDIO_ORCH_DEFAULT_OUTPUT_MODE = contract.default_output_mode as AudioOrchOutputMode;
export const AUDIO_ORCH_DEFAULT_SEGMENT_MODE = contract.default_segment_mode as AudioOrchSegmentMode;
export const AUDIO_ORCH_DEFAULT_SEGMENT_VALUE: number = contract.default_segment_value;
export const AUDIO_ORCH_MAX_STEP_TIMES: number = contract.max_step_times;
export const AUDIO_ORCH_DEFAULT_WORD_MODE = contract.default_word_mode as 'new_only' | 'all';
export const AUDIO_ORCH_DEFAULT_MAX_READ_COUNT: number = contract.default_new_only_max_read_count;
export const AUDIO_ORCH_DEFAULT_VIRTUAL_BATCH: string = contract.default_virtual_batch;

/** A fresh copy of the default reading pattern. */
export function audioOrchDefaultPattern(): AudioOrchPatternStep[] {
  return contract.default_pattern.map((step) => ({ type: step.type as AudioOrchStepType, times: step.times }));
}
