const { spawn } = require('child_process');
const path = require('path');

class TrayLauncher {
    constructor() {
        this.process = null;
        this.isRunning = false;
    }

    async launch(config = {}) {
        if (this.isRunning) {
            console.log('[TrayLauncher] Tray already running');
            return;
        }

        try {
            const electronPath = require('electron');
            const trayAppPath = path.join(__dirname, 'tray_app.js');

            const trayConfig = {
                iconPath: config.iconPath || null,
                tooltip: config.tooltip || 'Application',
                appTitle: config.appTitle || 'Application',
                frontendUrl: config.frontendUrl || null,
                backendUrl: config.backendUrl || null
            };

            const configJson = Buffer.from(JSON.stringify(trayConfig)).toString('base64');

            this.process = spawn(electronPath, [trayAppPath, `--config=${configJson}`], {
                stdio: 'inherit',
                detached: false
            });

            this.process.on('error', (error) => {
                console.error('[TrayLauncher] Failed to start tray:', error.message);
                this.isRunning = false;
            });

            this.process.on('exit', (code) => {
                console.log(`[TrayLauncher] Tray process exited with code ${code}`);
                this.isRunning = false;
            });

            this.isRunning = true;
            console.log('[TrayLauncher] Tray launched successfully');
        } catch (error) {
            console.error('[TrayLauncher] Failed to launch tray:', error.message);
            throw error;
        }
    }

    async shutdown() {
        if (!this.process || !this.isRunning) {
            return;
        }

        console.log('[TrayLauncher] Shutting down tray...');
        this.process.kill();
        this.isRunning = false;
    }
}

let instance = null;

function getInstance() {
    if (!instance) {
        instance = new TrayLauncher();
    }
    return instance;
}

module.exports = {
    TrayLauncher,
    getInstance
};
