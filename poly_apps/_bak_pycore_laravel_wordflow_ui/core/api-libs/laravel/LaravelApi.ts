/**
 * laravel-manager end API library.
 *
 * The Laravel dashboard already ships a complete, self-contained API layer
 * (singleton in core/api, with BaseAPI shared-base-URL probe/failover via
 * services/ApiManager and APICache). The unified shell keeps it verbatim and
 * simply re-exports it here so all three ends sit under core/api-libs/* with a
 * consistent, end-prefixed entry point. Probe / auto-select / cache unchanged.
 */
export { api as laravelApi } from '../../api';
export type { APIResponse } from '../../api';

import { MasterApiClient } from '../base';
import { getSharedBaseURL } from '../../api/base/BaseAPI';

/**
 * Structural opt-in point on the master API base client (core/api-libs/base).
 * PASS-THROUGH today: the offline write queue is DISABLED (no queueStorageKey)
 * and no existing laravel module routes through it — BaseAPI keeps its current
 * timeout/retry behavior unchanged in this pass. To enable later, construct
 * with `{ queueStorageKey: 'laravel_api_queue' }` and route writes through
 * `laravelMasterClient.request()` (30-min ceiling, queue semantics — see
 * development-guides/MULTI_API_URL_SYSTEM.md "Master API base client").
 */
export class LaravelMasterClient extends MasterApiClient {
  /** Follows the process-wide shared base URL (ApiManager-resolved). */
  protected resolveBaseUrl(): string {
    return getSharedBaseURL() ?? '';
  }
}

/** Queue-disabled pass-through instance (future opt-in surface). */
export const laravelMasterClient = new LaravelMasterClient();
