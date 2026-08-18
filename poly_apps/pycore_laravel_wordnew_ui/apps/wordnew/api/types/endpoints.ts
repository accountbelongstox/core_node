/** types/endpoints.ts - backend endpoint management types. (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
/**
 * The KIND of an endpoint — also its persisted "selection type". The settings
 * store a TYPE (the endpoint id), and the concrete endpoint is resolved from it
 * at runtime, so e.g. 'current-url' always re-resolves to the live page origin
 * rather than freezing a host that may later change.
 *   - 'current-url' : the page's own origin, host from window.location, port 9000.
 *   - 'default'     : a built-in named endpoint (remote-primary / loopback / mesh).
 *   - 'custom'      : a user-added endpoint.
 */
export type WfNewEndpointKind = 'current-url' | 'default' | 'custom';

/**
 * One configurable backend endpoint. `url` is the host only (no protocol/port);
 * the full base is `${protocol}://${url}:${port}`. All wordnew defaults use
 * port 9000 (the laravel_main / AppQyV1 Octane backend).
 */
export interface WfNewEndpoint {
  /** Unique id; doubles as the persisted selection TYPE token. */
  id: string;
  /** Selection kind (current-url resolves dynamically; see WfNewEndpointKind). */
  kind: WfNewEndpointKind;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  /** Lower = preferred (current-url is tried/selected first when healthy). */
  priority: number;
  isLocal: boolean;
  description: string;
  /** True for user-added endpoints (removable in Settings). */
  custom?: boolean;
}

/** Result of probing one endpoint's `/api/health`. */
export interface WfNewEndpointHealth {
  id: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

/**
 * Immutable snapshot of the endpoint manager's state, consumed reactively via
 * `useSyncExternalStore` (the project's store pattern — see core/logstore,
 * core/notify). A new object is produced on every change; the reference is
 * stable between changes so React can bail out of re-renders.
 */
export interface WfNewEndpointSnapshot {
  endpoints: WfNewEndpoint[];
  health: Record<string, WfNewEndpointHealth>;
  currentId: string | null;
  /** At least one endpoint answered healthy in the last pass. */
  healthy: boolean;
  /** First detection pass has completed. */
  ready: boolean;
  /** A manual "Test & select" pass is in flight. */
  testing: boolean;
}

// ---- The API contract -----------------------------------------------------
