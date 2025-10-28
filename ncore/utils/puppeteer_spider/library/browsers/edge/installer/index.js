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
const { execSync, spawn } = require('child_process');
const EdgeFinder = require('../finder');

class EdgeInstaller {
    constructor() {
        this.platform = process.platform;
        this.finder = new EdgeFinder();
    }

    // Install Edge on Windows using winget
    async installEdgeWindows() {
        if (this.platform !== 'win32') {
            throw new Error('Windows installation method called on non-Windows platform');
        }
        
        try {
            logger.info('Installing Microsoft Edge on Windows using winget...');
            
            // Check if winget is available
            if (!this.isWingetAvailable()) {
                throw new Error('winget is not available on this system');
            }
            
            // Install Edge using winget
            const command = 'winget install Microsoft.Edge --accept-package-agreements --accept-source-agreements';
            execSync(command, { stdio: 'inherit', timeout: 300000 }); // 5 minutes timeout
            
            logger.info('Microsoft Edge installed successfully via winget');
            return true;
            
        } catch (error) {
            logger.error('Failed to install Edge on Windows:', error.message);
            throw error;
        }
    }

    // Install Edge on Linux
    async installEdgeLinux() {
        if (this.platform !== 'linux') {
            throw new Error('Linux installation method called on non-Linux platform');
        }
        
        try {
            logger.info('Installing Microsoft Edge on Linux...');
            
            // Try different installation methods
            const methods = [
                () => this.installEdgeLinuxApt(),
                () => this.installEdgeLinuxSnap(),
                () => this.installEdgeLinuxDirect()
            ];
            
            for (const method of methods) {
                try {
                    await method();
                    logger.info('Microsoft Edge installed successfully');
                    return true;
                } catch (error) {
                    logger.debug(`Installation method failed: ${error.message}`);
                    continue;
                }
            }
            
            throw new Error('All installation methods failed');
            
        } catch (error) {
            logger.error('Failed to install Edge on Linux:', error.message);
            throw error;
        }
    }

    // Install Edge on Linux using APT
    async installEdgeLinuxApt() {
        try {
            logger.info('Installing Edge via APT...');
            
            // Add Microsoft GPG key
            execSync('wget -qO- https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -', { timeout: 30000 });
            
            // Add Microsoft repository
            execSync('echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge/ stable main" | sudo tee /etc/apt/sources.list.d/microsoft-edge.list', { timeout: 30000 });
            
            // Update package list
            execSync('sudo apt update', { timeout: 60000 });
            
            // Install Edge
            execSync('sudo apt install -y microsoft-edge-stable', { timeout: 300000 });
            
            logger.info('Edge installed via APT');
            return true;
            
        } catch (error) {
            logger.debug('APT installation failed:', error.message);
            throw error;
        }
    }

    // Install Edge on Linux using Snap
    async installEdgeLinuxSnap() {
        try {
            logger.info('Installing Edge via Snap...');
            
            // Check if snap is available
            execSync('which snap', { timeout: 5000 });
            
            // Install Edge via snap
            execSync('sudo snap install microsoft-edge', { timeout: 300000 });
            
            logger.info('Edge installed via Snap');
            return true;
            
        } catch (error) {
            logger.debug('Snap installation failed:', error.message);
            throw error;
        }
    }

    // Install Edge on Linux using direct download
    async installEdgeLinuxDirect() {
        try {
            logger.info('Installing Edge via direct download...');
            
            const { downloadFile } = require('../../../../utils/downloader');
            const tempDir = '/tmp';
            const debFile = path.join(tempDir, 'microsoft-edge-stable.deb');
            
            // Download Edge DEB package
            const downloadUrl = 'https://packages.microsoft.com/repos/edge/pool/main/m/microsoft-edge-stable/microsoft-edge-stable_119.0.2151.97-1_amd64.deb';
            await downloadFile(downloadUrl, debFile);
            
            // Install DEB package
            execSync(`sudo dpkg -i ${debFile}`, { timeout: 300000 });
            
            // Fix dependencies if needed
            try {
                execSync('sudo apt-get install -f -y', { timeout: 60000 });
            } catch (error) {
                // Ignore dependency fix errors
            }
            
            // Clean up
            execSync(`rm -f ${debFile}`, { timeout: 5000 });
            
            logger.info('Edge installed via direct download');
            return true;
            
        } catch (error) {
            logger.debug('Direct download installation failed:', error.message);
            throw error;
        }
    }

    // Check if winget is available
    isWingetAvailable() {
        try {
            execSync('winget --version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Install Edge based on platform
    async installEdge() {
        try {
            // Check if Edge is already installed
            if (this.finder.isEdgeInstalled()) {
                logger.info('Microsoft Edge is already installed');
                return true;
            }
            
            logger.info(`Installing Microsoft Edge on ${this.platform}...`);
            
            if (this.platform === 'win32') {
                return await this.installEdgeWindows();
            } else if (this.platform === 'linux') {
                return await this.installEdgeLinux();
            } else {
                throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
        } catch (error) {
            logger.error('Failed to install Edge:', error.message);
            throw error;
        }
    }

    // Uninstall Edge
    async uninstallEdge() {
        try {
            logger.info(`Uninstalling Microsoft Edge on ${this.platform}...`);
            
            if (this.platform === 'win32') {
                return await this.uninstallEdgeWindows();
            } else if (this.platform === 'linux') {
                return await this.uninstallEdgeLinux();
            } else {
                throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
        } catch (error) {
            logger.error('Failed to uninstall Edge:', error.message);
            throw error;
        }
    }

    // Uninstall Edge on Windows
    async uninstallEdgeWindows() {
        try {
            if (this.isWingetAvailable()) {
                execSync('winget uninstall Microsoft.Edge', { timeout: 300000 });
            } else {
                // Use Windows uninstaller
                execSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe --uninstall', { timeout: 300000 });
            }
            
            logger.info('Edge uninstalled on Windows');
            return true;
            
        } catch (error) {
            logger.error('Failed to uninstall Edge on Windows:', error.message);
            throw error;
        }
    }

    // Uninstall Edge on Linux
    async uninstallEdgeLinux() {
        try {
            // Try different uninstall methods
            const methods = [
                () => execSync('sudo apt remove -y microsoft-edge-stable', { timeout: 300000 }),
                () => execSync('sudo snap remove microsoft-edge', { timeout: 300000 })
            ];
            
            for (const method of methods) {
                try {
                    method();
                    logger.info('Edge uninstalled on Linux');
                    return true;
                } catch (error) {
                    continue;
                }
            }
            
            throw new Error('All uninstall methods failed');
            
        } catch (error) {
            logger.error('Failed to uninstall Edge on Linux:', error.message);
            throw error;
        }
    }

    // Get installation status
    getInstallationStatus() {
        return {
            isInstalled: this.finder.isEdgeInstalled(),
            info: this.finder.getEdgeInfo(),
            platform: this.platform,
            installer: 'EdgeInstaller'
        };
    }
}

module.exports = EdgeInstaller;
