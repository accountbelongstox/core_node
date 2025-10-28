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

const path = require('path');
const UserAgent = require('user-agents');
const logger = require('#@logger');
const EdgeConfig = require('./edge_config');
const ChromeConfig = require('./chrome_config');

// Declare variables
const DEFAULT_BROWSER_TYPE = 'edge';
const browserConfigs = {
    edge: new EdgeConfig(),
    chrome: new ChromeConfig()
};

class ConfigManager {
    constructor(browserType = DEFAULT_BROWSER_TYPE) {
        this.browserType = browserType;
        this.browserConfig = browserConfigs[browserType];
        this.config = this.browserConfig.getConfig();
        this.userAgent = null;
        this.screenInfo = null;
    }
    
    // Get current configuration
    getConfig() {
        return { ...this.config };
    }
    
    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
    
    // Reset to default
    resetToDefault() {
        this.config = this.browserConfig.resetToDefault();
        return this.config;
    }
    
    // Switch browser type
    switchBrowserType(browserType) {
        if (browserConfigs[browserType]) {
            this.browserType = browserType;
            this.browserConfig = browserConfigs[browserType];
            this.config = this.browserConfig.getConfig();
            logger.info(`Switched to ${browserType} configuration`);
            return this.config;
        } else {
            throw new Error(`Unsupported browser type: ${browserType}`);
        }
    }
    
    // Get browser-specific configuration
    getBrowserConfig() {
        return this.browserConfig;
    }
    
    // Initialize configuration with system detection
    async initialize() {
        try {
            // Set user agent
            this.config.userAgent = await this.generateUserAgent();
            
            // Set screen resolution
            await this.detectScreenResolution();
            
            // Set executable path if not provided
            if (!this.config.executablePath) {
                await this.detectBrowserPath();
            }
            
            logger.info(`Configuration initialized for ${this.browserType}`);
            return this.config;
        } catch (error) {
            logger.error('Failed to initialize configuration:', error.message);
            throw error;
        }
    }
    
    // Generate user agent
    async generateUserAgent() {
        if (!this.config.random_user_agent) {
            return this.browserConfig.getUserAgent(this.config.mobile);
        }
        
        try {
            const userAgent = new UserAgent({ 
                deviceCategory: this.config.mobile ? 'mobile' : 'desktop' 
            });
            return userAgent.random().toString();
        } catch (error) {
            logger.warn('Failed to generate random user agent, using browser default');
            return this.browserConfig.getUserAgent(this.config.mobile);
        }
    }
    
    // Detect screen resolution
    async detectScreenResolution() {
        try {
            const { getScreenInfo } = require('#@ncore/global_vars/libs/system_info.js');
            const screenInfo = await getScreenInfo();
            const { resolutionX, resolutionY } = screenInfo[0];
            
            let width = Math.floor(resolutionX * 0.6);
            let height = Math.floor(resolutionY * 0.6);
            
            // Adjust for high resolution displays
            if (resolutionX >= 2560) {
                width = 1920;
                height = 1080;
            }
            
            // Limit maximum size
            if (width > 1280) {
                width = 1280;
                height = Math.floor((width / resolutionX) * resolutionY);
            }
            if (height > 720) {
                height = 720;
                width = Math.floor((height / resolutionY) * resolutionX);
            }
            
            this.config.viewport = {
                width: this.config.mobile ? 320 : width,
                height: this.config.mobile ? 568 : height
            };
            
            logger.info(`Screen resolution detected: ${width}x${height}`);
        } catch (error) {
            logger.warn('Failed to detect screen resolution, using default');
            this.config.viewport = {
                width: this.config.mobile ? 320 : 1280,
                height: this.config.mobile ? 568 : 720
            };
        }
    }
    
    // Detect browser executable path
    async detectBrowserPath() {
        try {
            if (this.browserType === 'edge') {
                const EdgeFinder = require('../browsers/edge/finder');
                const finder = new EdgeFinder();
                const edgeInfo = finder.getEdgeInfo();
                if (edgeInfo && edgeInfo.executablePath) {
                    this.config.executablePath = edgeInfo.executablePath;
                    logger.info(`Edge executable detected: ${edgeInfo.executablePath}`);
                }
            } else if (this.browserType === 'chrome') {
                const ChromeFinder = require('../browsers/chrome/finder');
                const finder = new ChromeFinder();
                const chromeInfo = finder.getChromeInfo();
                if (chromeInfo && chromeInfo.executablePath) {
                    this.config.executablePath = chromeInfo.executablePath;
                    logger.info(`Chrome executable detected: ${chromeInfo.executablePath}`);
                }
            }
        } catch (error) {
            logger.warn('Failed to detect browser executable path');
        }
    }
    
    // Build browser-specific arguments
    buildBrowserArgs() {
        const args = this.browserConfig.getArgs();
        
        // Add window size
        args.push(`--window-size=${this.config.viewport.width},${this.config.viewport.height}`);
        
        // Add user data directory
        args.push(`--user-data-dir=/tmp/${this.browserType}-user-data-${Date.now()}`);
        
        // Add language
        args.push('--lang=zh-CN');
        
        // Add additional options
        if (this.config.disableGpu) {
            args.push('--disable-gpu');
        }
        
        if (this.config.mute) {
            args.push('--mute-audio');
        }
        
        if (this.config.devtools) {
            args.push('--auto-open-devtools-for-tabs');
        }
        
        return args;
    }
    
    // Get ignore default args
    getIgnoreDefaultArgs() {
        return this.browserConfig.getIgnoreArgs();
    }
    
    // Get browser-specific download settings
    getDownloadSettings() {
        return this.browserConfig.getDownloadSettings();
    }
    
    // Get browser-specific security settings
    getSecuritySettings() {
        if (this.browserType === 'chrome') {
            return this.browserConfig.getSecuritySettings();
        }
        return {};
    }
    
    // Get browser version info
    getBrowserVersionInfo() {
        return this.browserConfig.getVersionInfo();
    }
}

module.exports = ConfigManager;
