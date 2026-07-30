/**
 * PycoreLaravelApi - typed wrappers for the `laravel_api/*` HTTP routes.
 *
 * The frontend owns the prepared endpoint catalog; the pycore backend owns its
 * persisted overrides and selected target (the same resolution
 * `video_extract.backend_status` reports). `list` synchronizes the frontend
 * catalog into the backend cache and returns the backend-priority merged view.
 * These HTTPs also let the dashboard select/add/remove/probe those endpoints.
 * All calls use the shared HTTP controller transport (`requestPycoreHttp`).
 * a clear "HTTP unavailable" error when pycore (:59000) is offline — callers
 * must surface that instead of rendering a broken control.
 *
 * FE/BE contract (backend implemented in pycore, in parallel):
 *   laravel_api.list {frontend_endpoints} -> { endpoints: [{url, healthy, latency_ms, last_checked}], current }
 *   laravel_api.add {url}      -> mutate; FE re-lists after
 *   laravel_api.remove {url}   -> mutate; FE re-lists after
 *   laravel_api.select {url}   -> mutate; FE re-lists + refreshes backend_status
 *   laravel_api.probe {url?}   -> health result(s); FE re-lists after
 *
 * Mutate/probe response shapes are deliberately loose (the FE always re-calls
 * `list` afterwards rather than trusting partial echoes), so contract drift on
 * those replies can never break the UI.
 */
import { requestPycoreHttp } from './PycoreHttp';
import { PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';

/** One Laravel API endpoint as known to the pycore backend. */
export interface LaravelApiEndpoint {
  url: string;
  /** true = last probe OK, false = last probe failed, null = never probed. */
  healthy: boolean | null;
  /** Probe latency in ms; null/undefined when never probed or unhealthy. */
  latency_ms?: number | null;
  /** Epoch milliseconds or backend-formatted time; null when never probed. */
  last_checked?: number | string | null;
  /** Last HTTP status; null when the request did not return a response. */
  status?: number | null;
  /** Last probe error; null after a successful probe. */
  error?: string | null;
  /** Optional backend hint: user-added (removable) vs built-in. */
  custom?: boolean;
}

export interface LaravelApiListResponse {
  success?: boolean;
  endpoints: LaravelApiEndpoint[];
  /** URL of the endpoint the sync engine currently targets. */
  current: string | null;
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

export interface LaravelApiListOptions {
  probe?: boolean;
  frontendEndpoints?: readonly string[];
}

/**
 * Window event fired after a successful `laravel_api.select`, so sibling
 * widgets (e.g. PcLaravelMediaPanel's `video_extract.backend_status` view)
 * re-fetch against the newly targeted backend.
 */
export const pycoreLaravelApi = {
  /** List known Laravel endpoints + which one is current. Instant (last-known
   *  health rows); pass probe:false for a pure cached read that does not kick
   *  the server-side background sweep. */
  list: (opts?: LaravelApiListOptions): Promise<LaravelApiListResponse> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelApiList, {
      probe: opts?.probe ?? true,
      ...(opts?.frontendEndpoints
        ? { frontend_endpoints: Array.from(opts.frontendEndpoints) }
        : {}),
    }),

  /** Add a custom Laravel base URL. */
  add: (url: string): Promise<LaravelApiMutateResponse> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelApiAdd, { url }),

  /** Remove a (custom) Laravel base URL. */
  remove: (url: string): Promise<LaravelApiMutateResponse> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelApiRemove, { url }),

  /** Switch the sync engine's target to `url`. */
  select: (url: string): Promise<LaravelApiMutateResponse> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelApiSelect, { url }),

  /** Re-probe one endpoint (`url`) or all endpoints (no arg). */
  probe: (url?: string): Promise<LaravelApiMutateResponse> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.laravelApiProbe, url ? { url } : {}),
};

export type PycoreLaravelApi = typeof pycoreLaravelApi;
