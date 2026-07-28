/**
 * Presentation adapter for the central distributed-task catalog.
 *
 * Labels/icons/colors and capability labels live in
 * config/queue_center_contract.json. Laravel, Pycore, both manager UIs, and the
 * worker model read sibling adapters listed in queue-center-contract.ts.
 */

import {
  CAPABILITY_LABELS,
  PRIORITY_FAST,
  TASK_TYPE_CATALOG,
  type WorkerCapability,
} from '@/utils/queue-center-contract';

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

export const TASK_TYPE_META: Record<string, TaskTypeMeta> = Object.fromEntries(
  TASK_TYPE_CATALOG.map((definition) => [definition.key, {
    label: definition.label,
    icon: definition.ui.icon,
    badge: definition.ui.badge,
    zhLabel: definition.ui.summary_label,
    color: definition.ui.color,
  }]),
);
// Extension-local processor fallback, not a Laravel global task_type.
TASK_TYPE_META.bing_dictionary = { label: 'Bing Dictionary', icon: '📖', badge: 'DICT' };

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
export const CAPABILITY_LABEL: Partial<Record<WorkerCapability, string>> = CAPABILITY_LABELS;

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
