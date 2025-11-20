const { getRpcConfig, updateRpcConfig, resetRpcConfig, getRpcPort, getRpcHost } = require('#@global_vars/gconfig/rpc_config');
const { RPC_CONSTANTS } = require('#@global_vars');

function getConfig() {
    return getRpcConfig();
}

function setConfig(config) {
    return updateRpcConfig(config);
}

function reset() {
    return resetRpcConfig();
}

function getPort() {
    return getRpcPort();
}

function getHost() {
    return getRpcHost();
}

function getConstants() {
    return RPC_CONSTANTS;
}

function getMsgTypes() {
    return RPC_CONSTANTS.MESSAGE_TYPES;
}

function getErrorCodes() {
    return RPC_CONSTANTS.ERROR_CODES;
}

function getEvents() {
    return RPC_CONSTANTS.EVENTS;
}

function getDefaults() {
    return RPC_CONSTANTS.DEFAULTS;
}

module.exports = {
    getConfig,
    setConfig,
    reset,
    getPort,
    getHost,
    getConstants,
    getMsgTypes,
    getErrorCodes,
    getEvents,
    getDefaults,
    RPC_CONSTANTS
};
