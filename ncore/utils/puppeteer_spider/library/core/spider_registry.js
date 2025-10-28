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

// Declare variables
let sessionCounter = 0;

class SpiderRegistry {
    constructor() {
        this.sessions = new Map();
        this.defaultSessionId = null;
        this.sessionCounter = 0;
        this.isInitialized = false;
    }

    register(sessionId, spider) {
        try {
            if (!sessionId || !spider) {
                throw new Error('Session ID and spider instance are required');
            }
            
            if (this.sessions.has(sessionId)) {
                throw new Error(`Session ${sessionId} already exists`);
            }
            
            this.sessions.set(sessionId, {
                id: sessionId,
                spider: spider,
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                isActive: true
            });
            
            if (!this.defaultSessionId) {
                this.defaultSessionId = sessionId;
            }
            
            this.sessionCounter++;
            logger.info(`Spider session registered: ${sessionId}`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to register session ${sessionId}: ${error.message}`);
            throw error;
        }
    }

    unregister(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }
            
            this.sessions.delete(sessionId);
            
            if (this.defaultSessionId === sessionId) {
                const remainingSessions = Array.from(this.sessions.keys());
                this.defaultSessionId = remainingSessions.length > 0 ? remainingSessions[0] : null;
            }
            
            logger.info(`Spider session unregistered: ${sessionId}`);
            
            return true;
        } catch (error) {
            logger.error(`Failed to unregister session ${sessionId}: ${error.message}`);
            throw error;
        }
    }

    get(sessionId = null) {
        try {
            const id = sessionId || this.defaultSessionId;
            if (!id) {
                throw new Error('No spider sessions available. Create a session first.');
            }
            
            const session = this.sessions.get(id);
            if (!session) {
                throw new Error(`Spider session ${id} not found`);
            }
            
            // Update last accessed time
            session.lastAccessed = new Date().toISOString();
            
            return session.spider;
        } catch (error) {
            logger.error(`Failed to get session ${sessionId}: ${error.message}`);
            throw error;
        }
    }

    getAll() {
        return Array.from(this.sessions.values()).map(session => session.spider);
    }

    getSessionIds() {
        return Array.from(this.sessions.keys());
    }

    getSessionInfo(sessionId = null) {
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            return session ? {
                id: session.id,
                createdAt: session.createdAt,
                lastAccessed: session.lastAccessed,
                isActive: session.isActive,
                spiderInfo: session.spider.getSessionInfo()
            } : null;
        }
        
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            createdAt: session.createdAt,
            lastAccessed: session.lastAccessed,
            isActive: session.isActive,
            spiderInfo: session.spider.getSessionInfo()
        }));
    }

    getDefaultSession() {
        return this.get();
    }

    setDefaultSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        this.defaultSessionId = sessionId;
        logger.info(`Default session set to: ${sessionId}`);
        
        return true;
    }

    async closeSession(sessionId) {
        try {
            const spider = this.get(sessionId);
            if (spider) {
                await spider.close();
                this.unregister(sessionId);
                logger.info(`Session closed: ${sessionId}`);
            }
            
            return true;
        } catch (error) {
            logger.error(`Failed to close session ${sessionId}: ${error.message}`);
            throw error;
        }
    }

    async closeAll() {
        try {
            logger.info('Closing all spider sessions');
            
            const sessions = Array.from(this.sessions.keys());
            const closePromises = sessions.map(sessionId => 
                this.closeSession(sessionId).catch(error => 
                    logger.error(`Failed to close session ${sessionId}: ${error.message}`)
                )
            );
            
            await Promise.all(closePromises);
            
            this.sessions.clear();
            this.defaultSessionId = null;
            this.sessionCounter = 0;
            
            logger.info('All spider sessions closed');
            
            return true;
        } catch (error) {
            logger.error(`Failed to close all sessions: ${error.message}`);
            throw error;
        }
    }

    getStats() {
        return {
            totalSessions: this.sessions.size,
            defaultSessionId: this.defaultSessionId,
            sessionCounter: this.sessionCounter,
            sessions: this.getSessionInfo()
        };
    }

    cleanup() {
        try {
            logger.info('Cleaning up SpiderRegistry');
            
            this.sessions.clear();
            this.defaultSessionId = null;
            this.sessionCounter = 0;
            this.isInitialized = false;
            
            logger.info('SpiderRegistry cleaned up');
            
            return true;
        } catch (error) {
            logger.error(`Failed to cleanup SpiderRegistry: ${error.message}`);
            throw error;
        }
    }
}

module.exports = SpiderRegistry;
