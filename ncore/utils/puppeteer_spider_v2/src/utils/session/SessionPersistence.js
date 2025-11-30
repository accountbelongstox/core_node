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

/**
 * Session Persistence - Manages browser session data
 *
 * Handles saving and loading of:
 * - Cookies
 * - LocalStorage
 * - SessionStorage
 * - Last opened page
 * - Window state
 */

const fs = require('fs');
const path = require('path');

const logger = require('#@logger');
const systemPaths = require('#@ncore/foundation/common/system_paths.js');

class SessionPersistence {
    constructor(profileName = 'default') {
        this.profileName = profileName;
        this.sessionDir = systemPaths.getBrowserSessionDir(profileName);
        this.userDataDir = systemPaths.getBrowserUserDataDir(profileName);
        this.cookiesPath = systemPaths.getBrowserCookiesPath(profileName);
        this.localStoragePath = systemPaths.getBrowserLocalStoragePath(profileName);
        this.sessionStatePath = systemPaths.getBrowserSessionStatePath(profileName);

        this.autoSaveInterval = null;
        this.autoSaveIntervalMs = 5000;
        this.page = null;
        this.browser = null;
    }

    /**
     * Get user data directory for Puppeteer
     * @returns {string}
     */
    getUserDataDir() {
        return this.userDataDir;
    }

    /**
     * Set page and browser references
     * @param {Object} page - Puppeteer page
     * @param {Object} browser - Puppeteer browser
     */
    setPageAndBrowser(page, browser) {
        this.page = page;
        this.browser = browser;
    }

    /**
     * Save cookies from page
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<boolean>}
     */
    async saveCookies(page = null) {
        const targetPage = page || this.page;
        if (!targetPage) {
            logger.warn('[SessionPersistence] No page available to save cookies');
            return false;
        }

        try {
            const cookies = await targetPage.cookies();

            fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2), 'utf8');
            logger.info(`[SessionPersistence] Saved ${cookies.length} cookies`);

            return true;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to save cookies:', error.message);
            return false;
        }
    }

    /**
     * Load cookies to page
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<boolean>}
     */
    async loadCookies(page = null) {
        const targetPage = page || this.page;
        if (!targetPage) {
            logger.warn('[SessionPersistence] No page available to load cookies');
            return false;
        }

        if (!fs.existsSync(this.cookiesPath)) {
            logger.info('[SessionPersistence] No saved cookies found');
            return false;
        }

        try {
            const cookiesData = fs.readFileSync(this.cookiesPath, 'utf8');
            const cookies = JSON.parse(cookiesData);

            if (cookies.length > 0) {
                await targetPage.setCookie(...cookies);
                logger.info(`[SessionPersistence] Loaded ${cookies.length} cookies`);
            }

            return true;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to load cookies:', error.message);
            return false;
        }
    }

    /**
     * Save localStorage from page
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<boolean>}
     */
    async saveLocalStorage(page = null) {
        const targetPage = page || this.page;
        if (!targetPage) {
            logger.warn('[SessionPersistence] No page available to save localStorage');
            return false;
        }

        try {
            const localStorage = await targetPage.evaluate(() => {
                const items = {};
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    items[key] = window.localStorage.getItem(key);
                }
                return items;
            });

            fs.writeFileSync(this.localStoragePath, JSON.stringify(localStorage, null, 2), 'utf8');
            logger.info(`[SessionPersistence] Saved localStorage (${Object.keys(localStorage).length} items)`);

            return true;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to save localStorage:', error.message);
            return false;
        }
    }

    /**
     * Load localStorage to page
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<boolean>}
     */
    async loadLocalStorage(page = null) {
        const targetPage = page || this.page;
        if (!targetPage) {
            logger.warn('[SessionPersistence] No page available to load localStorage');
            return false;
        }

        if (!fs.existsSync(this.localStoragePath)) {
            logger.info('[SessionPersistence] No saved localStorage found');
            return false;
        }

        try {
            const localStorageData = fs.readFileSync(this.localStoragePath, 'utf8');
            const localStorage = JSON.parse(localStorageData);

            await targetPage.evaluate((items) => {
                for (const [key, value] of Object.entries(items)) {
                    window.localStorage.setItem(key, value);
                }
            }, localStorage);

            logger.info(`[SessionPersistence] Loaded localStorage (${Object.keys(localStorage).length} items)`);

            return true;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to load localStorage:', error.message);
            return false;
        }
    }

    /**
     * Save session state (last page, window state, etc.)
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<boolean>}
     */
    async saveSessionState(page = null) {
        const targetPage = page || this.page;
        if (!targetPage) {
            logger.warn('[SessionPersistence] No page available to save session state');
            return false;
        }

        try {
            const url = targetPage.url();
            const title = await targetPage.title();

            const state = {
                lastUrl: url,
                lastTitle: title,
                timestamp: Date.now(),
                profileName: this.profileName
            };

            fs.writeFileSync(this.sessionStatePath, JSON.stringify(state, null, 2), 'utf8');
            logger.info(`[SessionPersistence] Saved session state: ${url}`);

            return true;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to save session state:', error.message);
            return false;
        }
    }

    /**
     * Load session state
     * @returns {Object|null}
     */
    loadSessionState() {
        if (!fs.existsSync(this.sessionStatePath)) {
            logger.info('[SessionPersistence] No saved session state found');
            return null;
        }

        try {
            const stateData = fs.readFileSync(this.sessionStatePath, 'utf8');
            const state = JSON.parse(stateData);

            logger.info(`[SessionPersistence] Loaded session state: ${state.lastUrl}`);

            return state;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to load session state:', error.message);
            return null;
        }
    }

    /**
     * Save all session data
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<boolean>}
     */
    async saveAll(page = null) {
        const targetPage = page || this.page;

        await this.saveCookies(targetPage);
        await this.saveLocalStorage(targetPage);
        await this.saveSessionState(targetPage);

        return true;
    }

    /**
     * Load all session data
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @returns {Promise<Object>}
     */
    async loadAll(page = null) {
        const targetPage = page || this.page;

        await this.loadCookies(targetPage);
        await this.loadLocalStorage(targetPage);
        const state = this.loadSessionState();

        return state;
    }

    /**
     * Start auto-save interval
     * @param {Object} page - Puppeteer page (optional, uses stored page)
     * @param {number} intervalMs - Interval in milliseconds
     */
    startAutoSave(page = null, intervalMs = null) {
        if (page) {
            this.page = page;
        }

        if (intervalMs) {
            this.autoSaveIntervalMs = intervalMs;
        }

        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        this.autoSaveInterval = setInterval(async () => {
            await this.saveAll();
        }, this.autoSaveIntervalMs);

        logger.info(`[SessionPersistence] Auto-save started (every ${this.autoSaveIntervalMs / 1000}s)`);
    }

    /**
     * Stop auto-save interval
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            logger.info('[SessionPersistence] Auto-save stopped');
        }
    }

    /**
     * Get last URL from session state
     * @returns {string|null}
     */
    getLastUrl() {
        const state = this.loadSessionState();
        return state ? state.lastUrl : null;
    }

    /**
     * Clear all session data
     * @returns {boolean}
     */
    clearAll() {
        try {
            if (fs.existsSync(this.cookiesPath)) {
                fs.unlinkSync(this.cookiesPath);
            }

            if (fs.existsSync(this.localStoragePath)) {
                fs.unlinkSync(this.localStoragePath);
            }

            if (fs.existsSync(this.sessionStatePath)) {
                fs.unlinkSync(this.sessionStatePath);
            }

            logger.info('[SessionPersistence] Cleared all session data');
            return true;
        } catch (error) {
            logger.error('[SessionPersistence] Failed to clear session data:', error.message);
            return false;
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopAutoSave();
        this.page = null;
        this.browser = null;
    }
}

module.exports = SessionPersistence;
