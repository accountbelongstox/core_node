/**
 * AI hub (manifest catalog, test, history, boot) and model live-monitor types.
 */

export type AiHubBootState = 'ready' | 'deferred' | 'blocked' | 'pending';
export type AiHubLiveKind = 'qwen_queue' | 'word_batch';
export type AiHubFieldType = 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'image';

export interface AiHubReason {
  reason?: string | null;
  reason_code?: string | null;
  reason_params?: Record<string, unknown> | null;
}

export interface AiHubBoot extends AiHubReason {
  state: AiHubBootState;
  checked_at?: number | null;
}

export interface AiHubRuntimeState extends AiHubReason {
  pending?: boolean;
  installed?: boolean;
  available?: boolean;
  running?: boolean;
  model_loaded?: boolean;
  in_flight?: number;
  enabled?: boolean;
  paused?: boolean;
  version?: string | null;
  model?: string | null;
  idle_remaining_s?: number | null;
}

export interface AiHubModelTier {
  gpu?: string | null;
  cpu?: string | null;
  active?: string | null;
  env?: string | null;
}

export interface AiHubCapabilities {
  test?: boolean;
  history?: boolean;
  power?: boolean | null;
  live?: AiHubLiveKind | null;
}

export interface AiHubFieldOption {
  value: string;
  label?: string;
  label_key?: string;
}

export interface AiHubTestField {
  key: string;
  type: AiHubFieldType | string;
  label: string;
  label_key?: string;
  options?: AiHubFieldOption[];
  default?: string | number | boolean | null;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  max_chars?: number;
  visible_when?: Record<string, string> | null;
}

export interface AiHubTestSchema {
  fields: AiHubTestField[];
  hints?: Record<string, string | number | boolean>;
}

export interface AiHubEntry {
  id: string;
  key?: string;
  category: string;
  runtime: string;
  note?: string;
  aliases?: string[];
  meta?: Record<string, unknown>;
  tier?: AiHubModelTier | null;
  boot: AiHubBoot;
  runtime_state: AiHubRuntimeState;
  capabilities: AiHubCapabilities;
  test_schema?: AiHubTestSchema | null;
}

export interface AiHubCategory {
  id: string;
  entries: AiHubEntry[];
}

export interface AiHubCatalogData {
  generated_at?: number;
  categories: AiHubCategory[];
}

export interface AiHubTestResult {
  record_id: string;
  ok: boolean;
  kind: string;
  elapsed_ms: number;
  result?: Record<string, unknown> | null;
  error?: string | null;
  boot?: AiHubBoot | null;
}

export interface AiHubResultRef {
  kind: 'speech_history' | 'image_history' | string;
  id: string;
}

export interface AiHubHistoryRecord {
  record_id: string;
  key?: string;
  id: string;
  category: string;
  ok: boolean;
  created_at: number | string;
  elapsed_ms?: number | null;
  summary?: string;
  params?: Record<string, unknown> | null;
  result_ref?: AiHubResultRef | null;
  error?: string | null;
}

export interface AiHubHistoryQuery {
  key?: string;
  category?: string;
  limit?: number;
  before?: number | string;
}

export interface AiHubHistoryData {
  items: AiHubHistoryRecord[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

export interface AiHubHistoryChange {
  change: 'added' | 'deleted' | 'cleared' | string;
  key?: string;
  category?: string;
  record_id?: string;
}

export interface AiHubBootRecord extends AiHubBoot {
  id?: string;
  key?: string;
  category?: string;
}

export interface AiHubBootStatusData {
  records: AiHubBootRecord[];
}

export interface ModelLiveGpu {
  index?: number;
  name?: string;
  util_percent?: number | null;
  mem_used_mb?: number | null;
  mem_total_mb?: number | null;
  temperature_c?: number | null;
  compute_capability?: string | null;
}

export interface ModelLiveSystem {
  cpu_percent?: number | null;
  mem_percent?: number | null;
  mem_used_mb?: number | null;
  mem_total_mb?: number | null;
  gpus?: ModelLiveGpu[];
}

export interface QwenLiveQueue {
  pending?: number;
  running?: number;
  queue_max?: number;
  stalled?: boolean;
  consumer_running?: boolean;
  oldest_running_ms?: number | null;
  oldest_progress_age_ms?: number | null;
  average_elapsed_ms?: number | null;
}

export interface QwenLiveJob {
  job_id: string;
  status: string;
  progress?: number | null;
  progress_total?: number | null;
  chunks_completed?: number | null;
  chunks_total?: number | null;
  phase?: string | null;
  queue_position?: number | null;
  elapsed_ms?: number | null;
  running_elapsed_ms?: number | null;
  progress_age_ms?: number | null;
  text_summary?: string | null;
  language?: string | null;
  speaker?: string | null;
  error?: string | null;
}

export interface QwenLiveRecent {
  job_id: string;
  ok: boolean;
  status?: string;
  elapsed_ms?: number | null;
  result_bytes?: number | null;
  language?: string | null;
  speaker?: string | null;
  finished_at?: number | string | null;
  error?: string | null;
}

export interface QwenLive {
  online?: boolean;
  model_loaded?: boolean;
  device?: string | null;
  dtype?: string | null;
  model_id?: string | null;
  attention?: string | null;
  max_parallel?: number | null;
  capacity_plan?: Record<string, unknown> | null;
  gpu?: ModelLiveGpu | null;
  queue?: QwenLiveQueue | null;
  jobs?: QwenLiveJob[];
  recent?: QwenLiveRecent[];
  synthesized_count?: number;
  failed_count?: number;
  synthesis_runtime?: Record<string, unknown> | null;
}

export interface KokoroLiveBatch {
  batch_id?: number | string | null;
  engine?: string | null;
  device?: string | null;
  batch_size?: number | null;
  total_words?: number | null;
  done_words?: number | null;
  failed_words?: number | null;
  generated_words?: number | null;
  current_group?: number | null;
  total_groups?: number | null;
  phase?: string | null;
  started_at?: number | null;
  elapsed_ms?: number | null;
  words_per_s?: number | null;
  merged_used?: boolean;
  fallback_used?: boolean;
}

export interface KokoroLiveRecent {
  word: string;
  md5?: string | null;
  ok: boolean;
  ms?: number | null;
  duration_ms?: number | null;
  rtf?: number | null;
  error?: string | null;
}

export interface KokoroLive {
  loaded?: boolean;
  running?: boolean;
  cycle_running?: boolean;
  batch?: KokoroLiveBatch | null;
  recent?: KokoroLiveRecent[];
  last_batch?: KokoroLiveBatch | null;
  queue?: { queued?: number; processing?: number; model_queue_depth?: number } | null;
  backend_progress?: Record<string, unknown> | null;
}

export interface ModelLiveEngine {
  category?: string;
  kind?: string;
  loaded?: boolean;
  in_flight?: number;
  queue_depth?: number;
  idle_remaining_s?: number | null;
}

export interface ModelLiveSnapshot {
  success?: boolean;
  sampled_at?: number;
  revision?: number;
  system?: ModelLiveSystem;
  qwen3tts?: QwenLive | null;
  kokoro?: KokoroLive | null;
  engines?: Record<string, ModelLiveEngine>;
}

export interface AiHubFailure {
  code?: string;
  message?: string;
}

export interface AiHubEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: AiHubFailure | string;
}
