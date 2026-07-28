/**
 * TypeScript adapter for the canonical Queue Center and distributed-task contract.
 *
 * Source: config/queue_center_contract.json
 * Aligned adapters:
 * - pycore/callmodule/services/queue_center_contract.py
 * - poly_apps/laravel_main/app/Support/QueueCenterContract.php
 * - apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts
 *
 * This adapter is shared by Pycore UI and Laravel-manager UI. Change task
 * statuses, lanes, capabilities, task routes, priorities, and wire fields only
 * in the JSON source so Laravel, Pycore, mcp-chrome, and both UIs update together.
 */
import contractDocument from '../../../../../config/queue_center_contract.json';

export type QueueCenterControlName = 'assist_translation' | 'word_audio' | 'sentence_audio';
export type QueueCenterScope = 'heartbeat' | 'assist_translation' | 'word_audio' | 'sentence_audio' | 'media_image';
export type QueueCenterSectionLifecycle = 'off' | 'starting' | 'on' | 'error';
export type PcQueueHandler = 'chrome' | 'pycore';

export type GlobalTaskStatus = string;
export type GlobalTaskExecutionType = string;
export type GlobalTaskCapability = string;
export type GlobalTaskPayload = Record<string, unknown>;
export type GlobalTaskResult = Record<string, unknown>;

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
  priority: number;
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
  priority: number;
  capability: GlobalTaskCapability | null;
  is_fast_tier: boolean;
  created_at: string | null;
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

export interface GlobalTaskTypeDefinition {
  key: string;
  label: string;
  execution_type: GlobalTaskExecutionType;
  capability: GlobalTaskCapability | null;
  claimants?: Array<'pycore' | 'chrome' | 'laravel'>;
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
  control_names: QueueCenterControlName[];
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
    execution_types: Record<string, GlobalTaskExecutionType>;
    priorities: Record<'default' | 'manual' | 'fast' | 'maximum', number>;
    limits: Record<'list' | 'worker_pull' | 'completed' | 'long_poll_seconds', number>;
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

export const QUEUE_CENTER_CONTRACT = contractDocument as unknown as ContractDocument;
export const QUEUE_CENTER_SCHEMA_VERSION = QUEUE_CENTER_CONTRACT.schema_version;
export const QUEUE_CENTER_CONTROL_NAMES = QUEUE_CENTER_CONTRACT.control_names;
export const QUEUE_CENTER_SCOPES = Object.keys(QUEUE_CENTER_CONTRACT.section_scopes) as QueueCenterScope[];
export const QUEUE_CENTER_CATEGORY_KEYS = QUEUE_CENTER_CONTRACT.categories.map((category) => category.key);
export const QUEUE_CENTER_CATEGORY_CATALOG = QUEUE_CENTER_CONTRACT.categories.map((category) => ({
  ...category,
  claimants: category.capability
    ? QUEUE_CENTER_CONTRACT.capability_claimants[category.capability] ?? []
    : [category.primary_handler],
}));
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
export const GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE = QUEUE_CENTER_CONTRACT.task_contract.execution_types;
export const GLOBAL_TASK_EXECUTION_TYPES = Object.values(GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE);
export const GLOBAL_TASK_CAPABILITIES = Object.keys(
  QUEUE_CENTER_CONTRACT.capability_claimants,
) as GlobalTaskCapability[];
export const GLOBAL_TASK_PRIORITIES = QUEUE_CENTER_CONTRACT.task_contract.priorities;
export const GLOBAL_TASK_LIMITS = QUEUE_CENTER_CONTRACT.task_contract.limits;
export const GLOBAL_TASK_CAPABILITY_SINGLE_LANES = QUEUE_CENTER_CONTRACT.task_contract.capability_single_lanes;
export const GLOBAL_TASK_FAST_LANE_CAPABILITIES = QUEUE_CENTER_CONTRACT.task_contract.fast_lane_capabilities;
export const GLOBAL_TASK_WIRE_SHAPES = QUEUE_CENTER_CONTRACT.task_contract.wire_shapes;
export const GLOBAL_TASK_TYPE_CATALOG = QUEUE_CENTER_CONTRACT.task_contract.task_types;
export const GLOBAL_TASK_TYPE_BY_KEY = Object.fromEntries(
  GLOBAL_TASK_TYPE_CATALOG.map((definition) => [definition.key, definition]),
) as Record<string, GlobalTaskTypeDefinition>;
export const GLOBAL_TASK_FAST_PROMOTABLE_TYPES = GLOBAL_TASK_TYPE_CATALOG
  .filter((definition) => definition.fast_promotable === true)
  .map((definition) => definition.key);
export const GLOBAL_TASK_HISTORY_BUCKETS = QUEUE_CENTER_CONTRACT.task_contract.history_buckets.all;

export function getGlobalTaskTypeDefinition(taskType: unknown): GlobalTaskTypeDefinition | null {
  const key = typeof taskType === 'string' ? taskType.trim().toLowerCase() : '';
  return GLOBAL_TASK_TYPE_BY_KEY[key] ?? null;
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

/** Parse display-safe values only. Business aggregation remains in pycore. */
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
