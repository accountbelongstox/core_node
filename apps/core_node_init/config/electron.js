// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const path = require('path');
const bdir = require('#@bdir');
const fs = require('fs');

const electronConfig = {
    // Application settings
    appTitle: 'Core Node MCP Server',
    appName: 'core-node-mcp',
    version: '1.0.0',
    productName: 'Core Node MCP',

    // Application behavior mode
    mode: {
        trayOnly: true,
        hideOnStart: true,
        hideOnClose: true,
        minimizeToTray: true,
        startMinimized: true,
        showDockIcon: false
    },

    // Window settings
    window: {
        enabled: false,
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        maxWidth: 1920,
        maxHeight: 1080,
        showOnStart: false,
        center: true,
        resizable: true,
        frame: true,
        transparent: false,
        alwaysOnTop: false,
        skipTaskbar: true,
        show: false,
        backgroundColor: '#ffffff',
        title: 'Core Node MCP Server',
        icon: path.join(bdir.APP_STATIC_DIR, 'icons', 'app-icon.png'),
        content: {
            type: 'url',
            source: null,
            loadOptions: {
                extraHeaders: '',
                userAgent: ''
            }
        }
    },

    // Tray settings
    tray: {
        enabled: true,
        icon: _getTrayIconPath(),
        tooltip: 'Core Node MCP Server',
        title: 'Core Node MCP',
        pressedImage: null,
        balloonIcon: null,
        useTemplateIcon: false,
        contextMenu: {
            enabled: true,
            items: {
                openFrontend: true,
                openBackend: true,
                restartServices: true,
                serviceStatus: true,
                settings: true,
                about: true,
                separator: true,
                quit: true
            }
        },
        doubleClickAction: 'openFrontend',
        middleClickAction: 'none'
    },

    // Service URLs
    services: {
        frontend: {
            enabled: true,
            name: 'Frontend Service',
            url: 'http://localhost:7096',
            healthCheck: '/api/health',
            startupCommand: 'yarn dev:ittools --port 7096',
            startupDirectory: path.join(bdir.BASEDIR, 'poly_apps/nuxt_main'),
            startupTimeout: 30000,
            autoStart: false,
            restartOnCrash: false,
            maxRestartAttempts: 3,
            restartDelay: 5000
        },
        backend: {
            enabled: true,
            name: 'Backend MCP Service',
            url: 'http://localhost:8080',
            healthCheck: '/api/status',
            startupCommand: 'node main.js app=core_node_init mcp',
            startupDirectory: bdir.APP_ROOT,
            startupTimeout: 15000,
            autoStart: true,
            restartOnCrash: true,
            maxRestartAttempts: 5,
            restartDelay: 3000
        }
    },

    // Service monitoring
    monitoring: {
        enabled: true,
        checkInterval: 5000,
        retryAttempts: 3,
        connectionTimeout: 3000,
        notifyOnStatusChange: true,
        logHealthChecks: false,
        alertOnFailure: true
    },

    // Auto-start settings
    autoStart: {
        enabled: true,
        startBackend: true,
        startFrontend: false,
        startupDelay: 2000,
        waitForServices: true,
        launchAtLogin: false
    },

    // Menu items
    menu: {
        enableMenu: true,
        enableDevTools: process.env.NODE_ENV === 'development',
        showAbout: true,
        showPreferences: true,
        showServices: true,
        showHelp: false
    },

    // Notification settings
    notifications: {
        enabled: true,
        showOnServiceStart: false,
        showOnServiceStop: false,
        showOnServiceError: true,
        showOnUpdate: true,
        sound: false,
        duration: 5000
    },

    // Update settings
    updates: {
        enabled: false,
        checkOnStart: false,
        autoDownload: false,
        autoInstall: false,
        checkInterval: 86400000
    },

    // Security settings
    security: {
        allowRunningInsecureContent: false,
        enableRemoteModule: false,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
    },

    // Performance settings
    performance: {
        hardwareAcceleration: true,
        backgroundThrottling: false
    },

    // Logging
    logging: {
        enabled: true,
        level: 'info',
        file: path.join(bdir.CACHE_DIR, 'core-node-mcp.log'),
        maxSize: 10485760,
        maxFiles: 5,
        console: true,
        timestamp: true
    },

    // Developer options
    developer: {
        enableDevTools: process.env.NODE_ENV === 'development',
        openDevToolsOnStart: false,
        reloadOnChange: false,
        verboseLogging: false
    }
};

function _getTrayIconPath() {
    const iconPath = path.join(bdir.APP_STATIC_DIR, 'icons', 'tray-icon.png');
    const fallbackIconPath = path.join(__dirname, '..', 'template', 'static', 'icons', 'tray-icon.png');
    const defaultIconPath = path.join(bdir.BASEDIR, 'ncore', 'assets', 'icons', 'default-tray.png');

    if (fs.existsSync(iconPath)) {
        return iconPath;
    }

    if (fs.existsSync(fallbackIconPath)) {
        return fallbackIconPath;
    }

    if (fs.existsSync(defaultIconPath)) {
        return defaultIconPath;
    }

    return iconPath;
}

module.exports = electronConfig;