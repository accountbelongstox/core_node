const WsRpcServer = require('./WsRpcServer');
const WsRpcClient = require('./WsRpcClient');
const WsRpcServerExtended = require('./WsRpcServerExtended');
const WsRpcClientExtended = require('./WsRpcClientExtended');
const WsRpcBrowserClient = require('./WsRpcBrowserClient');
const ResultCache = require('./ResultCache');

const MSG_TYPES = {
    REQUEST: 'request',
    RESPONSE: 'response',
    EVENT: 'event',
    ERROR: 'error',
    PING: 'ping',
    PONG: 'pong',
    WELCOME: 'welcome',
    AUTH: 'auth',
    AUTH_RESPONSE: 'auth_response'
};

const ERROR_CODES = {
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    TIMEOUT: 'TIMEOUT',
    INVALID_PARAMS: 'INVALID_PARAMS'
};

module.exports = {
    WsRpcServer,
    WsRpcClient,
    WsRpcServerExtended,
    WsRpcClientExtended,
    WsRpcBrowserClient,
    ResultCache,
    MSG_TYPES,
    ERROR_CODES
};
