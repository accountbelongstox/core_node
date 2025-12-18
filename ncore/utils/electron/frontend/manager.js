// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * Frontend Manager - Automatic Frontend Server Management
 *
 * Ported from pycore/pyutils/native_ui/step9_frontend/frontend_thread.py
 * Adapted for Electron environment with ncore standards
 *
 * Usage:
 *   const { FrontendManager } = require('./manager');
 *   const manager = new FrontendManager(config);
 *   await manager.start();
 */

const { spawn } = require('child_process');
const http = require('http');
const EventEmitter = require('events');
const logger = require('#@logger');

function resolveCommandForPlatform(command) {
    if (process.platform !== 'win32') {
        return command;
    }

    const npmTools = ['npm', 'pnpm', 'npx', 'yarn', 'node'];
    if (command && command.length > 0 && npmTools.includes(command[0])) {
        const resolved = [...command];
        resolved[0] = `${command[0]}.cmd`;
        return resolved;
    }

    return command;
}

class FrontendManager extends EventEmitter {
    constructor(config) {
        super();

        this.config = config;
        this.process = null;
        this.running = false;
        this.ready = false;
        this.errorMessage = null;
        this._healthCheckInterval = null;

        logger.info(`[FrontendManager] Initialized: ${config.framework} (${config.mode})`);
        logger.info(`[FrontendManager] App directory: ${config.appDir}`);
    }

    async start() {
        if (this.running) {
            logger.warn('[FrontendManager] Already running');
            return;
        }

        this.running = true;

        try {
            if (this.config.autoInstall) {
                logger.info('[FrontendManager] Installing dependencies...');
                await this._installDependencies();
            }

            if (this.config.mode === 'production') {
                if (!this.config.skipBuild) {
                    logger.info('[FrontendManager] Building frontend...');
                    await this._buildFrontend();
                }

                logger.success('[FrontendManager] Frontend built successfully');
                this.ready = true;
                this.emit('ready');
            } else {
                logger.info('[FrontendManager] Starting dev server...');
                await this._startDevServer();
            }

        } catch (error) {
            logger.error('[FrontendManager] Failed to start:', error);
            this.errorMessage = error.message;
            this.running = false;
            this.emit('error', error);
            throw error;
        }
    }

    async _installDependencies() {
        const command = this.config.getInstallCommand();
        const resolved = resolveCommandForPlatform(command);

        return new Promise((resolve, reject) => {
            logger.info(`[FrontendManager] Running: ${resolved.join(' ')}`);

            const proc = spawn(resolved[0], resolved.slice(1), {
                cwd: this.config.appDir,
                stdio: this.config.showOutput ? 'inherit' : 'pipe',
                shell: true,
                env: { ...process.env, ...this.config.envVars }
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    logger.success('[FrontendManager] Dependencies installed');
                    resolve();
                } else {
                    reject(new Error(`Dependency installation failed with code ${code}`));
                }
            });

            proc.on('error', (error) => {
                reject(error);
            });
        });
    }

    async _buildFrontend() {
        const command = this.config.getBuildCommand();
        const resolved = resolveCommandForPlatform(command);

        return new Promise((resolve, reject) => {
            logger.info(`[FrontendManager] Running: ${resolved.join(' ')}`);

            const proc = spawn(resolved[0], resolved.slice(1), {
                cwd: this.config.appDir,
                stdio: this.config.showOutput ? 'inherit' : 'pipe',
                shell: true,
                env: { ...process.env, ...this.config.envVars }
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    logger.success('[FrontendManager] Build completed');
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });

            proc.on('error', (error) => {
                reject(error);
            });
        });
    }

    async _startDevServer() {
        const command = this.config.getDevCommand();
        const resolved = resolveCommandForPlatform(command);

        logger.info(`[FrontendManager] Running: ${resolved.join(' ')}`);

        this.process = spawn(resolved[0], resolved.slice(1), {
            cwd: this.config.appDir,
            stdio: this.config.showOutput ? 'inherit' : 'pipe',
            shell: true,
            env: {
                ...process.env,
                PORT: this.config.port.toString(),
                HOST: this.config.host,
                ...this.config.envVars
            }
        });

        this.process.on('error', (error) => {
            logger.error('[FrontendManager] Process error:', error);
            this.errorMessage = error.message;
            this.emit('error', error);
        });

        this.process.on('close', (code) => {
            logger.warn(`[FrontendManager] Process exited with code ${code}`);
            this.running = false;
            this.ready = false;
            this.emit('close', code);
        });

        await this._waitForReady();
    }

    async _waitForReady() {
        const maxWaitTime = this.config.healthCheckTimeout * 1000;
        const startTime = Date.now();
        const checkInterval = 1000;

        logger.info('[FrontendManager] Waiting for dev server...');

        return new Promise((resolve, reject) => {
            const checkHealth = () => {
                const elapsed = Date.now() - startTime;

                if (elapsed > maxWaitTime) {
                    clearInterval(this._healthCheckInterval);
                    const error = new Error('Frontend health check timeout');
                    this.errorMessage = error.message;
                    reject(error);
                    return;
                }

                this._checkHealth()
                    .then(isHealthy => {
                        if (isHealthy) {
                            clearInterval(this._healthCheckInterval);
                            this.ready = true;
                            logger.success(`[FrontendManager] Dev server ready at ${this.config.getDevUrl()}`);
                            this.emit('ready');
                            resolve();
                        }
                    })
                    .catch(() => {});
            };

            this._healthCheckInterval = setInterval(checkHealth, checkInterval);
            checkHealth();
        });
    }

    async _checkHealth() {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: this.config.port,
                path: this.config.healthPath,
                method: 'GET',
                timeout: 3000
            };

            const req = http.request(options, (res) => {
                resolve(res.statusCode === 200 || res.statusCode === 304);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    async stop() {
        if (!this.running) {
            return;
        }

        logger.info('[FrontendManager] Stopping frontend...');

        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
        }

        if (this.process) {
            this.process.kill('SIGTERM');
            this.process = null;
        }

        this.running = false;
        this.ready = false;

        logger.success('[FrontendManager] Frontend stopped');
        this.emit('stopped');
    }

    isReady() {
        return this.ready;
    }

    isRunning() {
        return this.running;
    }

    getUrl() {
        return this.config.getDevUrl();
    }

    getError() {
        return this.errorMessage;
    }
}

async function startFrontendIfNeeded(config, blockUntilReady = null) {
    if (!config.enabled) {
        logger.warn('[Frontend] Frontend disabled in config');
        return null;
    }

    logger.info('[Frontend] ========================================');
    logger.info('[Frontend] STARTING FRONTEND SERVICE');
    logger.info('[Frontend] ========================================');
    logger.info(`[Frontend] Framework: ${config.framework}`);
    logger.info(`[Frontend] Mode: ${config.mode}`);
    logger.info(`[Frontend] App Dir: ${config.appDir}`);
    logger.info(`[Frontend] Port: ${config.port}`);
    logger.info('[Frontend] ========================================');

    const manager = new FrontendManager(config);

    const shouldBlock = blockUntilReady !== null ? blockUntilReady : config.blockUntilReady;

    if (shouldBlock) {
        logger.warn('[Frontend] Blocking until ready...');
        await manager.start();

        logger.success('[Frontend] ========================================');
        logger.success('[Frontend] FRONTEND READY');
        logger.success('[Frontend] ========================================');

        if (config.mode === 'dev') {
            logger.success(`[Frontend] Dev URL: ${manager.getUrl()}`);
        } else {
            logger.success(`[Frontend] Static files: ${config.staticDir}`);
        }

        logger.success('[Frontend] ========================================');
    } else {
        manager.start().catch(error => {
            logger.error('[Frontend] Failed to start:', error);
        });
        logger.info('[Frontend] Started in background');
    }

    return manager;
}

module.exports = {
    FrontendManager,
    startFrontendIfNeeded
};
