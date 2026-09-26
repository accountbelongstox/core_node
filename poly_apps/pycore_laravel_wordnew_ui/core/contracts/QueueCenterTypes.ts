/**
 * Queue Center domain and wire-transfer types.
 *
 * Runtime contract interpretation remains in QueueCenterContract.ts.
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

/** Word-audio full-pull status (pycore `word_audio_full_sync`, word_audio section only). */
export interface QueueCenterWordAudioFullSyncStatus {
  running: boolean;
  last_sync_at: number;
  last_result: {
    success?: boolean;
    pulled?: number;
    inserted?: number;
    languages?: number;
    stopped?: boolean;
    source?: string;
    error?: string;
    /** Stable failure code (translated by the UI; `detail` is diagnostic only). */
    error_code?: string;
    detail?: string;
  };
  languages: Array<{
    language: string;
    language_code?: string;
    without_audio?: number;
    pulled?: number;
    inserted?: number;
  }>;
  cache_saved_at: number;
  cache_source: string;
  cache_count: number;
  queue_count: number;
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
  /** word_audio only: pycore full-pull status block (absent for other scopes). */
  full_sync?: QueueCenterWordAudioFullSyncStatus | null;
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
  /** Audio lanes: authoritative post-transition lane state (apply, never guess). */
  lane_state?: AudioLaneStatePayload;
}

/** Audio lane queue key: each lane owns its own Queue = Part1 + Part2. */
export type AudioLaneKey = 'word_audio' | 'sentence_audio';
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

export interface AudioLaneState {
  lane: AudioLaneKey;
  switch: { enabled: boolean; running: boolean };
  queue: AudioLaneQueueView;
  worker: AudioLaneWorkerState;
  section_contract: unknown;
  full_sync?: QueueCenterWordAudioFullSyncStatus;
}

/** Push topic `queue_center.audio_lane.changed` and RPC `ui/queue_center/audio_lane_state`. */
export interface AudioLaneStatePayload {
  success: boolean;
  instance: string;
  revision: number;
  generated_at: number;
  lanes: Record<AudioLaneKey, AudioLaneState>;
  wordAudio?: unknown;
  sentenceAudio?: unknown;
  error?: string;
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
