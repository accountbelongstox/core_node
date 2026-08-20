/**
 * mcp-chrome adapter for the canonical Queue Center contract.
 *
 * Source: config/queue_center_contract.json
 * Aligned adapters:
 * - poly_apps/laravel_main/app/Support/QueueCenterContract.php
 * - pycore/pyutils/common/queue_center_contract.py
 * - poly_apps/pycore_laravel_wordnew_ui/core/contracts/QueueCenterContract.ts
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
export type TaskOrdering = 'queue_position' | 'priority';
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
  queue_position: number;
  priority?: number;
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
  queue_position: number;
  priority?: number;
  is_fast_tier: boolean;
}

export interface Task extends Omit<TaskRow, 'progress' | 'assigned_to'> {
  payload: TaskPayload;
  timeout_seconds: number;
  retry_count: number;
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
  attempt?: number;
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

export interface QueueProgress {
  completed: number;
  total: number;
  pending: number;
  assigned: number;
  processing: number;
  failed: number;
}

export interface QueueSliceDiff {
  queue: string;
  cursor: number;
  changed: boolean;
  cached: boolean;
  poll_after_ms: number;
  slice_limit: number;
  head_task_ids: string[];
  /** Present only when the cursor was stale; null on the cached hot path. */
  progress: QueueProgress | null;
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

export interface WorkerReleaseOutcome {
  released: number;
  skipped: number;
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
  aliases?: string[];
  label: string;
  execution_type: ProcessorType;
  capability: WorkerCapability | null;
  capability_mode?: 'fixed' | 'selectable';
  capabilities?: WorkerCapability[];
  claimants?: Array<'pycore' | 'chrome' | 'laravel'>;
  interactive: boolean;
  fast_promotable?: boolean;
  ordering: TaskOrdering;
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

export interface QueueCategoryDefinition {
  key: string;
  label: string;
  laravel_task_type: string | null;
  summary_task_type?: string;
  capability: WorkerCapability | null;
  primary_handler: 'pycore' | 'chrome' | 'laravel';
}

export interface QueueLiveCounts {
  pending: number;
  leased: number;
  processing: number;
}

interface ContractDocument {
  schema_version: number;
  realtime: {
    transport: string;
    channel: string;
    event: string;
    events: {
      worker_presence: string;
      word_audio_head: string;
      [key: string]: string;
    };
  };
  diff_delivery: {
    version: number;
    cursor_store: string;
    id_page_store: string;
    data_segment_store: string;
    id_page_limit: number;
    id_limit: number;
    data_segment_limit: number;
    head_reserve: number;
    producer_batch_limits: Record<string, number>;
    consumer_batch_limits: Record<string, number>;
    consumer_task_timeout_seconds: Record<string, number>;
    consumer_upload_retry: { initial_seconds: number; maximum_seconds: number };
    consumer_log_tags: Record<string, string[]>;
    ready_ttl_seconds: number;
    consumed_ttl_seconds: number;
  };
  endpoints: Record<string, string>;
  delivery_receipt: {
    stages: Record<string, string>;
    worker_kinds: string[];
    task_id_limit_source: string;
  };
  control_names: string[];
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
    progress_stages: Record<'accepted' | 'synthesizing' | 'uploading' | 'finalizing' | 'completed', number>;
    limits: Record<
      'list_default' | 'list' | 'monitor' | 'worker_pull_default' | 'worker_pull' | 'completed' | 'long_poll_seconds' | 'history_records' | 'history_timeline' | 'event_batch',
      number
    >;
    capability_labels: Record<string, string>;
    capability_single_lanes: Record<string, ProcessorType>;
    fast_lane_capabilities: WorkerCapability[];
    chrome_capability_switches: Record<ChromeCapabilityKey, ChromeCapabilitySwitchDefinition>;
    wire_shapes: Record<string, string[]>;
    task_types: TaskTypeDefinition[];
  };
  categories: QueueCategoryDefinition[];
}

const TASK_WIRE_DTO_FIELDS = {
  create_result: [
    'task_id', 'execution_type', 'queue_position', 'priority', 'is_fast_tier',
  ] as const satisfies readonly (keyof TaskCreateResult)[],
  summary: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'status', 'progress',
    'assigned_to', 'created_at', 'capability', 'queue_position', 'priority', 'is_fast_tier',
  ] as const satisfies readonly (keyof TaskRow)[],
  worker_pull: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'status', 'payload',
    'timeout_seconds', 'retry_count', 'queue_position', 'priority', 'capability', 'is_fast_tier', 'created_at',
  ] as const satisfies readonly (keyof Task)[],
  status: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'capability', 'is_fast_tier',
    'status', 'queue_position', 'priority', 'progress', 'retry_count', 'max_retries', 'timeout_seconds',
    'payload', 'result', 'error', 'assigned_to', 'assigned_at', 'timeout_at',
    'completed_at', 'created_at', 'updated_at',
  ] as const satisfies readonly (keyof TaskStatusRecord)[],
  detail: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'capability', 'is_fast_tier',
    'status', 'queue_position', 'priority', 'progress', 'payload', 'result', 'error', 'assigned_to',
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
    'task_id', 'worker_id', 'attempt', 'status', 'progress', 'result', 'error',
  ] as const satisfies readonly (keyof TaskResult)[],
} as const;

export const QUEUE_CENTER_CONTRACT = contractDocument as unknown as ContractDocument;
export const QUEUE_CENTER_SCHEMA_VERSION = QUEUE_CENTER_CONTRACT.schema_version;
export const QUEUE_CENTER_ENDPOINTS = QUEUE_CENTER_CONTRACT.endpoints;
export type QueueCenterEndpointRole = keyof typeof contractDocument.endpoints;

/**
 * Render one contract-owned Laravel endpoint path. Templates live in
 * config/queue_center_contract.json `endpoints`; token values are URL path
 * segments and are percent-encoded here.
 */
export function queueCenterEndpoint(
  role: QueueCenterEndpointRole,
  tokens: Record<string, string | number> = {},
): string {
  let path = QUEUE_CENTER_ENDPOINTS[role];
  for (const [key, value] of Object.entries(tokens)) {
    path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  return path;
}
export const QUEUE_CENTER_REALTIME_EVENTS = QUEUE_CENTER_CONTRACT.realtime.events;
export const DIFF_DELIVERY = QUEUE_CENTER_CONTRACT.diff_delivery;
/** Word-validity verification defaults (batch size, languages, source marker, idle cadence). */
export const WORD_VALIDITY_CONFIG = contractDocument.word_validity;
export const DELIVERY_RECEIPT = QUEUE_CENTER_CONTRACT.delivery_receipt;
export const QUEUE_CENTER_CONTROL_NAMES = QUEUE_CENTER_CONTRACT.control_names;
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
export const TASK_TYPE_CATALOG = QUEUE_CENTER_CONTRACT.task_contract.task_types as TaskTypeDefinition[];
export const QUEUE_CATEGORY_CATALOG = QUEUE_CENTER_CONTRACT.categories;
export const TASK_SUMMARY_CATEGORY_KEYS = QUEUE_CATEGORY_CATALOG.reduce(
  (categories, definition) => {
    const taskType = definition.summary_task_type;
    if (!taskType) return categories;
    if (!categories[taskType]) categories[taskType] = [];
    categories[taskType].push(definition.key);
    return categories;
  },
  {} as Record<string, string[]>,
);
function buildTaskTypeIndex(definitions: TaskTypeDefinition[]): Record<string, TaskTypeDefinition> {
  const index: Record<string, TaskTypeDefinition> = {};
  for (const definition of definitions) {
    if (definition.ordering !== 'queue_position' && definition.ordering !== 'priority') {
      throw new Error(`Queue Center task type has invalid ordering: ${definition.key}`);
    }
    for (const name of [definition.key, ...(definition.aliases ?? [])]) {
      const normalized = name.trim().toLowerCase();
      if (!normalized || index[normalized]) {
        throw new Error(`Queue Center task type name is duplicated: ${normalized}`);
      }
      index[normalized] = definition;
    }
  }
  return index;
}

export const TASK_TYPE_BY_KEY = buildTaskTypeIndex(TASK_TYPE_CATALOG);
export const TASK_TYPE_KEYS = Object.fromEntries(
  TASK_TYPE_CATALOG.map((definition) => [definition.key, definition.key]),
) as Record<string, string>;
export const QUEUE_CENTER_QUEUE_POSITION_CONTROLS = QUEUE_CENTER_CONTROL_NAMES.filter(
  (taskType) => TASK_TYPE_BY_KEY[taskType]?.ordering === 'queue_position',
);
export const QUEUE_CENTER_QUEUE_POSITION_TASK_ALIASES = TASK_TYPE_CATALOG
  .filter((definition) => definition.ordering === 'queue_position')
  .flatMap((definition) => definition.aliases ?? []);
export type QueuePositionTaskAlias = (typeof QUEUE_CENTER_QUEUE_POSITION_TASK_ALIASES)[number];
export const FAST_PROMOTABLE_TASK_TYPES = TASK_TYPE_CATALOG
  .filter((definition) => definition.fast_promotable === true)
  .map((definition) => definition.key);
export function taskTypeClaimants(taskType: string): Array<'pycore' | 'chrome' | 'laravel'> {
  const definition = taskTypeDefinition(taskType);
  if (!definition) return [];
  if (definition.claimants) return [...definition.claimants];
  return definition.capability
    ? [...(QUEUE_CENTER_CONTRACT.capability_claimants[definition.capability] ?? [])]
    : [];
}

export function taskTypesForClaimant(
  claimant: 'pycore' | 'chrome' | 'laravel',
  capability?: WorkerCapability,
): string[] {
  return TASK_TYPE_CATALOG
    .filter((definition) => !capability || definition.capability === capability)
    .filter((definition) => taskTypeClaimants(definition.key).includes(claimant))
    .map((definition) => definition.key);
}

export const CHROME_TASK_TYPES = TASK_TYPE_CATALOG.filter((definition) => {
  return taskTypeClaimants(definition.key).includes('chrome');
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

/**
 * Single ordering authority for every end: queue_position-ordered (Queue
 * Center audio) tasks sort and bump by Laravel head tickets only; all other
 * tasks keep the contract-defined numeric priority.
 */
export function taskTypeOrdering(taskType: unknown): TaskOrdering {
  const definition = taskTypeDefinition(taskType);
  if (!definition) return 'priority';
  if (definition.ordering !== 'queue_position' && definition.ordering !== 'priority') {
    throw new Error(`Queue Center task type has invalid ordering: ${String(taskType ?? '')}`);
  }
  return definition.ordering;
}

export function isQueuePositionOrderedTask(taskType: unknown): boolean {
  return taskTypeOrdering(taskType) === 'queue_position';
}

export function taskOrderValue(task: Pick<TaskRow, 'task_type' | 'queue_position' | 'priority'>): number {
  const field = taskTypeOrdering(task.task_type);
  return Number(task[field] ?? 0);
}

export function compareTasksByContract(
  left: Pick<TaskRow, 'task_type' | 'queue_position' | 'priority'>,
  right: Pick<TaskRow, 'task_type' | 'queue_position' | 'priority'>,
): number {
  return taskOrderValue(right) - taskOrderValue(left);
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
