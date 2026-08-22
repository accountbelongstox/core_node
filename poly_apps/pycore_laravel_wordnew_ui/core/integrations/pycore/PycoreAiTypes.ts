/**
 * Pycore Ai API types.
 */
import type { AiUsageProviderStat } from '../../contracts/ai';

export type { AiChatMessage, AiChatRole, AiUsageKindStat, AiUsageProviderStat } from '../../contracts/ai';

// --- AI status (provider availability probe) ----------------------------- #
/** Local rate-limit snapshot for a provider (current usage vs encoded free-tier limits). */
export interface AiProviderRate {
  provider: string;
  enforced: boolean;
  note?: string;
  limits?: {
    rpm: number | null;
    rpd: number | null;
    rps: number | null;
    rpm_month: number | null;
    note: string;
  };
  usage?: { minute: number; day: number; month: number };
  /**
   * Seconds until each budget resets: minute = sliding 60s window; day = local
   * midnight; month = the 1st. null when there is nothing to reset.
   */
  resets_in?: { minute: number | null; day: number | null; month?: number | null };
  last_updated?: string;
}

/** GET /api/local/ai/rate-limits — live local rate budgets (auto-reset by tick). */
export interface AiRateLimitsResponse {
  success: boolean;
  last_updated?: string;
  storage_path?: string;
  providers: AiProviderRate[];
}

/**
 * Per-KEY rotation status slot (gateway endpoint). Multi-key providers rotate
 * KEY1 → KEY2 → … as keys hit a 429/quota and cool down. `image_keys` use the
 * SAME shape but a SEPARATE budget (a provider may have a dedicated
 * `{BASE}_IMAGE` key whose cooldowns never block text and vice-versa).
 */
export interface AiKeySlot {
  /** 0-based position in the rotation pool (UI shows it as KEY{index+1}). */
  index: number;
  /** Display label — 'KEY1' | 'KEY2' | … */
  label: string;
  /** Masked key (first4 + … + last4); never the full secret. */
  masked: string;
  /** Seconds remaining on this key's cooldown (0 = ready/active). */
  cooldown_s: number;
  /** Total attempts counted against this key slot. */
  used: number;
  ok: number;
  failed: number;
  /** Requests by this key in the last 60s (persistent per-key rate counter). */
  minute_used?: number;
  /** Requests by this key today, UTC (persistent per-key rate counter). */
  day_used?: number;
  /** Epoch seconds of the last use, or null. */
  last_used: number | null;
  /** Last error string for this key, or null. */
  last_error: string | null;
}

/**
 * One provider row from GET /api/local/ai/keys — the key-management view of a
 * provider (NOT a live availability probe). `keys` / `image_keys` reuse the
 * AiKeySlot shape; `key_base` is the secret-store base name (e.g. GOOGLE_API_KEY)
 * the indexed slots derive from (BASE_1 … BASE_5 for text, BASE_IMAGE_1 … for the
 * dedicated image budget).
 */
export interface AiKeyProvider {
  name: string;
  /** Secret-store base name the indexed key files derive from. */
  key_base: string;
  /** True when this provider needs no API key (e.g. pollinations). */
  keyless: boolean;
  /** True when this provider only generates images (no text/chat). */
  image_only: boolean;
  /** A text key is present (or keyless) — ready for chat/text. */
  configured: boolean;
  /** An image key is present (or keyless) — ready for image generation. */
  image_ready: boolean;
  /** How many text keys are configured. */
  key_count: number;
  /** Per-text-key rotation slots (KEY1/KEY2 …). */
  keys: AiKeySlot[];
  /** Per-image-key rotation slots (separate budget). */
  image_keys: AiKeySlot[];
}

/** GET /api/local/ai/keys — key-management catalog + the raw key file names. */
export interface AiKeysResponse {
  success: boolean;
  providers: AiKeyProvider[];
  /** Exact env-var names of every configured key file (for targeted delete). */
  raw_key_files: string[];
  error?: string;
}

/** POST /api/local/ai/keys body — write one indexed key file, then re-probe. */
export interface AiKeySetRequest {
  provider?: string;
  base_name?: string;
  /** 1..5 rotation slot. */
  index?: number;
  value: string;
  /** Write {BASE}_IMAGE_{index} (dedicated image budget) instead of {BASE}_{index}. */
  image?: boolean;
}

/** POST /api/local/ai/keys response — the env-var name that was written. */
export interface AiKeySetResponse {
  success: boolean;
  key_name?: string;
  error?: string;
}

/** DELETE /api/local/ai/keys/{key_name} response. */
export interface AiKeyDeleteResponse {
  success: boolean;
  error?: string;
}

/** POST /api/local/ai/keys/reset-cooldown response. */
export interface AiKeyResetCooldownResponse {
  success: boolean;
  /** How many key slots had their cooldown cleared. */
  cleared?: number;
  error?: string;
}

export interface AiProvider {
  name: string;
  configured: boolean;
  available: boolean;
  tier?: AiTier;
  limits?: string;
  vision?: boolean;
  /** Registry capability: this provider can generate images. */
  image?: boolean;
  /** image capability AND a key is present (ready to generate, NO live call). */
  image_ready?: boolean;
  /** The image model this provider generates with (e.g. `dall-e-3`). */
  image_model?: string;
  key_masked: string | null;
  models: string[];
  error: string | null;
  latency_ms: number | null;
  /** True once a live availability test has run (catalog rows are untested). */
  tested?: boolean;
  /** True when the test was skipped because the local rate budget is exhausted. */
  rate_limited?: boolean;
  /** Current local rate-limit usage vs limits (shown on the card). */
  rate?: AiProviderRate | null;
  /** Rotation pool size — how many keys are configured (gateway-sourced). */
  key_count?: number;
  /** Per-text-key rotation status (gateway-sourced; merged onto catalog rows). */
  keys?: AiKeySlot[];
  /** Per-IMAGE-key rotation status (separate budget; gateway-sourced). */
  image_keys?: AiKeySlot[];
}

export interface AiProbeResponse {
  providers: AiProvider[];
  error?: string;
}

/**
 * GET /api/local/ai/balance[?provider=] — account credit / remaining balance.
 * Only openrouter / deepseek / siliconflow / moonshot expose a balance API;
 * any other provider returns `supported:false` with no network call.
 */
export interface AiBalance {
  name: string;
  /** This provider exposes a machine-readable balance endpoint at all. */
  supported: boolean;
  /** A key is present (balance can be fetched). */
  configured: boolean;
  /** The live balance fetch succeeded. */
  ok: boolean;
  currency: string | null;
  /** Remaining / available balance. */
  balance: number | null;
  /** Free / granted portion (deepseek / siliconflow gift). */
  granted: number | null;
  /** Paid / topped-up portion. */
  topped_up: number | null;
  /** Total credits granted (openrouter). */
  total: number | null;
  /** Total usage to date (openrouter). */
  used: number | null;
  /** Openrouter key tier flag. */
  is_free_tier: boolean | null;
  key_masked: string | null;
  /** Human one-liner, e.g. "4.20 USD remaining". */
  detail: string;
  error: string | null;
  latency_ms: number | null;
}

export interface AiBalanceResponse {
  providers: AiBalance[];
  /** Provider names that expose a balance API. */
  supported: string[];
  /** Every other registered provider (no balance endpoint). */
  unsupported: string[];
}

// --- AI image generation + shared history -------------------------------- #
/**
 * POST /api/local/ai/image — unified IMAGE contract. On success the backend ALSO
 * records the result into the shared cross-runtime history store.
 */
export interface AiImageResponse {
  success: boolean;
  provider: string;
  model: string;
  /** Base64 image bytes (NO data: prefix) — render as `data:${mime};base64,...`. */
  image_base64: string | null;
  mime: string;
  latency_ms: number | null;
  error: string | null;
  /** History id of the saved entry, when the backend echoes it. */
  id?: string;
}

/**
 * One metadata row from GET /api/local/ai/image/history (newest-first). The image
 * bytes are NEVER inlined — fetch them via imageHistoryFileUrl(id). The store is
 * SHARED with laravel, so `origin` distinguishes which runtime generated each.
 */
export interface ImageHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  provider: string;
  model: string;
  prompt: string;
  size: string;
  mime: string;
  bytes: number;
  /** Relative store path (e.g. `ai_images/<id>.png`) — informational only. */
  file: string;
  latency_ms: number | null;
  source: string;
  /** Which runtime generated the entry. */
  origin: 'pycore' | 'laravel' | string;
  ok: boolean;
}

export interface ImageHistoryResponse {
  success: boolean;
  entries: ImageHistoryEntry[];
  error?: string;
}

export interface ImageHistoryClearResponse {
  success: boolean;
  removed?: number;
  error?: string;
}

export interface ImageHistoryDeleteResponse {
  success: boolean;
  error?: string;
}

// --- AI chat (provider confirm) ------------------------------------------ #
export interface AiChatResponse {
  success: boolean;
  provider: string;
  model: string;
  nickname?: string;
  text: string;
  latency_ms: number | null;
  error: string | null;
  retry_after_s?: number | null;
}

// --- AI gateway (unified exit: smart dispatch + quota + records) ---------- #
export type AiTier = 'free' | 'balance' | 'paid';

export interface AiGatewayQuota {
  kind: 'key-usage' | 'balance' | 'static' | 'none';
  is_free_tier?: boolean;
  usage?: number | null;
  limit?: number | null;
  limit_remaining?: number | null;
  rate_limit?: { requests?: number; interval?: string } | null;
  is_available?: boolean;
  balance?: string | null;
  currency?: string | null;
  note?: string;
  error?: string;
}

export interface AiGatewayProvider {
  name: string;
  tier: AiTier;
  limits?: string;
  vision: boolean;
  image?: boolean;
  configured: boolean;
  available: boolean;
  key_masked?: string | null;
  models: string[];
  quota: AiGatewayQuota;
  image_model?: string;
  calls: number;
  ok: number;
  failed: number;
  last_error: string | null;
  cooldown_s: number;
  /** Rotation pool size — how many keys are configured. */
  key_count?: number;
  /** Per-text-key rotation status (KEY1/KEY2…). */
  keys?: AiKeySlot[];
  /** Per-IMAGE-key rotation status (separate budget). */
  image_keys?: AiKeySlot[];
}

export interface AiGatewayRecord {
  ts: number;
  kind: 'text' | 'vision';
  source: string;
  provider: string;
  model: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface AiGatewayStatus {
  success: boolean;
  providers: AiGatewayProvider[];
  records: AiGatewayRecord[];
}

// --- AI usage (SHARED cross-runtime store — text / vision / probe) -------- #
/**
 * One shared usage record from GET /api/local/ai/usage (newest-first). The
 * store is SHARED with laravel, so `runtime` distinguishes which runtime issued
 * the call. Image generations are NOT here — they live in the image history.
 */
export interface AiUsageRecord {
  ts: number;
  iso: string;
  /** Which runtime issued the call — 'pycore' | 'laravel'. */
  runtime: 'pycore' | 'laravel' | string;
  kind: 'text' | 'vision' | 'probe';
  provider: string;
  model: string;
  source: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

/** GET /api/local/ai/usage — shared usage log + per-provider/kind rollup. */
export interface AiUsageResponse {
  success: boolean;
  storage_path: string;
  stats: Record<string, AiUsageProviderStat>;
  source_stats?: Record<string, Record<string, unknown>>;
  entries: AiUsageRecord[];
  error?: string;
}

