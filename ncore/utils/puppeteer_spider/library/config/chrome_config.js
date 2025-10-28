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

// Chrome-specific configuration
const CHROME_CONFIG = {
    // Browser identification
    browserType: 'chrome',
    browserName: 'Google Chrome',
    
    // Default settings
    headless: true,
    devtools: false,
    mobile: false,
    disableGpu: true,
    mute: true,
    showImages: false,
    showStyle: true,
    
    // Timing settings
    timeout: 30000,
    waitForComplete: true,
    
    // User agent settings
    random_user_agent: true,
    
    // Viewport settings
    viewport: {
        width: 1920,
        height: 1080
    },
    
    // Chrome-specific arguments
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--disable-sync-preferences',
        '--disable-default-apps',
        '--disable-web-resources'
    ],
    
    // Chrome-specific ignore args
    ignoreDefaultArgs: [
        '--enable-automation',
        '--enable-logging'
    ],
    
    // Chrome executable paths (platform-specific)
    executablePaths: {
        win32: [
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
        ],
        linux: [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium',
            '/opt/google/chrome/chrome'
        ],
        darwin: [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
        ]
    },
    
    // Chrome-specific user agents
    userAgents: {
        desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1'
    },
    
    // Chrome-specific download settings
    downloadSettings: {
        defaultPath: '/tmp/chrome-downloads',
        autoDownload: true,
        promptForDownload: false
    },
    
    // Chrome-specific security settings
    securitySettings: {
        ignoreCertificateErrors: true,
        ignoreHTTPSErrors: true,
        ignoreDefaultArgs: true
    }
};

class ChromeConfig {
    constructor() {
        this.config = { ...CHROME_CONFIG };
    }
    
    // Get Chrome configuration
    getConfig() {
        return { ...this.config };
    }
    
    // Update Chrome configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
    
    // Reset to default Chrome configuration
    resetToDefault() {
        this.config = { ...CHROME_CONFIG };
        return this.config;
    }
    
    // Get Chrome-specific arguments
    getArgs() {
        return [...this.config.args];
    }
    
    // Get Chrome-specific ignore args
    getIgnoreArgs() {
        return [...this.config.ignoreDefaultArgs];
    }
    
    // Get Chrome executable paths for current platform
    getExecutablePaths() {
        return this.config.executablePaths[process.platform] || [];
    }
    
    // Get Chrome-specific user agent
    getUserAgent(isMobile = false) {
        return isMobile ? this.config.userAgents.mobile : this.config.userAgents.desktop;
    }
    
    // Get Chrome download settings
    getDownloadSettings() {
        return { ...this.config.downloadSettings };
    }
    
    // Get Chrome security settings
    getSecuritySettings() {
        return { ...this.config.securitySettings };
    }
    
    // Check if Chrome is the default browser
    isDefaultBrowser() {
        return this.config.browserType === 'chrome';
    }
    
    // Get Chrome version info
    getVersionInfo() {
        return {
            browserType: this.config.browserType,
            browserName: this.config.browserName,
            version: '91.0.4472.124', // Default version
            userAgent: this.config.userAgents.desktop
        };
    }
}

module.exports = ChromeConfig;
