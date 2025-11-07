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

'use strict';

const logger = require('#@logger');
const { EventEmitter } = require('events');

/**
 * Session Manager for MCP Server
 * Manages multiple AI sessions with timeout and cleanup support
 *
 * @class SessionManager
 * @extends EventEmitter
 */
class SessionManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.sessions = new Map();
        this.timeout = options.timeout || 3600000;
        this.maxSessions = options.maxSessions || 100;
        this.cleanupInterval = options.cleanupInterval || 300000;
        this.cleanupTimer = null;
        this.sessionLock = new Map();
    }

    /**
     * Start automatic cleanup of expired sessions
     */
    startCleanup() {
        if (this.cleanupTimer) {
            logger.debug('Session cleanup already running');
            return;
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupInterval);

        logger.info(`Session cleanup started (interval: ${this.cleanupInterval}ms)`);
    }

    /**
     * Stop automatic cleanup
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            logger.info('Session cleanup stopped');
        }
    }

    /**
     * Create a new session
     * @param {string} sessionId - Unique session identifier
     * @param {Object} metadata - Session metadata
     * @returns {Object} Created session object
     */
    createSession(sessionId, metadata = {}) {
        if (this.sessions.size >= this.maxSessions) {
            const error = new Error(`Maximum number of sessions reached (${this.maxSessions})`);
            logger.error(error.message);
            throw error;
        }

        if (this.sessions.has(sessionId)) {
            logger.warn(`Session ${sessionId} already exists, updating...`);
            return this.updateSession(sessionId, metadata);
        }

        const session = {
            id: sessionId,
            metadata: metadata || {},
            createdAt: Date.now(),
            lastActivity: Date.now(),
            state: {},
            requestCount: 0
        };

        this.sessions.set(sessionId, session);
        this.emit('session:created', session);

        logger.info(`Session created: ${sessionId} (total: ${this.sessions.size})`);
        return session;
    }

    /**
     * Get a session by ID
     * @param {string} sessionId - Session identifier
     * @returns {Object|null} Session object or null if not found
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (session) {
            session.lastActivity = Date.now();
            session.requestCount++;
        }

        return session || null;
    }

    /**
     * Update session state
     * @param {string} sessionId - Session identifier
     * @param {Object} state - State to merge into session
     * @returns {Object} Updated session object
     */
    updateSession(sessionId, state) {
        const session = this.sessions.get(sessionId);

        if (!session) {
            logger.warn(`Session ${sessionId} not found, creating new session`);
            return this.createSession(sessionId, state);
        }

        session.state = { ...session.state, ...state };
        session.lastActivity = Date.now();

        this.emit('session:updated', session);

        logger.debug(`Session updated: ${sessionId}`);
        return session;
    }

    /**
     * Destroy a session
     * @param {string} sessionId - Session identifier
     */
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (session) {
            this.sessions.delete(sessionId);
            this.sessionLock.delete(sessionId);
            this.emit('session:destroyed', session);

            logger.info(`Session destroyed: ${sessionId} (total: ${this.sessions.size})`);
        } else {
            logger.debug(`Session ${sessionId} not found for destruction`);
        }
    }

    /**
     * Cleanup expired sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;
        const expiredSessions = [];

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.timeout) {
                expiredSessions.push(sessionId);
            }
        }

        for (const sessionId of expiredSessions) {
            this.destroySession(sessionId);
            cleanedCount++;
        }

        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} expired sessions`);
            this.emit('sessions:cleanup', { cleanedCount, remaining: this.sessions.size });
        }
    }

    /**
     * Get all active sessions
     * @returns {Array} Array of session objects
     */
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * Get session count
     * @returns {number} Number of active sessions
     */
    getSessionCount() {
        return this.sessions.size;
    }

    /**
     * Check if session exists
     * @param {string} sessionId - Session identifier
     * @returns {boolean} True if session exists
     */
    hasSession(sessionId) {
        return this.sessions.has(sessionId);
    }

    /**
     * Clear all sessions
     */
    clearAllSessions() {
        const count = this.sessions.size;

        for (const sessionId of this.sessions.keys()) {
            this.destroySession(sessionId);
        }

        logger.info(`Cleared all ${count} sessions`);
        this.emit('sessions:cleared', { clearedCount: count });
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getStats() {
        const sessions = this.getActiveSessions();
        const now = Date.now();

        return {
            totalSessions: this.sessions.size,
            maxSessions: this.maxSessions,
            timeout: this.timeout,
            sessions: sessions.map(s => ({
                id: s.id,
                createdAt: s.createdAt,
                lastActivity: s.lastActivity,
                age: now - s.createdAt,
                idleTime: now - s.lastActivity,
                requestCount: s.requestCount,
                metadata: s.metadata
            }))
        };
    }

    /**
     * Get sessions by metadata filter
     * @param {Function} filterFn - Filter function (session) => boolean
     * @returns {Array} Filtered sessions
     */
    filterSessions(filterFn) {
        return this.getActiveSessions().filter(filterFn);
    }
}

module.exports = SessionManager;
