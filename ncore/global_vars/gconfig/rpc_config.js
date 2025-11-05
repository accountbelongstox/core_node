const RPC_CONSTANTS = require('./rpc_constants.js');

const DEFAULT_RPC_CONFIG = {
    HTTP_PORT: RPC_CONSTANTS.DEFAULTS.SERVER_PORT || 8080,
    HTTP_HOST: RPC_CONSTANTS.DEFAULTS.SERVER_HOST || '0.0.0.0',
    WS_PORT: RPC_CONSTANTS.DEFAULTS.SERVER_PORT || 8080,
    WS_HOST: RPC_CONSTANTS.DEFAULTS.SERVER_HOST || '0.0.0.0',

    USE_SAME_PORT: true,

    SSL_ENABLED: false,
    SSL_KEY_PATH: null,
    SSL_CERT_PATH: null,

    REQUEST_TIMEOUT: RPC_CONSTANTS.DEFAULTS.REQUEST_TIMEOUT || 30000,
    MAX_PAYLOAD_SIZE: RPC_CONSTANTS.DEFAULTS.MAX_PAYLOAD_SIZE || 10485760,

    RECONNECT_INTERVAL: RPC_CONSTANTS.DEFAULTS.RECONNECT_INTERVAL || 3000,
    MAX_RECONNECT_ATTEMPTS: RPC_CONSTANTS.DEFAULTS.MAX_RECONNECT_ATTEMPTS || 10,

    HEARTBEAT_INTERVAL: RPC_CONSTANTS.DEFAULTS.HEARTBEAT_INTERVAL || 30000,
    HEARTBEAT_TIMEOUT: RPC_CONSTANTS.DEFAULTS.HEARTBEAT_TIMEOUT || 5000,

    COMPRESSION_ENABLED: false,
    COMPRESSION_THRESHOLD: RPC_CONSTANTS.DEFAULTS.COMPRESSION_THRESHOLD || 1024,

    AUTH_ENABLED: false,
    AUTH_SECRET: null,
    AUTH_TOKEN_EXPIRY: 86400000,

    auth: {
        enabled: false
    },

    RATE_LIMIT_ENABLED: false,
    RATE_LIMIT_MAX_REQUESTS: 100,
    RATE_LIMIT_WINDOW_MS: 60000,

    PERFORMANCE_MONITORING: true,
    PERFORMANCE_SAMPLE_RATE: 1.0,
    PERFORMANCE_MAX_HISTORY: 1000,

    STATIC_PATHS: null,

    CACHE_ENABLED: true,
    CACHE_TTL: 3600000,
    CACHE_MAX_SIZE: 1000
};

let currentConfig = { ...DEFAULT_RPC_CONFIG };

function getRpcConfig() {
    return { ...currentConfig };
}

function updateRpcConfig(config) {
    if (config && typeof config === 'object') {
        currentConfig = { ...currentConfig, ...config };

        if (currentConfig.USE_SAME_PORT && currentConfig.HTTP_PORT !== currentConfig.WS_PORT) {
            currentConfig.WS_PORT = currentConfig.HTTP_PORT;
        }
    }
    return currentConfig;
}

function resetRpcConfig() {
    currentConfig = { ...DEFAULT_RPC_CONFIG };
    return currentConfig;
}

function getRpcPort() {
    return currentConfig.USE_SAME_PORT
        ? currentConfig.HTTP_PORT
        : { http: currentConfig.HTTP_PORT, ws: currentConfig.WS_PORT };
}

function getRpcHost() {
    return currentConfig.USE_SAME_PORT
        ? currentConfig.HTTP_HOST
        : { http: currentConfig.HTTP_HOST, ws: currentConfig.WS_HOST };
}

module.exports = {
    DEFAULT_RPC_CONFIG,
    getRpcConfig,
    updateRpcConfig,
    resetRpcConfig,
    getRpcPort,
    getRpcHost
};
