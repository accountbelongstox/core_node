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

/**
 * Launcher Configuration
 *
 * Unified configuration for application launcher.
 * 1:1 port from pycore/pylauncher/launcher.py LauncherConfig
 *
 * Supports both modern dict-based API and legacy boolean flags.
 */

class LauncherConfig {
    constructor(options = {}) {
        this.services = options.services || {};
        this.appId = options.appId || 'default_app';
        this.appName = options.appName || 'Application';
        this.singleton = options.singleton || false;
        this.singletonPortStart = options.singletonPortStart || 54000;
        this.singletonPortRange = options.singletonPortRange || 100;
        this.forceLaunch = options.forceLaunch || false;
        this.shutdownExisting = options.shutdownExisting || false;

        this.enableTray = options.enableTray || false;
        this.trayBackend = options.trayBackend || 'auto';
        this.trayIconPath = options.trayIconPath || null;
        this.trayMenuItems = options.trayMenuItems || [];

        this.enableHeartbeat = options.enableHeartbeat !== false;
        this.enableRpcV2 = options.enableRpcV2 || false;
        this.rpcV2Port = options.rpcV2Port || 58100;
        this.rpcV2Host = options.rpcV2Host || '0.0.0.0';
        this.rpcV2Debug = options.rpcV2Debug !== false;
        this.enableSpeech = options.enableSpeech || false;
        this.speechMode = options.speechMode || 'single';
        this.enableUi = options.enableUi || false;
        this.singletonCheck = options.singletonCheck || false;

        this.enableExecutableSearch = options.enableExecutableSearch !== false;

        this._convertLegacyToModern();
    }

    _convertLegacyToModern() {
        const legacyUsed = (
            this.enableRpcV2 ||
            this.enableSpeech ||
            this.enableUi ||
            !this.enableHeartbeat
        );

        if (legacyUsed && Object.keys(this.services).length === 0) {
            if (this.enableHeartbeat) {
                this.services['heartbeat'] = {};
            }

            if (this.enableRpcV2) {
                this.services['rpc_v2'] = {
                    port: this.rpcV2Port,
                    host: this.rpcV2Host,
                    debug: this.rpcV2Debug
                };
            }

            if (this.enableSpeech) {
                this.services['speech'] = { mode: this.speechMode };
            }

            if (this.enableUi) {
                this.services['ui'] = {};
            }

            if (this.singletonCheck) {
                this.singleton = true;
            }
        }
    }

    static rpcV2Only(port = 58100, singleton = false) {
        return new LauncherConfig({
            appId: 'rpc_v2_app',
            appName: 'RPC v2 Service',
            singleton: singleton,
            services: {
                heartbeat: {},
                rpc_v2: { port: port, host: '0.0.0.0', debug: true }
            }
        });
    }

    static speechOnly(mode = 'single', singleton = false) {
        return new LauncherConfig({
            appId: 'speech_app',
            appName: 'Speech Service',
            singleton: singleton,
            services: {
                heartbeat: {},
                speech: { mode: mode }
            }
        });
    }

    static withSingleton(appId, port = 18880) {
        return new LauncherConfig({
            appId: appId,
            appName: appId,
            singleton: true,
            singletonPortStart: port,
            enableRpcV2: true,
            rpcV2Port: port
        });
    }

    getSingletonConfig() {
        return {
            port: this.singletonPortStart,
            range: this.singletonPortRange
        };
    }

    getRpcConfig() {
        if (this.services['rpc_v2']) {
            const rpcCfg = this.services['rpc_v2'];
            return {
                port: rpcCfg.port || this.rpcV2Port,
                host: rpcCfg.host || this.rpcV2Host,
                debug: rpcCfg.debug !== undefined ? rpcCfg.debug : this.rpcV2Debug
            };
        }
        return {
            port: this.rpcV2Port,
            host: this.rpcV2Host,
            debug: this.rpcV2Debug
        };
    }
}

module.exports = LauncherConfig;
