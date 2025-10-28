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

// Edge-specific configuration
const EDGE_CONFIG = {
    // Browser identification
    browserType: 'edge',
    browserName: 'Microsoft Edge',
    
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
    
    // Edge-specific arguments
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
        '--disable-renderer-backgrounding'
    ],
    
    // Edge-specific ignore args
    ignoreDefaultArgs: [
        '--enable-automation',
        '--enable-logging'
    ],
    
    // Edge executable paths (platform-specific)
    executablePaths: {
        win32: [
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ],
        linux: [
            '/usr/bin/microsoft-edge',
            '/usr/bin/microsoft-edge-stable',
            '/snap/bin/microsoft-edge',
            '/opt/microsoft/msedge/msedge'
        ],
        darwin: [
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ]
    },
    
    // Edge-specific user agents
    userAgents: {
        desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
        mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1 Edg/91.0.864.59'
    },
    
    // Edge-specific download settings
    downloadSettings: {
        defaultPath: '/tmp/edge-downloads',
        autoDownload: true,
        promptForDownload: false
    }
};

class EdgeConfig {
    constructor() {
        this.config = { ...EDGE_CONFIG };
    }
    
    // Get Edge configuration
    getConfig() {
        return { ...this.config };
    }
    
    // Update Edge configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.config;
    }
    
    // Reset to default Edge configuration
    resetToDefault() {
        this.config = { ...EDGE_CONFIG };
        return this.config;
    }
    
    // Get Edge-specific arguments
    getArgs() {
        return [...this.config.args];
    }
    
    // Get Edge-specific ignore args
    getIgnoreArgs() {
        return [...this.config.ignoreDefaultArgs];
    }
    
    // Get Edge executable paths for current platform
    getExecutablePaths() {
        return this.config.executablePaths[process.platform] || [];
    }
    
    // Get Edge-specific user agent
    getUserAgent(isMobile = false) {
        return isMobile ? this.config.userAgents.mobile : this.config.userAgents.desktop;
    }
    
    // Get Edge download settings
    getDownloadSettings() {
        return { ...this.config.downloadSettings };
    }
    
    // Check if Edge is the default browser
    isDefaultBrowser() {
        return this.config.browserType === 'edge';
    }
    
    // Get Edge version info
    getVersionInfo() {
        return {
            browserType: this.config.browserType,
            browserName: this.config.browserName,
            version: '91.0.864.59', // Default version
            userAgent: this.config.userAgents.desktop
        };
    }
}

module.exports = EdgeConfig;
