import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * AiStatusAPI — provider availability + live AI test for the AI Tools panel.
 *
 * Backed by laravel_main :9000 under the prefix `/api/app_qy_v1/ai_tools/ai`
 * (both routes are public / no-auth). BaseAPI already unwraps the
 * `{ success, data, message }` ApiResponse envelope, so callers read
 * `res.data` directly.
 *
 *   GET  /status[?refresh=1]  → AiStatusResponse
 *   POST /test                → AiTestResult (may arrive as HTTP 502 on failure,
 *                               in which case BaseAPI surfaces res.success=false
 *                               with the error string).
 */

/** One provider row from GET /status. */
export interface AiProviderStatus {
  name: string;
  configured: boolean;
  available: boolean;
  key_masked: string;
  models: string[];
  error: string | null;
  latency_ms: number | null;
}

/** Full payload of GET /status (already unwrapped from the data envelope). */
export interface AiStatusResponse {
  providers: AiProviderStatus[];
  fallback_chain: string[];
  cached: boolean;
  age_ms: number;
}

/** Body for POST /test. */
export interface AiTestRequest {
  provider: string;
  model?: string;
  prompt?: string;
}

/** Inner result of POST /test (the unwrapped `data`). */
export interface AiTestResult {
  success: boolean;
  provider: string;
  model: string;
  response: string;
  latency_ms: number | null;
  error?: string;
}

/**
 * AiStatusAPI module. Prefix is configured in core/api/index.ts as
 * `/api/app_qy_v1/ai_tools/ai`, so method paths are relative to that.
 */
export class AiStatusAPI extends BaseAPI {
  /**
   * Provider availability snapshot: masked key, models (= versions), latency,
   * and the fallback dispatch chain. Pass `refresh=true` to bypass the
   * server-side cache and re-probe live.
   */
  async getAiStatus(refresh: boolean = false): Promise<APIResponse<AiStatusResponse>> {
    const params = refresh ? { refresh: 1 } : undefined;
    // retry=false: a single probe — never fan out into a retry storm.
    return this.get<AiStatusResponse>('/status', params, false, 0, false);
  }

  /**
   * Run a real-time test prompt against one provider/model. On a provider
   * failure the backend may answer HTTP 502; BaseAPI then returns
   * `success=false` with the error in `error`, so callers should fall back to
   * `res.data?.error || res.error`.
   */
  async testAi(body: AiTestRequest): Promise<APIResponse<AiTestResult>> {
    return this.post<AiTestResult>('/test', body);
  }
}
