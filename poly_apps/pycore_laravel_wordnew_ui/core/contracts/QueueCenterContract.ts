/**
 * TypeScript adapter for the canonical Queue Center and distributed-task contract.
 *
 * Source: config/queue_center_contract.json
 * Aligned adapters:
 * - pycore/pyutils/common/queue_center_contract.py
 * - poly_apps/laravel_main/app/Support/QueueCenterContract.php
 * - apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts
 *
 * This adapter is shared by Pycore UI and Laravel-manager UI. Change task
 * statuses, lanes, capabilities, task routes, priorities, and wire fields only
 * in the JSON source so Laravel, Pycore, mcp-chrome, and both UIs update together.
 */
import contractDocument from '../../../../config/queue_center_contract.json';

export type QueueCenterControlName = (typeof contractDocument.control_names)[number];
export type QueueCenterScope = keyof typeof contractDocument.section_scopes;
export type QueueCenterSectionLifecycle = 'off' | 'starting' | 'on' | 'error';
export type PcQueueHandler = 'chrome' | 'pycore';
export type QueueDeliveryStage = 'waiting' | 'laravel_received' | 'worker_received' | 'completed' | 'failed';
export type QueueDeliveryVisualStage = QueueDeliveryStage
  | 'none'
  | 'missing'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'playing';
export type QueueDeliveryResourceKind = 'audio' | 'translation';

export type GlobalTaskStatus = string;
export type GlobalTaskOrdering = 'queue_position' | 'priority';
export type GlobalTaskExecutionType = string;
export type GlobalTaskCapability = string;
export type GlobalTaskPayload = Record<string, unknown>;
export type GlobalTaskResult = Record<string, unknown>;

export interface GlobalTaskCreateResult {
  task_id: string;
  execution_type: GlobalTaskExecutionType;
  queue_position: number;
  priority?: number;
  is_fast_tier: boolean;
}

export interface GlobalTaskStatsRecord {
  total: number;
  pending: number;
  assigned: number;
  processing: number;
  completed: number;
  completed_demo: number;
  failed: number;
  cancelled: number;
}

export interface GlobalTaskSummary {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: GlobalTaskExecutionType;
  status: GlobalTaskStatus;
  progress: number;
  assigned_to: string | null;
  created_at: string | null;
  capability: GlobalTaskCapability | null;
  claimants?: Array<'pycore' | 'chrome' | 'laravel'>;
  queue_position: number;
  priority?: number;
  is_fast_tier: boolean;
}

export interface GlobalTaskWorkerRecord {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: GlobalTaskExecutionType;
  status: GlobalTaskStatus;
  payload: GlobalTaskPayload;
  timeout_seconds: number;
  retry_count: number;
  queue_position: number;
  priority?: number;
  capability: GlobalTaskCapability | null;
  is_fast_tier: boolean;
  created_at: string | null;
}

export interface QueueCenterIdPageEntry {
  task_id: string;
  status: GlobalTaskStatus;
  queue_position: number;
  priority?: number;
}

export interface QueueCenterIdPage {
  page: number;
  ids: QueueCenterIdPageEntry[];
}

export interface QueueCenterIdPagesResponse {
  queue: string;
  revision: number;
  cursor: number;
  head_ids: string[];
  page_size: number;
  id_page_limit: number;
  id_limit: number;
  pages: QueueCenterIdPage[];
}

export interface QueueCenterPageDataResponse {
  queue: string;
  data_segment_limit: number;
  count: number;
  items: GlobalTaskWorkerRecord[];
}

export interface QueueCenterQueueStats {
  pending: number;
  assigned: number;
  processing: number;
  total: number;
}

export interface QueueCenterWorkerPresence {
  id: string;
  kind: 'pycore' | 'chrome' | 'laravel' | 'worker' | string;
  name: string;
  processor_types: string[];
  capabilities: string[];
  online: boolean;
  last_seen: string | null;
  claimed: number;
  hostname: string | null;
}

export interface QueueTaskDeliveryReceipt {
  task_id: string;
  task_type: string | null;
  stage: QueueDeliveryStage;
  task_status: GlobalTaskStatus | null;
  queue_position: number | null;
  priority?: number | null;
  worker: QueueCenterWorkerPresence | null;
  updated_at: string | null;
}

export interface QueueCenterReceiptsResponse {
  receipts: QueueTaskDeliveryReceipt[];
  workers: QueueCenterWorkerPresence[];
}

export interface QueueCenterOverviewResponse {
  queues: Partial<Record<QueueCenterControlName, QueueCenterQueueStats>>;
  workers?: QueueCenterWorkerPresence[];
  realtime: QueueCenterRealtimeConnection;
}

export interface QueueCenterRealtimeConnection {
  transport: string;
  app_key: string;
  host: string;
  port: number;
  scheme: string;
  channel: string;
  event: string;
  revision: number;
}

export interface QueueCenterRealtimeEvent {
  id: number;
  event: string;
  data: Record<string, unknown>;
}

export interface QueueCenterRealtimeReplay {
  cursor: number;
  events: QueueCenterRealtimeEvent[];
  has_more: boolean;
}

export interface GlobalTaskDetailRecord extends GlobalTaskSummary {
  payload: GlobalTaskPayload;
  result: GlobalTaskResult | null;
  error: string | null;
  assigned_at: string | null;
  timeout_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
}

export interface GlobalTaskStatusRecord extends GlobalTaskDetailRecord {
  retry_count: number;
  max_retries: number;
  timeout_seconds: number;
}

export interface GlobalTaskEventRecord {
  id: number | string;
  task_id: string;
  event: string;
  worker_id: string | null;
  attempt: number | null;
  detail: Record<string, unknown> | null;
  created_at: string | null;
  /** SSE-only resume cursor; snapshots omit it. */
  _id?: number | string;
}

export interface GlobalTaskCurrentPhase {
  phase: string | null;
  worker_id: string | null;
  elapsed_seconds: number | null;
}

export interface GlobalTaskDetailMetadata {
  total_attempts: number;
  max_retries: number;
  will_retry: boolean;
  estimated_timeout_in_seconds: number | null;
}

export interface GlobalTaskDetailBundle {
  task: GlobalTaskDetailRecord;
  events: GlobalTaskEventRecord[];
  current_phase: GlobalTaskCurrentPhase;
  metadata: GlobalTaskDetailMetadata;
}

export interface GlobalTaskWorkerRegistration {
  worker_id: string;
  worker_name: string;
  processor_types: GlobalTaskExecutionType[];
  capabilities?: GlobalTaskCapability[];
  hostname?: string;
  platform?: string;
  metadata?: Record<string, unknown>;
}

export interface GlobalTaskWorkerResult {
  task_id: string;
  worker_id: string;
  attempt?: number;
  status: GlobalTaskStatus;
  progress?: number;
  result?: GlobalTaskResult;
  error?: string;
}

export interface GlobalTaskTypeDefinition {
  key: string;
  aliases?: string[];
  label: string;
  execution_type: GlobalTaskExecutionType;
  capability: GlobalTaskCapability | null;
  capability_mode?: 'fixed' | 'selectable';
  capabilities?: GlobalTaskCapability[];
  claimants?: Array<'pycore' | 'chrome' | 'laravel'>;
  interactive: boolean;
  fast_promotable?: boolean;
  ordering: GlobalTaskOrdering;
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

export interface GlobalTaskOrderingRecord {
  task_type?: unknown;
  queue_position?: number | null;
  priority?: number | null;
}

export interface PcQueueSample {
  word?: string;
  language?: string;
  source_key?: string;
  title?: string;
  id?: string | number;
  [key: string]: unknown;
}

export interface PcQueueCategory {
  key: string;
  label: string;
  capability: string | null;
  primary_handler: PcQueueHandler;
  claimants: PcQueueHandler[];
  active_handlers: PcQueueHandler[];
  pending: number;
  processing: number;
  leased: number;
  total: number;
  by_language?: Record<string, number>;
  by_status?: Record<string, number>;
  sample?: PcQueueSample[];
  engine?: Record<string, unknown> | string | null;
}

export interface PcQueueWorker {
  id: string;
  kind: 'chrome' | 'pycore' | string;
  name?: string;
  processor_types: string[];
  online: boolean;
  last_seen: string | null;
  claimed: number;
}

export interface PcQueueEngines {
  tts?: { active?: string | null; priority: string[] };
  stt?: { priority: string[] };
  image?: { priority: string[] };
  translation?: { priority: string[] };
}

export interface QueueCenterToggleEnvelope {
  requested_by: string | null;
  enabled: boolean;
  reason: string | null;
  graceful_stop: boolean;
  paused_by_user: boolean | null;
}

export interface QueueCenterControlMetrics {
  pending: number;
  processing: number;
  leased: number;
  completed?: number;
  total: number;
}

export interface QueueCenterWorkerMetrics {
  online: boolean;
  claimed: number;
  ok: number | null;
  fail: number | null;
  last_heartbeat: string | null;
}

export interface QueueCenterErrorState {
  last_error: string | null;
  error_code: string | null;
}

export interface QueueCenterControlState {
  configured: boolean;
  requested?: boolean;
  running: boolean;
  owner: string;
  requested_by?: string;
  reason?: string | null;
  graceful_stop?: boolean;
  error_code?: string | null;
}

export interface QueueCenterSectionContract {
  type: QueueCenterScope;
  category: string;
  queue: QueueCenterControlMetrics;
  worker: QueueCenterWorkerMetrics;
  toggle: QueueCenterToggleEnvelope;
  lifecycle: QueueCenterSectionLifecycle;
  error_code: string | null;
  last_error: string | null;
  observed_at: string | null;
  age_s: number | null;
  stale: boolean;
}

export interface QueueCenterControlResponse {
  success: boolean;
  control: QueueCenterControlName;
  enabled: boolean;
  operation_id?: string;
  requested_by?: string | null;
  graceful_stop?: boolean;
  error?: string;
  result?: unknown;
}

export interface PcQueueOverview {
  success: boolean;
  generated_at?: string;
  observed_at?: string | null;
  age_s?: number | null;
  stale?: boolean;
  laravel_reachable: boolean;
  laravel_snapshot_age_s?: number | null;
  categories: PcQueueCategory[];
  workers: PcQueueWorker[];
  engines: PcQueueEngines;
  fast_lane?: Record<string, unknown>;
  source?: string;
  degraded?: boolean;
  diagnostics?: Record<string, unknown>;
  http_status?: number | null;
  laravel_endpoint?: string | null;
  error?: string;
}

interface ContractDocument {
  schema_version: number;
  realtime: {
    transport: string;
    channel: string;
    event: string;
    events: Record<string, string>;
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
    stages: Record<string, QueueDeliveryStage>;
    worker_kinds: string[];
    task_id_limit_source: string;
  };
  control_names: QueueCenterControlName[];
  callback_queue_roles: Record<string, 'transport' | 'consumer' | 'monitor' | 'signal' | 'maintainer'>;
  section_contract_defaults: Omit<QueueCenterSectionContract, 'type' | 'category' | 'observed_at'>;
  capability_claimants: Record<string, PcQueueHandler[]>;
  section_scopes: Record<QueueCenterScope, {
    category: string;
    category_keys: string[];
    queue_metrics: boolean;
  }>;
  task_contract: {
    statuses: {
      values: Record<string, GlobalTaskStatus>;
      all: GlobalTaskStatus[];
      live: GlobalTaskStatus[];
      terminal: GlobalTaskStatus[];
      worker_reportable: GlobalTaskStatus[];
    };
    events: {
      values: Record<string, string>;
      terminal: string[];
    };
    stream_events: Record<'initial' | 'transition' | 'ping' | 'close', string>;
    execution_types: Record<string, GlobalTaskExecutionType>;
    priorities: Record<'default' | 'manual' | 'fast' | 'maximum', number>;
    progress_stages: Record<'accepted' | 'synthesizing' | 'uploading' | 'finalizing' | 'completed', number>;
    limits: Record<
      'list_default' | 'list' | 'monitor' | 'worker_pull_default' | 'worker_pull' | 'completed' | 'long_poll_seconds' | 'history_records' | 'history_timeline' | 'event_batch',
      number
    >;
    capability_labels: Record<GlobalTaskCapability, string>;
    capability_single_lanes: Record<GlobalTaskCapability, GlobalTaskExecutionType>;
    fast_lane_capabilities: GlobalTaskCapability[];
    wire_shapes: Record<string, string[]>;
    task_types: GlobalTaskTypeDefinition[];
    history_buckets: {
      all: string[];
      exact_aliases: Record<string, string>;
      token_rules: Array<{ bucket: string; all: string[]; any: string[] }>;
      fallback: string;
    };
  };
  categories: Array<{
    key: string;
    label: string;
    laravel_task_type: string | null;
    capability: string | null;
    primary_handler: PcQueueHandler;
  }>;
}

const GLOBAL_TASK_WIRE_DTO_FIELDS = {
  create_result: [
    'task_id', 'execution_type', 'queue_position', 'priority', 'is_fast_tier',
  ] as const satisfies readonly (keyof GlobalTaskCreateResult)[],
  summary: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'status', 'progress',
    'assigned_to', 'created_at', 'capability', 'queue_position', 'priority', 'is_fast_tier',
  ] as const satisfies readonly (keyof GlobalTaskSummary)[],
  worker_pull: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'status', 'payload',
    'timeout_seconds', 'retry_count', 'queue_position', 'priority', 'capability', 'is_fast_tier', 'created_at',
  ] as const satisfies readonly (keyof GlobalTaskWorkerRecord)[],
  status: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'capability', 'is_fast_tier',
    'status', 'queue_position', 'priority', 'progress', 'retry_count', 'max_retries', 'timeout_seconds',
    'payload', 'result', 'error', 'assigned_to', 'assigned_at', 'timeout_at',
    'completed_at', 'created_at', 'updated_at',
  ] as const satisfies readonly (keyof GlobalTaskStatusRecord)[],
  detail: [
    'task_id', 'app_name', 'task_type', 'execution_type', 'capability', 'is_fast_tier',
    'status', 'queue_position', 'priority', 'progress', 'payload', 'result', 'error', 'assigned_to',
    'assigned_at', 'timeout_at', 'completed_at', 'created_at', 'updated_at',
  ] as const satisfies readonly (keyof GlobalTaskDetailRecord)[],
  event: [
    'id', 'task_id', 'event', 'worker_id', 'attempt', 'detail', 'created_at',
  ] as const satisfies readonly (keyof GlobalTaskEventRecord)[],
  detail_bundle: [
    'task', 'events', 'current_phase', 'metadata',
  ] as const satisfies readonly (keyof GlobalTaskDetailBundle)[],
  current_phase: [
    'phase', 'worker_id', 'elapsed_seconds',
  ] as const satisfies readonly (keyof GlobalTaskCurrentPhase)[],
  detail_metadata: [
    'total_attempts', 'max_retries', 'will_retry', 'estimated_timeout_in_seconds',
  ] as const satisfies readonly (keyof GlobalTaskDetailMetadata)[],
  stats: [
    'total', 'pending', 'assigned', 'processing', 'completed', 'completed_demo',
    'failed', 'cancelled',
  ] as const satisfies readonly (keyof GlobalTaskStatsRecord)[],
  worker_registration: [
    'worker_id', 'worker_name', 'processor_types', 'capabilities', 'hostname',
    'platform', 'metadata',
  ] as const satisfies readonly (keyof GlobalTaskWorkerRegistration)[],
  worker_result: [
    'task_id', 'worker_id', 'attempt', 'status', 'progress', 'result', 'error',
  ] as const satisfies readonly (keyof GlobalTaskWorkerResult)[],
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
export const QUEUE_CENTER_DIFF_DELIVERY = QUEUE_CENTER_CONTRACT.diff_delivery;
export const QUEUE_CENTER_DELIVERY_RECEIPT = QUEUE_CENTER_CONTRACT.delivery_receipt;
export const QUEUE_CENTER_TASK_PROGRESS = QUEUE_CENTER_CONTRACT.task_contract.progress_stages;
export const QUEUE_CENTER_CONTROL_NAMES = QUEUE_CENTER_CONTRACT.control_names;
export const QUEUE_CENTER_CALLBACK_ROLES = QUEUE_CENTER_CONTRACT.callback_queue_roles;
export const QUEUE_CENTER_SCOPES = Object.keys(QUEUE_CENTER_CONTRACT.section_scopes) as QueueCenterScope[];
const GLOBAL_TASK_TYPE_DEFINITIONS = QUEUE_CENTER_CONTRACT.task_contract.task_types as GlobalTaskTypeDefinition[];
export const QUEUE_CENTER_CATEGORY_KEYS = QUEUE_CENTER_CONTRACT.categories.map((category) => category.key);
export const QUEUE_CENTER_CATEGORY_CATALOG = QUEUE_CENTER_CONTRACT.categories.map((category) => {
  const taskType = GLOBAL_TASK_TYPE_DEFINITIONS.find(
    (definition) => definition.key === category.laravel_task_type,
  );
  return {
    ...category,
    claimants: taskType?.claimants ?? (category.capability
      ? QUEUE_CENTER_CONTRACT.capability_claimants[category.capability] ?? []
      : [category.primary_handler]),
  };
});
export const GLOBAL_TASK_STATUSES_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.statuses.values;
const taskStatusesForRoles = (roles: string[]): GlobalTaskStatus[] => (
  roles.map((role) => GLOBAL_TASK_STATUSES_BY_ROLE[role] ?? role)
);
export const GLOBAL_TASK_STATUSES = taskStatusesForRoles(QUEUE_CENTER_CONTRACT.task_contract.statuses.all);
export const GLOBAL_TASK_LIVE_STATUSES = taskStatusesForRoles(QUEUE_CENTER_CONTRACT.task_contract.statuses.live);
export const GLOBAL_TASK_TERMINAL_STATUSES = taskStatusesForRoles(QUEUE_CENTER_CONTRACT.task_contract.statuses.terminal);
export const GLOBAL_TASK_WORKER_RESULT_STATUSES = taskStatusesForRoles(
  QUEUE_CENTER_CONTRACT.task_contract.statuses.worker_reportable,
);
export const GLOBAL_TASK_EVENTS_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.events.values;
export const GLOBAL_TASK_TERMINAL_EVENTS = QUEUE_CENTER_CONTRACT.task_contract.events.terminal.map(
  (role) => GLOBAL_TASK_EVENTS_BY_ROLE[role] ?? role,
);
export const GLOBAL_TASK_STREAM_EVENTS_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.stream_events;
export const GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.execution_types;
export const GLOBAL_TASK_EXECUTION_TYPES = Object.values(GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE);
export const GLOBAL_TASK_CAPABILITIES = Object.keys(
  QUEUE_CENTER_CONTRACT.capability_claimants,
) as GlobalTaskCapability[];
export const GLOBAL_TASK_CAPABILITIES_BY_ROLE = Object.fromEntries(
  GLOBAL_TASK_CAPABILITIES.map((capability) => [capability, capability]),
) as Record<string, GlobalTaskCapability>;
export const GLOBAL_TASK_CAPABILITY_LABELS = QUEUE_CENTER_CONTRACT.task_contract.capability_labels;
export const GLOBAL_TASK_PRIORITIES = QUEUE_CENTER_CONTRACT.task_contract.priorities;
export const GLOBAL_TASK_LIMITS = QUEUE_CENTER_CONTRACT.task_contract.limits;
export const GLOBAL_TASK_CAPABILITY_SINGLE_LANES = QUEUE_CENTER_CONTRACT.task_contract.capability_single_lanes;
export const GLOBAL_TASK_FAST_LANE_CAPABILITIES = QUEUE_CENTER_CONTRACT.task_contract.fast_lane_capabilities;
export const GLOBAL_TASK_WIRE_SHAPES = QUEUE_CENTER_CONTRACT.task_contract.wire_shapes;
export const GLOBAL_TASK_TYPE_CATALOG = GLOBAL_TASK_TYPE_DEFINITIONS;
function buildGlobalTaskTypeIndex(
  definitions: GlobalTaskTypeDefinition[],
): Record<string, GlobalTaskTypeDefinition> {
  const index: Record<string, GlobalTaskTypeDefinition> = {};
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

export const GLOBAL_TASK_TYPE_BY_KEY = buildGlobalTaskTypeIndex(GLOBAL_TASK_TYPE_CATALOG);
export const QUEUE_CENTER_QUEUE_POSITION_CONTROLS = QUEUE_CENTER_CONTROL_NAMES.filter(
  (taskType) => GLOBAL_TASK_TYPE_BY_KEY[taskType]?.ordering === 'queue_position',
);
export const GLOBAL_QUEUE_POSITION_TASK_ALIASES = GLOBAL_TASK_TYPE_CATALOG
  .filter((definition) => definition.ordering === 'queue_position')
  .flatMap((definition) => definition.aliases ?? []);
export type GlobalQueuePositionTaskAlias = (typeof GLOBAL_QUEUE_POSITION_TASK_ALIASES)[number];
export const GLOBAL_TASK_FAST_PROMOTABLE_TYPES = GLOBAL_TASK_TYPE_CATALOG
  .filter((definition) => definition.fast_promotable === true)
  .map((definition) => definition.key);
export function getGlobalTaskTypeClaimants(
  taskType: string,
): Array<'pycore' | 'chrome' | 'laravel'> {
  const definition = getGlobalTaskTypeDefinition(taskType);
  if (!definition) return [];
  if (definition.claimants) return [...definition.claimants];
  return definition.capability
    ? [...(QUEUE_CENTER_CONTRACT.capability_claimants[definition.capability] ?? [])]
    : [];
}

export function getGlobalTaskTypesForClaimant(
  claimant: 'pycore' | 'chrome' | 'laravel',
  capability?: GlobalTaskCapability,
): string[] {
  return GLOBAL_TASK_TYPE_CATALOG
    .filter((definition) => !capability || definition.capability === capability)
    .filter((definition) => getGlobalTaskTypeClaimants(definition.key).includes(claimant))
    .map((definition) => definition.key);
}

export const GLOBAL_TASK_HISTORY_BUCKETS = QUEUE_CENTER_CONTRACT.task_contract.history_buckets.all;

function assertGlobalTaskWireDtoCoverage(): void {
  for (const [shape, dtoFields] of Object.entries(GLOBAL_TASK_WIRE_DTO_FIELDS)) {
    const contractFields = GLOBAL_TASK_WIRE_SHAPES[shape] ?? [];
    const matches = contractFields.length === dtoFields.length
      && contractFields.every((field, index) => field === dtoFields[index]);
    if (!matches) {
      throw new Error(`Queue Center DTO drift detected for wire shape: ${shape}`);
    }
  }
}

assertGlobalTaskWireDtoCoverage();

export function getGlobalTaskTypeDefinition(taskType: unknown): GlobalTaskTypeDefinition | null {
  const key = typeof taskType === 'string' ? taskType.trim().toLowerCase() : '';
  return GLOBAL_TASK_TYPE_BY_KEY[key] ?? null;
}

/**
 * Single ordering authority for every end: queue_position-ordered (Queue
 * Center audio) tasks sort and bump by Laravel head tickets only; all other
 * tasks keep the contract-defined numeric priority.
 */
export function getGlobalTaskOrdering(taskType: unknown): GlobalTaskOrdering {
  const definition = getGlobalTaskTypeDefinition(taskType);
  if (!definition) return 'priority';
  if (definition.ordering !== 'queue_position' && definition.ordering !== 'priority') {
    throw new Error(`Queue Center task type has invalid ordering: ${String(taskType ?? '')}`);
  }
  return definition.ordering;
}

export function isGlobalTaskQueuePositionOrdered(taskType: unknown): boolean {
  return getGlobalTaskOrdering(taskType) === 'queue_position';
}

export function getGlobalTaskOrderValue(
  task: GlobalTaskOrderingRecord,
): number {
  const field = getGlobalTaskOrdering(task.task_type);
  return Number(task[field] ?? 0);
}

export function compareGlobalTasksByContract(
  left: GlobalTaskOrderingRecord,
  right: GlobalTaskOrderingRecord,
): number {
  return getGlobalTaskOrderValue(right) - getGlobalTaskOrderValue(left);
}

export function getGlobalTaskPromptPayloadField(taskType: unknown): string {
  return getGlobalTaskTypeDefinition(taskType)?.prompt_payload_field ?? 'question';
}

/** Read prompt text by the central primary field with legacy payload fallbacks. */
export function getGlobalTaskPromptText(
  taskType: unknown,
  payload: GlobalTaskPayload,
): string {
  const fields = Array.from(new Set([
    getGlobalTaskPromptPayloadField(taskType),
    'text',
    'source_text',
    'question',
    'prompt',
  ]));
  for (const field of fields) {
    const value = payload[field];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}

export function normalizeGlobalTaskHistoryType(rawTaskType: unknown): string {
  const history = QUEUE_CENTER_CONTRACT.task_contract.history_buckets;
  const taskType = typeof rawTaskType === 'string' ? rawTaskType.trim().toLowerCase() : '';
  if (!taskType) return history.fallback;
  if (history.all.includes(taskType)) return taskType;
  if (history.exact_aliases[taskType]) return history.exact_aliases[taskType];

  for (const rule of history.token_rules) {
    const matchesAll = rule.all.every((token) => taskType.includes(token));
    const matchesAny = rule.any.length === 0 || rule.any.some((token) => taskType.includes(token));
    if (matchesAll && matchesAny) return rule.bucket;
  }
  return history.fallback;
}

export function isGlobalTaskStatus(value: unknown): value is GlobalTaskStatus {
  return typeof value === 'string' && GLOBAL_TASK_STATUSES.includes(value);
}

export function isGlobalTaskExecutionType(value: unknown): value is GlobalTaskExecutionType {
  return typeof value === 'string' && GLOBAL_TASK_EXECUTION_TYPES.includes(value);
}

export function isGlobalTaskCapability(value: unknown): value is GlobalTaskCapability {
  return typeof value === 'string' && GLOBAL_TASK_CAPABILITIES.includes(value);
}

const toNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : 0
);

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const toNullableString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

export function isQueueCenterScope(value: unknown): value is QueueCenterScope {
  return typeof value === 'string' && QUEUE_CENTER_SCOPES.includes(value as QueueCenterScope);
}

export function buildEmptyQueueCenterSection(
  scope: QueueCenterScope,
  observedAt: string | null = null,
): QueueCenterSectionContract {
  const definition = QUEUE_CENTER_CONTRACT.section_scopes[scope];
  const defaults = QUEUE_CENTER_CONTRACT.section_contract_defaults;
  return {
    type: scope,
    category: definition.category,
    queue: { ...defaults.queue },
    worker: { ...defaults.worker },
    toggle: { ...defaults.toggle },
    lifecycle: defaults.lifecycle,
    error_code: defaults.error_code,
    last_error: defaults.last_error,
    observed_at: observedAt,
    age_s: defaults.age_s,
    stale: defaults.stale,
  };
}

export function buildDefaultQueueCenterSections(
  observedAt: string | null = null,
): Record<QueueCenterScope, QueueCenterSectionContract> {
  return Object.fromEntries(
    QUEUE_CENTER_SCOPES.map((scope) => [scope, buildEmptyQueueCenterSection(scope, observedAt)]),
  ) as Record<QueueCenterScope, QueueCenterSectionContract>;
}

/** Parse display-safe values for the browser exchange layer. */
export function normalizeQueueCenterSections(
  rawContracts: unknown,
  envelopeGeneratedAt: string | null,
): Record<QueueCenterScope, QueueCenterSectionContract> {
  const result = buildDefaultQueueCenterSections(envelopeGeneratedAt);
  if (!rawContracts || typeof rawContracts !== 'object') return result;

  Object.entries(rawContracts).forEach(([scopeKey, rawValue]) => {
    if (!isQueueCenterScope(scopeKey) || !rawValue || typeof rawValue !== 'object') return;
    const raw = rawValue as Record<string, unknown>;
    const queue = raw.queue && typeof raw.queue === 'object' ? raw.queue as Record<string, unknown> : {};
    const worker = raw.worker && typeof raw.worker === 'object' ? raw.worker as Record<string, unknown> : {};
    const toggle = raw.toggle && typeof raw.toggle === 'object' ? raw.toggle as Record<string, unknown> : {};
    const lifecycle = raw.lifecycle;
    result[scopeKey] = {
      type: scopeKey,
      category: toNullableString(raw.category) ?? result[scopeKey].category,
      queue: {
        pending: toNumber(queue.pending),
        processing: toNumber(queue.processing),
        leased: toNumber(queue.leased),
        total: toNumber(queue.total),
      },
      worker: {
        online: toBoolean(worker.online),
        claimed: toNumber(worker.claimed),
        ok: worker.ok == null ? null : toNumber(worker.ok),
        fail: worker.fail == null ? null : toNumber(worker.fail),
        last_heartbeat: toNullableString(worker.last_heartbeat),
      },
      toggle: {
        requested_by: toNullableString(toggle.requested_by),
        enabled: toBoolean(toggle.enabled),
        reason: toNullableString(toggle.reason),
        graceful_stop: toBoolean(toggle.graceful_stop),
        paused_by_user: toggle.paused_by_user == null ? null : toBoolean(toggle.paused_by_user),
      },
      lifecycle: lifecycle === 'off' || lifecycle === 'starting' || lifecycle === 'on' || lifecycle === 'error'
        ? lifecycle
        : 'off',
      error_code: toNullableString(raw.error_code),
      last_error: toNullableString(raw.last_error),
      observed_at: toNullableString(raw.observed_at),
      age_s: raw.age_s == null ? null : toNumber(raw.age_s),
      stale: toBoolean(raw.stale),
    };
  });

  return result;
}
