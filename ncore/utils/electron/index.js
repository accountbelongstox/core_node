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

const { app, BrowserWindow, Menu, Tray, dialog, shell } = require('electron');
const path = require('path');
const logger = require('#@logger');

class ElectronManager {
    constructor() {
        this.name = 'ElectronManager';
        this.version = '1.0.0';
        this.mainWindow = null;
        this.tray = null;
        this.config = {
            appTitle: 'Core Node MCP Server',
            trayIcon: null,
            frontendUrl: 'http://localhost:7096',
            backendUrl: 'http://localhost:8080',
            autoStart: true,
            showWindowOnStart: false,
            enableTray: true,
            checkInterval: 5000 // Service health check interval
        };
        this.isInitialized = false;
        this.isQuitting = false;
        this.serviceStatus = {
            frontend: false,
            backend: false
        };
    }

    async initialize(config = {}) {
        if (this.isInitialized) {
            logger.warn('ElectronManager already initialized');
            return this;
        }

        try {
            logger.info('Initializing ElectronManager...');

            // Merge configuration
            this.config = { ...this.config, ...config };

            // Setup app event handlers
            this.setupAppEventHandlers();

            this.isInitialized = true;
            logger.info('ElectronManager initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize ElectronManager: ${error.message}`);
            throw error;
        }
    }

    setupAppEventHandlers() {
        // App ready handler
        app.whenReady().then(() => {
            this.onAppReady();
        });

        // Window all closed handler
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // App activate handler (macOS)
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        // Before quit handler
        app.on('before-quit', () => {
            this.isQuitting = true;
        });

        // App will quit handler
        app.on('will-quit', (event) => {
            logger.info('Electron application is quitting');
        });
    }

    async onAppReady() {
        try {
            logger.info('Electron app is ready');

            // Create system tray if enabled
            if (this.config.enableTray) {
                this.createTray();
            }

            // Create main window if configured
            if (this.config.showWindowOnStart) {
                this.createMainWindow();
            }

            // Start service monitoring
            this.startServiceMonitoring();

            logger.info('Electron app setup completed');
        } catch (error) {
            logger.error(`Error in onAppReady: ${error.message}`);
        }
    }

    createTray() {
        try {
            // Get tray icon path
            const iconPath = this.config.trayIcon || path.join(__dirname, 'assets', 'tray-icon.png');

            // Create tray
            this.tray = new Tray(iconPath);
            this.tray.setToolTip(this.config.appTitle);

            // Create context menu
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Open Frontend',
                    click: () => {
                        this.openFrontend();
                    }
                },
                {
                    label: 'Open Backend Status',
                    click: () => {
                        this.openBackendStatus();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Restart Services',
                    click: () => {
                        this.restartServices();
                    }
                },
                {
                    label: 'Service Status',
                    submenu: [
                        {
                            label: 'Frontend',
                            type: 'checkbox',
                            checked: this.serviceStatus.frontend,
                            enabled: false
                        },
                        {
                            label: 'Backend',
                            type: 'checkbox',
                            checked: this.serviceStatus.backend,
                            enabled: false
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    click: () => {
                        this.openSettings();
                    }
                },
                {
                    label: 'About',
                    click: () => {
                        this.showAboutDialog();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    click: () => {
                        app.quit();
                    }
                }
            ]);

            this.tray.setContextMenu(contextMenu);

            // Double click handler
            this.tray.on('double-click', () => {
                this.openFrontend();
            });

            logger.info('System tray created successfully');
        } catch (error) {
            logger.error(`Failed to create tray: ${error.message}`);
        }
    }

    createMainWindow() {
        try {
            // Create the browser window
            this.mainWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    enableRemoteModule: false,
                    preload: path.join(__dirname, 'preload.js')
                },
                icon: this.config.trayIcon,
                show: false // Don't show immediately
            });

            // Load the app URL
            this.mainWindow.loadURL(this.config.frontendUrl);

            // Show window when ready to prevent visual flash
            this.mainWindow.once('ready-to-show', () => {
                this.mainWindow.show();
            });

            // Handle window closed
            this.mainWindow.on('closed', () => {
                this.mainWindow = null;
            });

            // Handle navigation errors
            this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                logger.error(`Failed to load frontend: ${errorCode} - ${errorDescription}`);
                this.handleLoadError(errorCode, errorDescription);
            });

            logger.info('Main window created successfully');
        } catch (error) {
            logger.error(`Failed to create main window: ${error.message}`);
        }
    }

    async openFrontend() {
        try {
            logger.info('Opening frontend...');

            // Check if frontend service is running
            if (!this.serviceStatus.frontend) {
                logger.info('Frontend service not running, attempting to start...');
                const started = await this.startFrontendService();
                if (!started) {
                    this.showServiceError('Frontend', 'Failed to start frontend service');
                    return;
                }
            }

            // Create or show main window
            if (!this.mainWindow) {
                this.createMainWindow();
            } else {
                this.mainWindow.show();
                this.mainWindow.focus();
            }
        } catch (error) {
            logger.error(`Failed to open frontend: ${error.message}`);
        }
    }

    async openBackendStatus() {
        try {
            if (!this.serviceStatus.backend) {
                this.showServiceError('Backend', 'Backend service is not running');
                return;
            }

            // Open backend status page in default browser
            await shell.openExternal(`${this.config.backendUrl}/api/status`);
        } catch (error) {
            logger.error(`Failed to open backend status: ${error.message}`);
        }
    }

    async restartServices() {
        try {
            logger.info('Restarting services...');

            // Show confirmation dialog
            const result = await dialog.showMessageBox({
                type: 'question',
                buttons: ['Yes', 'No'],
                defaultId: 1,
                title: 'Restart Services',
                message: 'Are you sure you want to restart all services?'
            });

            if (result.response === 0) { // Yes button
                await this.performServiceRestart();
            }
        } catch (error) {
            logger.error(`Failed to restart services: ${error.message}`);
        }
    }

    async performServiceRestart() {
        try {
            // Implementation would depend on how services are managed
            // This is a placeholder for actual restart logic
            logger.info('Performing service restart...');

            // Notify user
            await dialog.showMessageBox({
                type: 'info',
                title: 'Services Restarting',
                message: 'Services are being restarted. This may take a moment.'
            });

            // Actual restart logic would go here
            // For now, just update status
            this.serviceStatus.frontend = false;
            this.serviceStatus.backend = false;

            // Start monitoring to detect when services are back
            this.startServiceMonitoring();
        } catch (error) {
            logger.error(`Failed to perform service restart: ${error.message}`);
        }
    }

    openSettings() {
        // Open settings window or modal
        logger.info('Opening settings...');
    }

    showAboutDialog() {
        dialog.showMessageBox({
            type: 'info',
            title: 'About',
            message: `${this.config.appTitle}\nVersion: ${this.version}\n\nCore Node MCP Server with Electron integration`,
            buttons: ['OK']
        });
    }

    handleLoadError(errorCode, errorDescription) {
        logger.warn(`Frontend load error: ${errorCode} - ${errorDescription}`);

        // Show user-friendly error in window
        if (this.mainWindow) {
            this.mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
                <html>
                    <head>
                        <title>Service Error</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            .error { color: #e74c3c; }
                            .retry { background: #3498db; color: white; padding: 10px 20px; border: none; cursor: pointer; }
                        </style>
                    </head>
                    <body>
                        <h1 class="error">Frontend Service Unavailable</h1>
                        <p>The frontend service is not running or is not responding.</p>
                        <p>Error: ${errorCode} - ${errorDescription}</p>
                        <button class="retry" onclick="location.reload()">Retry</button>
                        <br><br>
                        <button onclick="window.open('http://localhost:8080/api/status')">Check Backend Status</button>
                    </body>
                </html>
            `));
        }
    }

    showServiceError(serviceName, message) {
        dialog.showMessageBox({
            type: 'error',
            title: `${serviceName} Service Error`,
            message: message,
            buttons: ['OK']
        });
    }

    startServiceMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        this.monitoringInterval = setInterval(async () => {
            await this.checkServiceHealth();
        }, this.config.checkInterval);

        // Initial check
        this.checkServiceHealth();
    }

    async checkServiceHealth() {
        try {
            // Check frontend health
            const wasFrontendDown = !this.serviceStatus.frontend;
            this.serviceStatus.frontend = await this.checkFrontendHealth();

            if (wasFrontendDown && this.serviceStatus.frontend) {
                logger.info('Frontend service is now available');
                this.updateTrayMenu();
            }

            // Check backend health
            const wasBackendDown = !this.serviceStatus.backend;
            this.serviceStatus.backend = await this.checkBackendHealth();

            if (wasBackendDown && this.serviceStatus.backend) {
                logger.info('Backend service is now available');
                this.updateTrayMenu();
            }

            this.updateTrayMenu();
        } catch (error) {
            logger.error(`Error checking service health: ${error.message}`);
        }
    }

    async checkFrontendHealth() {
        try {
            const fetch = require('node-fetch');
            const response = await fetch(this.config.frontendUrl, {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async checkBackendHealth() {
        try {
            const fetch = require('node-fetch');
            const response = await fetch(`${this.config.backendUrl}/api/status`, {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    updateTrayMenu() {
        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open Frontend',
                click: () => {
                    this.openFrontend();
                }
            },
            {
                label: 'Open Backend Status',
                click: () => {
                    this.openBackendStatus();
                }
            },
            { type: 'separator' },
            {
                label: 'Restart Services',
                click: () => {
                    this.restartServices();
                }
            },
            {
                label: 'Service Status',
                submenu: [
                    {
                        label: 'Frontend',
                        type: 'checkbox',
                        checked: this.serviceStatus.frontend,
                        enabled: false
                    },
                    {
                        label: 'Backend',
                        type: 'checkbox',
                        checked: this.serviceStatus.backend,
                        enabled: false
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Settings',
                click: () => {
                    this.openSettings();
                }
            },
            {
                label: 'About',
                click: () => {
                    this.showAboutDialog();
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    app.quit();
                }
            }
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    async startFrontendService() {
        try {
            // This would integrate with the actual frontend startup logic
            // For now, return true as a placeholder
            logger.info('Starting frontend service...');
            return true;
        } catch (error) {
            logger.error(`Failed to start frontend service: ${error.message}`);
            return false;
        }
    }

    getServiceStatus() {
        return {
            ...this.serviceStatus,
            isInitialized: this.isInitialized,
            hasMainWindow: this.mainWindow !== null,
            hasTray: this.tray !== null
        };
    }

    async shutdown() {
        try {
            logger.info('Shutting down ElectronManager...');

            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }

            if (this.mainWindow) {
                this.mainWindow.close();
            }

            if (this.tray) {
                this.tray.destroy();
            }

            logger.info('ElectronManager shutdown completed');
        } catch (error) {
            logger.error(`Error during shutdown: ${error.message}`);
        }
    }
}

let instance = null;

function getInstance() {
    if (!instance) {
        instance = new ElectronManager();
    }
    return instance;
}

module.exports = {
    getInstance,
    ElectronManager
};