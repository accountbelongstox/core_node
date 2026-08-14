/**
 * API path registry — the SINGLE home for every backend endpoint PATH the
 * extension hits (laravel_main / pycore). Callers import a constant or a small
 * builder instead of hardcoding the same `/api/...` string in several files, so
 * a route rename touches one place and can never desync.
 *
 * Rule: a constant holds ONLY the path portion (leading `/api/...`). Where a
 * request concatenates a base URL, the caller keeps doing so — this module never
 * embeds an origin. Id-parameterized routes use the builders (which percent-
 * encode the id exactly as the callers did before).
 *
 * The worker and queue-center planes are owned by the shared contract
 * (config/queue_center_contract.json `endpoints`) and are rendered through
 * `queueCenterEndpoint` — those paths are NOT repeated as literals here.
 */

import { queueCenterEndpoint } from './queue-center-contract';

// ─────────────────────── Worker control plane (/api/worker/*) ───────────────────────
export const WORKER_PATHS = {
  REGISTER: queueCenterEndpoint('worker_register'),
  HEARTBEAT: queueCenterEndpoint('worker_heartbeat'),
  UNREGISTER: queueCenterEndpoint('worker_unregister'),
  LIST: queueCenterEndpoint('worker_list'),
  STATS: queueCenterEndpoint('worker_stats'),
} as const;

// ─────────────────────── Queue Center plane (/api/queue-center/*) ───────────────────────
export const QUEUE_CENTER_PATHS = {
  OVERVIEW: queueCenterEndpoint('queue_center_overview'),
  EVENTS: queueCenterEndpoint('queue_center_events'),
  RECEIPTS: queueCenterEndpoint('queue_center_receipts'),
} as const;

/** Task operations are type-scoped: /api/worker/tasks/{taskType}/{action}. */
export type WorkerTaskAction = 'pull' | 'accept' | 'result';

const WORKER_TASK_ACTION_ROLES = {
  pull: 'worker_task_pull',
  accept: 'worker_task_accept',
  result: 'worker_task_result',
} as const;

/** Build `/api/worker/tasks/{taskType}/{action}` (taskType percent-encoded). */
export function workerTaskPath(taskType: string, action: WorkerTaskAction): string {
  return queueCenterEndpoint(WORKER_TASK_ACTION_ROLES[action], { task_type: taskType });
}

export function queueCenterDiffPath(taskType: string): string {
  return queueCenterEndpoint('queue_center_queue_diff', { queue: taskType });
}

// ─────────────────────── Global-task plane (/api/task/*) ───────────────────────
/** Task list route (callers append their own query string). */
export const TASK_LIST_PATH = '/api/task/list';

/** Unified Task Center aggregate (scheduler + queue + workers) — laravel_main. */
export const TASK_CENTER_OVERVIEW_PATH = '/api/task-center/overview';

/** Id-parameterized task sub-routes. */
export type TaskSubPath = 'detail' | 'bump' | 'stream';

/** Build `/api/task/{id}/{sub}` with the id percent-encoded (matches callers). */
export function taskPath(id: string, sub: TaskSubPath): string {
  return `/api/task/${encodeURIComponent(id)}/${sub}`;
}

// ─────────────────────── Translation queue (/api/app_qy_v1/ai_tools/...) ───────────────────────
export const TRANSLATION_QUEUE_PATHS = {
  LIST: '/api/app_qy_v1/ai_tools/translation/queue/list',
  PENDING_WORDS: '/api/app_qy_v1/ai_tools/translation/queue/pending-words',
  ENQUEUE_PENDING: '/api/app_qy_v1/ai_tools/translation/queue/enqueue-pending',
} as const;

// ─────────────────────── Word-validity (/api/app_qy_v1/vocabulary/validity/*) ───────────────────────
export const VALIDITY_PATHS = {
  PENDING: '/api/app_qy_v1/vocabulary/validity/pending',
  REPORT: '/api/app_qy_v1/vocabulary/validity/report',
} as const;

// ─────────────────────── Assist image plane (/api/app_qy_v1/assist/*) ───────────────────────
export const ASSIST_PREFIX = '/api/app_qy_v1/assist';
export const ASSIST_PATHS = {
  CLAIM: `${ASSIST_PREFIX}/claim`,
  SUBMIT: `${ASSIST_PREFIX}/submit`,
  RELEASE: `${ASSIST_PREFIX}/release`,
  OVERVIEW: `${ASSIST_PREFIX}/overview`,
  OVERVIEW_ITEMS: `${ASSIST_PREFIX}/overview/items`,
} as const;

// ─────────────────────── Media ingest plane (/api/app_qy_v1/media/*) ───────────────────────
export const MEDIA_PATHS = {
  INGEST: '/api/app_qy_v1/media/ingest',
  AUDIO: '/api/app_qy_v1/media/audio',
  BOOKS: '/api/app_qy_v1/media/books',
  AI_AUDIO: '/api/app_qy_v1/media/ai-audio',
} as const;

/** Build the study-gen action path `/api/app_qy_v1/study-gen/{action}`. */
export function studyGenPath(action: string): string {
  return `/api/app_qy_v1/study-gen/${action}`;
}

// ─────────────────────── Dashboard control reads (/api/dashboard/*) ───────────────────────
export const DASHBOARD_CODE_LAST_MODIFIED_PATH = '/api/dashboard/code-last-modified';
