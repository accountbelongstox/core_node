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

class PerformanceMonitor {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.sampleRate = options.sampleRate || 1.0;
        this.maxHistorySize = options.maxHistorySize || 1000;

        this.requests = new Map();
        this.routes = new Map();
        this.clients = new Map();
        this.history = [];
        this.startTime = Date.now();
    }

    startRequest(requestId, routeName, clientId) {
        if (!this.enabled || Math.random() > this.sampleRate) {
            return;
        }

        this.requests.set(requestId, {
            routeName,
            clientId,
            startTime: Date.now(),
            startMemory: process.memoryUsage().heapUsed
        });
    }

    endRequest(requestId, success = true, error = null) {
        if (!this.enabled) {
            return;
        }

        const requestData = this.requests.get(requestId);
        if (!requestData) {
            return;
        }

        const endTime = Date.now();
        const duration = endTime - requestData.startTime;
        const memoryUsed = process.memoryUsage().heapUsed - requestData.startMemory;

        const record = {
            requestId,
            routeName: requestData.routeName,
            clientId: requestData.clientId,
            duration,
            memoryUsed,
            success,
            error: error ? error.message : null,
            timestamp: endTime
        };

        this._recordRoute(requestData.routeName, duration, success);
        this._recordClient(requestData.clientId, duration, success);
        this._addToHistory(record);

        this.requests.delete(requestId);
    }

    getRouteStats(routeName) {
        return this.routes.get(routeName) || {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalDuration: 0,
            avgDuration: 0,
            minDuration: 0,
            maxDuration: 0
        };
    }

    getClientStats(clientId) {
        return this.clients.get(clientId) || {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalDuration: 0,
            avgDuration: 0
        };
    }

    getGlobalStats() {
        let totalRequests = 0;
        let successfulRequests = 0;
        let failedRequests = 0;
        let totalDuration = 0;

        for (const stats of this.routes.values()) {
            totalRequests += stats.totalRequests;
            successfulRequests += stats.successfulRequests;
            failedRequests += stats.failedRequests;
            totalDuration += stats.totalDuration;
        }

        const uptime = Date.now() - this.startTime;
        const requestsPerSecond = totalRequests / (uptime / 1000);

        return {
            uptime,
            totalRequests,
            successfulRequests,
            failedRequests,
            successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
            avgDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
            requestsPerSecond,
            activeRequests: this.requests.size,
            uniqueClients: this.clients.size,
            uniqueRoutes: this.routes.size
        };
    }

    getHistory(limit = 100) {
        return this.history.slice(-limit);
    }

    getSlowestRequests(limit = 10) {
        return [...this.history]
            .sort((a, b) => b.duration - a.duration)
            .slice(0, limit);
    }

    getRecentFailures(limit = 10) {
        return this.history
            .filter(r => !r.success)
            .slice(-limit);
    }

    reset() {
        this.requests.clear();
        this.routes.clear();
        this.clients.clear();
        this.history = [];
        this.startTime = Date.now();
        logger.debug('Performance monitor reset');
    }

    _recordRoute(routeName, duration, success) {
        let stats = this.routes.get(routeName);

        if (!stats) {
            stats = {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalDuration: 0,
                avgDuration: 0,
                minDuration: Infinity,
                maxDuration: 0
            };
            this.routes.set(routeName, stats);
        }

        stats.totalRequests++;
        if (success) {
            stats.successfulRequests++;
        } else {
            stats.failedRequests++;
        }

        stats.totalDuration += duration;
        stats.avgDuration = stats.totalDuration / stats.totalRequests;
        stats.minDuration = Math.min(stats.minDuration, duration);
        stats.maxDuration = Math.max(stats.maxDuration, duration);
    }

    _recordClient(clientId, duration, success) {
        let stats = this.clients.get(clientId);

        if (!stats) {
            stats = {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                totalDuration: 0,
                avgDuration: 0
            };
            this.clients.set(clientId, stats);
        }

        stats.totalRequests++;
        if (success) {
            stats.successfulRequests++;
        } else {
            stats.failedRequests++;
        }

        stats.totalDuration += duration;
        stats.avgDuration = stats.totalDuration / stats.totalRequests;
    }

    _addToHistory(record) {
        this.history.push(record);

        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }
}

module.exports = PerformanceMonitor;
