/**
 * PycoreLaravelApi — typed wrappers for the pycore `laravel_api.*` rpc_v2 RPCs.
 *
 * The pycore backend owns WHICH Laravel base URL its sync engine targets
 * (single source of truth — the same resolution `video_extract.backend_status`
 * reports). These RPCs let the dashboard list/select/add/remove/probe those
 * endpoints. All calls ride the shared WS bus (`callRpc`), so they reject with
 * a clear "RPC unavailable" error when pycore (:59000) is offline — callers
 * must surface that instead of rendering a broken control.
 *
 * FE/BE contract (backend implemented in pycore, in parallel):
 *   laravel_api.list           -> { endpoints: [{url, healthy, latency_ms, last_checked}], current }
 *   laravel_api.add {url}      -> mutate; FE re-lists after
 *   laravel_api.remove {url}   -> mutate; FE re-lists after
 *   laravel_api.select {url}   -> mutate; FE re-lists + refreshes backend_status
 *   laravel_api.probe {url?}   -> health result(s); FE re-lists after
 *
 * Mutate/probe response shapes are deliberately loose (the FE always re-calls
 * `list` afterwards rather than trusting partial echoes), so contract drift on
 * those replies can never break the UI.
 */
import { callRpc } from './PycoreWs';
import { PYCORE_RPC_ROUTES } from './PycoreRpcRoutes';

/** One Laravel API endpoint as known to the pycore backend. */
export interface LaravelApiEndpoint {
  url: string;
  /** true = last probe OK, false = last probe failed, null = never probed. */
  healthy: boolean | null;
  /** Probe latency in ms; null/undefined when never probed or unhealthy. */
  latency_ms?: number | null;
  /** ISO-ish timestamp of the last probe; null when never probed. */
  last_checked?: string | null;
  /** Optional backend hint: user-added (removable) vs built-in. */
  custom?: boolean;
}

export interface LaravelApiListResponse {
  success?: boolean;
  endpoints: LaravelApiEndpoint[];
  /** URL of the endpoint the sync engine currently targets. */
  current: string;
  /** URL the resolver actually settled on this process (null = not resolved yet). */
  resolved: string | null;
  error?: string;
}

/** Loose mutate/probe reply — FE re-lists instead of trusting these fields. */
export interface LaravelApiMutateResponse {
  success?: boolean;
  error?: string;
  endpoints?: LaravelApiEndpoint[];
  current?: string;
}

/**
 * Window event fired after a successful `laravel_api.select`, so sibling
 * widgets (e.g. PcLaravelMediaPanel's `video_extract.backend_status` view)
 * re-fetch against the newly targeted backend.
 */
export const PYCORE_LARAVEL_API_CHANGED_EVENT = 'pycore:laravel-api-changed';

export const pycoreLaravelApi = {
  /** List known Laravel endpoints + which one is current. */
  list: (): Promise<LaravelApiListResponse> =>
    callRpc(PYCORE_RPC_ROUTES.laravelApiList, {}),

  /** Add a custom Laravel base URL. */
  add: (url: string): Promise<LaravelApiMutateResponse> =>
    callRpc(PYCORE_RPC_ROUTES.laravelApiAdd, { url }),

  /** Remove a (custom) Laravel base URL. */
  remove: (url: string): Promise<LaravelApiMutateResponse> =>
    callRpc(PYCORE_RPC_ROUTES.laravelApiRemove, { url }),

  /** Switch the sync engine's target to `url`. */
  select: (url: string): Promise<LaravelApiMutateResponse> =>
    callRpc(PYCORE_RPC_ROUTES.laravelApiSelect, { url }),

  /** Re-probe one endpoint (`url`) or all endpoints (no arg). */
  probe: (url?: string): Promise<LaravelApiMutateResponse> =>
    callRpc(PYCORE_RPC_ROUTES.laravelApiProbe, url ? { url } : {}),
};

export type PycoreLaravelApi = typeof pycoreLaravelApi;
