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
const { v4: uuidv4 } = require('uuid');

class Session {
    constructor(id, config = {}) {
        this.id = id;
        this.config = config;
        this.browser = null;
        this.pages = new Map();
        this.activePage = null;
        this.isInitialized = false;
        this.createdAt = new Date().toISOString();
        this.lastActivity = new Date().toISOString();
        this.plugins = new Map();
        this.metrics = {
            pagesCreated: 0,
            pagesClosed: 0,
            requests: 0,
            errors: 0
        };
    }

    async initialize() {
        try {
            logger.info(`Initializing session: ${this.id}`);
            
            const BrowserFactory = require('../factories/BrowserFactory');
            this.browser = await BrowserFactory.create(this.config.browser || 'edge', this.config);
            
            await this.browser.launch(this.config.browserOptions || {});
            this.isInitialized = true;
            this.lastActivity = new Date().toISOString();
            
            logger.info(`Session initialized: ${this.id}`);
            return this;
        } catch (error) {
            logger.error(`Failed to initialize session ${this.id}:`, error);
            throw error;
        }
    }

    async newPage(options = {}) {
        try {
            // Check for blank page to reuse first
            const pages = await this.browser.getPages();
            let blankPageIndex = -1;
            
            for (let i = 0; i < pages.length; i++) {
                try {
                    const pageUrl = await pages[i].mainFrame().url();
                    const blankUrls = ['about:blank', 'chrome://newtab/', 'edge://newtab/', 'chrome://new-tab-page/', 'edge://new-tab-page/', 'about:newtab'];
                    if (blankUrls.includes(pageUrl) || pageUrl === '') {
                        blankPageIndex = i;
                        break;
                    }
                } catch (error) {
                    // Page might be closed or not ready
                    continue;
                }
            }
            
            let wrappedPage;
            if (blankPageIndex !== -1) {
                // Reuse blank page
                wrappedPage = pages[blankPageIndex];
                logger.info(`✅ Reusing blank page at index ${blankPageIndex} in session ${this.id}`);
            } else {
                // Create new page
                wrappedPage = await this.browser.newPage(options);
                logger.info(`❌ No blank page found, created new page in session ${this.id}`);
            }
            
            const pageId = uuidv4();
            this.pages.set(pageId, wrappedPage);
            this.activePage = wrappedPage;
            this.metrics.pagesCreated++;
            this.lastActivity = new Date().toISOString();
            
            logger.info(`Page created in session ${this.id}: ${pageId}`);
            return wrappedPage;
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to create page in session ${this.id}:`, error);
            throw error;
        }
    }

    async closePage(pageId) {
        try {
            const page = this.pages.get(pageId);
            if (page) {
                await page.close();
                this.pages.delete(pageId);
                this.metrics.pagesClosed++;
                this.lastActivity = new Date().toISOString();
                
                if (this.activePage === page) {
                    this.activePage = this.pages.size > 0 ? Array.from(this.pages.values())[0] : null;
                }
                
                logger.info(`Page closed in session ${this.id}: ${pageId}`);
            }
        } catch (error) {
            this.metrics.errors++;
            logger.error(`Failed to close page ${pageId} in session ${this.id}:`, error);
            throw error;
        }
    }

    getPage(pageId = null) {
        if (pageId) {
            return this.pages.get(pageId);
        }
        return this.activePage;
    }

    getAllPages() {
        return Array.from(this.pages.values());
    }

    async loadPlugin(plugin) {
        try {
            await plugin.initialize(this);
            this.plugins.set(plugin.name, plugin);
            logger.info(`Plugin ${plugin.name} loaded in session ${this.id}`);
        } catch (error) {
            logger.error(`Failed to load plugin ${plugin.name} in session ${this.id}:`, error);
            throw error;
        }
    }

    async unloadPlugin(pluginName) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                await plugin.cleanup();
                this.plugins.delete(pluginName);
                logger.info(`Plugin ${pluginName} unloaded from session ${this.id}`);
            }
        } catch (error) {
            logger.error(`Failed to unload plugin ${pluginName} from session ${this.id}:`, error);
            throw error;
        }
    }

    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }

    async close() {
        try {
            logger.info(`Closing session: ${this.id}`);
            
            // Close all pages
            for (const [pageId, page] of this.pages) {
                try {
                    await page.close();
                } catch (error) {
                    logger.warn(`Failed to close page ${pageId}:`, error);
                }
            }
            
            // Cleanup plugins
            for (const [pluginName, plugin] of this.plugins) {
                try {
                    await plugin.cleanup();
                } catch (error) {
                    logger.warn(`Failed to cleanup plugin ${pluginName}:`, error);
                }
            }
            
            // Close browser
            if (this.browser) {
                await this.browser.close();
            }
            
            this.isInitialized = false;
            logger.info(`Session closed: ${this.id}`);
        } catch (error) {
            logger.error(`Failed to close session ${this.id}:`, error);
            throw error;
        }
    }

    getBrowser() {
        return this.browser;
    }

    getInfo() {
        return {
            id: this.id,
            isInitialized: this.isInitialized,
            createdAt: this.createdAt,
            lastActivity: this.lastActivity,
            config: this.config,
            pages: this.pages.size,
            activePage: this.activePage ? 'active' : 'none',
            plugins: Array.from(this.plugins.keys()),
            metrics: this.metrics
        };
    }
}

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionCounter = 0;
        this.maxSessions = 10;
    }

    async create(config = {}) {
        if (this.sessions.size >= this.maxSessions) {
            throw new Error(`Maximum number of sessions (${this.maxSessions}) reached`);
        }

        const sessionId = this.generateSessionId();
        const session = new Session(sessionId, config);
        
        await session.initialize();
        this.sessions.set(sessionId, session);
        
        return session;
    }

    get(sessionId) {
        return this.sessions.get(sessionId);
    }

    getAll() {
        return Array.from(this.sessions.values());
    }

    async close(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            await session.close();
            this.sessions.delete(sessionId);
            return session;
        }
        return null;
    }

    async closeAll() {
        const closePromises = Array.from(this.sessions.keys()).map(sessionId => 
            this.close(sessionId).catch(error => 
                logger.error(`Failed to close session ${sessionId}:`, error)
            )
        );
        
        await Promise.all(closePromises);
        logger.info('All sessions closed');
    }

    generateSessionId() {
        return `session_${++this.sessionCounter}_${Date.now()}`;
    }

    getInfo() {
        return {
            totalSessions: this.sessions.size,
            maxSessions: this.maxSessions,
            sessionIds: Array.from(this.sessions.keys())
        };
    }
}

module.exports = SessionManager;
