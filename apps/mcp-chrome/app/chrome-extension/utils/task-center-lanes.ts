/**
 * Task Center lane / processor identifier facade.
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
 * Execution values come from config/queue_center_contract.json through
 * queue-center-contract.ts. Only extension-local processor identifiers remain
 * in this file. The aligned Laravel/Pycore/manager adapters are documented in
 * that central adapter.
 */
import { EXECUTION_TYPES_BY_ROLE } from './queue-center-contract';

export const LANES = {
  // ── Execution-type lanes (GlobalTask::EXECUTION_TYPES) ──
  REMOTE_CLIENT: EXECUTION_TYPES_BY_ROLE.remote_client,
  REMOTE_TRANSLATION: EXECUTION_TYPES_BY_ROLE.remote_translation,
  REMOTE_AUDIO: EXECUTION_TYPES_BY_ROLE.remote_audio,
  REMOTE_FAST: EXECUTION_TYPES_BY_ROLE.remote_fast,
  REMOTE_POSTER: EXECUTION_TYPES_BY_ROLE.remote_poster,
  REMOTE_VALIDITY: EXECUTION_TYPES_BY_ROLE.remote_validity,
  REMOTE_NOTEBOOKLM: EXECUTION_TYPES_BY_ROLE.remote_notebooklm,
  REMOTE_GEMINI: EXECUTION_TYPES_BY_ROLE.remote_gemini,
  REMOTE_GEMINI_TEXT: EXECUTION_TYPES_BY_ROLE.remote_gemini_text,
  REMOTE_SUBTITLE: EXECUTION_TYPES_BY_ROLE.remote_subtitle,
  REMOTE_SENTENCE_AUDIO: EXECUTION_TYPES_BY_ROLE.remote_sentence_audio,
  REMOTE_STT: EXECUTION_TYPES_BY_ROLE.remote_stt,
  // ── Processor / worker identifier keys (a processor's own processorType) ──
  MEDIA_IMAGE: 'media_image',
  QWEN_TTS: 'qwen_tts',
  BING_DICTIONARY: 'bing_dictionary',
  WEB_AI_TRANSLATE: 'web_ai_translate',
  WORD_VALIDITY_WEB: 'word_validity_web',
  PROMPT_TRANSLATE_WEB: 'prompt_translate_web',
  CHATGPT_WEB: 'chatgpt_web',
  PUTER_TRANSLATE: 'puter_translate',
} as const;

export type LaneKey = keyof typeof LANES;
export type LaneValue = (typeof LANES)[LaneKey];
