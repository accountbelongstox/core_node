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

const { v4: uuidv4 } = require('uuid');
const logger = require('#@logger');
const { WS_RPC_CONSTANTS } = require('#@global_vars');

const MSG_TYPES = WS_RPC_CONSTANTS.MESSAGE_TYPES;
const ERROR_CODES = WS_RPC_CONSTANTS.ERROR_CODES;

class HttpRpcClient {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.basePath = options.basePath || '/rpc';
        this.timeout = options.timeout || 30000;
        this.sessionId = options.sessionId || uuidv4();
        this.headers = options.headers || {};
        this.retryCount = options.retryCount || 0;
        this.retryDelay = options.retryDelay || 1000;
    }

    async call(route, params = {}) {
        const requestId = uuidv4();
        const message = {
            type: MSG_TYPES.REQUEST,
            id: requestId,
            route,
            params,
            timestamp: Date.now()
        };

        let lastError = null;
        let attempt = 0;
        const maxAttempts = this.retryCount + 1;

        while (attempt < maxAttempts) {
            try {
                const response = await this._makeRequest(message);
                return response;
            } catch (error) {
                lastError = error;
                attempt++;

                if (attempt < maxAttempts) {
                    logger.warn(`HTTP RPC call failed (attempt ${attempt}/${maxAttempts}), retrying...`);
                    await this._delay(this.retryDelay * attempt);
                }
            }
        }

        throw lastError;
    }

    async _makeRequest(message) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.baseUrl}${this.basePath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId,
                    ...this.headers
                },
                body: JSON.stringify(message),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded');
                }
                if (response.status === 401) {
                    throw new Error('Authentication required');
                }
                if (response.status === 404) {
                    throw new Error(`Route not found: ${message.route}`);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.type === MSG_TYPES.ERROR) {
                throw new Error(data.error || 'Unknown error');
            }

            if (data.type === MSG_TYPES.RESPONSE) {
                if (data.success) {
                    return data.result;
                } else {
                    throw new Error(data.error || 'Request failed');
                }
            }

            throw new Error('Invalid response format');

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }

            throw error;
        }
    }

    async batch(calls) {
        const promises = calls.map(({ route, params }) => this.call(route, params));
        return Promise.all(promises);
    }

    async batchSettled(calls) {
        const promises = calls.map(({ route, params }) =>
            this.call(route, params)
                .then(result => ({ status: 'fulfilled', value: result }))
                .catch(error => ({ status: 'rejected', reason: error.message }))
        );
        return Promise.all(promises);
    }

    setHeader(key, value) {
        this.headers[key] = value;
        return this;
    }

    removeHeader(key) {
        delete this.headers[key];
        return this;
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
        return this;
    }

    setTimeout(timeout) {
        this.timeout = timeout;
        return this;
    }

    setRetry(count, delay = 1000) {
        this.retryCount = count;
        this.retryDelay = delay;
        return this;
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}${this.basePath}/health`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                return { status: 'error', code: response.status };
            }

            const data = await response.json();
            return data;
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = HttpRpcClient;
