// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const WS_RPC_CONSTANTS = {
    MESSAGE_TYPES: {
        REQUEST: 'request',
        RESPONSE: 'response',
        EVENT: 'event',
        WELCOME: 'welcome',
        ERROR: 'error',
        PING: 'ping',
        PONG: 'pong',
        AUTH: 'auth',
        AUTH_RESPONSE: 'auth_response',
        SUBSCRIBE: 'subscribe',
        UNSUBSCRIBE: 'unsubscribe',
        BROADCAST: 'broadcast',
        CANCEL: 'cancel'
    },

    DEFAULTS: {
        SERVER_PORT: 8080,
        SERVER_HOST: '0.0.0.0',
        REQUEST_TIMEOUT: 30000,
        RECONNECT_INTERVAL: 3000,
        MAX_RECONNECT_ATTEMPTS: 10,
        HEARTBEAT_INTERVAL: 30000,
        HEARTBEAT_TIMEOUT: 5000,
        MAX_PAYLOAD_SIZE: 10485760,
        COMPRESSION_THRESHOLD: 1024,
        MAX_LISTENERS: 100
    },

    CONNECTION: {
        STATE_CONNECTING: 0,
        STATE_OPEN: 1,
        STATE_CLOSING: 2,
        STATE_CLOSED: 3
    },

    ERROR_CODES: {
        ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
        TIMEOUT: 'TIMEOUT',
        UNAUTHORIZED: 'UNAUTHORIZED',
        FORBIDDEN: 'FORBIDDEN',
        PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        INVALID_MESSAGE: 'INVALID_MESSAGE',
        CONNECTION_LOST: 'CONNECTION_LOST',
        CANCELLED: 'CANCELLED'
    },

    EVENTS: {
        CONNECTION: 'connection',
        DISCONNECT: 'disconnect',
        ERROR: 'error',
        RECONNECT: 'reconnect',
        RECONNECT_FAILED: 'reconnect_failed',
        AUTHENTICATED: 'authenticated',
        UNAUTHORIZED: 'unauthorized',
        MESSAGE: 'message'
    }
};

module.exports = WS_RPC_CONSTANTS;
