const { v4: uuidv4 } = require('uuid');
const logger = require('#@logger');

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const DEFAULT_MAX_AGE_MS = 1800000;
const DEFAULT_CLEANUP_INTERVAL_MS = 60000;
const DEFAULT_MAX_SESSIONS = 10000;

function normalizeClientId(clientId) {
    return typeof clientId === 'string' && CLIENT_ID_PATTERN.test(clientId) ? clientId : null;
}

class SessionManager {
    constructor(options = {}) {
        this.sessions = new Map();
        this.groups = new Map();
        this.maxAge = options.maxAge || DEFAULT_MAX_AGE_MS;
        this.cleanupInterval = options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL_MS;
        this.maxSessions = options.maxSessions || DEFAULT_MAX_SESSIONS;
        this.cleanupTimer = null;

        this.startAutoCleanup();
    }

    startAutoCleanup() {
        this.stopAutoCleanup();
        this.cleanupTimer = setInterval(() => this.cleanup(this.maxAge), this.cleanupInterval);
        this.cleanupTimer.unref();
        return this;
    }

    stopAutoCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        return this;
    }

    evictOldest() {
        let oldestId = null;
        let oldestActivity = Infinity;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.lastActivity < oldestActivity) {
                oldestActivity = session.lastActivity;
                oldestId = sessionId;
            }
        }

        if (oldestId !== null) {
            this.removeSession(oldestId);
        }
    }

    createSession(clientId = null) {
        const sessionId = normalizeClientId(clientId) || uuidv4();

        if (!this.sessions.has(sessionId) && this.sessions.size >= this.maxSessions) {
            this.evictOldest();
        }

        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                id: sessionId,
                createdAt: Date.now(),
                lastActivity: Date.now(),
                requests: new Map(),
                metadata: {}
            });
        }

        return sessionId;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    hasSession(sessionId) {
        return this.sessions.has(sessionId);
    }

    updateActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = Date.now();
        }
    }

    removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.requests.clear();
        }
        this.sessions.delete(sessionId);

        this.groups.forEach((group, groupId) => {
            group.delete(sessionId);
            if (group.size === 0) {
                this.groups.delete(groupId);
            }
        });
    }

    addToGroup(groupId, sessionId) {
        if (!this.groups.has(groupId)) {
            this.groups.set(groupId, new Set());
        }
        this.groups.get(groupId).add(sessionId);
    }

    getGroup(groupId) {
        return this.groups.get(groupId);
    }

    removeFromGroup(groupId, sessionId) {
        const group = this.groups.get(groupId);
        if (group) {
            group.delete(sessionId);
            if (group.size === 0) {
                this.groups.delete(groupId);
            }
        }
    }

    addRequest(sessionId, requestId, callback) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.requests.set(requestId, {
                id: requestId,
                callback,
                createdAt: Date.now(),
                retries: 0
            });
        }
    }

    getRequest(sessionId, requestId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            return session.requests.get(requestId);
        }
        return null;
    }

    removeRequest(sessionId, requestId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.requests.delete(requestId);
        }
    }

    getAllSessions() {
        return Array.from(this.sessions.keys());
    }

    getSessionCount() {
        return this.sessions.size;
    }

    cleanup(maxAge = this.maxAge) {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > maxAge) {
                this.removeSession(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`SessionManager: Cleaned ${cleaned} expired sessions`);
        }

        return cleaned;
    }

    setMetadata(sessionId, key, value) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.metadata[key] = value;
        }
    }

    getMetadata(sessionId, key) {
        const session = this.sessions.get(sessionId);
        if (session) {
            return session.metadata[key];
        }
        return null;
    }
}

const defaultSessionManager = new SessionManager();

module.exports = {
    SessionManager,
    defaultSessionManager,
    normalizeClientId
};
