const WsRpcClient = require('./WsRpcClient');
const http = require('http');
const https = require('https');
const logger = require('#@logger');

class WsRpcClientExtended extends WsRpcClient {
    constructor(url, options = {}) {
        super(url, options);

        this.httpUrl = options.httpUrl || this._deriveHttpUrl(url);
        this.enableHttp = options.enableHttp !== false;
        this.preferWebSocket = options.preferWebSocket !== false;
        this.httpPollingInterval = options.httpPollingInterval || 1000;
        this.httpMaxPollingAttempts = options.httpMaxPollingAttempts || 60;

        this.storage = options.storage || null;
        this.enablePersistence = options.enablePersistence !== false && this.storage;

        this.pendingHttpRequests = new Map();
        this.pollingTimers = new Map();

        if (this.enablePersistence) {
            this._loadPersistedRequests();
        }
    }

    async connect() {
        try {
            await super.connect();
        } catch (error) {
            logger.warn(`WebSocket connection failed: ${error.message}`);

            if (this.enableHttp && !this.preferWebSocket) {
                logger.info('Falling back to HTTP mode');
                this.connected = false;
            } else {
                throw error;
            }
        }
    }

    async call(routeName, params = null, options = {}) {
        const requestId = options.requestId || this._generateRequestId();

        if (this.enablePersistence) {
            this._persistRequest(requestId, { route: routeName, params, timestamp: Date.now() });
        }

        if (this.connected && this.preferWebSocket) {
            try {
                const result = await super.call(routeName, params);
                if (this.enablePersistence) {
                    this._removePersistedRequest(requestId);
                }
                return result;
            } catch (error) {
                logger.warn(`WebSocket call failed: ${error.message}, trying HTTP...`);

                if (this.enableHttp) {
                    return await this._callViaHttp(requestId, routeName, params, options);
                }

                throw error;
            }
        } else if (this.enableHttp) {
            return await this._callViaHttp(requestId, routeName, params, options);
        } else {
            throw new Error('Not connected and HTTP is disabled');
        }
    }

    async _callViaHttp(requestId, routeName, params, options = {}) {
        const usePolling = options.polling !== false;

        const requestData = {
            requestId,
            route: routeName,
            params,
            clientId: this.clientId
        };

        if (options.delay) {
            requestData.delay = options.delay;
        }

        try {
            const response = await this._httpRequest(
                `${this.httpUrl}/api/request`,
                'POST',
                requestData
            );

            if (response.status === 'completed') {
                if (this.enablePersistence) {
                    this._removePersistedRequest(requestId);
                }
                return response.result;
            } else if (response.status === 'scheduled' || response.status === 'pending') {
                if (usePolling) {
                    return await this._pollForResult(requestId);
                } else {
                    return { requestId, status: response.status };
                }
            } else {
                throw new Error(response.error || 'Unknown error');
            }
        } catch (error) {
            logger.error(`HTTP call error: ${error.message}`);
            throw error;
        }
    }

    async _pollForResult(requestId, attempt = 0) {
        if (attempt >= this.httpMaxPollingAttempts) {
            throw new Error(`Polling timeout for request ${requestId}`);
        }

        try {
            const response = await this._httpRequest(
                `${this.httpUrl}/api/result?requestId=${requestId}`,
                'GET'
            );

            if (response.success) {
                if (this.enablePersistence) {
                    this._removePersistedRequest(requestId);
                }

                this._stopPolling(requestId);
                return response.result;
            } else if (response.status === 'pending') {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(async () => {
                        try {
                            const result = await this._pollForResult(requestId, attempt + 1);
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    }, this.httpPollingInterval);

                    this.pollingTimers.set(requestId, timer);
                });
            } else {
                throw new Error(response.error || 'Result not available');
            }
        } catch (error) {
            logger.error(`Polling error: ${error.message}`);
            throw error;
        }
    }

    async getResult(requestId) {
        if (this.enableHttp) {
            try {
                const response = await this._httpRequest(
                    `${this.httpUrl}/api/result?requestId=${requestId}`,
                    'GET'
                );

                if (response.success) {
                    return response.result;
                } else {
                    return null;
                }
            } catch (error) {
                logger.error(`Get result error: ${error.message}`);
                return null;
            }
        }

        return null;
    }

    async getStatus(requestId) {
        if (this.enableHttp) {
            try {
                const response = await this._httpRequest(
                    `${this.httpUrl}/api/status?requestId=${requestId}`,
                    'GET'
                );

                return response;
            } catch (error) {
                logger.error(`Get status error: ${error.message}`);
                return null;
            }
        }

        return null;
    }

    _stopPolling(requestId) {
        const timer = this.pollingTimers.get(requestId);
        if (timer) {
            clearTimeout(timer);
            this.pollingTimers.delete(requestId);
        }
    }

    async _httpRequest(url, method, data = null) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const isHttps = parsedUrl.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = httpModule.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk.toString();
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    _persistRequest(requestId, data) {
        if (!this.storage) return;

        try {
            const key = this._getStorageKey('request', requestId);
            const value = JSON.stringify({
                ...data,
                persistedAt: Date.now()
            });
            this.storage.setItem(key, value);
        } catch (error) {
            logger.error(`Failed to persist request: ${error.message}`);
        }
    }

    _removePersistedRequest(requestId) {
        if (!this.storage) return;

        try {
            const key = this._getStorageKey('request', requestId);
            this.storage.removeItem(key);
        } catch (error) {
            logger.error(`Failed to remove persisted request: ${error.message}`);
        }
    }

    _loadPersistedRequests() {
        if (!this.storage) return;

        try {
            const prefix = this._getStorageKey('request', '');
            const keys = [];

            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key && key.startsWith(prefix)) {
                    keys.push(key);
                }
            }

            logger.info(`Found ${keys.length} persisted requests`);

            for (const key of keys) {
                const value = this.storage.getItem(key);
                if (value) {
                    try {
                        const data = JSON.parse(value);
                        logger.debug(`Loaded persisted request: ${key}`, data);
                    } catch (error) {
                        logger.error(`Failed to parse persisted request: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`Failed to load persisted requests: ${error.message}`);
        }
    }

    getPersistedRequests() {
        if (!this.storage) return [];

        const requests = [];
        const prefix = this._getStorageKey('request', '');

        try {
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key && key.startsWith(prefix)) {
                    const value = this.storage.getItem(key);
                    if (value) {
                        const data = JSON.parse(value);
                        const requestId = key.substring(prefix.length);
                        requests.push({ requestId, ...data });
                    }
                }
            }
        } catch (error) {
            logger.error(`Failed to get persisted requests: ${error.message}`);
        }

        return requests;
    }

    clearPersistedRequests() {
        if (!this.storage) return;

        const prefix = this._getStorageKey('request', '');
        const keys = [];

        try {
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key && key.startsWith(prefix)) {
                    keys.push(key);
                }
            }

            for (const key of keys) {
                this.storage.removeItem(key);
            }

            logger.info(`Cleared ${keys.length} persisted requests`);
        } catch (error) {
            logger.error(`Failed to clear persisted requests: ${error.message}`);
        }
    }

    _getStorageKey(type, id) {
        return `wsrpc_${type}_${id}`;
    }

    _deriveHttpUrl(wsUrl) {
        const url = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
        const match = url.match(/^(https?:\/\/[^:]+):(\d+)/);

        if (match) {
            const baseUrl = match[1];
            const port = parseInt(match[2]) + 1;
            return `${baseUrl}:${port}`;
        }

        return url;
    }

    _generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async disconnect() {
        this.pollingTimers.forEach(timer => clearTimeout(timer));
        this.pollingTimers.clear();

        await super.disconnect();
    }
}

module.exports = WsRpcClientExtended;
