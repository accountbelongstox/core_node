const UnifiedRpcClient = require('./UnifiedRpcClient');

function createClient(baseUrl, options = {}) {
    return new UnifiedRpcClient(baseUrl, options);
}

module.exports = {
    UnifiedRpcClient,
    createClient
};
