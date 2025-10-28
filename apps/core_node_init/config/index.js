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
const os = require('os');
const globalDir = require('#@global_dir');

// Declare variables
const homeDir = os.homedir();
const downloadsDir = path.join(homeDir, 'Downloads');

// Extract the required directories
// Safe fallback for globalDir to avoid circular dependency
const safeAppLargeFilesCacheDir = globalDir?.APP_LARGE_FILES_CACHE_DIR || path.join(homeDir, '.core_node', 'cache', 'large_files');
const safeAppRuntimeCacheDir = globalDir?.APP_RUNTIME_CACHE_DIR || path.join(homeDir, '.core_node', 'cache', 'runtime');

// Use ncore existing functionality
const { Spider } = require('#@puppeteer');

// Download configurations for different applications
const downloadConfigs = {
    cursor: {
        name: 'Cursor IDE',
        url: 'https://cursor.com/download',
        targetSelector: 'a[href*="AppImage"]',
        keywords: ['Linux', 'AppImage', 'x64'],
        filePattern: 'cursor.*\\.appimage',
        downloadDir: downloadsDir,
        timeout: 300000, // 5 minutes
        waitForDownload: true,
        description: 'AI-powered code editor'
    },
    vscode: {
        name: 'Visual Studio Code',
        url: 'https://code.visualstudio.com/download',
        targetSelector: 'a[href*=".deb"], .download-button, [data-os="linux"], .btn-download',
        keywords: ['linux', 'deb', 'x64', 'download'],
        filePattern: 'code.*\\.deb',
        downloadDir: downloadsDir,
        timeout: 300000, // 5 minutes
        waitForDownload: true,
        description: 'Source code editor developed by Microsoft'
    }
};

// Puppeteer configuration
const puppeteerConfig = {
    headless: true,
    devtools: false,
    timeout: 120000,
    waitForComplete: true,
    showImages: false,
    showStyle: true,
    disableGpu: true,
    mute: true,
    random_user_agent: true,
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
        `--user-data-dir=${safeAppRuntimeCacheDir}/chrome-user-data-${Date.now()}`
    ]
};

// File monitoring configuration
const fileMonitorConfig = {
    pollInterval: 2000, // Check every 2 seconds
    maxWaitTime: 300000, // Maximum wait time 5 minutes
    stableTime: 3000, // File must be stable for 3 seconds
    minFileSize: 1024 * 1024 // Minimum file size 1MB
};

// Download directories configuration
const downloadDirConfig = {
    searchDirs: [
        downloadsDir,
        path.join(homeDir, 'downloads'),
        path.join(homeDir, 'Desktop'),
        '/tmp/downloads'
    ],
    cacheDir: safeAppLargeFilesCacheDir,
    tempDir: safeAppRuntimeCacheDir
};

// Logging configuration
const loggingConfig = {
    level: 'info',
    enableFileLog: true,
    enableConsoleLog: true,
    logDir: path.join(safeAppRuntimeCacheDir, 'logs')
};

// Browser automation configuration
const automationConfig = {
    clickDelay: 1000,
    navigationTimeout: 30000,
    elementTimeout: 10000,
    retryAttempts: 3,
    retryDelay: 2000
};

// Export configuration
const config = {
    // Application configurations
    downloadConfigs,
    
    // Browser and automation settings
    puppeteerConfig,
    automationConfig,
    
    // File handling settings
    fileMonitorConfig,
    downloadDirConfig,
    
    // Logging settings
    loggingConfig,
    
    // Default settings
    defaultTimeout: 120000,
    defaultRetries: 3,
    defaultWaitTime: 5000,
    
    // Application metadata
    appName: 'core_node_init',
    appVersion: '1.0.0',
    appDescription: 'Core Node Initialization and Download Manager'
};

module.exports = config;
