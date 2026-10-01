/** Canonical Pycore HTTP and WebSocket constants. */
import rpcContract from '../../../../../config/pycore_rpc_contract.json';
import { PYCORE_BACKEND_PORT } from '../../contracts/ServiceContract';
import relayContract from '../../../../../config/pycore_relay_contract.json';

const PYCORE_HTTP_API_PREFIX = rpcContract.api_prefix;
const protocolPath = (route: { path: string }): string => `${PYCORE_HTTP_API_PREFIX}/${route.path}`;

export { PYCORE_BACKEND_PORT };
export const PYCORE_HTTP_JSON_CONTENT_TYPE = 'application/json';
export const PYCORE_HTTP_TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

export const PYCORE_HTTP_PATHS = {
  apiPrefix: PYCORE_HTTP_API_PREFIX,
  clientId: protocolPath(rpcContract.protocol_routes.clientId),
  status: protocolPath(rpcContract.protocol_routes.status),
  info: protocolPath(rpcContract.protocol_routes.info),
  routes: protocolPath(rpcContract.protocol_routes.routes),
  ws: protocolPath(rpcContract.protocol_routes.ws),
} as const;

export const PYCORE_HTTP_HEADER_NAMES = {
  accept: 'Accept',
  contentType: 'Content-Type',
  requestId: 'X-Request-ID',
  clientId: 'X-Pycore-Client-ID',
  browserId: 'X-Pycore-Browser-ID',
} as const;

export const PYCORE_HTTP_DEFAULTS = {
  reconnectMinMs: 1_000,
  reconnectMaxMs: 30_000,
  fallbackPollMs: 30_000,
  slowFallbackPollMs: 60_000,
  capabilityPollMs: 20_000,
  engineLoadPollMs: 1_500,
  maxProcessedEvents: 512,
} as const;

export const PYCORE_HEALTH_DEFAULTS = {
  healthCheckInterval: 60_000,
  pingTimeoutMs: 3_000,
  failuresBeforeDown: 2,
  probeRetryMs: 750,
} as const;

export const PYCORE_HEALTH_EVENT = 'pycore-health-changed';

export const PYCORE_BROWSER_EVENTS = {
  capabilityChanged: 'pycore-capability-changed',
  engineLoadChanged: 'pycore-engine-load-changed',
  httpEventReplayLost: 'http_event_replay_lost',
  httpEventServerRestarted: 'http_event_server_restarted',
  /** The relay dropped events between the device and this client: reconcile like after a reconnect. */
  relayEventsDropped: relayContract.client_events.relay_events_dropped.type,
} as const;

/** Frame ops of the pycore event socket (pycore network_constants WS_OP_*). */
export const PYCORE_WS_OPS = {
  hello: 'hello',
  subscribe: 'subscribe',
  lease: 'lease',
  ping: 'ping',
  pong: 'pong',
  state: 'state',
  events: 'events',
  error: 'error',
} as const;

export const PYCORE_WS_DEFAULTS = {
  /** Coalesces topic subscription changes into one subscribe frame. */
  subscribeDebounceMs: 100,
} as const;

/** Cross-tab leader election (Web Locks) and the BroadcastChannel carrying the leader's pushes. */
export const PYCORE_EVENT_LOCK_PREFIX = 'pycore-events:';

export const PYCORE_PEER_DEFAULTS = {
  /** Cadence at which a follower tab re-announces its topics to the leader. */
  wantsRefreshMs: 15_000,
  /** The leader drops a follower that stayed silent this long. */
  wantsExpireMs: 45_000,
} as const;

/** UI presence leases (pycore owners check these names via ui_presence). */
export const PYCORE_PRESENCE_LEASES = {
  agentHistoryLiveMonitor: 'agent_history.live_monitor',
} as const;

export type PycorePresenceLease = typeof PYCORE_PRESENCE_LEASES[keyof typeof PYCORE_PRESENCE_LEASES];

export const PYCORE_PRESENCE_DEFAULTS = {
  /** HTTP renewal cadence when no event socket carries the lease (pycore UI_PRESENCE_RENEW_SECONDS). */
  renewMs: 5_000,
} as const;
