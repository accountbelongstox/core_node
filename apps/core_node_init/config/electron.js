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

const electronConfig = {
    // Application settings
    appTitle: 'Core Node MCP Server',
    version: '1.0.0',

    // Window settings
    window: {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        showOnStart: false,
        center: true,
        resizable: true
    },

    // Tray settings
    tray: {
        enabled: true,
        icon: path.join(bdir.APP_STATIC_DIR, 'icons', 'tray-icon.png'),
        tooltip: 'Core Node MCP Server'
    },

    // Service URLs
    services: {
        frontend: {
            url: 'http://localhost:7096',
            healthCheck: '/api/health',
            startupCommand: 'yarn dev:ittools --port 7096',
            startupDirectory: path.join(bdir.BASEDIR, 'poly_apps/nuxt_main'),
            startupTimeout: 30000
        },
        backend: {
            url: 'http://localhost:8080',
            healthCheck: '/api/status',
            startupCommand: 'node main.js app=core_node_init mcp',
            startupDirectory: bdir.APP_ROOT,
            startupTimeout: 15000
        }
    },

    // Service monitoring
    monitoring: {
        enabled: true,
        checkInterval: 5000,
        retryAttempts: 3,
        connectionTimeout: 3000
    },

    // Auto-start settings
    autoStart: {
        enabled: true,
        startBackend: true,
        startFrontend: false // Frontend will be started on demand
    },

    // Menu items
    menu: {
        enableMenu: true,
        enableDevTools: process.env.NODE_ENV === 'development'
    },

    // Security settings
    security: {
        allowRunningInsecureContent: false,
        enableRemoteModule: false,
        nodeIntegration: false,
        contextIsolation: true
    },

    // Logging
    logging: {
        level: 'info',
        file: path.join(bdir.CACHE_DIR, 'core-node-mcp.log')
    }
};

module.exports = electronConfig;