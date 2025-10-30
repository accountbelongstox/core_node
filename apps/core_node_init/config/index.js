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
const { pathtool } = require('#@ncore/foundation/utilities');

// Declare variables
const homeDir = os.homedir();
const downloadConfig = pathtool.getDownloadConfig();
const downloadsDir = downloadConfig.defaultDir;

// Extract the required directories
const safeAppLargeFilesCacheDir = globalDir?.APP_LARGE_FILES_CACHE_DIR || path.join(homeDir, '.core_node', 'cache', 'large_files');
const safeAppRuntimeCacheDir = globalDir?.APP_RUNTIME_CACHE_DIR || path.join(homeDir, '.core_node', 'cache', 'runtime');

// Download configurations for different applications
const downloadConfigs = {
    cursor: {
        name: 'Cursor IDE',
        url: 'https://cursor.com/download',
        targetSelector: 'a[href*="AppImage"]',
        keywords: ['linux', 'appimage', 'x64', 'download'],
        filePattern: 'cursor.*\\.appimage',
        downloadDir: downloadsDir,
        timeout: 300000,
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
        timeout: 300000,
        waitForDownload: true,
        description: 'Source code editor developed by Microsoft'
    }
};

// Puppeteer configuration for v2 framework
const puppeteerConfig = {
    browser: 'edge',
    headless: false,
    devtools: false,
    timeout: 120000,
    waitForComplete: true,
    showImages: false,
    showStyle: true,
    disableGpu: true,
    mute: true,
    random_user_agent: true,
    downloadDir: downloadsDir,
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
    pollInterval: 2000,
    maxWaitTime: 300000,
    stableTime: 3000,
    minFileSize: 1024 * 1024
};

// Download directories configuration (using pathtool)
const downloadDirConfig = {
    ...downloadConfig,
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
    downloadConfigs,
    puppeteerConfig,
    automationConfig,
    fileMonitorConfig,
    downloadDirConfig,
    loggingConfig,
    defaultTimeout: 120000,
    defaultRetries: 3,
    defaultWaitTime: 5000,
    appName: 'core_node_init',
    appVersion: '2.0.0',
    appDescription: 'Core Node Initialization and Download Manager (v2)'
};

module.exports = config;
