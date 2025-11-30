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

const logger = require('#@logger');

class RateLimiter {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.maxRequests = options.maxRequests || 100;
        this.windowMs = options.windowMs || 60000;
        this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
        this.skipFailedRequests = options.skipFailedRequests || false;
        this.onLimitReached = options.onLimitReached || null;

        this.clients = new Map();
        this.cleanupInterval = setInterval(() => this._cleanup(), this.windowMs);
    }

    check(clientId) {
        if (!this.enabled) {
            return { allowed: true, remaining: this.maxRequests };
        }

        const now = Date.now();
        let clientData = this.clients.get(clientId);

        if (!clientData) {
            clientData = {
                count: 0,
                resetTime: now + this.windowMs,
                blocked: false
            };
            this.clients.set(clientId, clientData);
        }

        if (now >= clientData.resetTime) {
            clientData.count = 0;
            clientData.resetTime = now + this.windowMs;
            clientData.blocked = false;
        }

        if (clientData.count >= this.maxRequests) {
            if (!clientData.blocked) {
                clientData.blocked = true;
                logger.warn(`Rate limit exceeded for client ${clientId}`);
                if (this.onLimitReached) {
                    this.onLimitReached(clientId);
                }
            }

            return {
                allowed: false,
                remaining: 0,
                resetTime: clientData.resetTime,
                retryAfter: clientData.resetTime - now
            };
        }

        clientData.count++;

        return {
            allowed: true,
            remaining: this.maxRequests - clientData.count,
            resetTime: clientData.resetTime
        };
    }

    recordSuccess(clientId) {
        if (!this.skipSuccessfulRequests) {
            return;
        }

        const clientData = this.clients.get(clientId);
        if (clientData && clientData.count > 0) {
            clientData.count--;
        }
    }

    recordFailure(clientId) {
        if (!this.skipFailedRequests) {
            return;
        }

        const clientData = this.clients.get(clientId);
        if (clientData && clientData.count > 0) {
            clientData.count--;
        }
    }

    reset(clientId) {
        this.clients.delete(clientId);
        logger.debug(`Rate limit reset for client ${clientId}`);
    }

    resetAll() {
        this.clients.clear();
        logger.debug('All rate limits reset');
    }

    getStats(clientId) {
        const clientData = this.clients.get(clientId);
        if (!clientData) {
            return {
                count: 0,
                remaining: this.maxRequests,
                resetTime: Date.now() + this.windowMs,
                blocked: false
            };
        }

        return {
            count: clientData.count,
            remaining: Math.max(0, this.maxRequests - clientData.count),
            resetTime: clientData.resetTime,
            blocked: clientData.blocked
        };
    }

    _cleanup() {
        const now = Date.now();
        for (const [clientId, data] of this.clients.entries()) {
            if (now >= data.resetTime + this.windowMs) {
                this.clients.delete(clientId);
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clients.clear();
    }
}

module.exports = RateLimiter;
