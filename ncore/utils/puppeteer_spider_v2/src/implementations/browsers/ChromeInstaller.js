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

'use strict';

const logger = require('#@logger');
const { execSync } = require('child_process');
const path = require('path');
const ChromeFinder = require('./ChromeFinder');

class ChromeInstaller {
    constructor() {
        this.platform = process.platform;
        this.finder = new ChromeFinder();
    }

    async install() {
        try {
            logger.info('Installing Google Chrome...');
            
            if (this.platform === 'win32') {
                return await this.installWindows();
            } else if (this.platform === 'linux') {
                return await this.installLinux();
            } else if (this.platform === 'darwin') {
                return await this.installMacOS();
            } else {
                throw new Error(`Unsupported platform: ${this.platform}`);
            }
        } catch (error) {
            logger.error('Failed to install Chrome:', error);
            throw error;
        }
    }

    async installWindows() {
        try {
            logger.info('Installing Google Chrome on Windows...');
            
            // Try different installation methods
            const methods = [
                () => this.installWindowsWinget(),
                () => this.installWindowsChocolatey(),
                () => this.installWindowsDirect()
            ];
            
            for (const method of methods) {
                try {
                    await method();
                    logger.info('Google Chrome installed successfully on Windows');
                    return true;
                } catch (error) {
                    logger.debug(`Windows installation method failed: ${error.message}`);
                    continue;
                }
            }
            
            throw new Error('All Windows installation methods failed');
        } catch (error) {
            logger.error('Failed to install Chrome on Windows:', error);
            throw error;
        }
    }

    async installWindowsWinget() {
        try {
            logger.info('Installing Chrome via winget...');
            
            if (!this.isWingetAvailable()) {
                throw new Error('winget is not available');
            }
            
            const command = 'winget install Google.Chrome --accept-package-agreements --accept-source-agreements';
            execSync(command, { stdio: 'inherit', timeout: 300000 });
            
            return true;
        } catch (error) {
            logger.debug('winget installation failed:', error.message);
            throw error;
        }
    }

    async installWindowsChocolatey() {
        try {
            logger.info('Installing Chrome via Chocolatey...');
            
            if (!this.isChocolateyAvailable()) {
                throw new Error('Chocolatey is not available');
            }
            
            const command = 'choco install googlechrome -y';
            execSync(command, { stdio: 'inherit', timeout: 300000 });
            
            return true;
        } catch (error) {
            logger.debug('Chocolatey installation failed:', error.message);
            throw error;
        }
    }

    async installWindowsDirect() {
        try {
            logger.info('Installing Chrome via direct download...');
            
            const downloadUrl = 'https://dl.google.com/chrome/install/375.126/chrome_installer.exe';
            const installerPath = path.join(process.env.TEMP, 'chrome_installer.exe');
            
            // Download installer
            const https = require('https');
            const fs = require('fs');
            
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(installerPath);
                https.get(downloadUrl, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });
            
            // Run installer
            execSync(`"${installerPath}" /silent /install`, { timeout: 300000 });
            
            // Cleanup
            fs.unlinkSync(installerPath);
            
            return true;
        } catch (error) {
            logger.debug('Direct installation failed:', error.message);
            throw error;
        }
    }

    async installLinux() {
        try {
            logger.info('Installing Google Chrome on Linux...');
            
            // Try different installation methods
            const methods = [
                () => this.installLinuxApt(),
                () => this.installLinuxSnap(),
                () => this.installLinuxFlatpak(),
                () => this.installLinuxDirect()
            ];
            
            for (const method of methods) {
                try {
                    await method();
                    logger.info('Google Chrome installed successfully on Linux');
                    return true;
                } catch (error) {
                    logger.debug(`Linux installation method failed: ${error.message}`);
                    continue;
                }
            }
            
            throw new Error('All Linux installation methods failed');
        } catch (error) {
            logger.error('Failed to install Chrome on Linux:', error);
            throw error;
        }
    }

    async installLinuxApt() {
        try {
            logger.info('Installing Chrome via APT...');
            
            // Add Google GPG key
            execSync('wget -qO- https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -', { timeout: 30000 });
            
            // Add Google repository
            execSync('echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list', { timeout: 30000 });
            
            // Update package list
            execSync('sudo apt update', { timeout: 60000 });
            
            // Install Chrome
            execSync('sudo apt install -y google-chrome-stable', { timeout: 300000 });
            
            return true;
        } catch (error) {
            logger.debug('APT installation failed:', error.message);
            throw error;
        }
    }

    async installLinuxSnap() {
        try {
            logger.info('Installing Chrome via Snap...');
            
            if (!this.isSnapAvailable()) {
                throw new Error('Snap is not available');
            }
            
            execSync('sudo snap install chromium', { timeout: 300000 });
            
            return true;
        } catch (error) {
            logger.debug('Snap installation failed:', error.message);
            throw error;
        }
    }

    async installLinuxFlatpak() {
        try {
            logger.info('Installing Chrome via Flatpak...');
            
            if (!this.isFlatpakAvailable()) {
                throw new Error('Flatpak is not available');
            }
            
            execSync('flatpak install -y flathub com.google.Chrome', { timeout: 300000 });
            
            return true;
        } catch (error) {
            logger.debug('Flatpak installation failed:', error.message);
            throw error;
        }
    }

    async installLinuxDirect() {
        try {
            logger.info('Installing Chrome via direct download...');
            
            const downloadUrl = 'https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb';
            const debPath = '/tmp/google-chrome-stable_current_amd64.deb';
            
            // Download DEB package
            execSync(`wget -O "${debPath}" "${downloadUrl}"`, { timeout: 300000 });
            
            // Install DEB package
            execSync(`sudo dpkg -i "${debPath}"`, { timeout: 300000 });
            
            // Fix dependencies
            execSync('sudo apt-get install -f -y', { timeout: 300000 });
            
            // Cleanup
            execSync(`rm "${debPath}"`);
            
            return true;
        } catch (error) {
            logger.debug('Direct installation failed:', error.message);
            throw error;
        }
    }

    async installMacOS() {
        try {
            logger.info('Installing Google Chrome on macOS...');
            
            // Try different installation methods
            const methods = [
                () => this.installMacOSHomebrew(),
                () => this.installMacOSDirect()
            ];
            
            for (const method of methods) {
                try {
                    await method();
                    logger.info('Google Chrome installed successfully on macOS');
                    return true;
                } catch (error) {
                    logger.debug(`macOS installation method failed: ${error.message}`);
                    continue;
                }
            }
            
            throw new Error('All macOS installation methods failed');
        } catch (error) {
            logger.error('Failed to install Chrome on macOS:', error);
            throw error;
        }
    }

    async installMacOSHomebrew() {
        try {
            logger.info('Installing Chrome via Homebrew...');
            
            if (!this.isHomebrewAvailable()) {
                throw new Error('Homebrew is not available');
            }
            
            execSync('brew install --cask google-chrome', { timeout: 300000 });
            
            return true;
        } catch (error) {
            logger.debug('Homebrew installation failed:', error.message);
            throw error;
        }
    }

    async installMacOSDirect() {
        try {
            logger.info('Installing Chrome via direct download...');
            
            const downloadUrl = 'https://dl.google.com/chrome/mac/stable/GGRO/googlechrome.dmg';
            const dmgPath = '/tmp/googlechrome.dmg';
            const mountPath = '/tmp/chrome_mount';
            
            // Download DMG
            execSync(`curl -L -o "${dmgPath}" "${downloadUrl}"`, { timeout: 300000 });
            
            // Mount DMG
            execSync(`mkdir -p "${mountPath}"`);
            execSync(`hdiutil attach "${dmgPath}" -mountpoint "${mountPath}"`);
            
            // Install Chrome
            execSync(`cp -R "${mountPath}/Google Chrome.app" /Applications/`);
            
            // Unmount DMG
            execSync(`hdiutil detach "${mountPath}"`);
            
            // Cleanup
            execSync(`rm "${dmgPath}"`);
            execSync(`rmdir "${mountPath}"`);
            
            return true;
        } catch (error) {
            logger.debug('Direct installation failed:', error.message);
            throw error;
        }
    }

    isWingetAvailable() {
        try {
            execSync('winget --version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    isChocolateyAvailable() {
        try {
            execSync('choco --version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    isSnapAvailable() {
        try {
            execSync('snap --version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    isFlatpakAvailable() {
        try {
            execSync('flatpak --version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    isHomebrewAvailable() {
        try {
            execSync('brew --version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    async isInstalled() {
        try {
            const chromePath = await this.finder.find();
            return chromePath !== null;
        } catch (error) {
            return false;
        }
    }

    async getInstalledVersion() {
        try {
            const chromePath = await this.finder.find();
            if (chromePath) {
                return await this.finder.getVersion(chromePath);
            }
            return null;
        } catch (error) {
            logger.error('Failed to get installed Chrome version:', error);
            return null;
        }
    }

    getInfo() {
        return {
            platform: this.platform,
            installer: 'ChromeInstaller',
            methods: {
                windows: ['winget', 'chocolatey', 'direct'],
                linux: ['apt', 'snap', 'flatpak', 'direct'],
                darwin: ['homebrew', 'direct']
            }
        };
    }
}

module.exports = ChromeInstaller;
