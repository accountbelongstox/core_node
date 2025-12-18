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
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const logger = require('#@logger');
const { getInstance: getModeResolver } = require('./utils/mode_resolver');
const CustomTitleBar = require('./components/custom_title_bar');
const LoadingAnimations = require('./components/loading_animations');

class ElectronManager {
    constructor() {
        this.name = 'ElectronManager';
        this.version = '1.0.0';
        this.mainWindow = null;
        this.tray = null;
        this.electron = null;
        this.app = null;
        this.BrowserWindow = null;
        this.Menu = null;
        this.Tray = null;
        this.dialog = null;
        this.shell = null;
        this.config = {
            enabled: false,
            appTitle: 'Core Node MCP Server',
            trayIcon: null,
            frontendUrl: 'http://localhost:7096',
            backendUrl: 'ws://localhost:8081',
            backendHealthRoute: 'server.status',
            autoStart: true,
            showWindowOnStart: false,
            enableTray: true,
            checkInterval: 5000
        };
        this.isInitialized = false;
        this.isQuitting = false;
        this.serviceStatus = {
            frontend: false,
            backend: false
        };
    }

    _loadElectron() {
        if (this.electron) {
            return true;
        }

        try {
            this.electron = require('electron');
            this.app = this.electron.app;
            this.BrowserWindow = this.electron.BrowserWindow;
            this.Menu = this.electron.Menu;
            this.Tray = this.electron.Tray;
            this.dialog = this.electron.dialog;
            this.shell = this.electron.shell;
            return true;
        } catch (error) {
            logger.error(`Failed to load Electron module: ${error.message}`);
            return false;
        }
    }

    async initialize(config = {}) {
        if (this.isInitialized) {
            logger.warn('ElectronManager already initialized');
            return this;
        }

        try {
            logger.info('Initializing ElectronManager...');

            this.config = { ...this.config, ...config };

            const electronEnabled = this.config.enabled !== false && (this.config.tray?.enabled || this.config.window?.enabled);

            if (!electronEnabled) {
                logger.info('Electron is disabled in configuration, skipping initialization');
                this.isInitialized = true;
                return this;
            }

            const electronLoaded = this._loadElectron();
            if (!electronLoaded) {
                logger.warn('Electron module not available, running without desktop features');
                this.isInitialized = true;
                return this;
            }

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
        if (!this.app) {
            logger.warn('Electron app not available, skipping event handler setup');
            return;
        }

        this.app.whenReady().then(() => {
            this.onAppReady();
        });

        this.app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                this.app.quit();
            }
        });

        this.app.on('activate', () => {
            if (this.BrowserWindow && this.BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        this.app.on('before-quit', () => {
            this.isQuitting = true;
        });

        this.app.on('will-quit', (event) => {
            logger.info('Electron application is quitting');
        });
    }

    async onAppReady() {
        try {
            logger.info('Electron app is ready');

            const modeResolver = getModeResolver();
            if (!modeResolver.validate(this.config)) {
                logger.error('Configuration validation failed, aborting');
                return;
            }

            const mode = modeResolver.resolve(this.config);

            if (mode.enableTray) {
                this.createTray();
                logger.info('System tray created');
            }

            if (mode.enableWindow) {
                if (mode.showWindowOnStart) {
                    this.createMainWindow();
                    logger.info('Main window created and shown');
                } else {
                    logger.info('Window enabled but not shown on start');
                }
            } else {
                logger.info('Window disabled by launch mode');
            }

            this.setupIPCHandlers();

            this.startServiceMonitoring();

            logger.info('Electron app setup completed');
        } catch (error) {
            logger.error(`Error in onAppReady: ${error.message}`);
        }
    }

    setupIPCHandlers() {
        if (!this.electron || !this.electron.ipcMain) {
            logger.warn('IPC not available, skipping handler setup');
            return;
        }

        const { ipcMain } = this.electron;

        ipcMain.handle('minimize-window', () => {
            if (this.mainWindow) {
                this.mainWindow.minimize();
            }
        });

        ipcMain.handle('maximize-window', () => {
            if (this.mainWindow) {
                if (this.mainWindow.isMaximized()) {
                    this.mainWindow.unmaximize();
                } else {
                    this.mainWindow.maximize();
                }
            }
        });

        ipcMain.handle('close-window', () => {
            if (this.mainWindow) {
                this.mainWindow.close();
            }
        });

        ipcMain.handle('is-window-maximized', () => {
            return this.mainWindow ? this.mainWindow.isMaximized() : false;
        });

        ipcMain.handle('get-service-status', () => {
            return this.getServiceStatus();
        });

        ipcMain.handle('check-service-health', async () => {
            await this.checkServiceHealth();
            return this.getServiceStatus();
        });

        ipcMain.handle('restart-services', async () => {
            await this.restartServices();
        });

        ipcMain.handle('open-backend-status', async () => {
            await this.openBackendStatus();
        });

        ipcMain.handle('get-app-version', () => {
            return this.version;
        });

        ipcMain.handle('get-app-name', () => {
            return this.config.appTitle || 'Core Node MCP Server';
        });

        logger.info('IPC handlers registered successfully');
    }

    createTray() {
        if (!this.Tray) {
            logger.warn('Tray not available, skipping tray creation');
            return;
        }

        try {
            const fs = require('fs');
            const trayConfig = this.config.tray || {};
            const iconPath = trayConfig.icon || this.config.trayIcon || path.join(__dirname, 'assets', 'tray-icon.png');
            const tooltip = trayConfig.tooltip || this.config.appTitle || 'Core Node MCP Server';

            if (!iconPath || !fs.existsSync(iconPath)) {
                logger.warn(`Tray icon not found: ${iconPath}`);
                logger.warn('Skipping tray creation - please provide a valid icon path');
                return;
            }

            this.tray = new this.Tray(iconPath);
            this.tray.setToolTip(tooltip);
            logger.info(`Tray icon path resolved: ${iconPath}`);

            if (trayConfig.title) {
                this.tray.setTitle(trayConfig.title);
            }

            this.updateTrayMenu();

            const doubleClickAction = trayConfig.doubleClickAction || 'openFrontend';
            this.tray.on('double-click', () => {
                if (doubleClickAction === 'openFrontend') {
                    this.openFrontend();
                } else if (doubleClickAction === 'openWindow') {
                    this.showMainWindow();
                } else if (doubleClickAction === 'openBackend') {
                    this.openBackendStatus();
                }
            });

            if (trayConfig.middleClickAction && trayConfig.middleClickAction !== 'none') {
                this.tray.on('middle-click', () => {
                    if (trayConfig.middleClickAction === 'openBackend') {
                        this.openBackendStatus();
                    } else if (trayConfig.middleClickAction === 'restartServices') {
                        this.restartServices();
                    }
                });
            }

            logger.info('System tray created successfully');
        } catch (error) {
            logger.error(`Failed to create tray: ${error.message}`);
        }
    }

    createMainWindow() {
        if (!this.BrowserWindow) {
            logger.warn('BrowserWindow not available, skipping window creation');
            return;
        }

        try {
            const windowConfig = this.config.window || {};
            const securityConfig = this.config.security || {};
            const modeConfig = this.config.mode || {};

            this.mainWindow = new this.BrowserWindow({
                width: windowConfig.width || 1200,
                height: windowConfig.height || 800,
                minWidth: windowConfig.minWidth || 800,
                minHeight: windowConfig.minHeight || 600,
                maxWidth: windowConfig.maxWidth,
                maxHeight: windowConfig.maxHeight,
                center: windowConfig.center !== false,
                resizable: windowConfig.resizable !== false,
                frame: windowConfig.frame !== false,
                transparent: windowConfig.transparent === true,
                alwaysOnTop: windowConfig.alwaysOnTop === true,
                skipTaskbar: windowConfig.skipTaskbar === true,
                show: windowConfig.show === true,
                backgroundColor: windowConfig.backgroundColor || '#ffffff',
                title: windowConfig.title || this.config.appTitle || 'Core Node MCP Server',
                icon: windowConfig.icon || this.config.trayIcon,
                webPreferences: {
                    nodeIntegration: securityConfig.nodeIntegration === true,
                    contextIsolation: securityConfig.contextIsolation !== false,
                    enableRemoteModule: securityConfig.enableRemoteModule === true,
                    sandbox: securityConfig.sandbox !== false,
                    webSecurity: securityConfig.webSecurity !== false,
                    preload: path.join(__dirname, 'preload.js')
                }
            });

            this.loadWindowContent();

            this.mainWindow.once('ready-to-show', () => {
                if (!modeConfig.hideOnStart && windowConfig.showOnStart) {
                    this.mainWindow.show();
                }
            });

            this.mainWindow.on('close', (event) => {
                if (modeConfig.hideOnClose || modeConfig.minimizeToTray) {
                    if (!this.isQuitting) {
                        event.preventDefault();
                        this.mainWindow.hide();
                        logger.info('Window hidden to tray');
                    }
                }
            });

            this.mainWindow.on('closed', () => {
                this.mainWindow = null;
            });

            this.mainWindow.on('maximize', () => {
                if (this.mainWindow && this.mainWindow.webContents) {
                    this.mainWindow.webContents.send('window-maximized');
                }
            });

            this.mainWindow.on('unmaximize', () => {
                if (this.mainWindow && this.mainWindow.webContents) {
                    this.mainWindow.webContents.send('window-unmaximized');
                }
            });

            this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                logger.error(`Failed to load frontend: ${errorCode} - ${errorDescription}`);
                this.handleLoadError(errorCode, errorDescription);
            });

            logger.info('Main window created successfully');
        } catch (error) {
            logger.error(`Failed to create main window: ${error.message}`);
        }
    }

    loadWindowContent() {
        try {
            if (!this.mainWindow) {
                logger.warn('Cannot load content: main window not created');
                return;
            }

            const windowConfig = this.config.window || {};
            const contentConfig = windowConfig.content || {};
            const contentType = contentConfig.type || 'url';
            const contentSource = contentConfig.source || this.config.services?.frontend?.url || this.config.frontendUrl || 'http://localhost:7096';
            const loadOptions = contentConfig.loadOptions || {};
            const loadingConfig = contentConfig.loadingAnimation || {};

            if (loadingConfig.enabled) {
                const style = loadingConfig.style || 1;
                const text = loadingConfig.text || 'Loading...';
                const bg = loadingConfig.backgroundColor || '#1e1e1e';

                logger.info(`Showing loading animation (style ${style})...`);
                LoadingAnimations.show(this.mainWindow, style, text, bg);

                setTimeout(() => {
                    this.loadActualContent(contentType, contentSource, loadOptions);
                }, 500);
            } else {
                this.loadActualContent(contentType, contentSource, loadOptions);
            }

            logger.info('Window content loaded successfully');
        } catch (error) {
            logger.error(`Failed to load window content: ${error.message}`);
        }
    }

    loadActualContent(contentType, contentSource, loadOptions) {
        switch (contentType) {
            case 'url':
                logger.info(`Loading URL: ${contentSource}`);
                this.mainWindow.loadURL(contentSource, loadOptions);
                break;

            case 'file':
                const filePath = path.isAbsolute(contentSource) ? contentSource : path.join(process.cwd(), contentSource);
                logger.info(`Loading file: ${filePath}`);
                this.mainWindow.loadFile(filePath);
                break;

            case 'html':
                logger.info('Loading HTML content');
                this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(contentSource)}`);
                break;

            default:
                logger.warn(`Unknown content type: ${contentType}, falling back to URL`);
                this.mainWindow.loadURL(contentSource, loadOptions);
        }

        const windowConfig = this.config.window || {};
        const titleBarConfig = windowConfig.titleBar || {};

        if (titleBarConfig.enabled) {
            this.mainWindow.webContents.once('did-finish-load', () => {
                this.injectCustomTitleBar();
            });
        }
    }

    async injectCustomTitleBar() {
        try {
            const windowConfig = this.config.window || {};
            const titleBarConfig = windowConfig.titleBar || {};

            const titleBar = new CustomTitleBar(this.mainWindow, {
                height: titleBarConfig.height || 40,
                style: titleBarConfig.style || 'modern',
                showAppName: titleBarConfig.showAppName !== false,
                showLogo: titleBarConfig.showLogo === true,
                appName: this.config.appTitle || 'Application',
                logoPath: titleBarConfig.logoPath || this.config.trayIcon,
                buttons: titleBarConfig.buttons || {
                    minimize: true,
                    maximize: true,
                    close: true
                },
                customStyles: titleBarConfig.customStyles || {}
            });

            await titleBar.inject();
            logger.info('Custom title bar injected successfully');
        } catch (error) {
            logger.error(`Failed to inject custom title bar: ${error.message}`);
        }
    }

    showMainWindow() {
        try {
            if (!this.mainWindow) {
                this.createMainWindow();
            } else {
                if (this.mainWindow.isMinimized()) {
                    this.mainWindow.restore();
                }
                this.mainWindow.show();
                this.mainWindow.focus();
            }
            logger.info('Main window shown');
        } catch (error) {
            logger.error(`Failed to show main window: ${error.message}`);
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

            const backendUrl = this.config.backendUrl || '';

            if (backendUrl.startsWith('ws://') || backendUrl.startsWith('wss://')) {
                if (this.dialog) {
                    await this.dialog.showMessageBox({
                        type: 'info',
                        title: 'Backend WebSocket Endpoint',
                        message: 'The backend is exposed via WebSocket.',
                        detail: backendUrl
                    });
                }
                return;
            }

            const statusUrl = `${backendUrl}${this.config.backendHealthRoute || '/api/status'}`;

            if (this.shell) {
                await this.shell.openExternal(statusUrl);
            }
        } catch (error) {
            logger.error(`Failed to open backend status: ${error.message}`);
        }
    }

    async restartServices() {
        try {
            logger.info('Restarting services...');

            if (!this.dialog) {
                logger.warn('Dialog not available, skipping confirmation');
                await this.performServiceRestart();
                return;
            }

            const result = await this.dialog.showMessageBox({
                type: 'question',
                buttons: ['Yes', 'No'],
                defaultId: 1,
                title: 'Restart Services',
                message: 'Are you sure you want to restart all services?'
            });

            if (result.response === 0) {
                await this.performServiceRestart();
            }
        } catch (error) {
            logger.error(`Failed to restart services: ${error.message}`);
        }
    }

    async performServiceRestart() {
        try {
            logger.info('Performing service restart...');

            if (this.dialog) {
                await this.dialog.showMessageBox({
                    type: 'info',
                    title: 'Services Restarting',
                    message: 'Services are being restarted. This may take a moment.'
                });
            }

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
        if (!this.dialog) {
            logger.warn('Dialog not available, cannot show about dialog');
            return;
        }

        this.dialog.showMessageBox({
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
        if (!this.dialog) {
            logger.error(`${serviceName} Service Error: ${message}`);
            return;
        }

        this.dialog.showMessageBox({
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
            const backendUrl = this.config.backendUrl || '';
            if (backendUrl.startsWith('ws://') || backendUrl.startsWith('wss://')) {
                return await this._checkBackendHealthViaWebSocket(backendUrl);
            }
            return await this._checkBackendHealthViaHttp(backendUrl);
        } catch (error) {
            return false;
        }
    }

    async _checkBackendHealthViaHttp(backendUrl) {
        try {
            const fetch = require('node-fetch');
            const statusUrl = `${backendUrl}${this.config.backendHealthRoute || '/api/status'}`;
            const response = await fetch(statusUrl, {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            logger.debug(`HTTP backend health check failed: ${error.message}`);
            return false;
        }
    }

    async _checkBackendHealthViaWebSocket(backendUrl) {
        return await new Promise((resolve) => {
            const healthRoute = this.config.backendHealthRoute || 'server.status';
            const requestId = uuidv4();
            const timeoutMs = 3000;
            let resolved = false;

            const socket = new WebSocket(backendUrl, {
                handshakeTimeout: timeoutMs
            });

            const finalize = (result) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                try {
                    socket.terminate();
                } catch (error) {
                    logger.debug(`Error terminating backend health socket: ${error.message}`);
                }
                resolve(result);
            };

            const timeoutHandle = setTimeout(() => {
                finalize(false);
            }, timeoutMs);

            socket.on('open', () => {
                const payload = {
                    type: 'request',
                    id: requestId,
                    route: healthRoute,
                    params: {},
                    timestamp: Date.now()
                };
                socket.send(JSON.stringify(payload));
            });

            socket.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'response' && message.id === requestId) {
                        clearTimeout(timeoutHandle);
                        finalize(message.success !== false);
                    }
                } catch (error) {
                    logger.debug(`Backend WebSocket health parse error: ${error.message}`);
                }
            });

            socket.on('error', (error) => {
                clearTimeout(timeoutHandle);
                logger.debug(`Backend WebSocket health socket error: ${error.message}`);
                finalize(false);
            });

            socket.on('close', () => {
                clearTimeout(timeoutHandle);
                finalize(resolved);
            });
        });
    }

    updateTrayMenu() {
        if (!this.tray || !this.Menu) {
            return;
        }

        const menuConfig = this.config.tray?.contextMenu || {};
        const menuItems = menuConfig.items || {};
        const menuTemplate = [];

        if (menuItems.openFrontend !== false) {
            menuTemplate.push({
                label: 'Open Frontend',
                click: () => {
                    this.openFrontend();
                }
            });
        }

        if (menuItems.openBackend !== false) {
            menuTemplate.push({
                label: 'Open Backend Status',
                click: () => {
                    this.openBackendStatus();
                }
            });
        }

        if (menuItems.separator !== false && menuTemplate.length > 0) {
            menuTemplate.push({ type: 'separator' });
        }

        if (menuItems.restartServices !== false) {
            menuTemplate.push({
                label: 'Restart Services',
                click: () => {
                    this.restartServices();
                }
            });
        }

        if (menuItems.serviceStatus !== false) {
            menuTemplate.push({
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
            });
        }

        if (menuItems.separator !== false) {
            menuTemplate.push({ type: 'separator' });
        }

        if (menuItems.settings !== false) {
            menuTemplate.push({
                label: 'Settings',
                click: () => {
                    this.openSettings();
                }
            });
        }

        if (menuItems.about !== false) {
            menuTemplate.push({
                label: 'About',
                click: () => {
                    this.showAboutDialog();
                }
            });
        }

        if (menuItems.separator !== false) {
            menuTemplate.push({ type: 'separator' });
        }

        if (menuItems.quit !== false) {
            menuTemplate.push({
                label: 'Quit',
                click: () => {
                    if (this.app) {
                        this.app.quit();
                    }
                }
            });
        }

        const contextMenu = this.Menu.buildFromTemplate(menuTemplate);
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

module.exports = ElectronManager;
module.exports.ElectronManager = ElectronManager;
module.exports.getInstance = getInstance;

module.exports.PlatformAdapter = require('./platform_adapter').PlatformAdapter;
module.exports.getGlobalPlatformAdapter = require('./platform_adapter').getGlobalPlatformAdapter;
module.exports.PortManager = require('./port_manager').PortManager;
module.exports.getGlobalPortManager = require('./port_manager').getGlobalPortManager;
module.exports.FrontendConfig = require('./frontend').FrontendConfig;
module.exports.FrontendManager = require('./frontend').FrontendManager;
module.exports.startFrontendIfNeeded = require('./frontend').startFrontendIfNeeded;
module.exports.launchElectronApp = require('./app_launcher').launchElectronApp;
module.exports.isElectronAppLaunched = require('./app_launcher').isElectronAppLaunched;
module.exports.getLaunchedAppName = require('./app_launcher').getLaunchedAppName;
module.exports.getFrontendManager = require('./app_launcher').getFrontendManager;
