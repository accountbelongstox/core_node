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
 * Platform Adapter - Cross-platform Detection and Adaptation
 *
 * Ported from pycore/pyutils/native_ui/platform_adapter.py
 * Adapted for Electron environment with ncore standards
 *
 * Usage:
 *   const { PlatformAdapter } = require('./platform_adapter');
 *   const adapter = new PlatformAdapter();
 *   const isLinux = adapter.isLinux();
 */

const os = require('os');
const logger = require('#@logger');

class PlatformAdapter {
    constructor() {
        this.platform = process.platform;
        this.arch = process.arch;
        this.osRelease = os.release();
        this.osType = os.type();

        this._displayServer = null;
        this._desktopEnvironment = null;
        this._trayBackend = null;
    }

    isWindows() {
        return this.platform === 'win32';
    }

    isLinux() {
        return this.platform === 'linux';
    }

    isMacOS() {
        return this.platform === 'darwin';
    }

    isX11() {
        if (!this.isLinux()) {
            return false;
        }

        if (this._displayServer === null) {
            try {
                const displayEnv = process.env.DISPLAY;
                const waylandEnv = process.env.WAYLAND_DISPLAY;

                if (waylandEnv) {
                    this._displayServer = 'wayland';
                } else if (displayEnv) {
                    this._displayServer = 'x11';
                } else {
                    const xdgSession = process.env.XDG_SESSION_TYPE;
                    if (xdgSession === 'wayland') {
                        this._displayServer = 'wayland';
                    } else if (xdgSession === 'x11') {
                        this._displayServer = 'x11';
                    } else {
                        this._displayServer = 'unknown';
                    }
                }
            } catch (error) {
                logger.warn('[PlatformAdapter] Failed to detect display server:', error);
                this._displayServer = 'unknown';
            }
        }

        return this._displayServer === 'x11';
    }

    isWayland() {
        if (!this.isLinux()) {
            return false;
        }

        this.isX11();

        return this._displayServer === 'wayland';
    }

    getDesktopEnvironment() {
        if (this._desktopEnvironment !== null) {
            return this._desktopEnvironment;
        }

        if (!this.isLinux()) {
            this._desktopEnvironment = 'none';
            return this._desktopEnvironment;
        }

        try {
            const desktopEnv = process.env.XDG_CURRENT_DESKTOP ||
                              process.env.DESKTOP_SESSION ||
                              process.env.GDMSESSION;

            if (desktopEnv) {
                this._desktopEnvironment = desktopEnv.toLowerCase();
            } else {
                this._desktopEnvironment = 'unknown';
            }
        } catch (error) {
            logger.warn('[PlatformAdapter] Failed to detect desktop environment:', error);
            this._desktopEnvironment = 'unknown';
        }

        return this._desktopEnvironment;
    }

    getTrayBackend() {
        if (this._trayBackend !== null) {
            return this._trayBackend;
        }

        if (this.isWindows()) {
            this._trayBackend = 'win32';
        } else if (this.isMacOS()) {
            this._trayBackend = 'darwin';
        } else if (this.isLinux()) {
            const de = this.getDesktopEnvironment();

            if (de.includes('gnome')) {
                this._trayBackend = 'appindicator';
            } else if (de.includes('kde') || de.includes('plasma')) {
                this._trayBackend = 'statusnotifier';
            } else if (de.includes('xfce') || de.includes('mate')) {
                this._trayBackend = 'gtk';
            } else if (this.isWayland()) {
                this._trayBackend = 'appindicator';
            } else {
                this._trayBackend = 'gtk';
            }
        } else {
            this._trayBackend = 'unknown';
        }

        logger.info(`[PlatformAdapter] Detected tray backend: ${this._trayBackend}`);
        return this._trayBackend;
    }

    supportsSystemTray() {
        const backend = this.getTrayBackend();
        return backend !== 'unknown' && backend !== 'none';
    }

    supportsTransparentWindow() {
        if (this.isWindows()) {
            return true;
        } else if (this.isMacOS()) {
            return true;
        } else if (this.isLinux()) {
            return this.isX11();
        }
        return false;
    }

    supportsCustomTitleBar() {
        return true;
    }

    getDefaultIconSize() {
        if (this.isWindows()) {
            return { width: 256, height: 256 };
        } else if (this.isMacOS()) {
            return { width: 512, height: 512 };
        } else if (this.isLinux()) {
            return { width: 256, height: 256 };
        }
        return { width: 256, height: 256 };
    }

    getDefaultTrayIconSize() {
        if (this.isWindows()) {
            return { width: 16, height: 16 };
        } else if (this.isMacOS()) {
            return { width: 22, height: 22 };
        } else if (this.isLinux()) {
            return { width: 24, height: 24 };
        }
        return { width: 16, height: 16 };
    }

    getEnvironmentInfo() {
        return {
            platform: this.platform,
            arch: this.arch,
            osRelease: this.osRelease,
            osType: this.osType,
            displayServer: this._displayServer || 'unknown',
            desktopEnvironment: this.getDesktopEnvironment(),
            trayBackend: this.getTrayBackend(),
            supportsSystemTray: this.supportsSystemTray(),
            supportsTransparentWindow: this.supportsTransparentWindow(),
            supportsCustomTitleBar: this.supportsCustomTitleBar()
        };
    }

    adaptElectronConfig(config) {
        const adapted = { ...config };

        if (!this.supportsSystemTray() && adapted.systemTray) {
            logger.warn('[PlatformAdapter] System tray not supported, disabling');
            adapted.systemTray = null;
        }

        if (!this.supportsTransparentWindow() && adapted.mainWindow?.transparent) {
            logger.warn('[PlatformAdapter] Transparent windows not supported, disabling');
            adapted.mainWindow.transparent = false;
        }

        if (this.isLinux()) {
            if (this.isWayland()) {
                logger.info('[PlatformAdapter] Wayland detected, applying optimizations');
                if (adapted.mainWindow) {
                    adapted.hardwareAcceleration = true;
                }
            }

            if (adapted.mainWindow?.frame === false && !adapted.mainWindow?.useCustomTitleBar) {
                logger.warn('[PlatformAdapter] Frameless window without custom title bar may have issues on Linux');
            }
        }

        if (this.isMacOS()) {
            if (adapted.mainWindow && !adapted.mainWindow.titleBarStyle) {
                adapted.mainWindow.titleBarStyle = 'hiddenInset';
            }
        }

        return adapted;
    }
}

let _globalAdapter = null;

function getGlobalPlatformAdapter() {
    if (_globalAdapter === null) {
        _globalAdapter = new PlatformAdapter();
    }
    return _globalAdapter;
}

module.exports = {
    PlatformAdapter,
    getGlobalPlatformAdapter
};
