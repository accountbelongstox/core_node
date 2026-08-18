/**
 * Per-cell sentence/word audio UI state (book reader + library table).
 */
import type { WordNewAudioFileVariant } from '../api/types/media';
import type { QueueDeliveryVisualStage } from '../../../core/contracts/QueueCenterContract';

export type { WordNewAudioFileVariant };

export type WordNewAudioCellState = QueueDeliveryVisualStage;

export const cellKeyOf = (grain: string, seq: number, lang: string) => `${grain}-${seq}-${lang}`;

export const wordCellKeyOf = (md5: string, lang: string) => `${md5}:${lang}`;

/** Map Laravel tts_status + resolve flags to a UI state. */
export function ttsStatusToCellState(
  hasAudio: boolean,
  ttsStatus?: string | null,
  queued?: boolean,
  isPlaying?: boolean,
): WordNewAudioCellState {
  if (isPlaying) return 'playing';
  if (hasAudio) return 'ready';
  const st = (ttsStatus || '').toLowerCase();
  if (st === 'processing') return 'processing';
  if (queued || st === 'pending') return 'queued';
  return 'missing';
}
