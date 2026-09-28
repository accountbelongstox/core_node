/**
 * Task Center shared types + message constants — the SINGLE canonical shape of
 * the popup <-> background control protocol.
 *
 * Both the background scheduler (TaskCenter / listener / workers) and the popup
 * composable import these instead of re-declaring their own copies, so the
 * config, status and message shapes can NEVER drift (data + variable
 * centralization). Pairs with the capability catalog in `task-capabilities.ts`
 * (which owns the capability <-> processorType mapping).
 */

import type { CapabilityKey } from './task-capabilities';
import { TASK_LIMITS } from './queue-center-contract';

// ─────────────────────────── Message envelope ───────────────────────────
// Centralized message-type + action string constants. Popup senders and the
// background listener both reference these so a rename can't desync them.

export const TASK_CENTER_MSG = 'task_center' as const;
export const VALIDITY_TEST_MSG = 'validity_test' as const;
/** Popup -> background: read persistent retry-outbox status ({pending,oldestAt}). */
export const SUBMIT_OUTBOX_MSG = 'submit_outbox' as const;

// ─────────────────────────── Shared defaults ───────────────────────────
// Single source for the numeric worker defaults + the default translation
// language pair, so the popup composable and every worker agree on one value.

/**
 * Extension scheduling defaults plus the central worker pull default. Every
 * worker runtime heartbeats at `heartbeatInterval` seconds, well inside
 * Laravel's Worker::HEARTBEAT_TIMEOUT (120 s) online window.
 */
export const TASK_CENTER_DEFAULTS = {
  pollInterval: 5,
  batchSize: TASK_LIMITS.worker_pull_default,
  heartbeatInterval: 20,
} as const;

/** Default source / target translation language when a task omits them. */
export const DEFAULT_SOURCE_LANG = 'en' as const;
export const DEFAULT_TARGET_LANG = 'zh' as const;

export type TaskCenterAction =
  | 'start'
  | 'stop'
  | 'set_capability'
  | 'get_status'
  | 'enable_processor'
  | 'disable_processor'
  | 'start_processor'
  | 'stop_processor';

// ─────────────────────────── Processor-level shapes ───────────────────────
// Canonical (moved here from ITaskProcessor.ts, which now re-exports them).

export interface ProcessorConfig {
  apiUrl: string;
  [key: string]: any;
}

export interface ProcessorStats {
  pending: number;
  translated: number;
  failed: number;
  lastRun: number | null;
  workerId: string | null;
  isOnline: boolean;
  queueTotal: number;
  newTasks: number;
  duplicateTasks: number;
  // Backend-reachability signals owned by SimpleWorkerBase (optional: not every
  // processor is a SimpleWorkerBase worker).
  backendOnline?: boolean;
  consecutiveFailures?: number;
  lastError?: string | null;
  lastErrorAt?: number | null;
  lastRequestAt?: number | null;
  [key: string]: any; // Allow additional custom stats
}

export interface ProcessorStatus {
  isRunning: boolean;
  stats: ProcessorStats;
}

// ─────────────────────────── Task Center config ───────────────────────────

export interface TaskCenterConfig {
  /** Runtime-only: the background resolves it from ApiManager at start/resume; never persisted. */
  apiUrl: string;
  pollInterval?: number;
  /**
   * Per-processor config map. OPTIONAL: the popup may send only
   * {activeCapabilities}; the center normalizes an absent map to {} so
   * lane activation never assumes its presence (logic consistency).
   */
  processors?: { [processorType: string]: ProcessorConfig };
  /** Authoritative allowlist when present; an empty list keeps every processor idle. */
  enabledProcessors?: string[];
  /** Capability keys the user checked; the background maps these to processors. */
  activeCapabilities?: CapabilityKey[];
}

export type ProcessorSettings = Omit<ProcessorConfig, 'apiUrl'>;

/** Persisted / popup-sent Task Center shape: `api_settings` is the only API location. */
export interface TaskCenterSettings extends Omit<TaskCenterConfig, 'apiUrl' | 'processors'> {
  processors?: { [processorType: string]: ProcessorSettings };
}

/** Drop every `apiUrl` copy (root + per processor), including legacy persisted ones. */
export function toTaskCenterSettings(
  config?: TaskCenterSettings | Partial<TaskCenterConfig> | null,
): TaskCenterSettings {
  const { apiUrl: _apiUrl, processors, ...rest } = (config || {}) as Partial<TaskCenterConfig>;
  const cleanProcessors: { [processorType: string]: ProcessorSettings } = {};
  for (const [processorType, processor] of Object.entries(processors || {})) {
    const { apiUrl: _processorApiUrl, ...processorSettings } = processor || {};
    cleanProcessors[processorType] = processorSettings;
  }
  return { ...rest, processors: cleanProcessors };
}

/** Bind settings to the API base resolved for this run (center + every processor). */
export function withApiBase(
  settings: TaskCenterSettings | Partial<TaskCenterConfig> | null | undefined,
  apiUrl: string,
): TaskCenterConfig {
  const clean = toTaskCenterSettings(settings);
  const processors: { [processorType: string]: ProcessorConfig } = {};
  for (const [processorType, processor] of Object.entries(clean.processors || {})) {
    processors[processorType] = { ...processor, apiUrl };
  }
  return { ...clean, apiUrl, processors };
}

// ─────────────────────────── Aggregate status ───────────────────────────

export interface TaskCenterStats {
  totalProcessors: number;
  runningProcessors: number;
  totalPending: number;
  totalTranslated: number;
  totalFailed: number;
  processors: { [processorType: string]: ProcessorStatus };
}

/** Aggregated backend REQUEST-layer reachability (surfaced in the popup strip). */
export interface BackendHealth {
  online: boolean;
  lastError: string | null;
  lastRequestAt: number | null;
  consecutiveFailures: number;
}

/** The full status object every task_center response returns. */
export interface FullTaskCenterStatus {
  isRunning: boolean;
  activeApiUrl: string | null;
  stats: TaskCenterStats;
  backend: BackendHealth;
  activeCapabilities: CapabilityKey[];
}
