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
 * Electron App Launcher - Unified Application Launcher
 *
 * Ported from pycore/pyutils/native_ui/step3_launcher/launch_native_app.py
 * Adapted for Electron environment with ncore standards
 *
 * Main entry point for launching Electron applications with integrated features:
 * - Platform adaptation
 * - Port management
 * - Frontend auto-start
 * - Single instance enforcement
 * - System tray integration
 *
 * Usage:
 *   const { launchElectronApp } = require('./app_launcher');
 *   const result = await launchElectronApp({
 *       appName: 'MyApp',
 *       mainWindow: { width: 1200, height: 800 },
 *       systemTray: { enabled: true },
 *       frontend: { enabled: true, framework: 'vite', appDir: './frontend' }
 *   });
 */

const logger = require('#@logger');
const { getGlobalPlatformAdapter } = require('./platform_adapter');
const { getGlobalPortManager } = require('./port_manager');
const { FrontendConfig, startFrontendIfNeeded } = require('./frontend');

let _isLaunched = false;
let _launchedAppName = null;
let _electronManager = null;
let _frontendManager = null;

async function launchElectronApp(config = {}) {
    if (_isLaunched) {
        logger.warn(`[ElectronLauncher] Application already launched: ${_launchedAppName}`);
        throw new Error(`Electron app already launched: ${_launchedAppName}`);
    }

    try {
        const appName = config.appName || 'ElectronApp';
        logger.info(`[ElectronLauncher] Launching ${appName}...`);

        const platformAdapter = getGlobalPlatformAdapter();
        logger.info('[ElectronLauncher] Platform info:', platformAdapter.getEnvironmentInfo());

        const adaptedConfig = platformAdapter.adaptElectronConfig(config);

        const portManager = getGlobalPortManager();

        if (adaptedConfig.singleInstance) {
            const singleInstancePort = adaptedConfig.singleInstancePort || 58099;

            const isPortAvailable = await portManager.isPortAvailable(singleInstancePort);
            if (!isPortAvailable) {
                logger.warn(`[ElectronLauncher] Single instance port ${singleInstancePort} in use`);
                logger.warn(`[ElectronLauncher] Another instance of ${appName} is already running`);
                throw new Error(`Single instance violation: ${appName} already running`);
            }

            await portManager.allocatePort(singleInstancePort);
            logger.success(`[ElectronLauncher] Single instance lock acquired on port ${singleInstancePort}`);
        }

        if (adaptedConfig.frontend) {
            logger.info('[ElectronLauncher] Frontend configuration detected');

            let frontendConfig;

            if (adaptedConfig.frontend instanceof FrontendConfig) {
                frontendConfig = adaptedConfig.frontend;
            } else {
                frontendConfig = new FrontendConfig({
                    enabled: adaptedConfig.frontend.enabled !== false,
                    framework: adaptedConfig.frontend.framework || 'vite',
                    appDir: adaptedConfig.frontend.appDir,
                    mode: adaptedConfig.frontend.mode || 'production',
                    port: adaptedConfig.frontend.port || 3000,
                    host: adaptedConfig.frontend.host || '0.0.0.0',
                    autoInstall: adaptedConfig.frontend.autoInstall !== false,
                    showOutput: true,
                    blockUntilReady: adaptedConfig.frontend.blockUntilReady || false,
                    devCommand: adaptedConfig.frontend.devCommand || null
                });
            }

            if (frontendConfig.enabled) {
                const allocatedPort = await portManager.allocatePort(frontendConfig.port);
                frontendConfig.port = allocatedPort;

                const frontendUrl = `http://${frontendConfig.host === '0.0.0.0' ? 'localhost' : frontendConfig.host}:${allocatedPort}`;
                logger.info(`[ElectronLauncher] Frontend URL: ${frontendUrl}`);

                if (adaptedConfig.mainWindow) {
                    adaptedConfig.mainWindow.url = frontendUrl;
                }

                try {
                    _frontendManager = await startFrontendIfNeeded(frontendConfig, true);

                    if (config.onFrontendReady && typeof config.onFrontendReady === 'function') {
                        await config.onFrontendReady(_frontendManager);
                    }
                } catch (error) {
                    logger.error('[ElectronLauncher] Frontend failed to start:', error);
                    throw error;
                }
            }
        }

        const ElectronManager = require('./index');
        _electronManager = new ElectronManager();

        await _electronManager.initialize(adaptedConfig);

        if (config.onReady && typeof config.onReady === 'function') {
            logger.info('[ElectronLauncher] Calling onReady callback...');
            await config.onReady(_electronManager);
        }

        if (adaptedConfig.systemTray && _electronManager.tray) {
            if (config.onTrayCreated && typeof config.onTrayCreated === 'function') {
                logger.info('[ElectronLauncher] Calling onTrayCreated callback...');
                await config.onTrayCreated(_electronManager.tray);
            }
        }

        _isLaunched = true;
        _launchedAppName = appName;

        logger.success(`[ElectronLauncher] ${appName} launched successfully`);

        return {
            manager: _electronManager,
            frontend: _frontendManager,
            config: adaptedConfig,
            platformAdapter: platformAdapter,
            portManager: portManager
        };

    } catch (error) {
        logger.error('[ElectronLauncher] Failed to launch application:', error);

        if (config.onError && typeof config.onError === 'function') {
            await config.onError(error);
        }

        const portManager = getGlobalPortManager();
        portManager.releaseAllPorts();

        throw error;
    }
}

function isElectronAppLaunched() {
    return _isLaunched;
}

function getLaunchedAppName() {
    return _launchedAppName;
}

function getElectronManager() {
    return _electronManager;
}

function getFrontendManager() {
    return _frontendManager;
}

module.exports = {
    launchElectronApp,
    isElectronAppLaunched,
    getLaunchedAppName,
    getElectronManager,
    getFrontendManager
};
