/** Canonical Pycore HTTP and Server-Sent Events constants. */
const PYCORE_HTTP_API_PREFIX = '/api';
const PYCORE_HTTP_EVENTS_PATH = `${PYCORE_HTTP_API_PREFIX}/events`;

export const PYCORE_HTTP_PORT = 59000;
export const PYCORE_HTTP_JSON_CONTENT_TYPE = 'application/json';

export const PYCORE_HTTP_PATHS = {
  apiPrefix: PYCORE_HTTP_API_PREFIX,
  status: `${PYCORE_HTTP_API_PREFIX}/status`,
  info: `${PYCORE_HTTP_API_PREFIX}/info`,
  routes: `${PYCORE_HTTP_API_PREFIX}/routes`,
  events: PYCORE_HTTP_EVENTS_PATH,
  eventsAck: `${PYCORE_HTTP_EVENTS_PATH}/ack`,
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
  laravelApiChanged: 'pycore:laravel-api-changed',
} as const;

export const PYCORE_SSE_EVENTS = {
  state: 'sse.state',
  event: 'sse.event',
} as const;
