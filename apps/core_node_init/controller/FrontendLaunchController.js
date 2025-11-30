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
const { commander } = require('#@commander');
const { httptool } = require('#@btools');
const { bdir } = require('#@bdir');
const path = require('path');
const electronConfig = require('../config/electron');

class FrontendLaunchController {
    constructor() {
        this.name = 'FrontendLaunchController';
        this.version = '1.0.0';
        this.frontendProcess = null;
        this.isRunning = false;
        this.startupAttempts = 0;
        this.maxStartupAttempts = 3;
        this.config = electronConfig.services.frontend;
        this.statusCheckInterval = null;
        this.status = {
            running: false,
            url: this.config.url,
            lastChecked: null,
            startupTime: null,
            processId: null
        };
    }

    async initialize() {
        try {
            logger.info('Initializing FrontendLaunchController...');

            // Check initial status
            await this.checkFrontendStatus();

            logger.info('FrontendLaunchController initialized successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize FrontendLaunchController: ${error.message}`);
            throw error;
        }
    }

    async launchFrontend() {
        try {
            logger.info('Launching frontend application...');

            // Check if already running
            if (await this.isFrontendRunning()) {
                logger.info('Frontend is already running');
                return {
                    success: true,
                    message: 'Frontend already running',
                    url: this.config.url,
                    pid: this.frontendProcess ? this.frontendProcess.pid : null
                };
            }

            // Reset startup attempts
            this.startupAttempts = 0;

            // Start the frontend
            const result = await this.startFrontendProcess();

            if (result.success) {
                // Start status monitoring
                this.startStatusMonitoring();

                // Wait for service to be ready
                const ready = await this.waitForFrontendReady();

                if (ready) {
                    logger.info(`Frontend launched successfully at ${this.config.url}`);
                    return {
                        success: true,
                        message: 'Frontend launched successfully',
                        url: this.config.url,
                        pid: this.frontendProcess ? this.frontendProcess.pid : null,
                        startupTime: this.status.startupTime
                    };
                } else {
                    logger.error('Frontend failed to become ready within timeout');
                    return {
                        success: false,
                        message: 'Frontend failed to start within timeout',
                        error: 'Service not responding'
                    };
                }
            } else {
                return result;
            }
        } catch (error) {
            logger.error(`Failed to launch frontend: ${error.message}`);
            return {
                success: false,
                message: 'Failed to launch frontend',
                error: error.message
            };
        }
    }

    async startFrontendProcess() {
        try {
            logger.info('Starting frontend process...');

            // Validate startup directory
            if (!await ftools.dirExists(this.config.startupDirectory)) {
                throw new Error(`Frontend startup directory not found: ${this.config.startupDirectory}`);
            }

            // Start the process
            const startTime = Date.now();

            this.frontendProcess = commander.executeCommandAsync(
                this.config.startupCommand,
                {
                    cwd: this.config.startupDirectory,
                    timeout: this.config.startupTimeout,
                    shell: true
                }
            );

            this.status.processId = this.frontendProcess.pid;
            this.status.startupTime = new Date().toISOString();

            logger.info(`Frontend process started with PID: ${this.frontendProcess.pid}`);

            // Handle process events
            this.frontendProcess.on('error', (error) => {
                logger.error(`Frontend process error: ${error.message}`);
                this.handleProcessError(error);
            });

            this.frontendProcess.on('exit', (code, signal) => {
                logger.info(`Frontend process exited with code ${code}, signal ${signal}`);
                this.handleProcessExit(code, signal);
            });

            this.frontendProcess.stdout.on('data', (data) => {
                logger.debug(`Frontend stdout: ${data.toString().trim()}`);
            });

            this.frontendProcess.stderr.on('data', (data) => {
                logger.warn(`Frontend stderr: ${data.toString().trim()}`);
            });

            return {
                success: true,
                pid: this.frontendProcess.pid,
                startupTime: Date.now() - startTime
            };
        } catch (error) {
            logger.error(`Failed to start frontend process: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async waitForFrontendReady() {
        const startTime = Date.now();
        const timeout = this.config.startupTimeout;
        const checkInterval = 2000; // Check every 2 seconds

        return new Promise((resolve) => {
            const checkReady = async () => {
                const elapsed = Date.now() - startTime;

                if (elapsed >= timeout) {
                    logger.error('Frontend ready check timed out');
                    resolve(false);
                    return;
                }

                const isReady = await this.isFrontendRunning();
                if (isReady) {
                    logger.info(`Frontend is ready after ${elapsed}ms`);
                    resolve(true);
                    return;
                }

                // Check again
                setTimeout(checkReady, checkInterval);
            };

            // Start checking after a small delay
            setTimeout(checkReady, 3000);
        });
    }

    async isFrontendRunning() {
        try {
            const response = await httptool.getRequest(this.config.url, {
                timeout: 3000,
                retries: 1
            });

            return response && response.statusCode === 200;
        } catch (error) {
            return false;
        }
    }

    async checkFrontendStatus() {
        try {
            const wasRunning = this.status.running;
            this.status.running = await this.isFrontendRunning();
            this.status.lastChecked = new Date().toISOString();

            // Log status changes
            if (wasRunning !== this.status.running) {
                logger.info(`Frontend status changed: ${wasRunning ? 'running' : 'stopped'} → ${this.status.running ? 'running' : 'stopped'}`);
            }

            return this.status;
        } catch (error) {
            logger.error(`Error checking frontend status: ${error.message}`);
            this.status.running = false;
            this.status.lastChecked = new Date().toISOString();
            return this.status;
        }
    }

    startStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        logger.info('Starting frontend status monitoring...');

        this.statusCheckInterval = setInterval(async () => {
            await this.checkFrontendStatus();
        }, 10000); // Check every 10 seconds

        // Initial check
        this.checkFrontendStatus();
    }

    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
            logger.info('Frontend status monitoring stopped');
        }
    }

    handleProcessError(error) {
        logger.error(`Frontend process error: ${error.message}`);
        this.status.running = false;
        this.status.lastChecked = new Date().toISOString();
    }

    handleProcessExit(code, signal) {
        logger.info(`Frontend process exited (code: ${code}, signal: ${signal})`);
        this.frontendProcess = null;
        this.status.running = false;
        this.status.processId = null;
        this.status.lastChecked = new Date().toISOString();

        // If the process exited unexpectedly, try to restart it
        if (code !== 0 && code !== null && this.startupAttempts < this.maxStartupAttempts) {
            logger.info(`Attempting to restart frontend (attempt ${this.startupAttempts + 1}/${this.maxStartupAttempts})`);
            this.startupAttempts++;
            setTimeout(() => {
                this.startFrontendProcess();
            }, 5000); // Wait 5 seconds before restart
        }
    }

    async stopFrontend() {
        try {
            logger.info('Stopping frontend...');

            // Stop status monitoring
            this.stopStatusMonitoring();

            if (this.frontendProcess) {
                logger.info('Terminating frontend process...');

                // Try graceful shutdown first
                this.frontendProcess.kill('SIGTERM');

                // Wait for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Force kill if still running
                if (this.frontendProcess && !this.frontendProcess.killed) {
                    logger.info('Force killing frontend process...');
                    this.frontendProcess.kill('SIGKILL');
                }

                this.frontendProcess = null;
            }

            this.status.running = false;
            this.status.processId = null;
            this.status.lastChecked = new Date().toISOString();

            logger.info('Frontend stopped successfully');
            return {
                success: true,
                message: 'Frontend stopped successfully'
            };
        } catch (error) {
            logger.error(`Failed to stop frontend: ${error.message}`);
            return {
                success: false,
                message: 'Failed to stop frontend',
                error: error.message
            };
        }
    }

    async restartFrontend() {
        try {
            logger.info('Restarting frontend...');

            // Stop current instance
            const stopResult = await this.stopFrontend();

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Start new instance
            const startResult = await this.launchFrontend();

            return {
                success: startResult.success,
                stopResult: stopResult,
                startResult: startResult
            };
        } catch (error) {
            logger.error(`Failed to restart frontend: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getStatus() {
        return {
            ...this.status,
            hasProcess: this.frontendProcess !== null,
            processId: this.frontendProcess ? this.frontendProcess.pid : null,
            startupAttempts: this.startupAttempts,
            isMonitoring: this.statusCheckInterval !== null
        };
    }

    async getHealthCheck() {
        const status = await this.checkFrontendStatus();
        const processInfo = this.frontendProcess ? {
            pid: this.frontendProcess.pid,
            uptime: Date.now() - (this.status.startupTime ? new Date(this.status.startupTime).getTime() : Date.now())
        } : null;

        return {
            service: 'frontend',
            url: this.config.url,
            status: status.running ? 'healthy' : 'unhealthy',
            process: processInfo,
            lastChecked: status.lastChecked,
            config: {
                startupCommand: this.config.startupCommand,
                startupDirectory: this.config.startupDirectory,
                timeout: this.config.startupTimeout
            }
        };
    }

    async shutdown() {
        try {
            logger.info('Shutting down FrontendLaunchController...');

            // Stop monitoring
            this.stopStatusMonitoring();

            // Stop frontend process
            await this.stopFrontend();

            logger.info('FrontendLaunchController shutdown completed');
        } catch (error) {
            logger.error(`Error during shutdown: ${error.message}`);
        }
    }

    // Static factory method
    static async create() {
        const controller = new FrontendLaunchController();
        await controller.initialize();
        return controller;
    }
}

module.exports = FrontendLaunchController;