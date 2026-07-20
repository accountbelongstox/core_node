/**
 * chrome.storage key registry — the SINGLE home for every raw chrome.storage
 * (local / session) key + related alarm name the extension writes. Consumers
 * import `STORAGE_KEYS.X` instead of repeating a literal, so a key can never be
 * mistyped or renamed at one site and silently orphan its persisted data.
 *
 * VALUES here are frozen: they are the on-disk keys, so changing one would
 * abandon existing data. Keys already owned by a dedicated module (e.g.
 * `backend-timeout.ts`) are REFERENCED, not re-defined, so there is still one
 * source of truth per value.
 */

import { BACKEND_TIMEOUT_STORAGE_KEY } from './backend-timeout';

export const STORAGE_KEYS = {
  // Task Center popup composable (useTaskCenter.ts).
  TASK_CENTER_CONFIG: 'task_center_config',
  TASK_CENTER_ACTIVE: 'task_center_active',

  // Background run-intent — authoritative assist allowlist (run-intent.ts).
  TC_RUN_INTENT: 'tc_run_intent',

  // Durable write-retry queue (outbox/submit-outbox.ts).
  SUBMIT_OUTBOX: 'submit_outbox_v1',

  // Backend request timeout — canonical const lives in backend-timeout.ts.
  BACKEND_TIMEOUT: BACKEND_TIMEOUT_STORAGE_KEY,

  // DeepSeek task queue (utils/deepseek-task-queue.ts).
  DEEPSEEK_TASKS: 'deepseek_tasks',
  DEEPSEEK_CONFIG: 'deepseek_config',

  // Bing dictionary worker runtime (session) + watchdog alarm name
  // (bing-worker-lifecycle.ts).
  BING_WORKER_RUNTIME: 'bing_worker_runtime',
  BING_WATCHDOG_ALARM: 'bing-translation-worker-watchdog',

  // Bing dictionary popup composables
  // (useBingDictionary.ts / useBingDictionaryClient.ts).
  BING_DICTIONARY_HISTORY: 'bing_dictionary_history',
  BING_DICTIONARY_CLIENT_MODE: 'bing_dictionary_client_mode',
  BING_DICTIONARY_CLIENT_CONFIG: 'bing_dictionary_client_config',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
