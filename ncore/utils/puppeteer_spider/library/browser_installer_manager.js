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

class BrowserInstallerManager {
    constructor() {
        this.installers = new Map();
        this.initializeInstallers();
    }
    
    // Initialize available installers
    initializeInstallers() {
        try {
            // Edge installer
            const EdgeInstaller = require('./browsers/edge/installer');
            this.installers.set('edge', new EdgeInstaller());
            
            // Chrome installer
            const ChromeInstaller = require('./browsers/chrome/installer');
            this.installers.set('chrome', new ChromeInstaller());
            
            logger.info('Browser installers initialized');
        } catch (error) {
            logger.error('Failed to initialize browser installers:', error.message);
        }
    }
    
    // Install browser by type
    async installBrowser(browserType, options = {}) {
        const installer = this.installers.get(browserType);
        if (!installer) {
            throw new Error(`No installer available for browser type: ${browserType}`);
        }
        
        try {
            logger.info(`Installing ${browserType} browser...`);
            await installer.install(options);
            logger.info(`${browserType} browser installed successfully`);
            return true;
        } catch (error) {
            logger.error(`Failed to install ${browserType} browser:`, error.message);
            throw error;
        }
    }
    
    // Check if browser is installed
    async isBrowserInstalled(browserType) {
        const installer = this.installers.get(browserType);
        if (!installer) {
            return false;
        }
        
        try {
            return await installer.isInstalled();
        } catch (error) {
            logger.debug(`Failed to check ${browserType} installation:`, error.message);
            return false;
        }
    }
    
    // Get browser executable path
    async getBrowserPath(browserType) {
        const installer = this.installers.get(browserType);
        if (!installer) {
            return null;
        }
        
        try {
            return await installer.getBrowserPath();
        } catch (error) {
            logger.debug(`Failed to get ${browserType} path:`, error.message);
            return null;
        }
    }
    
    // Get browser version
    async getBrowserVersion(browserType) {
        const installer = this.installers.get(browserType);
        if (!installer) {
            return null;
        }
        
        try {
            return await installer.getBrowserVersion();
        } catch (error) {
            logger.debug(`Failed to get ${browserType} version:`, error.message);
            return null;
        }
    }
    
    // Install browser with fallback
    async installBrowserWithFallback(preferredBrowserType = 'edge', options = {}) {
        const fallbackOrder = preferredBrowserType === 'edge' ? 
            ['edge', 'chrome'] : ['chrome', 'edge'];
        
        for (const browserType of fallbackOrder) {
            try {
                const isInstalled = await this.isBrowserInstalled(browserType);
                if (isInstalled) {
                    logger.info(`${browserType} browser is already installed`);
                    return { success: true, browserType, installed: false };
                }
                
                await this.installBrowser(browserType, options);
                return { success: true, browserType, installed: true };
            } catch (error) {
                logger.warn(`Failed to install ${browserType}:`, error.message);
                continue;
            }
        }
        
        throw new Error('Failed to install any supported browser');
    }
    
    // Get available browser types
    getAvailableBrowserTypes() {
        return Array.from(this.installers.keys());
    }
    
    // Get installer info
    getInstallerInfo(browserType) {
        const installer = this.installers.get(browserType);
        if (!installer) {
            return null;
        }
        
        return {
            type: browserType,
            available: true,
            methods: installer.getAvailableMethods ? installer.getAvailableMethods() : []
        };
    }
}

module.exports = BrowserInstallerManager;
