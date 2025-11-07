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

const logger = require('#@logger');
const ElectronManager = require('../../../ncore/utils/electron');
const { commander } = require('#@commander');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const electronConfig = require('../config/electron');

class ElectronMCPController {
    constructor() {
        this.name = 'ElectronMCPController';
        this.version = '1.0.0';
        this.electronManager = null;
        this.serviceProcesses = new Map();
        this.initialized = false;
        this.config = electronConfig;
    }

    async initialize() {
        if (this.initialized) {
            logger.warn('ElectronMCPController already initialized');
            return this;
        }

        try {
            logger.info('Initializing ElectronMCPController...');

            const electronEnabled = this.config.enabled !== false;

            if (!electronEnabled) {
                logger.info('Electron is disabled in configuration, skipping Electron initialization');
                this.initialized = true;
                return this;
            }

            this.electronManager = ElectronManager.getInstance();
            await this.electronManager.initialize(this.config);

            if (!this.electronManager.isInitialized || !this.electronManager.electron) {
                logger.warn('Electron module not available, running without Electron features');
                this.electronManager = null;
                this.initialized = true;
                return this;
            }

            this.setupIPCHandlers();

            await this.initializeServices();

            this.initialized = true;
            logger.info('ElectronMCPController initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize ElectronMCPController: ${error.message}`);
            throw error;
        }
    }

    setupIPCHandlers() {
        if (!this.electronManager) {
            return;
        }

        // Note: In a real implementation, these would be IPC handlers
        // For now, these are placeholder methods that would be connected to Electron IPC

        this.ipcHandlers = {
            'get-service-status': async () => {
                return this.getServiceStatus();
            },

            'check-service-health': async () => {
                return await this.checkAllServices();
            },

            'restart-services': async () => {
                return await this.restartAllServices();
            },

            'open-backend-status': async () => {
                return await this.openBackendStatus();
            },

            'get-app-version': () => {
                return this.version;
            }
        };
    }

    async initializeServices() {
        try {
            logger.info('Initializing MCP services...');

            // Start backend service if auto-start is enabled
            if (this.config.autoStart.startBackend) {
                await this.startBackendService();
            }

            // Start service monitoring
            this.startServiceMonitoring();

            logger.info('MCP services initialization completed');
        } catch (error) {
            logger.error(`Failed to initialize services: ${error.message}`);
            throw error;
        }
    }

    async startBackendService() {
        try {
            logger.info('Starting backend MCP service...');

            const backendConfig = this.config.services.backend;

            // Check if backend is already running
            const isRunning = await this.checkBackendHealth();
            if (isRunning) {
                logger.info('Backend service is already running');
                return true;
            }

            // Start backend process
            const result = await commander.executeCommand(
                backendConfig.startupCommand,
                {
                    cwd: backendConfig.startupDirectory,
                    timeout: backendConfig.startupTimeout
                }
            );

            if (result.code === 0) {
                logger.info('Backend service started successfully');
                return true;
            } else {
                logger.error(`Backend service failed to start: ${result.stderr}`);
                return false;
            }
        } catch (error) {
            logger.error(`Error starting backend service: ${error.message}`);
            return false;
        }
    }

    async startFrontendService() {
        try {
            logger.info('Starting frontend service...');

            const frontendConfig = this.config.services.frontend;

            // Check if frontend is already running
            const isRunning = await this.checkFrontendHealth();
            if (isRunning) {
                logger.info('Frontend service is already running');
                return true;
            }

            // Start frontend process
            const result = await commander.executeCommand(
                frontendConfig.startupCommand,
                {
                    cwd: frontendConfig.startupDirectory,
                    timeout: frontendConfig.startupTimeout
                }
            );

            if (result.code === 0) {
                logger.info('Frontend service started successfully');
                return true;
            } else {
                logger.error(`Frontend service failed to start: ${result.stderr}`);
                return false;
            }
        } catch (error) {
            logger.error(`Error starting frontend service: ${error.message}`);
            return false;
        }
    }

    async checkBackendHealth() {
        try {
            const backendConfig = this.config.services.backend;
            if (!backendConfig || backendConfig.enabled === false) {
                return false;
            }

            const backendUrl = backendConfig.url || '';
            if (backendUrl.startsWith('ws://') || backendUrl.startsWith('wss://')) {
                return await this._checkBackendHealthViaWebSocket(backendConfig);
            }

            return await this._checkBackendHealthViaHttp(backendConfig);
        } catch (error) {
            logger.debug(`Backend health check failed: ${error.message}`);
            return false;
        }
    }

    async _checkBackendHealthViaHttp(backendConfig) {
        try {
            const { httptool } = require('#@btools');
            const healthPath = backendConfig.healthCheck || '/api/status';
            const response = await httptool.getRequest(
                `${backendConfig.url}${healthPath}`,
                {
                    timeout: this.config.monitoring.connectionTimeout,
                    retries: this.config.monitoring.retryAttempts
                }
            );
            return response && response.statusCode === 200;
        } catch (error) {
            logger.debug(`HTTP backend health check failed: ${error.message}`);
            return false;
        }
    }

    async _checkBackendHealthViaWebSocket(backendConfig) {
        return await new Promise((resolve) => {
            const routeName = backendConfig.healthRoute || 'server.status';
            const requestId = uuidv4();
            const timeoutMs = this.config.monitoring.connectionTimeout;
            let resolved = false;

            const socket = new WebSocket(backendConfig.url, {
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
                    logger.debug(`Error terminating WebSocket: ${error.message}`);
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
                    route: routeName,
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
                    logger.debug(`WebSocket backend health parsing error: ${error.message}`);
                }
            });

            socket.on('error', (error) => {
                clearTimeout(timeoutHandle);
                logger.debug(`WebSocket backend health socket error: ${error.message}`);
                finalize(false);
            });

            socket.on('close', () => {
                clearTimeout(timeoutHandle);
                finalize(resolved);
            });
        });
    }

    async checkFrontendHealth() {
        try {
            const frontendConfig = this.config.services.frontend;
            const { httptool } = require('#@btools');

            const response = await httptool.getRequest(
                frontendConfig.url,
                {
                    timeout: this.config.monitoring.connectionTimeout,
                    retries: this.config.monitoring.retryAttempts
                }
            );

            return response && response.statusCode === 200;
        } catch (error) {
            logger.debug(`Frontend health check failed: ${error.message}`);
            return false;
        }
    }

    async checkAllServices() {
        try {
            const backend = await this.checkBackendHealth();
            const frontend = await this.checkFrontendHealth();

            return {
                backend: backend,
                frontend: frontend,
                timestamp: new Date().toISOString(),
                services: {
                    backend: {
                        url: this.config.services.backend.url,
                        status: backend ? 'running' : 'stopped',
                        lastChecked: new Date().toISOString()
                    },
                    frontend: {
                        url: this.config.services.frontend.url,
                        status: frontend ? 'running' : 'stopped',
                        lastChecked: new Date().toISOString()
                    }
                }
            };
        } catch (error) {
            logger.error(`Error checking services: ${error.message}`);
            return {
                backend: false,
                frontend: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async restartAllServices() {
        try {
            logger.info('Restarting all services...');

            const results = {
                backend: await this.restartService('backend'),
                frontend: await this.restartService('frontend'),
                timestamp: new Date().toISOString()
            };

            logger.info('Service restart completed', results);
            return results;
        } catch (error) {
            logger.error(`Error restarting services: ${error.message}`);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async restartService(serviceName) {
        try {
            const config = this.config.services[serviceName];
            if (!config) {
                throw new Error(`Unknown service: ${serviceName}`);
            }

            logger.info(`Restarting ${serviceName} service...`);

            // Stop the service (if possible)
            // Note: Graceful shutdown would need to be implemented based on service specifics

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Start the service
            let success = false;
            if (serviceName === 'backend') {
                success = await this.startBackendService();
            } else if (serviceName === 'frontend') {
                success = await this.startFrontendService();
            }

            return {
                service: serviceName,
                success: success,
                url: config.url,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error(`Error restarting service ${serviceName}: ${error.message}`);
            return {
                service: serviceName,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async openBackendStatus() {
        try {
            const backendConfig = this.config.services.backend;
            const backendUrl = backendConfig.url;

            if (backendUrl.startsWith('ws://') || backendUrl.startsWith('wss://')) {
                logger.info(`Backend WebSocket endpoint: ${backendUrl}`);
                return {
                    success: true,
                    url: backendUrl,
                    message: 'Backend WebSocket endpoint logged'
                };
            }

            const { shell } = require('electron');
            const targetUrl = backendConfig.healthCheck ?
                `${backendUrl}${backendConfig.healthCheck}` :
                backendUrl;
            await shell.openExternal(targetUrl);
            return {
                success: true,
                url: targetUrl
            };
        } catch (error) {
            logger.error(`Failed to open backend status: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    startServiceMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        logger.info('Starting service monitoring...');

        this.monitoringInterval = setInterval(async () => {
            try {
                const healthStatus = await this.checkAllServices();

                // Notify Electron manager of status changes
                if (this.electronManager) {
                    this.electronManager.serviceStatus = {
                        backend: healthStatus.backend,
                        frontend: healthStatus.frontend
                    };
                    this.electronManager.updateTrayMenu();
                }

                // Log status changes
                logger.debug('Service health check completed', healthStatus);
            } catch (error) {
                logger.error(`Error in service monitoring: ${error.message}`);
            }
        }, this.config.monitoring.checkInterval);

        // Initial health check
        this.checkAllServices();
    }

    getServiceStatus() {
        return {
            initialized: this.initialized,
            hasElectronManager: this.electronManager !== null,
            config: this.config,
            monitoring: {
                enabled: this.monitoringInterval !== null,
                interval: this.config.monitoring.checkInterval
            }
        };
    }

    async shutdown() {
        try {
            logger.info('Shutting down ElectronMCPController...');

            // Stop monitoring
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }

            // Shutdown Electron manager
            if (this.electronManager) {
                await this.electronManager.shutdown();
            }

            // Clean up service processes if needed
            this.serviceProcesses.clear();

            logger.info('ElectronMCPController shutdown completed');
        } catch (error) {
            logger.error(`Error during shutdown: ${error.message}`);
        }
    }

    // Static factory method
    static async create() {
        const controller = new ElectronMCPController();
        await controller.initialize();
        return controller;
    }
}

module.exports = ElectronMCPController;
