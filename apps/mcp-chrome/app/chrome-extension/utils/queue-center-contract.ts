/**
 * mcp-chrome adapter for the canonical distributed-task contract.
 *
 * Source: config/queue_center_contract.json
 * Aligned adapters:
 * - poly_apps/laravel_main/app/Support/QueueCenterContract.php
 * - pycore/callmodule/services/queue_center_contract.py
 * - poly_apps/pycore_laravel_wordflow_ui/core/api-libs/pycore/QueueCenterContract.ts
 *
 * mcp-chrome intentionally calls Laravel directly; Pycore is a separate Laravel
 * worker, Pycore UI reaches Laravel only through Pycore RPC v2, and
 * Laravel-manager may call Laravel directly. These transports differ, but every
 * task record, status, lane, capability, priority, and task-type route comes
 * from this one JSON document. Change the JSON first; never copy a new literal
 * vocabulary into the popup or a worker.
 *
 * WXT/Vite can bundle this repository-root JSON directly. wxt.config.ts allows
 * the repository root for the dev file server, so start.ps1/start.sh do not need
 * a generated copy that could drift.
 */

import contractDocument from '../../../../../config/queue_center_contract.json';

export type ProcessorType = string;
export type WorkerCapability = string;
export type TaskStatus = string;
export type ChromeCapabilityKey = keyof typeof contractDocument.task_contract.chrome_capability_switches;

export interface ChromeCapabilitySwitchDefinition {
  storage_key: string;
  label: string;
  hint: string;
  processors: string[];
  uses_validity_runner: boolean;
}

export interface TaskCreateResult {
  task_id: string;
  execution_type: ProcessorType;
  priority: number;
  is_fast_tier: boolean;
}

export interface TaskPayload {
  words?: Array<{
    word: string;
    md5: string;
    query_count?: number;
  }>;
  language?: string;
  is_demo_mode?: boolean;
  word_count?: number;
  [key: string]: unknown;
}

export interface TaskRow {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: ProcessorType;
  status: TaskStatus;
  progress: number;
  assigned_to: string | null;
  created_at: string | null;
  capability: WorkerCapability | null;
  claimants?: Array<'pycore' | 'chrome' | 'laravel'>;
  priority: number;
  is_fast_tier: boolean;
}

export interface Task extends Omit<TaskRow, 'progress' | 'assigned_to'> {
  payload: TaskPayload;
  timeout_seconds: number;
}

export interface TaskDetail extends TaskRow {
  payload: TaskPayload;
  result: Record<string, any> | null;
  error: string | null;
  assigned_at: string | null;
  timeout_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
}

export interface TaskStatusRecord extends TaskDetail {
  retry_count: number;
  max_retries: number;
  timeout_seconds: number;
}

export interface TaskEvent {
  id: number | string;
  task_id: string;
  event: string;
  worker_id: string | null;
  attempt: number | null;
  detail: Record<string, any> | null;
  created_at: string | null;
  _id?: number | string;
}

export interface TaskCurrentPhase {
  phase: string | null;
  worker_id: string | null;
  elapsed_seconds: number | null;
}

export interface TaskDetailMetadata {
  total_attempts: number;
  max_retries: number;
  will_retry: boolean;
  estimated_timeout_in_seconds: number | null;
}

export interface TaskDetailBundle {
  task: TaskDetail;
  events: TaskEvent[];
  current_phase: TaskCurrentPhase;
  metadata: TaskDetailMetadata;
}

export interface TaskResult {
  task_id: string;
  worker_id: string;
  status: TaskStatus;
  progress?: number;
  result?: Record<string, any>;
  error?: string;
}

export interface TaskStatsRecord {
  total: number;
  pending: number;
  assigned: number;
  processing: number;
  completed: number;
  completed_demo: number;
  failed: number;
  cancelled: number;
}

export interface WorkerRegistration {
  worker_id: string;
  worker_name: string;
  processor_types: ProcessorType[];
  capabilities?: WorkerCapability[];
  hostname?: string;
  platform?: string;
  metadata?: Record<string, any>;
}

export interface WorkerSubmitOutcome {
  status: TaskStatus;
  stored_count: number;
  failed_count: number;
  synced_to_dict?: boolean;
  saved?: number;
  invalid?: number;
  audio_saved?: number;
  images_saved?: number;
}

export interface WorkerInfo {
  worker_id: string;
  worker_name: string;
  processor_types: ProcessorType[];
  status: 'online' | 'offline';
  hostname?: string;
  platform?: string;
  completed_tasks: number;
  failed_tasks: number;
  current_task_id: string | null;
  last_heartbeat_at: string;
  created_at: string;
}

export interface TaskTypeDefinition {
  key: string;
  label: string;
  execution_type: ProcessorType;
  capability: WorkerCapability | null;
  capability_mode?: 'fixed' | 'selectable';
  capabilities?: WorkerCapability[];
  claimants?: Array<'pycore' | 'chrome' | 'laravel'>;
  interactive: boolean;
  fast_promotable?: boolean;
  /** Payload key consumed by prompt-driven workers; defaults to `question`. */
  prompt_payload_field?: string;
  pycore_local_label: string;
  ui: {
    icon: string;
    badge: string;
    summary_label: string;
    color: string;
  };
}

interface ContractDocument {
  schema_version: number;
  capability_claimants: Record<string, Array<'pycore' | 'chrome'>>;
  task_contract: {
    statuses: {
      values: Record<string, TaskStatus>;
      all: string[];
      live: string[];
      terminal: string[];
      worker_reportable: string[];
    };
    events: {
      values: Record<string, string>;
      terminal: string[];
    };
    stream_events: Record<'initial' | 'transition' | 'ping' | 'close', string>;
    execution_types: Record<string, ProcessorType>;
    priorities: Record<'default' | 'manual' | 'fast' | 'maximum', number>;
    limits: Record<
      'list_default' | 'list' | 'worker_pull_default' | 'worker_pull' | 'completed' | 'long_poll_seconds' | 'history_records' | 'history_timeline' | 'event_batch',
      number
    >;
    capability_labels: Record<string, string>;
    capability_single_lanes: Record<string, ProcessorType>;
    fast_lane_capabilities: WorkerCapability[];
    chrome_capability_switches: Record<ChromeCapabilityKey, ChromeCapabilitySwitchDefinition>;
    wire_shapes: Record<string, string[]>;
    task_types: TaskTypeDefinition[];
  };
}

const TASK_WIRE_DTO_FIELDS = {
  create_result: [
    'task_id', 'execution_type', 'priority', 'is_fast_tier',
  ] as const satisfies readonly (keyof TaskCreateResult)[],
  summary: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'status', 'progress',
    'assigned_to', 'created_at', 'capability', 'priority', 'is_fast_tier',
  ] as const satisfies readonly (keyof TaskRow)[],
  worker_pull: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'status', 'payload',
    'timeout_seconds', 'priority', 'capability', 'is_fast_tier', 'created_at',
  ] as const satisfies readonly (keyof Task)[],
  status: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'capability', 'is_fast_tier',
    'status', 'priority', 'progress', 'retry_count', 'max_retries', 'timeout_seconds',
    'payload', 'result', 'error', 'assigned_to', 'assigned_at', 'timeout_at',
    'completed_at', 'created_at', 'updated_at',
  ] as const satisfies readonly (keyof TaskStatusRecord)[],
  detail: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'capability', 'is_fast_tier',
    'status', 'priority', 'progress', 'payload', 'result', 'error', 'assigned_to',
    'assigned_at', 'timeout_at', 'completed_at', 'created_at', 'updated_at',
  ] as const satisfies readonly (keyof TaskDetail)[],
  event: [
    'id', 'task_id', 'event', 'worker_id', 'attempt', 'detail', 'created_at',
  ] as const satisfies readonly (keyof TaskEvent)[],
  detail_bundle: [
    'task', 'events', 'current_phase', 'metadata',
  ] as const satisfies readonly (keyof TaskDetailBundle)[],
  current_phase: [
    'phase', 'worker_id', 'elapsed_seconds',
  ] as const satisfies readonly (keyof TaskCurrentPhase)[],
  detail_metadata: [
    'total_attempts', 'max_retries', 'will_retry', 'estimated_timeout_in_seconds',
  ] as const satisfies readonly (keyof TaskDetailMetadata)[],
  stats: [
    'total', 'pending', 'assigned', 'processing', 'completed', 'completed_demo',
    'failed', 'cancelled',
  ] as const satisfies readonly (keyof TaskStatsRecord)[],
  worker_registration: [
    'worker_id', 'worker_name', 'processor_types', 'capabilities', 'hostname',
    'platform', 'metadata',
  ] as const satisfies readonly (keyof WorkerRegistration)[],
  worker_result: [
    'task_id', 'worker_id', 'status', 'progress', 'result', 'error',
  ] as const satisfies readonly (keyof TaskResult)[],
} as const;

export const QUEUE_CENTER_CONTRACT = contractDocument as unknown as ContractDocument;
export const TASK_STATUS_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.statuses.values;
const taskStatusesForRoles = (roles: string[]): TaskStatus[] => (
  roles.map((role) => TASK_STATUS_BY_ROLE[role] ?? role)
);
export const TASK_STATUSES = taskStatusesForRoles(QUEUE_CENTER_CONTRACT.task_contract.statuses.all);
export const LIVE_TASK_STATUSES = taskStatusesForRoles(QUEUE_CENTER_CONTRACT.task_contract.statuses.live);
export const TERMINAL_TASK_STATUSES = taskStatusesForRoles(QUEUE_CENTER_CONTRACT.task_contract.statuses.terminal);
export const WORKER_RESULT_STATUSES = taskStatusesForRoles(
  QUEUE_CENTER_CONTRACT.task_contract.statuses.worker_reportable,
);
export const TASK_EVENT_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.events.values;
export const TERMINAL_TASK_EVENTS = QUEUE_CENTER_CONTRACT.task_contract.events.terminal.map(
  (role) => TASK_EVENT_BY_ROLE[role] ?? role,
);
export const TASK_STREAM_EVENT_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.stream_events;
export const EXECUTION_TYPES_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.execution_types;
export const EXECUTION_TYPES = Object.values(EXECUTION_TYPES_BY_ROLE);
export const WORKER_CAPABILITIES = Object.keys(
  QUEUE_CENTER_CONTRACT.capability_claimants,
) as WorkerCapability[];
export const TASK_CAPABILITY_BY_ROLE = Object.fromEntries(
  WORKER_CAPABILITIES.map((capability) => [capability, capability]),
) as Record<string, WorkerCapability>;
export const TASK_PRIORITIES = QUEUE_CENTER_CONTRACT.task_contract.priorities;
export const PRIORITY_FAST = TASK_PRIORITIES.fast;
export const TASK_LIMITS = QUEUE_CENTER_CONTRACT.task_contract.limits;
export const CAPABILITY_LABELS = QUEUE_CENTER_CONTRACT.task_contract.capability_labels;
export const CAPABILITY_SINGLE_LANES = QUEUE_CENTER_CONTRACT.task_contract.capability_single_lanes;
export const FAST_LANE_CAPABILITIES = QUEUE_CENTER_CONTRACT.task_contract.fast_lane_capabilities;
export const CHROME_CAPABILITY_SWITCHES = QUEUE_CENTER_CONTRACT.task_contract.chrome_capability_switches;
export const TASK_WIRE_SHAPES = QUEUE_CENTER_CONTRACT.task_contract.wire_shapes;
export const TASK_TYPE_CATALOG = QUEUE_CENTER_CONTRACT.task_contract.task_types;
export const TASK_TYPE_BY_KEY = Object.fromEntries(
  TASK_TYPE_CATALOG.map((definition) => [definition.key, definition]),
) as Record<string, TaskTypeDefinition>;
export const TASK_TYPE_KEYS = Object.fromEntries(
  TASK_TYPE_CATALOG.map((definition) => [definition.key, definition.key]),
) as Record<string, string>;
export const FAST_PROMOTABLE_TASK_TYPES = TASK_TYPE_CATALOG
  .filter((definition) => definition.fast_promotable === true)
  .map((definition) => definition.key);
export const CHROME_TASK_TYPES = TASK_TYPE_CATALOG.filter((definition) => {
  const claimants = definition.capability
    ? QUEUE_CENTER_CONTRACT.capability_claimants[definition.capability] ?? []
    : definition.claimants ?? [];
  return claimants.includes('chrome');
});

function assertTaskWireDtoCoverage(): void {
  for (const [shape, dtoFields] of Object.entries(TASK_WIRE_DTO_FIELDS)) {
    const contractFields = TASK_WIRE_SHAPES[shape] ?? [];
    const matches = contractFields.length === dtoFields.length
      && contractFields.every((field, index) => field === dtoFields[index]);
    if (!matches) {
      throw new Error(`Queue Center DTO drift detected for wire shape: ${shape}`);
    }
  }
}

assertTaskWireDtoCoverage();

export function taskTypeDefinition(taskType: unknown): TaskTypeDefinition | null {
  const key = typeof taskType === 'string' ? taskType.trim().toLowerCase() : '';
  return TASK_TYPE_BY_KEY[key] ?? null;
}

/** Read the primary prompt field declared by the central task definition. */
export function taskPromptText(taskType: unknown, payload: Record<string, unknown>): string {
  const primaryField = taskTypeDefinition(taskType)?.prompt_payload_field ?? 'question';
  const fields = Array.from(new Set([primaryField, 'text', 'source_text', 'question', 'prompt']));
  for (const field of fields) {
    const value = payload[field];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value);
}

/** Resolve and validate a worker-reportable status from the central role map. */
export function workerResultStatus(role: string): TaskStatus {
  const status = TASK_STATUS_BY_ROLE[role];
  if (!status || !WORKER_RESULT_STATUSES.includes(status)) {
    throw new Error(`Unsupported worker result status role: ${role}`);
  }
  return status;
}

export function isProcessorType(value: unknown): value is ProcessorType {
  return typeof value === 'string' && EXECUTION_TYPES.includes(value);
}

export function isWorkerCapability(value: unknown): value is WorkerCapability {
  return typeof value === 'string' && WORKER_CAPABILITIES.includes(value);
}
