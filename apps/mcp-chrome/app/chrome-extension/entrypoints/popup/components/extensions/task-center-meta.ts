/**
 * Shared task-type / capability presentation maps for the unified Task Center.
 *
 * Keys mirror the EXACT `task_type` values the laravel TaskController emits and
 * the worker contract uses (GlobalTask::EXECUTION_TYPES drives lanes; task_type
 * is the work kind). CAPABILITY_LABEL keys mirror GlobalTask::CAPABILITIES, with
 * ai_translate surfaced as "AI Translate" and a NULL → "any" fallback.
 *
 * Used by BOTH UnifiedTaskCenter.vue (row label/badge/icon) and
 * TaskDetailModal.vue (header label/icon) so the two views never drift.
 */

export interface TaskTypeMeta {
  /** Friendly label shown in rows + modal header. */
  label: string;
  /** Emoji glyph (kept inline; no per-type SVG component needed). */
  icon: string;
  /** Short uppercase badge tag. */
  badge: string;
}

/** Covers all 8 unified task types + the local bing_dictionary worker kind. */
export const TASK_TYPE_META: Record<string, TaskTypeMeta> = {
  word_translation: { label: 'Word Translation', icon: '🔤', badge: 'TRANSLATE' },
  word_media: { label: 'Word Media', icon: '🖼️', badge: 'MEDIA' },
  word_audio: { label: 'Word Audio', icon: '🔊', badge: 'AUDIO' },
  gemini_image: { label: 'Gemini Image', icon: '🎨', badge: 'IMAGE' },
  gemini_chat: { label: 'Gemini Chat', icon: '💬', badge: 'CHAT' },
  notebooklm: { label: 'NotebookLM', icon: '📓', badge: 'NOTEBOOK' },
  sentence_audio: { label: 'Sentence Audio', icon: '🎧', badge: 'SENTENCE' },
  poster: { label: 'Poster', icon: '🎬', badge: 'POSTER' },
  subtitle_search: { label: 'Subtitle Search', icon: '💬', badge: 'SUBTITLE' },
  bing_dictionary: { label: 'Bing Dictionary', icon: '📖', badge: 'DICT' },
};

/** Fallback meta for an unknown / future task_type so the UI never blanks out. */
export const UNKNOWN_TASK_META: TaskTypeMeta = { label: 'Task', icon: '📦', badge: 'TASK' };

/**
 * Capability → label. Keys mirror GlobalTask::CAPABILITIES
 * ({audio,image,translate,sentence_audio,ai_translate,subtitle,poster}); a
 * null / unset capability means "any client may claim it".
 */
export const CAPABILITY_LABEL: Record<string, string> = {
  audio: 'Audio',
  image: 'Image',
  translate: 'Translate',
  sentence_audio: 'Sentence Audio',
  ai_translate: 'AI Translate',
  subtitle: 'Subtitle',
  poster: 'Poster',
};

/** Resolve meta for a task_type, preferring task_type then a processorType fallback. */
export function taskMeta(taskType?: string | null, fallbackType?: string | null): TaskTypeMeta {
  const key = (taskType || fallbackType || '').toString();
  return TASK_TYPE_META[key] || UNKNOWN_TASK_META;
}

/** Icon for a task_type (prefers task_type, falls back to processorType). */
export function taskIcon(taskType?: string | null, fallbackType?: string | null): string {
  return taskMeta(taskType, fallbackType).icon;
}

/** Friendly label for a task_type (prefers task_type, falls back to processorType). */
export function taskTypeLabel(taskType?: string | null, fallbackType?: string | null): string {
  return taskMeta(taskType, fallbackType).label;
}

/** Capability label; null / '' / undefined → 'any'. */
export function capabilityLabel(capability?: string | null): string {
  if (capability === null || capability === undefined || capability === '') return 'any';
  return CAPABILITY_LABEL[capability] || capability;
}

/** True when the capability is the AI Translate fast-lane subset. */
export function isAiTranslate(capability?: string | null): boolean {
  return capability === 'ai_translate';
}

/** Fast-tier when explicitly flagged, on remote_fast, or at/above the FAST priority tier. */
export function isFastTier(opts: {
  is_fast_tier?: boolean | null;
  priority?: number | null;
  execution_type?: string | null;
}): boolean {
  if (opts.is_fast_tier) return true;
  if (opts.execution_type === 'remote_fast') return true;
  return typeof opts.priority === 'number' && opts.priority >= 100;
}
