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
 * Platform Detector - Detects system environment for headless/headed mode
 */

const os = require('os');
const { exec } = require('child_process');

const logger = require('#@logger');

class PlatformDetector {
    constructor() {
        this.platform = os.platform();
        this.isDesktop = null;
        this.hasDisplay = null;
    }

    /**
     * Check if running on a desktop system with display
     * @returns {Promise<boolean>}
     */
    async isDesktopSystem() {
        if (this.isDesktop !== null) {
            return this.isDesktop;
        }

        this.isDesktop = await this._detectDesktop();
        return this.isDesktop;
    }

    /**
     * Internal desktop detection
     * @returns {Promise<boolean>}
     */
    async _detectDesktop() {
        // Windows detection
        if (this.platform === 'win32') {
            return this._detectWindowsDesktop();
        }

        // macOS always has GUI when running
        if (this.platform === 'darwin') {
            return true;
        }

        // Linux detection
        if (this.platform === 'linux') {
            return this._detectLinuxDesktop();
        }

        // Default to headless for unknown platforms
        return false;
    }

    /**
     * Detect Windows desktop environment
     * @returns {Promise<boolean>}
     */
    async _detectWindowsDesktop() {
        return new Promise((resolve) => {
            // Check if explorer.exe is running (desktop session)
            exec('tasklist /FI "IMAGENAME eq explorer.exe" /NH', (error, stdout) => {
                if (error) {
                    logger.warn('[PlatformDetector] Failed to detect Windows desktop:', error.message);
                    resolve(false);
                    return;
                }

                const hasExplorer = stdout.toLowerCase().includes('explorer.exe');
                logger.info(`[PlatformDetector] Windows desktop detected: ${hasExplorer}`);
                resolve(hasExplorer);
            });
        });
    }

    /**
     * Detect Linux desktop environment
     * @returns {Promise<boolean>}
     */
    async _detectLinuxDesktop() {
        // Check DISPLAY environment variable
        const display = process.env.DISPLAY;
        if (display) {
            logger.info(`[PlatformDetector] Linux DISPLAY detected: ${display}`);
            this.hasDisplay = true;
            return true;
        }

        // Check XDG_SESSION_TYPE
        const sessionType = process.env.XDG_SESSION_TYPE;
        if (sessionType === 'x11' || sessionType === 'wayland') {
            logger.info(`[PlatformDetector] Linux session type: ${sessionType}`);
            this.hasDisplay = true;
            return true;
        }

        // Check if X server is running
        return new Promise((resolve) => {
            exec('xdpyinfo 2>/dev/null | head -n 1', (error, stdout) => {
                if (error || !stdout) {
                    logger.info('[PlatformDetector] No X display detected');
                    this.hasDisplay = false;
                    resolve(false);
                    return;
                }

                this.hasDisplay = true;
                resolve(true);
            });
        });
    }

    /**
     * Get browser launch options based on platform
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    async getBrowserOptions(options = {}) {
        const isDesktop = await this.isDesktopSystem();

        const baseOptions = {
            headless: !isDesktop,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security'
            ]
        };

        // Desktop-specific options
        if (isDesktop) {
            baseOptions.args.push('--start-maximized');
            logger.info('[PlatformDetector] Using headed browser mode (desktop detected)');
        } else {
            baseOptions.args.push('--disable-gpu');
            logger.info('[PlatformDetector] Using headless browser mode (no desktop detected)');
        }

        return { ...baseOptions, ...options };
    }

    /**
     * Get platform information
     * @returns {Object}
     */
    getInfo() {
        return {
            platform: this.platform,
            arch: os.arch(),
            release: os.release(),
            type: os.type(),
            isDesktop: this.isDesktop,
            hasDisplay: this.hasDisplay,
            hostname: os.hostname(),
            userInfo: os.userInfo().username
        };
    }
}

const platformDetector = new PlatformDetector();

module.exports = {
    PlatformDetector,
    platformDetector
};
