/**
 * WfNewTypes — UI-only types for the /wordnew app.
 *
 * The DATA models (Word, WordGroup, UserStats, …) live in the single shared
 * API type surface ./api/WfNewApiTypes and are re-exported here so existing
 * `from '../WfNewTypes'` imports keep working against the ONE canonical shape.
 * Only purely-visual descriptors (themes) are defined locally.
 */
export type { Word, WordGroup, UserStats } from './api/WfNewApiTypes';

export interface ElementTheme {
  id: string;
  nameEn: string;
  nameZh: string;
  bgClass: string;
  cardClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  accentText: string;
  accentBg: string;
  borderClass: string;
  glowClass: string;
  inputClass: string;
}
