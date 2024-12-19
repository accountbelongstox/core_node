const path = require('path');

const apiConfig = {
    hostname: 'api.deepbricks.ai',
    basePath: '/v1',
    completionsPath: '/chat/completions',
    modelsPath: '/models',
    defaultModel: 'gpt-4o-2024-08-06',
    timeout: 300000, // 30 seconds

    getFullPath(endpoint) {
        return `${this.basePath}${endpoint}`;
    }
};

module.exports = apiConfig; 