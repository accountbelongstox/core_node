import { BaseAPI, getSharedBaseURL } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * AiManagementAPI — laravel_main's unified AI gateway, surfaced on the
 * laravel-manager "AI Management" page.
 *
 * Backed by laravel_main :9000 under the prefix `/api/local/ai` (configured in
 * core/api/index.ts). BaseAPI already unwraps the `{ success, data, message }`
 * ApiResponse envelope, so callers read `res.data` directly.
 *
 *   GET  /catalog                 → { providers }              (no network — instant grid)
 *   GET  /probe?provider=NAME     → AiProvider (tested:true)   (single-card live test)
 *   GET  /probe?refresh=1         → { providers, cached, age_ms } (Test All)
 *   POST /chat                    → AiChatResult
 *   GET  /gateway                 → { providers, records }     (gateway activity)
 *   GET  /rate-limits             → { providers: RateStatus[] } (live rate meters)
 *   POST /image                   → AiImageResult
 *
 * Probes pass retry=false so a single test never fans out into a retry storm
 * against a slow/dead provider.
 */

/** Local rate-budget snapshot for one provider (minute / day / month). */
export interface AiRateStatus {
  provider: string;
  enforced: boolean;
  note?: string;
  limits?: {
    rpm?: number | null;
    rpd?: number | null;
    rps?: number | null;
    rpm_month?: number | null;
    note?: string | null;
  };
  usage?: {
    minute?: number;
    day?: number;
    month?: number;
  };
  resets_in?: {
    minute?: number;
    day?: number;
    month?: number;
  };
  last_updated?: string;
}

/** One provider row from GET /catalog or GET /probe. */
export interface AiProvider {
  name: string;
  configured: boolean;
  available: boolean;
  tier: 'free' | 'balance' | 'paid';
  limits: string;
  vision: boolean;
  image: boolean;
  /** True when an image model is bound and ready (solid badge); else muted-outline. */
  image_ready?: boolean;
  /** The image model bound to this provider (shown next to the image badge). */
  image_model?: string;
  key_masked: string | null;
  models: string[];
  error: string | null;
  latency_ms: number | null;
  tested: boolean;
  rate: AiRateStatus | null;
  /** Present on a single-provider probe response when the provider is cooling down. */
  rate_limited?: boolean;
}

/** Payload of GET /catalog (already unwrapped from the data envelope). */
export interface AiCatalogResponse {
  providers: AiProvider[];
  error?: string | null;
}

/** Payload of GET /probe?refresh=1 (the Test All response). */
export interface AiProbeAllResponse {
  providers: AiProvider[];
  cached: boolean;
  age_ms: number;
  error?: string | null;
}

/** A single chat message in a multi-turn /chat request. */
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Body for POST /chat. */
export interface AiChatRequest {
  provider?: string;
  message?: string;
  messages?: AiChatMessage[];
  model?: string;
  source?: string;
}

/** Inner result of POST /chat (the unwrapped `data`). */
export interface AiChatResult {
  success: boolean;
  provider: string;
  model: string;
  nickname: string;
  text: string;
  latency_ms: number | null;
  error: string | null;
  retry_after_s: number | null;
}

/** One gateway provider summary from GET /gateway. */
export interface AiGatewayProvider {
  name: string;
  tier: 'free' | 'balance' | 'paid';
  limits: string;
  vision: boolean;
  image: boolean;
  configured: boolean;
  available: boolean;
  key_masked: string | null;
  models: string[];
  quota: Record<string, any>;
  calls: number;
  ok: number;
  failed: number;
  last_error: string | null;
  cooldown_s: number;
}

/** One recent gateway call record from GET /gateway. */
export interface AiGatewayRecord {
  ts: number;
  kind: string;
  source: string;
  provider: string;
  model: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

/** Payload of GET /gateway. */
export interface AiGatewayResponse {
  success: boolean;
  providers: AiGatewayProvider[];
  records: AiGatewayRecord[];
}

/** Payload of GET /rate-limits. */
export interface AiRateLimitsResponse {
  success: boolean;
  last_updated: string;
  storage_path: string;
  providers: AiRateStatus[];
}

/** Body for POST /image. */
export interface AiImageRequest {
  prompt: string;
  size?: string;
  model?: string;
  provider?: string;
  source?: string;
}

/** Inner result of POST /image. */
export interface AiImageResult {
  success: boolean;
  provider: string;
  model: string;
  image_base64: string;
  mime: string;
  latency_ms: number | null;
  error: string | null;
}

/** One image-history entry (metadata only — no base64 in the index). */
export interface AiImageHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  provider: string;
  model: string;
  prompt: string;
  size: string;
  mime: string;
  bytes: number;
  file: string;
  latency_ms: number | null;
  source: string;
  /** Which runtime generated the entry — 'pycore' | 'laravel'. */
  origin: string;
  ok: boolean;
}

/** Payload of GET /image/history. */
export interface AiImageHistoryResponse {
  success: boolean;
  entries: AiImageHistoryEntry[];
  error?: string | null;
}

/** Payload of POST /image/history/clear. */
export interface AiImageHistoryClearResponse {
  success: boolean;
  removed: number;
}

/** One shared usage record (text / vision / probe — images live in history). */
export interface AiUsageRecord {
  ts: number;
  iso: string;
  /** Which runtime issued the call — 'pycore' | 'laravel'. */
  runtime: string;
  kind: 'text' | 'vision' | 'probe';
  provider: string;
  model: string;
  source: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

/** Per-kind counters for one provider in the usage rollup. */
export interface AiUsageKindStat {
  calls: number;
  ok: number;
  failed: number;
}

/** Per-provider usage rollup (kinds + last call). */
export interface AiUsageProviderStat {
  text?: AiUsageKindStat;
  vision?: AiUsageKindStat;
  probe?: AiUsageKindStat;
  last_ts?: number;
  last_model?: string;
}

/** Payload of GET /usage. */
export interface AiUsageResponse {
  success: boolean;
  storage_path: string;
  stats: Record<string, AiUsageProviderStat>;
  entries: AiUsageRecord[];
}

/** One key slot for a provider (a single secret file name + masked value). */
export interface AiKeySlot {
  /** Exact secret name, e.g. GOOGLE_API_KEY_1 / GOOGLE_API_KEY_IMAGE_1. */
  name: string;
  /** True when a value is currently stored under this name. */
  set: boolean;
  /**
   * True for a real secret (masked). False for plain config (endpoint /
   * deployment / region / base-url) which is returned in FULL so the user can
   * verify it. Absent → treat as secret.
   */
  secret?: boolean;
  /** Secret: masked (first4…last4). Config: the full value. null when unset. */
  masked: string | null;
}

/** One provider's key inventory from GET /keys. */
export interface AiKeysProvider {
  provider: string;
  /** Registry base name (e.g. GOOGLE_API_KEY); '' for keyless providers. */
  key_base: string;
  /** Secondary secret name (e.g. CLOUDFLARE_ACCOUNT_ID) or null. */
  extra_secret_name: string | null;
  /** True when the provider needs no API key (e.g. pollinations). */
  keyless: boolean;
  /** _1.._5, bare, _IMAGE_1.._5, then the extra-secret slot if any. */
  slots: AiKeySlot[];
}

/** Payload of GET /keys. */
export interface AiKeysResponse {
  success: boolean;
  providers: AiKeysProvider[];
  error?: string | null;
}

/** Payload of POST /keys (set/replace one key). */
export interface AiKeySetResponse {
  success: boolean;
  key_name?: string;
  /** Masked stored value (first4…last4) — never the raw key. */
  masked?: string | null;
  error?: string | null;
}

/** Payload of POST /keys/delete. */
export interface AiKeyDeleteResponse {
  success: boolean;
  error?: string | null;
}

/**
 * AiManagementAPI module. Prefix is configured in core/api/index.ts as
 * `/api/local/ai`, so method paths are relative to that.
 */
export class AiManagementAPI extends BaseAPI {
  /**
   * Provider catalog — no network call, renders the grid instantly with masked
   * keys / models / tier / limits / cached rate snapshot (tested:false).
   */
  async getCatalog(): Promise<APIResponse<AiCatalogResponse>> {
    return this.get<AiCatalogResponse>('/catalog', undefined, false, 0, false);
  }

  /**
   * Live test ONE provider (never cached). Returns a single provider record
   * with tested:true plus optional rate_limited:bool.
   */
  async probeOne(name: string): Promise<APIResponse<AiProvider>> {
    return this.get<AiProvider>('/probe', { provider: name }, false, 0, false);
  }

  /**
   * Live test ALL providers ("Test All"). `refresh=true` bypasses the
   * server-side cache and re-probes everything.
   */
  async probeAll(refresh: boolean = true): Promise<APIResponse<AiProbeAllResponse>> {
    const params = refresh ? { refresh: 1 } : undefined;
    return this.get<AiProbeAllResponse>('/probe', params, false, 0, false);
  }

  /**
   * Run a chat completion through the gateway. `provider` may be "auto" (smart
   * free→balance→paid dispatch) or a specific provider name.
   */
  async chat(body: AiChatRequest): Promise<APIResponse<AiChatResult>> {
    return this.post<AiChatResult>('/chat', body);
  }

  /**
   * Gateway activity: per-provider call counters / cooldown + the recent call
   * record list (which provider/model handled each task).
   */
  async getGateway(): Promise<APIResponse<AiGatewayResponse>> {
    return this.get<AiGatewayResponse>('/gateway', undefined, false, 0, false);
  }

  /**
   * Live local rate-budget snapshot for every provider (minute / day / month
   * usage vs limits with reset countdowns). No provider call, no quota spend.
   */
  async getRateLimits(): Promise<APIResponse<AiRateLimitsResponse>> {
    return this.get<AiRateLimitsResponse>('/rate-limits', undefined, false, 0, false);
  }

  /**
   * Generate an image through the gateway (returns base64). Used by the chat
   * test box when an image model is selected.
   */
  async generateImage(body: AiImageRequest): Promise<APIResponse<AiImageResult>> {
    return this.post<AiImageResult>('/image', body);
  }

  /**
   * Generate an image (spec alias of generateImage). POST /image — the result
   * carries base64 + mime, and the backend auto-records it to shared history.
   */
  async image(req: AiImageRequest): Promise<APIResponse<AiImageResult>> {
    return this.post<AiImageResult>('/image', req);
  }

  /**
   * List the shared image history (metadata only, newest-first). GET
   * /image/history?limit=N. The store is shared cross-runtime, so this returns
   * entries generated by both pycore and laravel (see the `origin` field).
   */
  async imageHistory(limit: number = 50): Promise<APIResponse<AiImageHistoryResponse>> {
    return this.get<AiImageHistoryResponse>('/image/history', { limit }, false, 0, false);
  }

  /**
   * Absolute URL of the raw image bytes for one history entry, suitable for an
   * `<img src>` (GET /image/history/file/{id}). Uses the SAME shared base URL
   * + prefix every other AI call resolves, so it follows endpoint failover.
   */
  imageHistoryFileUrl(id: string): string {
    const base = (getSharedBaseURL() ?? this.baseURL).replace(/\/+$/, '');
    const prefix = this.prefix ? (this.prefix.endsWith('/') ? this.prefix.slice(0, -1) : this.prefix) : '';
    return `${base}${prefix}/image/history/file/${encodeURIComponent(id)}`;
  }

  /** Delete one image-history entry. DELETE /image/history/{id}. */
  async deleteImageHistory(id: string): Promise<APIResponse<{ success: boolean }>> {
    return this.delete<{ success: boolean }>(`/image/history/${encodeURIComponent(id)}`);
  }

  /** Clear the entire image history. POST /image/history/clear. */
  async clearImageHistory(): Promise<APIResponse<AiImageHistoryClearResponse>> {
    return this.post<AiImageHistoryClearResponse>('/image/history/clear', {});
  }

  /**
   * Shared cross-runtime AI usage log — text / vision / probe records (newest
   * first) + a per-provider/kind rollup. GET /usage?limit=N&kind=. The store is
   * shared with pycore, so this shows usage from BOTH runtimes (see `runtime`).
   * Image generations live in the image history, not here.
   */
  async getUsage(limit: number = 100, kind?: string): Promise<APIResponse<AiUsageResponse>> {
    const params: Record<string, any> = { limit };
    if (kind) {
      params.kind = kind;
    }
    return this.get<AiUsageResponse>('/usage', params, false, 0, false);
  }

  /**
   * Per-provider AI key inventory (slots with masked values only — the raw key
   * is never returned). GET /keys. Keys are SHARED with pycore; multiple keys
   * (KEY_1, KEY_2, …) enable automatic failover.
   */
  async listKeys(): Promise<APIResponse<AiKeysResponse>> {
    return this.get<AiKeysResponse>('/keys', undefined, false, 0, false);
  }

  /**
   * Set/replace one AI provider key. POST /keys { key_name, value }. The backend
   * validates the name against the registry allow-list and returns the MASKED
   * stored value — never the raw key.
   */
  async setKey(keyName: string, value: string): Promise<APIResponse<AiKeySetResponse>> {
    return this.post<AiKeySetResponse>('/keys', { key_name: keyName, value });
  }

  /** Delete one AI provider key file. POST /keys/delete { key_name }. */
  async deleteKey(keyName: string): Promise<APIResponse<AiKeyDeleteResponse>> {
    return this.post<AiKeyDeleteResponse>('/keys/delete', { key_name: keyName });
  }
}
