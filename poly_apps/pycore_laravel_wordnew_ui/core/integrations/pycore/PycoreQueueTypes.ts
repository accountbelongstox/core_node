/**
 * Pycore Queue API types.
 */
import type { GlobalTaskCapability, GlobalTaskExecutionType } from '../../contracts/QueueCenterTypes';

export type {
  GlobalTaskCapability,
  GlobalTaskDetailRecord,
  GlobalTaskEventRecord,
  GlobalTaskExecutionType,
  GlobalTaskPayload,
  GlobalTaskResult,
  GlobalTaskStatus,
  GlobalTaskStatusRecord,
  GlobalTaskSummary,
  GlobalTaskTypeDefinition,
  GlobalTaskWorkerRecord,
  PcQueueCategory,
  PcQueueEngines,
  PcQueueHandler,
  PcQueueOverview,
  PcQueueSample,
  PcQueueWorker,
  QueueCenterControlMetrics,
  QueueCenterControlName,
  QueueCenterControlResponse,
  QueueCenterControlState,
  QueueCenterErrorState,
  QueueCenterOverviewResponse,
  QueueCenterScope,
  QueueCenterSectionContract,
  QueueCenterSectionLifecycle,
  QueueCenterToggleEnvelope,
  QueueCenterWorkerMetrics,
} from '../../contracts/QueueCenterTypes';

// Queue Center category, worker, control, and section types are defined in
// core/contracts/QueueCenterContract.ts, which reads the shared JSON contract
// used by Python and Laravel. Raw Task Center slice types remain below.

/** One in-flight sentence-audio task (sentence worker get_status). */
export interface SentenceWorkerTask {
  task_id?: number;
  content_id?: string;
  language?: string;
  priority?: number;
  queue_position?: number;
  content?: string;
  variant_count?: number;
  current_variant_index?: number;
  current_variant_key?: string;
  current_provider?: string;
  stage?: string;
  progress?: number;
  progress_total?: number;
  elapsed_seconds?: number;
  speaker?: string;
  backend_uploaded?: boolean;
  backend_result_accepted?: boolean;
}

export interface AudioDeliveryOutboxStatus {
  total: number;
  pending: number;
  pending_domain_upload: number;
  pending_result: number;
  pending_history: number;
  dead_letter: number;
  oldest_pending_at?: number | null;
  next_retry_at?: number | null;
}

export interface QueueWorkerEvent {
  id?: number;
  at?: number;
  kind?: string;
  detail?: string;
  task_id?: number | string;
  task_display_id?: string;
  text_preview?: string;
  language?: string;
  stage?: string;
  progress?: number;
  progress_total?: number;
  elapsed_seconds?: number;
  backend_uploaded?: boolean;
  backend_result_accepted?: boolean;
  backend_progress_current?: number;
  backend_progress_total?: number;
  current_provider?: string;
}

export interface QueueWorkerEventPage {
  items: QueueWorkerEvent[];
  page: number;
  page_size: number;
  pages: number;
  total: number;
  revision: number;
}

/** HTTP API sentence-audio status — auto-start, worker, and Laravel counts. */
export interface SentenceAudioAutoStatus {
  auto_start: boolean;
  /** Effective worker concurrency + recommended value for the current engine. */
  concurrency?: number;
  concurrency_recommended?: number;
  concurrency_limit?: number;
  concurrency_class?: string | null;
  selected_speaker?: string;
  supported_speakers?: string[];
  heartbeat_enabled: boolean;
  /** Canonical dispatch-driven processor state; heartbeat_enabled is legacy. */
  processor_enabled?: boolean;
  sentence_audio_capability: boolean;
  required_engine?: string;
  laravel?: {
    pending?: number;
    leased?: number;
    observed_at?: string | null;
    age_s?: number | null;
    stale?: boolean;
  };
  worker?: {
    worker_id?: string;
    worker_name?: string;
    processor_types?: GlobalTaskExecutionType[];
    capabilities?: GlobalTaskCapability[];
    queued?: number;
    leased?: number;
    processing?: number | string | null;
    enabled?: boolean;
    cycle_running?: boolean;
    delivery_outbox_running?: boolean;
    delivery_outbox?: AudioDeliveryOutboxStatus;
    total_claimed?: number;
    total_succeeded?: number;
    total_failed?: number;
    event_count?: number;
    event_revision?: number;
    queue_progress?: {
      completed?: number;
      total?: number;
      pending?: number;
      assigned?: number;
      processing?: number;
      failed?: number;
    };
    last_cycle?: Record<string, unknown>;
    /** Legacy worker flag retained for older queue snapshots. */
    heartbeat_enabled?: boolean;
    /** Single task before the concurrent worker; a list of in-flight tasks after. */
    current_task?: SentenceWorkerTask | SentenceWorkerTask[] | null;
    /** "lang:content_id" keys of the in-flight tasks (queue-row spinner marker). */
    current_keys?: string[];
  };
}

export interface SentenceQueueRow {
  task_id?: string;
  content_id: string;
  text?: string;
  language: string;
  queue_position?: number;
  tts_status?: string;
  progress?: number;
  stage?: string;
  backend_uploaded?: boolean;
  assigned_at?: string | null;
  updated_at?: string | null;
  tts_locked_by?: string | null;
  occurrence_count?: number;
  /** Flagged by the queue endpoint when this row is mid-synthesis in the worker. */
  processing?: boolean;
}

export interface SentenceAudioQueueSnapshot {
  success?: boolean;
  worker?: SentenceAudioAutoStatus['worker'];
  queue?: {
    items?: SentenceQueueRow[];
    total?: number;
    laravel_reachable?: boolean;
    snapshot_age_s?: number;
    summary?: {
      languages?: Record<string, number>;
      reconciled?: number;
    };
  };
}

/** One voice variant spec for sentence-audio (GET/POST/DELETE /api/local/sentence-audio/variants).
 *  `accent` is 'us'|'uk'|null; `gender` is 'female'|'male'; exactly one spec per
 *  lang has `is_primary` true. */
export interface SentenceVoiceVariant {
  lang: string;
  variant_key: string;
  accent: string | null;
  gender: string;
  is_primary: boolean;
}

export interface QueueBumpEvent {
  lane: string;
  item_id: string;
  label: string;
  old_priority: number | string;
  new_priority: number | string;
  at?: number;
  recently_bumped?: boolean;
  meta?: Record<string, unknown>;
}

export interface QueueBumpsSnapshot {
  events: QueueBumpEvent[];
  active_bumps?: string[];
  ttl_seconds?: number;
}

/** Word-dictionary TTS worker auto-start strip (tts_queue_poller). */
export interface WordTtsWorkerTask {
  task_id?: number | string;
  task_display_id?: string;
  content_id?: string;
  word?: string;
  text?: string;
  language?: string;
  queue_position?: number;
  current_provider?: string;
  stage?: string;
  progress?: number;
  progress_total?: number;
  elapsed_seconds?: number;
  backend_uploaded?: boolean;
  backend_result_accepted?: boolean;
}

export interface WordTtsAutoStatus {
  auto_start: boolean;
  /** Effective worker concurrency + recommended value for the current engine. */
  concurrency?: number;
  concurrency_recommended?: number;
  heartbeat_enabled: boolean;
  /** Canonical dispatch-driven processor state; heartbeat_enabled is legacy. */
  processor_enabled?: boolean;
  laravel?: {
    pending?: number;
    leased?: number;
    observed_at?: string | null;
    age_s?: number | null;
    stale?: boolean;
  };
  worker?: {
    batch_running?: boolean;
    enabled?: boolean;
    total_claimed?: number;
    total_succeeded?: number;
    total_failed?: number;
    event_count?: number;
    event_revision?: number;
    last_tick?: Record<string, unknown>;
    /** Legacy worker flag retained for older queue snapshots. */
    heartbeat_enabled?: boolean;
    processing?: number;
    current_task?: WordTtsWorkerTask | null;
    current_tasks?: WordTtsWorkerTask[];
    delivery_outbox_running?: boolean;
    delivery_outbox?: AudioDeliveryOutboxStatus;
    backend_progress?: {
      current?: number;
      completed?: number;
      pending?: number;
      processing?: number;
      failed?: number;
      total?: number;
      observed_at?: number;
      refreshed_at?: number;
      source?: string;
    };
    queue_progress?: {
      completed?: number;
      total?: number;
      pending?: number;
      assigned?: number;
      processing?: number;
      failed?: number;
    };
  };
}

// --- Code version indicator ------------------------------------------------ #
export interface PcCodeVersion {
  last_modified_unix: number;
  last_modified_at: string;
  latest_file: string;
  scan_ms?: number;
}
export interface PcVersionInfo {
  success: boolean;
  pycore: PcCodeVersion;
}

// --- Queue Center: capability settings (contract B) ------------------------ #
// GET/POST /api/local/capabilities/settings. Each capability block carries the
// engine PRIORITY chain (re-orderable), an availability map, and its options
// (TTS has synth_timeout_s + edge_cooldown_s; the others are typically empty).

export interface PcCapabilityOptions {
  synth_timeout_s?: number;
  edge_cooldown_s?: number;
  server_auto_manage?: boolean;
  server_single_active?: boolean;
  server_idle_shutdown_s?: number;
  server_enabled?: Record<string, boolean>;
  [k: string]: unknown;
}

/** One capability's settings block. */
export interface PcCapabilityBlock {
  /** Ordered engine chain (index 0 = tried first). */
  priority: string[];
  /** Per-engine runtime-ready (engine id -> can use now). */
  available: Record<string, boolean>;
  /** Per-engine prerequisites installed (engine id -> pip/staging present). */
  installed?: Record<string, boolean>;
  /** Per-engine setup hint when installed but not ready. */
  setup_reasons?: Record<string, string>;
  /** Tuning options (TTS: synth_timeout_s / edge_cooldown_s). */
  options: PcCapabilityOptions;
}

/** GET /api/local/capabilities/settings — capability blocks (stt/tts/image/translation + sentence_tts/word_tts profiles). */
export interface PcCapabilitySettings {
  success: boolean;
  stt: PcCapabilityBlock;
  tts: PcCapabilityBlock;
  image: PcCapabilityBlock;
  translation: PcCapabilityBlock;
  /** Sentence-level TTS variant chain (optional - older backends omit it). */
  sentence_tts?: PcCapabilityBlock;
  /** Word-level TTS variant chain (optional - older backends omit it). */
  word_tts?: PcCapabilityBlock;
  error?: string;
}

/** The capability ids the drawer manages (sentence_tts/word_tts are TTS profiles). */
export type PcCapabilityKey = 'stt' | 'tts' | 'image' | 'translation' | 'sentence_tts' | 'word_tts';

/** POST /api/local/capabilities/settings response — the updated block. */
export interface PcCapabilitySaveResponse extends Partial<PcCapabilityBlock> {
  success: boolean;
  capability?: PcCapabilityKey;
  error?: string;
}

// --- Offline dictionary (ECDICT + WordNet) --------------------------------- #
/** GET /api/local/dictionary/status — which offline dicts are installed. */
export interface DictionaryStatus {
  success: boolean;
  ecdict: { available: boolean; db_path: string; entries: number };
  wordnet: { available: boolean };
  error?: string;
}

/** GET /api/local/dictionary/lookup?word=&target= — a rich offline word entry. */
export interface DictionaryEntry {
  success: boolean;
  found: boolean;
  word: string;
  /** Full ECDICT Chinese translation (newline senses collapsed to '; '). */
  translation: string;
  /** English definition (ECDICT, else WordNet gloss). */
  definition: string;
  phonetic: string;
  pos: string;
  /** Exam tags: zk gk cet4 cet6 ky toefl ielts gre. */
  tags: string[];
  collins: number;
  oxford: boolean;
  bnc: number;
  frq: number;
  exchange: string;
  wordnet_definition: string;
  synonyms: string[];
  source: string;
  target: string;
  /** Single-language answer for the requested target ('zh'|'en'); null on miss. */
  target_translation: string | null;
  error?: string;
}

// --- Recent tasks (cross-end task history: pycore + chrome) ---------------- #
// ui/task_history/get_recent_local_tasks returns Pycore-local finished tasks
// units across both ends (pycore workers + the chrome MCP host). Each record is
// a single processed item (a word, a TTS synth, an image fetch, a translation
// batch, …). `detail` is free-form per task_type; the common keys are typed but
// any extra keys may appear.

/** One word entry inside a batch task's detail (per-word audio/engine info). */
export interface PcTaskDetailWord {
  word: string;
  audio_bytes?: number;
  engine?: string;
  [k: string]: unknown;
}

/** One translation pair inside a batch task's detail. */
export interface PcTaskDetailTranslation {
  word: string;
  translation: string;
  [k: string]: unknown;
}

/** A result resource copied into pycore's persistent completed-task cache. */
export interface PcTaskCachedResource {
  source: string;
  cache_key?: string;
  local_url?: string;
  mime?: string;
  size?: number;
  cached: boolean;
  error?: string;
}

/** Free-form per-task detail. Common keys typed; extras allowed. */
export interface PcTaskDetail {
  text?: string;
  translation?: string;
  provider?: string;
  model?: string;
  engine?: string;
  voice?: string;
  /** The produced audio file address (path or URL). */
  audio_path?: string;
  /** Human-readable synth invocation (engine-specific). */
  synth_command?: string;
  audio_bytes?: number;
  image_bytes?: number;
  mime?: string;
  size?: string;
  word_count?: number;
  /** word_translation: count translated this batch (NOT a boolean). */
  translated?: number;
  /** word_translation: count skipped (already-done) this batch. */
  skipped?: number;
  /** word_audio: count of words whose audio synthesized OK. */
  audio_ok?: number;
  /** word_audio: count of words whose audio synthesis failed. */
  audio_failed?: number;
  words?: PcTaskDetailWord[];
  translations?: PcTaskDetailTranslation[];
  failed_words?: string[];
  media_type?: string;
  year?: number | null;
  filename?: string;
  [k: string]: unknown;
}

/** A single finished task unit (newest-first in the recent log). */
export interface PcTaskRecord {
  ts: string;
  seq: number;
  /** Which end ran it. */
  end: 'pycore' | 'chrome' | string;
  worker: string;
  task_type: string;
  task_id: string;
  /** Base URL of the API the task came from. */
  source_api: string;
  /** The word / text / title the task was about. */
  title: string;
  language: string;
  /** submitted | already_done | completed | skipped | released | failed | … */
  status: string;
  success: boolean;
  /** Whether the result was returned to the originating API. */
  posted_back: boolean;
  latency_ms: number | null;
  error: string | null;
  detail: PcTaskDetail;
  execution_type?: string;
  capability?: string;
  archive_id?: string | number;
  resources?: PcTaskCachedResource[];
  is_local?: boolean;
  source?: string;
  updated_at?: string;
  last_error?: string | null;
}

/** Roll-up stats for the recent-task ring. */
export interface PcTaskRecentStats {
  total: number;
  success: number;
  failed: number;
  posted_back: number;
  /** Ring buffer capacity. */
  ring_max: number;
  /** Path of the on-disk text log. */
  log_path: string;
}

/** HTTP API recent task history plus roll-up stats. */
export interface PcTaskRecentResponse {
  success: boolean;
  records: PcTaskRecord[];
  count: number;
  stats: PcTaskRecentStats;
  types?: Record<string, number>;
  resource_count?: number;
  last_sync_at?: string | null;
  error?: string;
}

/** HTTP API command to wipe history and truncate the text log. */
export interface PcTaskClearResponse {
  ok: boolean;
  error?: string;
}

// --- Translate history (Google / AI translate usage records) --------------- #
export interface TranslateHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  source: string;
  target: string;
  text: string;
  engine: 'google' | 'ai' | string;
  result: string;
  origin: string;
}
export interface TranslateHistoryResponse {
  success: boolean;
  entries: TranslateHistoryEntry[];
}
export interface TranslateHistoryClearResponse {
  success: boolean;
  removed: number;
}
export interface TranslateHistoryDeleteResponse {
  success: boolean;
}

