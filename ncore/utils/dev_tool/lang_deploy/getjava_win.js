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

const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@global_vars');
const bdir = require('#@/ncore/global_vars/global_dir/globaldir.js');
const gconfig = require('#@gconfig');
const logger = require('#@logger');
const winget = require('#@/ncore/utils/dev_tool/win-libs/winget.js');
const { execCmd } = require('#@commander');

class GetJavaWin {
    constructor() {
        this.javaVersions = {
            23: {
                winget_id: "Oracle.JDK.23"
            }
        };
        this.defaultVersionKey = 23;
        this.baseInstallDir = path.join(gconfig.DEV_LANG_DIR);
        this.prepareDirectories();
    }

    prepareDirectories() {
        if (!fs.existsSync(this.baseInstallDir)) {
            fs.mkdirSync(this.baseInstallDir, { recursive: true });
        }
    }

    getJavaInstallDir(winget_id) {
        return path.join(this.baseInstallDir, winget_id);
    }

    isJavaExecutableExists(installDir) {
        const javaExePath = path.join(installDir, 'bin', 'java.exe');
        return fs.existsSync(javaExePath);
    }

    async installJava() {
        const versionDetails = this.javaVersions[this.defaultVersionKey];
        if (!versionDetails) {
            logger.error(`Unsupported Java version: ${this.defaultVersionKey}`);
            return false;
        }

        try {
            const installDir = this.getJavaInstallDir(versionDetails.winget_id);
            const wingetId = versionDetails.winget_id;
            
            // 检查是否已安装
            const isWingetInstalled = await winget.isInstalled(wingetId);
            const isJavaExeExists = this.isJavaExecutableExists(installDir);

            // 如果 winget 显示已安装但 java.exe 不存在，需要先卸载
            if (isWingetInstalled && !isJavaExeExists) {
                logger.warn(`Java is registered in winget but executable is missing at ${installDir}`);
                logger.info(`Uninstalling Java ${wingetId} from winget...`);
                
                const uninstallSuccess = await winget.uninstallSoftwareById(
                    wingetId,
                    true,
                    null,
                    (progress, result) => {
                        if (progress === 100) {
                            logger.success(`Previous Java installation removed successfully`);
                        }
                    }
                );

                if (!uninstallSuccess) {
                    logger.error(`Failed to remove previous Java installation`);
                    return false;
                }

                // 确保安装目录是空的
                if (fs.existsSync(installDir)) {
                    logger.info(`Cleaning up installation directory: ${installDir}`);
                    fs.rmSync(installDir, { recursive: true, force: true });
                }
            }

            // 如果目录不存在，创建它
            if (!fs.existsSync(installDir)) {
                fs.mkdirSync(installDir, { recursive: true });
            }

            // 安装 Java
            logger.info(`Installing Oracle JDK ${wingetId} to ${installDir}...`);
            const success = await winget.installSoftwareById(
                wingetId,
                installDir,
                true,
                null,
                (progress, result) => {
                    if (progress === 100) {
                        logger.success(`Java installation completed`);
                    } else if (progress === -1) {
                        logger.error(`Java installation failed:`, result);
                    }
                }
            );

            // 最后验证安装
            if (success) {
                const finalCheck = this.isJavaExecutableExists(installDir);
                if (!finalCheck) {
                    logger.error(`Installation reported success but java.exe not found in ${installDir}`);
                    return false;
                }
                logger.success(`Java installation verified at ${installDir}`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error('Error during Java installation:', error);
            return false;
        }
    }

    async verifyInstallation() {
        try {
            const versionDetails = this.javaVersions[this.defaultVersionKey];
            const installDir = this.getJavaInstallDir(versionDetails.winget_id);

            const isValid = await winget.isInstalled(versionDetails.winget_id) && 
                          this.isJavaExecutableExists(installDir);

            if (isValid) {
                logger.success('Java installation verified successfully');
                return true;
        } else {
                logger.error('Java installation verification failed');
                return false;
            }
        } catch (error) {
            logger.error('Error verifying Java installation:', error);
            return false;
        }
    }

    async uninstallJava() {
        const versionDetails = this.javaVersions[this.defaultVersionKey];
        if (!versionDetails) {
            logger.error(`Unsupported Java version: ${this.defaultVersionKey}`);
            return false;
        }

        try {
            if (await winget.isInstalled(versionDetails.winget_id)) {
                logger.info(`Uninstalling Java ${versionDetails.winget_id}...`);
                const success = await winget.uninstallSoftwareById(
                    versionDetails.winget_id,
                    true,
                    null,
                    (progress, result) => {
                        if (progress === 100) {
                            logger.success(`Java uninstallation completed`);
                        } else if (progress === -1) {
                            logger.error(`Java uninstallation failed:`, result);
                        }
                    }
                );
                return success;
            }

            logger.info('Java is not installed');
            return true;
        } catch (error) {
            logger.error('Error during Java uninstallation:', error);
            return false;
        }
    }

    async start() {
        await bdir.initializedBDir();
        
        if (await this.verifyInstallation()) {
            logger.info('Java is already installed');
            return true;
        }

        logger.info('Starting Java installation...');
        const success = await this.installJava();
        
        if (success) {
            await this.verifyInstallation();
            return true;
        }
        
        return false;
    }

    /**
     * Get installation information, including environment paths and executable paths
     * @returns {{
     *   binPaths: string[],      // Paths to be added to environment variables
     *   versionExePath: string,  // Full path to the version check executable
     *   defaultVersion: string,  // Default version number
     *   installedVersions: number // Number of installed versions
     * }}
     */
    getInstallInfo() {
        try {
            // Get Java installation directory
            const installDir = this.getJavaInstallDir(this.javaVersions[this.defaultVersionKey].winget_id);
            if (!fs.existsSync(installDir)) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.defaultVersionKey,
                    installedVersions: 0
                };
            }

            // Collect all required paths
            const binPaths = [];
            
            // Java main directory
            if (fs.existsSync(installDir)) {
                binPaths.push(installDir);
            }

            // bin directory
            const binPath = path.join(installDir, 'bin');
            if (fs.existsSync(binPath)) {
                binPaths.push(binPath);
            }

            // lib directory
            const libPath = path.join(installDir, 'lib');
            if (fs.existsSync(libPath)) {
                binPaths.push(libPath);
            }

            // Find java.exe
            const versionExePath = path.join(binPath, 'java.exe');
            const isValidInstall = fs.existsSync(versionExePath);

            // Get number of installed versions
            let installedVersions = 0;
            if (isValidInstall) {
                // Check if key files exist
                const javacPath = path.join(binPath, 'javac.exe');
                const jarPath = path.join(binPath, 'jar.exe');
                if (fs.existsSync(javacPath) && fs.existsSync(jarPath)) {
                    installedVersions = 1; // Java typically has only one version installed
                }
            }

            return {
                binPaths,
                versionExePath: isValidInstall ? versionExePath : null,
                defaultVersion: this.defaultVersionKey,
                installedVersions
            };
        } catch (error) {
            logger.error('Error getting Java installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.defaultVersionKey,
                installedVersions: 0
            };
        }
    }

    /**
     * Print Java version information
     */
    async printVersionInfo() {
        const { versionExePath, defaultVersion, installedVersions, binPaths } = this.getInstallInfo();
        
        if (versionExePath && installedVersions > 0) {
            try {
                // Get Java version
                const version = await execCmd(`"${versionExePath}" -version 2>&1`);
                logger.info('Java Version Information:');
                version.split('\n').forEach(line => {
                    if (line.trim()) {
                        logger.info(`  ${line.trim()}`);
                    }
                });

                logger.info(`Default Version: ${defaultVersion}`);
                logger.info(`Installed Versions: ${installedVersions}`);
                logger.info(`Executable Path: ${versionExePath}`);

                // Display Java compiler version
                const javacPath = path.join(path.dirname(versionExePath), 'javac.exe');
                if (fs.existsSync(javacPath)) {
                    const javacVersion = await execCmd(`"${javacPath}" -version 2>&1`);
                    logger.info('Java Compiler Version:');
                    logger.info(`  ${javacVersion.trim()}`);
                }

                // Display configuration paths
                logger.info('Java Configuration Paths:');
                binPaths.forEach(path => {
                    logger.info(`  ${path}`);
                });

                // Display Java properties
                const properties = await execCmd(`"${versionExePath}" -XshowSettings:properties -version 2>&1`);
                logger.info('Java Properties:');
                properties.split('\n').forEach(line => {
                    if (line.trim() && !line.includes('Picked up')) {
                        logger.info(`  ${line.trim()}`);
                    }
                });

            } catch (error) {
                logger.error('Error getting Java version:', error);
            }
        } else {
            logger.warn('Java is not properly installed');
        }
    }
}

module.exports = new GetJavaWin();