const { v4: uuidv4 } = require('uuid');
const logger = require('#@logger');

class RequestManager {
    constructor() {
        this.requests = new Map();
        this.callbacks = new Map();
    }

    createRequest(sessionId, metadata = {}) {
        const requestId = uuidv4();

        this.requests.set(requestId, {
            id: requestId,
            sessionId,
            createdAt: Date.now(),
            status: 'pending',
            retries: 0,
            maxRetries: 3,
            retryInterval: 1000,
            metadata
        });

        return requestId;
    }

    getRequest(requestId) {
        return this.requests.get(requestId);
    }

    hasRequest(requestId) {
        return this.requests.has(requestId);
    }

    updateRequestStatus(requestId, status) {
        const request = this.requests.get(requestId);
        if (request) {
            request.status = status;
            request.updatedAt = Date.now();
        }
    }

    incrementRetry(requestId) {
        const request = this.requests.get(requestId);
        if (request) {
            request.retries++;
            return request.retries;
        }
        return 0;
    }

    canRetry(requestId) {
        const request = this.requests.get(requestId);
        if (request) {
            return request.retries < request.maxRetries;
        }
        return false;
    }

    registerCallback(requestId, callback, context = null) {
        if (typeof callback !== 'function') {
            logger.error('RequestManager: Callback must be a function');
            return false;
        }

        this.callbacks.set(requestId, {
            callback,
            context,
            createdAt: Date.now()
        });

        return true;
    }

    async executeCallback(requestId, data, error = null) {
        const callbackInfo = this.callbacks.get(requestId);

        if (!callbackInfo) {
            logger.warn(`RequestManager: No callback found for request ${requestId}`);
            return false;
        }

        try {
            if (callbackInfo.context) {
                await callbackInfo.callback.call(callbackInfo.context, data, error);
            } else {
                await callbackInfo.callback(data, error);
            }

            this.updateRequestStatus(requestId, 'completed');
            this.callbacks.delete(requestId);

            return true;
        } catch (e) {
            logger.error(`RequestManager: Callback execution error for ${requestId}:`, e);
            return false;
        }
    }

    removeRequest(requestId) {
        this.requests.delete(requestId);
        this.callbacks.delete(requestId);
    }

    getRequestsBySession(sessionId) {
        const requests = [];
        for (const [requestId, request] of this.requests.entries()) {
            if (request.sessionId === sessionId) {
                requests.push(requestId);
            }
        }
        return requests;
    }

    removeRequestsBySession(sessionId) {
        const requests = this.getRequestsBySession(sessionId);
        requests.forEach(requestId => {
            this.removeRequest(requestId);
        });
        return requests.length;
    }

    cleanup(maxAge = 1800000) {
        const now = Date.now();
        let cleaned = 0;

        for (const [requestId, request] of this.requests.entries()) {
            if (now - request.createdAt > maxAge) {
                this.removeRequest(requestId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`RequestManager: Cleaned ${cleaned} expired requests`);
        }

        return cleaned;
    }

    getStats() {
        const stats = {
            total: this.requests.size,
            pending: 0,
            completed: 0,
            failed: 0,
            callbacks: this.callbacks.size
        };

        for (const request of this.requests.values()) {
            if (request.status === 'pending') stats.pending++;
            else if (request.status === 'completed') stats.completed++;
            else if (request.status === 'failed') stats.failed++;
        }

        return stats;
    }
}

const defaultRequestManager = new RequestManager();

module.exports = {
    RequestManager,
    defaultRequestManager
};
