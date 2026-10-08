/**
 * Queue Center domain and wire-transfer types.
 *
 * Runtime contract interpretation remains in QueueCenterContract.ts.
 */
import contractDocument from '../../../../config/queue_center_contract.json';
import type { QueueLaneReport } from './QueueProgress';

export type QueueCenterControlName = (typeof contractDocument.control_names)[number];
export type QueueCenterScope = keyof typeof contractDocument.section_scopes;
export type QueueCenterSectionLifecycle = 'off' | 'starting' | 'on' | 'stopping' | 'error';
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

export interface QueueCenterHttpTransfer {
  protocol: string;
  chunk_bytes: number;
  maximum_chunk_bytes: number;
  connect_timeout_seconds: number;
  idle_timeout_seconds: number;
  retry_interval_ms: number;
}

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
  progress?: number | null;
  estimated_wait_seconds?: number | null;
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
  lease_capacity?: number;
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
  error_code?: string;
  result?: unknown;
  /** Audio lanes: authoritative post-transition lane state (apply, never guess). */
  lane_state?: AudioLaneStatePayload;
}

/** Audio lane queue key: each lane owns its own Queue = Part1 + Part2. */
export type AudioLaneKey = 'word_audio' | 'sentence_audio' | 'phrase_audio';
export type AudioLaneTrackState = 'queued' | 'processing' | 'done' | 'failed';

export interface AudioLaneQueueRow {
  task_id: string;
  text: string;
  language: string;
  local_source: string;
}

export interface AudioLaneTrackedItem {
  key: string;
  text: string;
  language: string;
  state: AudioLaneTrackState;
  owners: string[];
  source: string;
  provider: string;
  error: string;
  settled_by: string;
  /** Unix seconds: entered Part1 / generation began / reached done|failed. */
  queued_at?: number | null;
  started_at?: number | null;
  finished_at?: number | null;
  updated_at: number;
}

export type AudioLaneTrackCounts = Record<AudioLaneTrackState, number> & { total?: number };

/** Read-only Part1 / Part2 / whole-Queue view of ONE lane (pycore-owned). */
export interface AudioLaneQueueView {
  lane: AudioLaneKey;
  revision: number;
  queued: number;
  part1: number;
  part2: number;
  taken: number;
  part1_head: AudioLaneQueueRow[];
  part2_head: AudioLaneQueueRow[];
  tracked: AudioLaneTrackCounts;
  owner: {
    id: string;
    counts: AudioLaneTrackCounts;
    total: number;
    items: AudioLaneTrackedItem[];
  } | null;
}

export interface AudioLaneWorkerState {
  cycle_running: boolean;
  processing: number;
  queued: number;
  total_claimed: number;
  total_succeeded: number;
  total_failed: number;
  planned_engine?: string | null;
  current_keys: string[];
  event_revision: number;
  delivery_outbox: Record<string, unknown>;
  delivery_outbox_running: boolean;
}

/** A pooled gap (rows no node can take now): `reason_code` is a contract `work_leases.reason_codes` entry. */
export interface WorkPoolEntry {
  lane: string;
  language: string;
  count?: number;
  gap?: number;
  leased?: number;
  free?: number;
  reason_code: string | null;
}

/** This node's work-lease state of one audio lane (`lanes.<lane>.leases`). */
export interface AudioLaneLeaseState {
  leases: number;
  items_leased: number;
  last_batch: number;
  done_per_hour: number;
  claim_in_seconds: number;
  pooled: WorkPoolEntry[];
  engines?: string[];
  languages?: string[];
  /** Set once a renew reported a lease lost (reason_code LEASE_LOST); null otherwise. */
  lost?: { reason_code: string; leases: number; rows: number } | null;
}

/** One pycore node of Laravel's work-lease roster (`work_nodes`). */
export interface WorkNode {
  worker_id: string;
  /** Short stable node id (the id `clip.leased` carries). */
  sid?: string;
  /** colab | kaggle, empty on a desktop or server node. */
  platform?: string;
  /** Host label the node declared (may be empty). */
  label?: string;
  /** Direct LAN backend URLs the node serves (`http://<RFC 1918 host>:59000`; empty unless its LAN bind is on). */
  lan_urls?: string[];
  compute_class: string;
  online: boolean;
  lanes: Record<string, string[]>;
  /** Engine ids the node declared per lane on its claims. */
  engines?: Record<string, string[]>;
  leases: number;
  items_leased: number;
  done_per_hour: number;
  /** Items per hour per lane (the lane worker's rate; `done_per_hour` is their sum). */
  lane_rates?: Record<string, number>;
  /** Worker id serving each lane of this node (leases and assignments bind to it). */
  workers?: Record<string, string>;
  batch_size: number;
  eta_seconds: number | null;
  last_heartbeat_at: string | null;
  /** Latest resource sample the node attached to a claim or renew (absent on an older node or server). */
  load?: WorkNodeLoad | null;
  /** When Laravel received `load` (ISO-8601). */
  load_at?: string | null;
}

/** One GPU of a node load sample. */
export interface WorkNodeGpuLoad {
  index: number;
  name?: string;
  util_percent?: number | null;
  mem_used_mb?: number | null;
  mem_total_mb?: number | null;
}

/** Per-lane in-flight work of a node load sample (Queue = Part1 + Part2). */
export interface WorkNodeLaneLoad {
  in_flight?: number;
  part1?: number;
  part2?: number;
}

/** Resource sample of a pycore node (`work_nodes[].load`); every field is optional. */
export interface WorkNodeLoad {
  sampled_at?: string | number | null;
  cpu_percent?: number | null;
  mem_percent?: number | null;
  gpus?: WorkNodeGpuLoad[];
  lanes?: Record<string, WorkNodeLaneLoad>;
}

export interface WorkNodesResponse {
  /** `work_nodes.changed` cursor: refetch only when it moved. */
  revision?: number;
  nodes: WorkNode[];
  pool: WorkPoolEntry[];
}

/** Clips of one kind inside an orchestration task, as a wordnew client reports them. */
export interface OrchClientKindCounts {
  lane?: string;
  total?: number;
  queued?: number;
  loading?: number;
  done?: number;
  missing?: number;
  generating?: { pycore?: number; relay?: number; laravel?: number };
}

export interface OrchClientTask {
  task_id: string;
  plan_id?: string | null;
  state?: string;
  counts?: Record<string, OrchClientKindCounts>;
  stages?: Record<string, string>;
}

export interface OrchClientWindow {
  sid?: string;
  lane?: string;
  language?: string;
  count?: number;
  assigned?: number;
  generating?: number;
  done?: number;
}

export interface OrchClientAssignment {
  plan_id: string;
  fresh?: boolean;
  expires_in?: number | null;
  direct_share?: Record<string, number>;
  windows?: OrchClientWindow[];
}

export interface OrchClientChannels {
  direct?: boolean;
  relay?: boolean;
  laravel?: boolean;
  lan?: boolean;
  selected_pycore?: { host?: string | null; node_sid?: string | null } | null;
  laravel_endpoint_id?: string | null;
}

/** One wordnew device's latest telemetry (`audio_orchestration_contract.client_monitor`) plus server fields. */
export interface OrchClientReport {
  device_id: string;
  instance_id?: string;
  seq?: number;
  sent_at?: string | number | null;
  platform?: 'native' | 'web' | string;
  app_version?: string;
  foreground?: boolean;
  route?: { tab?: string | null; item?: string | null; changed_at?: string | number | null } | null;
  channels?: OrchClientChannels | null;
  tasks?: OrchClientTask[];
  assignments?: OrchClientAssignment[];
  user?: string | { id?: string | number; name?: string; email?: string } | null;
  last_seen_at?: string | null;
  online?: boolean;
}

export interface WorkMonitorPlan {
  plan_id: string;
  source_key?: string | null;
  languages?: string[];
  include_words?: boolean;
  include_phrases?: boolean;
  counters?: Record<string, number>;
  /** app_led: a fresh wordnew layout drives the nodes; laravel_fallback: Laravel leases alone. */
  mode?: 'app_led' | 'laravel_fallback' | string;
  layout?: {
    applied_at?: string | null;
    expires_in?: number | null;
    device_ids?: string[];
    ranges?: unknown[];
  } | null;
}

/** `GET api/work/monitor`: wordnew clients, plans and nodes in one picture. */
export interface WorkMonitorResponse {
  /** The server's clock (ISO 8601): every other timestamp of the answer is compared with it. */
  server_time?: string;
  revision?: { nodes?: number; clients?: number };
  clients: OrchClientReport[];
  nodes: WorkNode[];
  pool: WorkPoolEntry[];
  plans: WorkMonitorPlan[];
}

export interface AudioLaneState extends QueueLaneReport {
  lane: AudioLaneKey;
  switch: { enabled: boolean; running: boolean };
  queue: AudioLaneQueueView;
  leases?: AudioLaneLeaseState;
  worker: AudioLaneWorkerState;
  section_contract: unknown;
}

/** Push topic `queue_center.audio_lane.changed` and RPC `ui/queue_center/audio_lane_state`. */
export interface AudioLaneStatePayload {
  success: boolean;
  instance: string;
  revision: number;
  generated_at: number;
  lanes: Record<AudioLaneKey, AudioLaneState> & { translation?: QueueLaneReport };
  wordAudio?: unknown;
  sentenceAudio?: unknown;
  error?: string;
  error_code?: string;
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
