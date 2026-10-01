import type { ServiceLinkState } from '../../../../core/network/ServiceLink';

/** types/endpoints.ts - backend endpoint management types. (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
/**
 * The KIND of an endpoint (its id is the persisted selection):
 *   - 'domain'  : the Laravel API of a root domain (api.<region>.<domain>).
 *   - 'tailnet' : a tailnet machine's /laravel-api mount (static in a build, live in dev).
 *   - 'custom'  : a user-added endpoint.
 */
export type WfNewEndpointKind = 'domain' | 'tailnet' | 'custom';

/**
 * One configurable backend endpoint. `url` is the host only (no protocol/port);
 * the full base is `${protocol}://${url}:${port}`. All wordnew defaults use
 * port 9000 (the laravel_main / AppQyV1 Octane backend).
 */
export interface WfNewEndpoint {
  /** Unique id; doubles as the persisted selection TYPE token. */
  id: string;
  /** Endpoint kind (see WfNewEndpointKind). */
  kind: WfNewEndpointKind;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  /** Path the API is mounted under (tailnet machines: /laravel-api). */
  basePath?: string;
  /** Lower = preferred for the first-run selection. */
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
  /** The selected endpoint answered its last probe. */
  healthy: boolean;
  /** Connection to the selected endpoint (requests wait while it reconnects). */
  link: ServiceLinkState;
  /** First detection pass has completed. */
  ready: boolean;
  /** A manual detection pass is in flight. */
  testing: boolean;
}

// ---- The API contract -----------------------------------------------------
