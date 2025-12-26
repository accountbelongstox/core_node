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

const { EventEmitter } = require('events');
const logger = require('#@logger');
const LauncherConfig = require('./launcher_config');
const { getAppExecutableLauncher } = require('./app_executable_launcher');
const { SingletonDetector } = require('./singleton_detector');
const { SERVICE_STARTERS } = require('./service_starters');

/**
 * Service Launcher
 *
 * Unified launcher for all services and components.
 * 1:1 port from pycore/pylauncher/launcher.py ServiceLauncher
 *
 * Manages the startup and shutdown of:
 * - App executables (main.cmd, main.bat, main.sh)
 * - RPC servers (Express/HTTP/WebSocket)
 * - Singleton detection
 * - Heartbeat system
 * - Speech system
 * - UI system
 * - Other services via dynamic registration
 */

class ServiceLauncher extends EventEmitter {
    constructor(config) {
        super();

        if (!(config instanceof LauncherConfig)) {
            config = new LauncherConfig(config);
        }

        this.config = config;
        this.services = {};
        this._started = false;
        this.executableLauncher = getAppExecutableLauncher();
        this.singletonDetector = null;
        this.detectionResult = null;

        if (!('heartbeat' in this.config.services)) {
            this.config.services['heartbeat'] = {};
        }
    }

    async start() {
        if (this._started) {
            logger.warn('[Launcher] Already started');
            return false;
        }

        logger.success(`=== Launching ${this.config.appName} ===`);

        if (this.config.singleton && !(await this._singletonDetect())) {
            return false;
        }

        let successCount = 0;
        for (const [name, cfg] of Object.entries(this.config.services)) {
            if (!(name in SERVICE_STARTERS)) {
                logger.error(`[Launcher] Unknown service: ${name}`);
                continue;
            }

            try {
                const instance = SERVICE_STARTERS[name](cfg);
                if (instance) {
                    this.services[name] = instance;
                    successCount++;
                }
            } catch (error) {
                logger.error(`[Launcher] Failed to start ${name}:`, error);
            }
        }

        this._started = true;

        try {
            const threadBus = require('#@thread_bus');
            if (threadBus && threadBus.signal) {
                threadBus.signal('launcher.services.started', {
                    app_name: this.config.appName,
                    services: Object.keys(this.services),
                    success_count: successCount
                });

                threadBus.triggerEvent('system.third_party_packages_loaded', {
                    message: 'All required third-party packages have been loaded',
                    app_name: this.config.appName,
                    services: Object.keys(this.services)
                });
                logger.info('[Launcher] Third-party packages loaded signal sent');
            }
        } catch (error) {
            logger.warn('[Launcher] THREAD_BUS not available:', error.message);
        }

        this.emit('started', {
            appName: this.config.appName,
            services: Object.keys(this.services),
            successCount
        });

        logger.success(`=== Launched ${successCount}/${Object.keys(this.config.services).length} services ===`);
        return successCount > 0;
    }

    async _singletonDetect() {
        logger.info(`[Singleton] Detecting ${this.config.appId}...`);

        const onMsg = (msg) => {
            if (msg.type === 'SHUTDOWN') {
                logger.warn(`[Singleton] Shutdown by new instance (PID ${msg.pid})`);
                try {
                    const threadBus = require('#@thread_bus');
                    if (threadBus && threadBus.requestShutdown) {
                        threadBus.requestShutdown(
                            `Shutdown by new instance (PID ${msg.pid})`,
                            true
                        );
                    } else {
                        this.stop().then(() => process.exit(0));
                    }
                } catch (error) {
                    this.stop().then(() => process.exit(0));
                }
            }
        };

        const stateChecker = () => {
            try {
                const threadBus = require('#@thread_bus');
                if (threadBus && threadBus.isBusy) {
                    const isBusy = threadBus.isBusy();
                    return {
                        canShutdown: !isBusy,
                        message: isBusy ? (threadBus.getBusyReason ? threadBus.getBusyReason() : 'Application is busy') : 'Ready to shutdown'
                    };
                }
            } catch (error) {
                // THREAD_BUS not available
            }
            return {
                canShutdown: true,
                message: 'Ready to shutdown'
            };
        };

        this.singletonDetector = new SingletonDetector({
            appId: this.config.appId,
            portStart: this.config.singletonPortStart,
            portRange: this.config.singletonPortRange,
            debug: true,
            onMessage: onMsg,
            stateChecker: stateChecker,
            shutdownExisting: this.config.shutdownExisting
        });

        const detection = await this.singletonDetector.detectAndBind();
        this.detectionResult = detection;

        if (detection.isPrimary) {
            logger.success(`[Singleton] PRIMARY on port ${detection.port}`);
            return true;
        } else if (detection.existingInstance && !this.config.forceLaunch) {
            logger.warn(`[Singleton] Existing instance at ${detection.existingPort}`);
            logger.warn(`[Singleton] ${detection.message}`);
            return false;
        } else if (this.config.forceLaunch) {
            logger.warn('[Singleton] forceLaunch=true, continuing anyway');
            return true;
        } else {
            logger.error('[Singleton] Failed to become PRIMARY');
            return false;
        }
    }

    async searchAndLaunchAppExecutables(appDirectory, appName) {
        if (!this.config.enableExecutableSearch) {
            return false;
        }

        logger.info('[Launcher] Searching for executable files in app directory...');
        return await this.executableLauncher.searchAndLaunchAppExecutables(appDirectory, appName);
    }

    async stop() {
        if (!this._started) {
            logger.warn('[Launcher] Not started');
            return false;
        }

        logger.warn('[Launcher] Stopping services...');

        try {
            const threadBus = require('#@thread_bus');
            if (threadBus && threadBus.requestShutdown) {
                threadBus.requestShutdown('Launcher shutdown', true);
            }
        } catch (error) {
            logger.warn('[Launcher] THREAD_BUS not available, stopping services manually');
            for (const [name, service] of Object.entries(this.services)) {
                try {
                    if (service && typeof service.stop === 'function') {
                        await service.stop();
                        logger.info(`[Launcher] Stopped service: ${name}`);
                    }
                } catch (error) {
                    logger.error(`[Launcher] Error stopping service ${name}:`, error);
                }
            }
        }

        if (this.singletonDetector) {
            this.singletonDetector.stop();
            this.singletonDetector = null;
        }

        this._started = false;
        this.services = {};
        this.emit('stopped');

        logger.success('[Launcher] All services stopped');
        return true;
    }

    getService(name) {
        return this.services[name] || null;
    }

    isRunning(serviceName = null) {
        if (serviceName === null) {
            return this._started;
        }
        return serviceName in this.services && this.services[serviceName] !== null;
    }
}

function launchServices(config) {
    const launcher = new ServiceLauncher(config);
    launcher.start();
    return launcher;
}

function stopServices(launcher) {
    launcher.stop();
}

module.exports = {
    ServiceLauncher,
    LauncherConfig,
    launchServices,
    stopServices
};
