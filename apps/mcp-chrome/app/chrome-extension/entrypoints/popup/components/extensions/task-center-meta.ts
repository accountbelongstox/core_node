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

// PRIORITY_FAST (value) + WorkerCapability (type) come from the worker API client
// — the single source for the fast-tier threshold and the capability vocabulary.
import { PRIORITY_FAST, type WorkerCapability } from '@/entrypoints/background/api/WorkerApiClient';

export interface TaskTypeMeta {
  /** Friendly label shown in rows + modal header. */
  label: string;
  /** Emoji glyph (kept inline; no per-type SVG component needed). */
  icon: string;
  /** Short uppercase badge tag. */
  badge: string;
  /** Chinese label for the popup summary strip (SUMMARY_CATS builds from this). */
  zhLabel?: string;
  /** Accent color for the popup summary strip. */
  color?: string;
}

/** Covers the unified task types plus the local bing_dictionary worker kind. */
export const TASK_TYPE_META: Record<string, TaskTypeMeta> = {
  word_translation: { label: 'Word Translation', icon: '🔤', badge: 'TRANSLATE', zhLabel: '待翻译任务', color: '#818cf8' },
  word_media: { label: 'Word Image', icon: '🖼️', badge: 'WORD IMAGE', zhLabel: '待搜索单词图片', color: '#a78bfa' },
  word_audio: { label: 'Word Audio', icon: '🔊', badge: 'AUDIO', zhLabel: '待生成语音', color: '#2dd4bf' },
  gemini_image: { label: 'Gemini Image', icon: '🎨', badge: 'IMAGE', zhLabel: '待 AI 生图', color: '#c084fc' },
  gemini_chat: { label: 'Gemini Chat', icon: '💬', badge: 'CHAT', zhLabel: '待 AI 对话', color: '#f472b6' },
  notebooklm: { label: 'NotebookLM', icon: '📓', badge: 'NOTEBOOK', zhLabel: '待 NLM 处理', color: '#fbbf24' },
  word_validity: { label: 'Word Validity', icon: '✅', badge: 'VALIDITY', zhLabel: '待有效检测', color: '#22c55e' },
  prompt_translation: { label: 'Prompt Translation', icon: '🌐', badge: 'PROMPT', zhLabel: '待提示词翻译', color: '#06b6d4' },
  sentence_audio: { label: 'Sentence Audio', icon: '🎧', badge: 'SENTENCE', zhLabel: '待句子音频', color: '#34d399' },
  poster: { label: 'Book / Media Cover', icon: '🎬', badge: 'COVER', zhLabel: '待搜索图书封面', color: '#fb7185' },
  subtitle_search: { label: 'Subtitle Search', icon: '💬', badge: 'SUBTITLE', zhLabel: '待字幕搜索', color: '#60a5fa' },
  bing_dictionary: { label: 'Bing Dictionary', icon: '📖', badge: 'DICT' },
};

/** Fallback meta for an unknown / future task_type so the UI never blanks out. */
export const UNKNOWN_TASK_META: TaskTypeMeta = { label: 'Task', icon: '📦', badge: 'TASK' };

/**
 * Capability → label. Keys mirror GlobalTask::CAPABILITIES
 * ({audio,image,translate,sentence_audio,ai_translate,subtitle,poster}); a
 * null / unset capability means "any client may claim it".
 */
// Typed by WorkerCapability so an unknown capability key can't be added; Partial
// because not every capability needs a bespoke label (unknowns fall back to the
// raw key in capabilityLabel).
export const CAPABILITY_LABEL: Partial<Record<WorkerCapability, string>> = {
  audio: 'Audio',
  image: 'Image',
  translate: 'Translate',
  sentence_audio: 'Sentence Audio',
  ai_translate: 'AI Translate',
  puter_translate: 'Puter Translate',
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
  return CAPABILITY_LABEL[capability as WorkerCapability] || capability;
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
  return typeof opts.priority === 'number' && opts.priority >= PRIORITY_FAST;
}
