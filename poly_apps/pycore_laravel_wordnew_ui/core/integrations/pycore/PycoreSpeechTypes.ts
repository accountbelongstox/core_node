/**
 * Pycore Speech API types.
 */

// --- OCR engine availability --------------------------------------------- #
export interface OcrEngine {
  /** Engine id: 'windows' | 'easyocr' | 'cnocr'. */
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  available: boolean;
  note: string;
  /** Installed PyPI package version, when applicable. */
  version?: string | null;
}

export interface OcrStatus {
  success: boolean;
  /** Highest-priority available engine id, or null when none are installed. */
  best: string | null;
  available_count: number;
  engines: OcrEngine[];
  error?: string;
}

/** Live per-engine recognition test (POST /api/local/ocr/test). */
export interface OcrTestResponse {
  success: boolean;
  /** Engine that ran (null when no engine is available). */
  engine: string | null;
  /** Recognized text (empty on failure). */
  text: string;
  latency_ms: number;
  error: string | null;
  /** Model type used (cnocr: "general"|"scene"|"doc"|"number"|"english"|"chinese_traditional"). */
  model_type?: string;
  /** Language list used (easyocr). */
  languages?: string[];
}

// --- TTS engine availability (live edge-tts probe) ----------------------- #
export interface TtsProvider {
  /** Provider id: currently 'edge'. */
  name: string;
  available: boolean;
  version: string | null;
  /** Whether an outbound proxy (EDGE_TTS_PROXY) is in effect. */
  proxy: boolean;
  error: string | null;
  /** True when the value came from the ~60s availability cache. */
  cached: boolean;
  /**
   * True when no live edge probe has run yet (the periodic status poll never
   * blocks on one — a background probe fills the cache, and `refresh=1` forces
   * a live check). `available` stays null/false until the probe completes.
   */
  pending?: boolean;
}

export interface QwenTtsQueueJob {
  job_id: string;
  client_job_id?: string | null;
  text_summary?: string;
  language?: string;
  speaker?: string | null;
  format?: 'mp3' | 'wav' | string;
  priority?: number;
  submitted_at?: string;
  finished_at?: string | null;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | string;
  elapsed_ms?: number | null;
  error?: string | null;
  result_url?: string | null;
}

export interface QwenTtsQueueStatus {
  seq: number;
  queue_max: number;
  counts: Record<string, number>;
  jobs: QwenTtsQueueJob[];
  synthesized_count?: number;
  average_elapsed_ms?: number;
}

/**
 * One entry in the TTS fallback chain (priority order:
 * chattts -> cosyvoice -> fishspeech -> qwen3tts -> bark -> parler -> voxcpm2 -> kokoro -> …). `cooldown_remaining` is only set on
 * the 'edge' entry (seconds left on its failure cooldown; 0/absent = normal).
 */
export interface TtsEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  /** Runtime-ready — can synthesize now. */
  available: boolean;
  /** Prerequisites installed (pip / staging / models); may still need server or config. */
  installed?: boolean;
  note?: string;
  /** Installed PyPI package version (edge version comes from live probe). */
  version?: string | null;
  /** Why this engine is off (e.g. missing STREAMELEMENTS_API_KEY). */
  disabled_reason?: string;
  /** Seconds left on this engine's failure cooldown (edge / streamelements). */
  cooldown_remaining?: number;
  /** edge only: live synth probe result (may differ from package installed). */
  live_available?: boolean | null;
  /** edge only: EDGE_TTS_PROXY in effect. */
  proxy?: boolean;
  /** edge only: last live-probe error (e.g. HTTP 403). */
  probe_error?: string | null;
  /** edge only: live probe still running. */
  probe_pending?: boolean;
  /** edge only: live probe came from cache. */
  probe_cached?: boolean;
  /** Configured model/checkpoint tier (see tts_model_tiers.py). */
  model?: string | null;
  /** Local HTTP server engine (chattts/cosyvoice/…). */
  server_engine?: boolean;
  server_running?: boolean;
  server_managed?: boolean;
  server_enabled?: boolean;
  server_idle_remaining_s?: number | null;
  /** Bound local Web console URL reported after the server socket is ready. */
  server_url?: string | null;
  /** Qwen3-TTS only: authoritative in-memory queue snapshot. */
  queue?: QwenTtsQueueStatus;
  /** In-process model engine (sherpa/kokoro/bark/…): weights resident in memory. Class-C server engines like qwen3tts report server_* instead. */
  model_loaded?: boolean;
  /** Seconds until idle-unload for an in-process model (null when not loaded). */
  model_idle_remaining_s?: number | null;
  /** Parallel-safety annotation: 'serial' (edge lock) | 'cloud' | 'in_process' | 'server'. */
  concurrency?: string;
}

export interface TtsStatus {
  success: boolean;
  providers: TtsProvider[];
  /** Highest-priority AVAILABLE engine (ignores cooldown), or null. */
  best?: string | null;
  /** Engine the NEXT synth would ACTUALLY use (honours cooldown), or null. */
  active?: string | null;
  /** Seconds left on the edge-tts failure cooldown; 0 = not cooling. */
  edge_cooldown_remaining?: number;
  /** Whether STREAMELEMENTS_API_KEY exists in .secret_keys (value never returned). */
  streamelements_key_present?: boolean;
  /** Fallback chain in priority order (chattts -> cosyvoice -> fishspeech -> qwen3tts -> bark -> parler -> … -> azure). */
  engines?: TtsEngine[];
  /** Effective sentence and word profiles used by their queue workers. */
  sentence_priority?: string[];
  word_priority?: string[];
  error?: string;
}

/** Live per-engine synth test (POST /api/local/tts/test). */
export interface TtsTestResponse {
  success: boolean;
  engine: string | null;
  latency_ms: number;
  /** Size of the produced mp3 (0 on failure). */
  bytes: number;
  error: string | null;
  /** The text that was synthesized. */
  text?: string;
  /** Recognition / synth language used. */
  language?: string;
  /** On-disk path of the produced clip (informational). */
  path?: string;
  /** Id of the persisted speech-history record - play via speechHistoryFileUrl(id). */
  record_id?: string;
  /** Accent ACTUALLY produced ("us"|"uk"|"unknown"). */
  accent?: string | null;
  /** Gender used (edge: "female"|"male"). */
  gender?: string;
  /** Speaker name used (qwen3tts, cosyvoice). */
  speaker?: string;
  /** Voice style instruction used (qwen3tts, cosyvoice). */
  instruct?: string;
  /** Voice description used (parler). */
  description?: string;
}

// --- STT (speech-to-text) engine availability + live test ---------------- #
/** Quota/balance for a cloud STT engine (only Azure Speech has one). */
export interface SttQuota {
  /** 'free-tier'. */
  kind: string;
  note: string;
  /** True when the free quota is exhausted (HTTP 429 seen). */
  blocked: boolean;
  error?: string | null;
}

/**
 * One entry in the STT fallback chain (priority order:
 * faster-whisper -> whisper -> vosk -> azure). `quota` is only set on cloud
 * engines that expose one (azure).
 */
export interface SttEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  available: boolean;
  note?: string;
  /** Installed PyPI package version, when applicable. */
  version?: string | null;
  /** Active model/checkpoint tier (STT whisper / faster-whisper). */
  model?: string | null;
  quota?: SttQuota;
  /** Local STT model resident in memory (faster-whisper/whisper/vosk). */
  model_loaded?: boolean;
  /** Seconds until idle-unload (null when not loaded). */
  model_idle_remaining_s?: number | null;
}

export interface SttStatus {
  success: boolean;
  /** Highest-priority available engine id, or null when none are ready. */
  best: string | null;
  active: string | null;
  available_count: number;
  engines: SttEngine[];
  error?: string;
}

/** Live recognition round-trip test (POST /api/local/stt/test). */
export interface SttTestResponse {
  success: boolean;
  engine: string | null;
  /** Recognized text from the generated sample clip. */
  text: string;
  latency_ms: number;
  error: string | null;
  /** The phrase that was synthesized then recognized. */
  phrase?: string;
  /** Language used for synthesis + recognition. */
  language?: string;
  /** On-disk path of the synthesized sample clip. */
  path?: string;
  /** Model used (faster-whisper / whisper override). */
  model?: string;
  /** Id of the persisted speech-history record (for the Records timeline). */
  record_id?: string;
  /** Echo of the backend route that handled this test. */
  route?: string;
}

// --- Engine model-load progress (GET /api/local/engines/load-status) ------- #
/** Load state of a single speech engine (TTS/STT), server or in-process model. */
export type EngineLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * One engine's live model-load progress. Populated for class-B in-process models
 * and class-C HTTP servers as they load; class-A cloud/CLI engines never appear.
 * `log_tail` is the last lines of the engine's startup/load output (bounded).
 */
export interface EngineLoadStatusEntry {
  name: string;
  state: EngineLoadState;
  message: string;
  device: string;
  /** Epoch seconds when the current load started (null when idle). */
  started_at: number | null;
  /** Epoch seconds of the last state change. */
  updated_at: number | null;
  /** Milliseconds elapsed since the load started (ticks while loading). */
  elapsed_ms: number;
  /** Bounded tail of recent load/startup log lines. */
  log_tail: string[];
}

/** GET /api/local/engines/load-status — name -> live load-progress entry. */
export interface EnginesLoadStatusResponse {
  success: boolean;
  engines: Record<string, EngineLoadStatusEntry>;
  error?: string;
}

// --- Speech (TTS/STT) clip history — the audio side of the Records timeline - #
export interface SpeechRecord {
  id: string;
  ts: number;
  iso: string;
  kind: 'tts' | 'stt';
  /** Engine that produced/recognized the clip (edge/sherpa/whisper/azure…). */
  engine: string;
  /** TTS: the synthesized text; STT: the recognized transcript. */
  text: string;
  language: string;
  mime: string;
  bytes: number;
  /** Relative store path (informational). */
  file: string;
  /** Absolute path on disk — for "show actual location" / Open location. */
  path?: string;
  latency_ms: number | null;
  source: string;
  origin: 'pycore' | string;
  ok: boolean;
}

export interface SpeechHistoryResponse {
  success: boolean;
  entries: SpeechRecord[];
  error?: string;
}

/** Local AI agent history — Claude/Codex/Cursor/Gemini txt store (/api/local/agent-history). */
export interface AgentHistorySessionSummary {
  id: string;
  raw_id?: string;
  tool: string;
  os_user: string;
  project: string;
  title: string;
  started_at: string;
  ended_at: string;
  started_ts: number;
  prompt_count: number;
  message_count: number;
  has_subagent: boolean;
  models?: string[];
  bytes?: number;
  file?: string;
}

export interface AgentHistoryTurn {
  ts: number;
  time: string;
  role: 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result' | 'system';
  is_subagent: boolean;
  model?: string | null;
  name?: string | null;
  text: string;
}

export interface AgentHistorySessionDetail extends AgentHistorySessionSummary {
  prompts: Array<{ id: string; ts: number; text: string; edited?: boolean }>;
  turns: AgentHistoryTurn[];
}

export interface AgentHistoryIndex {
  is_dev_machine: boolean;
  generated_at: string;
  tools: string[];
  users: string[];
  langs?: string[];
  sessions: AgentHistorySessionSummary[];
  counts?: Record<string, number>;
}

export interface AgentHistoryPrompt {
  id: string;
  tool: string;
  os_user: string;
  project: string;
  session_id: string;
  ts: number;
  time: string;
  text: string;
  lang?: string;
  edited?: boolean;
}

export interface AgentHistoryPromptsResponse {
  success: boolean;
  data: { items: AgentHistoryPrompt[]; total: number; limit?: number; offset?: number } | null;
  error: string | null;
}

export interface AgentHistoryIndexResponse {
  success: boolean;
  data: AgentHistoryIndex | null;
  error: string | null;
}

export interface AgentHistorySessionResponse {
  success: boolean;
  data: AgentHistorySessionDetail | null;
  error: string | null;
}

// --- DIFF read surface (ID page tables + lazy per-page materialization) ---- #
// ID pages carry IDs + status metadata only and are aligned by `revision`;
// full rows are materialized lazily for the visible page. No full loads.
export interface AgentHistoryIdPage<T> {
  revision: string;
  /** True when `since_revision` matched — reuse the locally cached page table. */
  unchanged?: boolean;
  total: number;
  page: number;
  page_count: number;
  items?: T[];
}

export interface AgentHistorySessionIdItem {
  id: string;
  tool: string;
  os_user: string;
  started_ts: number;
  prompt_count: number;
  has_subagent: boolean;
}

export type AgentHistoryPromptIdItem = Omit<AgentHistoryPrompt, 'text'>;

export type AgentHistoryArticleRecordMetadata = Omit<AgentHistoryArticleRecord, 'article_en' | 'reference_cn'>;

export interface AgentHistorySessionIdPagesResponse {
  success: boolean;
  data: (AgentHistoryIdPage<AgentHistorySessionIdItem> & {
    is_dev_machine?: boolean;
    generated_at?: string;
    tools?: string[];
    users?: string[];
    langs?: string[];
    counts?: Record<string, number>;
  }) | null;
  error: string | null;
}

export interface AgentHistoryPromptIdPagesResponse {
  success: boolean;
  data: (AgentHistoryIdPage<AgentHistoryPromptIdItem> & {
    generated_at?: string;
    tools?: string[];
    users?: string[];
    counts?: Record<string, number>;
  }) | null;
  error: string | null;
}

export interface AgentHistoryArticleRecordIdPagesResponse {
  success: boolean;
  data: AgentHistoryIdPage<AgentHistoryArticleRecordMetadata> | null;
  error: string | null;
}

export interface AgentHistorySessionPageResponse {
  success: boolean;
  data: { items: AgentHistorySessionSummary[]; total: number } | null;
  error: string | null;
}

export interface AgentHistoryPromptPageResponse {
  success: boolean;
  data: { items: AgentHistoryPrompt[]; total: number } | null;
  error: string | null;
}

export interface AgentHistoryArticleRecordPageResponse {
  success: boolean;
  data: { items: AgentHistoryArticleRecord[]; total: number } | null;
  error: string | null;
}

/** One generated article row from GET …/agent-history/article/records. */
export interface AgentHistoryArticleRecord {
  id: string;
  created_at: string;
  title_cn: string;
  title_en: string;
  reference_cn?: string;
  article_en?: string;
  word_count: number;
  openrouter_model?: string;
  translation_engine?: string;
  /** Audio generation source reported by the TTS backend at synthesis time. */
  tts_engine?: string;
  tts_model?: string;
  /** Multi-sentence synthesis marker (single-version pipeline): true = the
   *  audio was generated by the sentence-chunk pipeline. A missing marker
   *  marks the record as a rebuild candidate (engine-agnostic rule) for the
   *  piggyback lane that re-generates it and replaces it on Laravel. */
  tts_chunked?: boolean;
  rebuild_attempts?: number;
  audio_rebuilt_at?: string | null;
  audio_available: boolean;
  audio_url?: string | null;
  audio_status?: string | null;
  laravel_article_id?: string | null;
  uploaded: boolean;
  uploaded_at?: string | null;
}

export interface AgentHistoryTestExtractResponse {
  success?: boolean;
  data?: {
    ok: boolean;
    empty?: boolean;
    tool: string;
    sources?: number;
    error?: string;
    prompt?: { ts: number; text: string };
  };
  error?: string | null;
}

export interface AgentHistoryToolStatistics {
  tool: string;
  sessions: number;
  history_records: number;
  content_records?: number;
  processed: number;
  pending: number;
  prompts: number;
  replies: number;
  generated_at: string;
  source_modified_ts: number;
}

export interface AgentHistoryStatusResponse {
  success: boolean;
  data?: {
    tick?: Record<string, unknown>;
    store?: Record<string, unknown>;
    article?: Record<string, unknown>;
    tool_history?: AgentHistoryToolStatistics;
    tool_histories?: AgentHistoryToolStatistics[];
  };
  error?: string | null;
}

export interface AgentHistoryArticleRecordsResponse {
  success?: boolean;
  records?: AgentHistoryArticleRecord[];
  data?: { records?: AgentHistoryArticleRecord[] };
  error?: string | null;
}

/** POST …/reveal — opened the file's folder in the OS file manager. */
export interface RevealResponse {
  success: boolean;
  /** Absolute path that was revealed. */
  path?: string;
  error?: string;
}

/** Settings-adjustable TTS tuning (GET/POST /api/local/tts/settings). */
export interface TtsSettings {
  success: boolean;
  /** Per-attempt edge-tts synth timeout (seconds; backend clamps 5–120). */
  synth_timeout_s: number;
  /** Edge-tts failure cooldown window (seconds; backend clamps 0–3600). */
  edge_cooldown_s: number;
  server_auto_manage?: boolean;
  server_single_active?: boolean;
  server_idle_shutdown_s?: number;
  server_enabled?: Record<string, boolean>;
}

export interface TtsServerActionResponse {
  success: boolean;
  engine?: string;
  enabled?: boolean;
  running?: boolean;
  managed?: boolean;
  error?: string;
  note?: string;
}

// --- Local LLM engines (article pipeline) — mirrors the TTS status shape --- #
/** One local LLM engine row (priority order; e.g. ollama -> lmstudio -> llamacpp). */
export interface LlmEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  /** Runtime-ready — reachable + has a usable model now. */
  available: boolean;
  /** Prerequisites installed (binary/server present); may still need a running server. */
  installed: boolean;
  note?: string;
  base_url?: string;
  default_model?: string;
  /** Managed local HTTP server engine (ollama is startable via /api/local/llm/server). */
  server_engine?: boolean;
  server_running?: boolean;
  /** Why this engine is off (e.g. not installed / server down). */
  disabled_reason?: string | null;
}

export interface LlmStatus {
  success: boolean;
  /** Highest-priority AVAILABLE engine, or null. */
  best?: string | null;
  /** Engine the next generation would actually use, or null (falls back to OpenRouter). */
  active?: string | null;
  available_count: number;
  engines: LlmEngine[];
  auto_manage: boolean;
  single_active: boolean;
  idle_shutdown_s: number;
}

/** Live per-engine generation test (POST /api/local/llm/test). */
export interface LlmTestResponse {
  success: boolean;
  engine?: string | null;
  model?: string | null;
  text?: string;
  error?: string;
}

export interface LlmServerActionResponse {
  success: boolean;
  engine?: string;
  enabled?: boolean;
  running?: boolean;
  error?: string;
  note?: string;
}

