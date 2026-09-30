/** Canonical Pycore HTTP, Server-Sent Events and WebSocket constants. */
import { PYCORE_BACKEND_PORT } from '../../contracts/ServiceContract';

const PYCORE_HTTP_API_PREFIX = '/api';
const PYCORE_HTTP_CLIENT_ID_PATH = `${PYCORE_HTTP_API_PREFIX}/client-id`;
const PYCORE_HTTP_EVENTS_PATH = `${PYCORE_HTTP_API_PREFIX}/events`;
const PYCORE_HTTP_WS_PATH = `${PYCORE_HTTP_API_PREFIX}/ws`;

export { PYCORE_BACKEND_PORT };
export const PYCORE_HTTP_JSON_CONTENT_TYPE = 'application/json';
export const PYCORE_HTTP_TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

export const PYCORE_HTTP_PATHS = {
  apiPrefix: PYCORE_HTTP_API_PREFIX,
  clientId: PYCORE_HTTP_CLIENT_ID_PATH,
  status: `${PYCORE_HTTP_API_PREFIX}/status`,
  info: `${PYCORE_HTTP_API_PREFIX}/info`,
  routes: `${PYCORE_HTTP_API_PREFIX}/routes`,
  events: PYCORE_HTTP_EVENTS_PATH,
  ws: PYCORE_HTTP_WS_PATH,
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
  maxBackoffExponent: 10,
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
} as const;

export const PYCORE_SSE_EVENTS = {
  state: 'sse.state',
  event: 'sse.event',
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
  /** Failed opens while HTTP stays reachable before SSE takes over. */
  sseFallbackAfterFailures: 3,
  /** While on SSE fallback, try the socket again after this long (also on a server restart). */
  socketRetryAfterFallbackMs: 300_000,
  /** Coalesces topic subscription changes into one subscribe frame. */
  subscribeDebounceMs: 100,
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
