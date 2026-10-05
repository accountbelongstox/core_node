/**
 * Audio lane vocabulary of the pycore-manager views, derived from
 * config/queue_center_contract.json (`lane_state.lanes`): a lane is an audio
 * lane unless it is the translation assist lane. A clip kind (word, sentence,
 * phrase) maps to the lane `<kind>_audio`.
 */
import contractDocument from '../../../../../config/queue_center_contract.json';
import type { AudioLaneKey } from '../../../core/contracts/QueueCenterTypes';

const TRANSLATION_LANE = 'translation';
const KIND_LANE_SUFFIX = '_audio';

export const PC_AUDIO_LANES: readonly AudioLaneKey[] = contractDocument.lane_state.lanes
  .filter((lane) => lane !== TRANSLATION_LANE) as AudioLaneKey[];

export function pcAudioLaneOfKind(kind: string): AudioLaneKey {
  const lane = `${kind}${KIND_LANE_SUFFIX}`;
  return (PC_AUDIO_LANES as readonly string[]).includes(lane) ? lane as AudioLaneKey : PC_AUDIO_LANES[0];
}
