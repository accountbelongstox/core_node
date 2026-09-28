import { EXTENSION_ID } from '../scripts/constant';

const serviceContract = require('../../../../../../config/service_contract');
const clientKeyErrorCodes: string[] = serviceContract.value('client_key_auth.error_codes');
const CHROME_EXTENSION_SCHEME = 'chrome-extension://';
const CHROME_EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/[a-p]{32}\/?$/;

function launchingExtensionOrigins(): string[] {
  return process.argv
    .slice(2)
    .filter((arg) => CHROME_EXTENSION_ORIGIN_PATTERN.test(arg))
    .map((arg) => arg.replace(/\/$/, ''));
}

export const NATIVE_SERVER_PORT = serviceContract.port('mcp_chrome');

// Timeout constants (in milliseconds)
export const TIMEOUTS = {
  DEFAULT_REQUEST_TIMEOUT: 15000,
  EXTENSION_REQUEST_TIMEOUT: 20000,
  PROCESS_DATA_TIMEOUT: 20000,
} as const;

// Server configuration
export const SERVER_CONFIG = {
  HOST: serviceContract.host('loopback'),
  LOGGER_ENABLED: false,
} as const;

// Local RPC guard (K7, ncore local_rpc_guard): browser callers only from the extension.
export const LOCAL_RPC_GUARD_OPTIONS = {
  allowedOrigins: [
    ...new Set([`${CHROME_EXTENSION_SCHEME}${EXTENSION_ID}`, ...launchingExtensionOrigins()]),
  ],
  allowLoopbackOrigins: false,
};

// Shared ncore modules (paths from the repository root).
export const NCORE_MODULES = {
  CLIENT_KEY_AUTH: 'ncore/foundation/common/client_key_auth.js',
  LOCAL_RPC_GUARD: 'ncore/foundation/common/local_rpc_guard.js',
  // stdout is the native-messaging channel; this ncore logger switch sends its logs to stderr.
  STDIO_LOG_ENV: 'MCP_MODE',
  STDIO_LOG_MODE: 'mcp',
} as const;

// Client-key signing (K6): the host signs for the extension; the key never leaves this process.
export const CLIENT_KEY_SIGNING = {
  CLIENT: 'mcp_chrome',
  PROTOCOL_INVALID_CODE: clientKeyErrorCodes.find((code) => code.endsWith('_protocol_invalid')) as string,
} as const;

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  SERVICE_UNAVAILABLE: 503,
  // 404 is the MCP Streamable HTTP signal for an unknown/expired session: a
  // spec-compliant client re-initializes when it sees it (a 400 is NOT treated
  // as recoverable). Keep them distinct — see the /mcp handlers.
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NATIVE_HOST_NOT_AVAILABLE: 'Native host connection not established.',
  SERVER_NOT_RUNNING: 'Server is not actively running.',
  REQUEST_TIMEOUT: 'Request to extension timed out.',
  EXTENSION_NOT_CONNECTED: 'Browser extension is not connected.',
  INVALID_MCP_REQUEST: 'Invalid MCP request or session.',
  // Returned (HTTP 404) when a request carries a session id the server no longer
  // knows — the client should re-initialize a fresh session.
  SESSION_NOT_FOUND: 'Session not found; reinitialize with an initialize request.',
  INVALID_SESSION_ID: 'Invalid or missing MCP session ID.',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  MCP_SESSION_DELETION_ERROR: 'Internal server error during MCP session deletion.',
  MCP_REQUEST_PROCESSING_ERROR: 'Internal server error during MCP request processing.',
  INVALID_SSE_SESSION: 'Invalid or missing MCP session ID for SSE.',
} as const;
