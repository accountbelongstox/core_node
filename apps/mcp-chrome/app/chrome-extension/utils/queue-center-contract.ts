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

export interface TaskDetailBundle {
  task: TaskDetail;
  events: TaskEvent[];
  current_phase: {
    phase: string | null;
    worker_id: string | null;
    elapsed_seconds: number | null;
  };
  metadata: {
    total_attempts: number;
    max_retries: number;
    will_retry: boolean;
    estimated_timeout_in_seconds: number | null;
  };
}

export interface TaskResult {
  task_id: string;
  worker_id: string;
  status: TaskStatus;
  progress?: number;
  result?: Record<string, any>;
  error?: string;
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
  status: string;
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
  interactive: boolean;
  fast_promotable?: boolean;
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
    execution_types: Record<string, ProcessorType>;
    priorities: Record<'default' | 'manual' | 'fast' | 'maximum', number>;
    capability_labels: Record<string, string>;
    capability_single_lanes: Record<string, ProcessorType>;
    wire_shapes: Record<string, string[]>;
    task_types: TaskTypeDefinition[];
  };
}

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
export const EXECUTION_TYPES_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.execution_types;
export const EXECUTION_TYPES = Object.values(EXECUTION_TYPES_BY_ROLE);
export const WORKER_CAPABILITIES = Object.keys(
  QUEUE_CENTER_CONTRACT.capability_claimants,
) as WorkerCapability[];
export const TASK_PRIORITIES = QUEUE_CENTER_CONTRACT.task_contract.priorities;
export const PRIORITY_FAST = TASK_PRIORITIES.fast;
export const CAPABILITY_SINGLE_LANES = QUEUE_CENTER_CONTRACT.task_contract.capability_single_lanes;
export const TASK_WIRE_SHAPES = QUEUE_CENTER_CONTRACT.task_contract.wire_shapes;
export const TASK_TYPE_CATALOG = QUEUE_CENTER_CONTRACT.task_contract.task_types;
export const TASK_TYPE_BY_KEY = Object.fromEntries(
  TASK_TYPE_CATALOG.map((definition) => [definition.key, definition]),
) as Record<string, TaskTypeDefinition>;
export const CHROME_TASK_TYPES = TASK_TYPE_CATALOG.filter((definition) => {
  const claimants = definition.capability
    ? QUEUE_CENTER_CONTRACT.capability_claimants[definition.capability] ?? []
    : definition.claimants ?? [];
  return claimants.includes('chrome');
});

export function taskTypeDefinition(taskType: unknown): TaskTypeDefinition | null {
  const key = typeof taskType === 'string' ? taskType.trim().toLowerCase() : '';
  return TASK_TYPE_BY_KEY[key] ?? null;
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.includes(value);
}

export function isProcessorType(value: unknown): value is ProcessorType {
  return typeof value === 'string' && EXECUTION_TYPES.includes(value);
}

export function isWorkerCapability(value: unknown): value is WorkerCapability {
  return typeof value === 'string' && WORKER_CAPABILITIES.includes(value);
}
