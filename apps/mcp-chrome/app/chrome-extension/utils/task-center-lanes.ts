/**
 * Task Center lane / processorType string catalog — the SINGLE value-level
 * source of truth for the exact strings shared across the worker API union,
 * processor classes, worker services, the capability catalog and the popup.
 *
 * The `ProcessorType` TYPE union still lives in WorkerApiClient.ts (the type
 * source); this module owns the VALUE literals so every call site references the
 * same constant instead of re-typing the raw string. Two kinds of key live here:
 *   - execution-type lanes (mirror Laravel GlobalTask::EXECUTION_TYPES), e.g.
 *     REMOTE_FAST / REMOTE_TRANSLATION / REMOTE_GEMINI — a worker subscribes to
 *     these via processor_types.
 *   - processor / worker identifier keys (a processor's own `processorType`),
 *     e.g. MEDIA_IMAGE / BING_DICTIONARY — internal names, not execution lanes.
 *
 * NEVER change a value here without changing the backend it mirrors.
 */
export const LANES = {
  // ── Execution-type lanes (GlobalTask::EXECUTION_TYPES) ──
  REMOTE_CLIENT: 'remote_client',
  REMOTE_TRANSLATION: 'remote_translation',
  REMOTE_FAST: 'remote_fast',
  REMOTE_POSTER: 'remote_poster',
  REMOTE_VALIDITY: 'remote_validity',
  REMOTE_NOTEBOOKLM: 'remote_notebooklm',
  REMOTE_GEMINI: 'remote_gemini',
  REMOTE_GEMINI_TEXT: 'remote_gemini_text',
  // ── Processor / worker identifier keys (a processor's own processorType) ──
  MEDIA_IMAGE: 'media_image',
  BING_DICTIONARY: 'bing_dictionary',
  WEB_AI_TRANSLATE: 'web_ai_translate',
  WORD_VALIDITY_WEB: 'word_validity_web',
  PROMPT_TRANSLATE_WEB: 'prompt_translate_web',
} as const;

export type LaneKey = keyof typeof LANES;
export type LaneValue = (typeof LANES)[LaneKey];
