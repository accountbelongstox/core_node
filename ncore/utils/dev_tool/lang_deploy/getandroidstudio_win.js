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
const bdir = require('#@/ncore/global_vars/global_dir/globaldir.js');
const gconfig = require('#@gconfig');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');
const { CURLDownload, ensureDir } = require('#@downloader');

class GetAndroidStudioWin {
    constructor() {
        this.version = '2024.3.1.13';
        this.downloadFile = path.join(gconfig.DOWNLOAD_DIR, 'android-studio.exe');
        this.downloadUrl = 'https://redirector.gvt1.com/edgedl/android/studio/install/2024.3.1.13/android-studio-2024.3.1.13-windows.exe';
        
        this.programFiles = process.env['ProgramFiles'];
        this.defaultInstallPath = path.join(this.programFiles, 'Android', 'Android Studio');
        
        // 环境变量
        this.envVars = {
            'ANDROID_HOME': path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
            'ANDROID_SDK_ROOT': path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
        };
    }

    /**
     * Initialize required tools
     */
    async initTools() {
        await bdir.initializedBDir();
        this.curl = await bdir.getCurlExecutable();
    }

    /**
     * Set up required directories
     */
    prepareDirectories() {
        ensureDir(gconfig.DOWNLOAD_DIR);
        ensureDir(this.defaultInstallPath);
    }

    /**
     * Check if Android Studio is already installed
     */
    isAndroidStudioInstalled() {
        const exePath = path.join(this.defaultInstallPath, 'bin', 'studio64.exe');
        return fs.existsSync(exePath);
    }

    /**
     * Set Android Studio environment variables
     */
    async setAndroidStudioEnv() {
        try {
            for (const [key, value] of Object.entries(this.envVars)) {
                process.env[key] = value;
                logger.info(`Set ${key}=${value}`);
            }
        } catch (error) {
            logger.error('Error setting Android Studio environment variables:', error);
            throw error;
        }
    }

    /**
     * Download Android Studio installer
     */
    async downloadAndroidStudio() {
        try {
            logger.info('Downloading Android Studio...');
            
            const result = await CURLDownload(this.downloadUrl, this.downloadFile, {
                onComplete: () => {
                    logger.success('Android Studio download completed');
                },
                onError: (error) => {
                    logger.error('Android Studio download failed:', error);
                }
            });

            if (!result) {
                logger.error('Download failed');
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error downloading Android Studio:', error);
            return false;
        }
    }

    /**
     * Install Android Studio
     */
    async installAndroidStudio() {
        try {
            logger.info('Installing Android Studio...');
            
            const installArgs = [
                '/S',                           // Silent install
                `/D=${this.defaultInstallPath}` // Installation directory
            ];

            const installCmd = `"${this.downloadFile}" ${installArgs.join(' ')}`;
            await execCmd(installCmd);

            logger.success('Android Studio installed successfully');
            return true;
        } catch (error) {
            logger.error('Error installing Android Studio:', error);
            return false;
        }
    }

    /**
     * Get installation information
     */
    getInstallInfo() {
        try {
            const binDir = path.join(this.defaultInstallPath, 'bin');
            const binPaths = [binDir];

            // Add SDK paths if they exist
            Object.values(this.envVars).forEach(dir => {
                if (fs.existsSync(dir)) {
                    binPaths.push(dir);
                    // Add platform-tools if exists
                    const platformTools = path.join(dir, 'platform-tools');
                    if (fs.existsSync(platformTools)) {
                        binPaths.push(platformTools);
                    }
                }
            });

            const studioExePath = path.join(binDir, 'studio64.exe');
            if (!fs.existsSync(studioExePath)) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    version: null
                };
            }

            return {
                binPaths,
                versionExePath: studioExePath,
                version: this.version,
                installationPath: this.defaultInstallPath
            };
        } catch (error) {
            logger.error('Error getting Android Studio installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                version: null
            };
        }
    }

    /**
     * Print version information
     */
    async printVersionInfo() {
        const info = this.getInstallInfo();
        if (info.versionExePath && fs.existsSync(info.versionExePath)) {
            logger.info('Android Studio Installation Information:');
            logger.info(`Version: ${this.version}`);
            logger.info(`Installation Directory: ${this.defaultInstallPath}`);
            logger.info('Environment Variables:');
            Object.entries(this.envVars).forEach(([key, value]) => {
                logger.info(`  ${key}=${value}`);
            });
            logger.info('PATH Directories:');
            info.binPaths.forEach(p => {
                logger.info(`  ${p}`);
            });
        } else {
            logger.warn('Android Studio is not properly installed');
        }
    }

    /**
     * Start the installation process
     */
    async start() {
        try {
            await this.initTools();
            this.prepareDirectories();

            await this.setAndroidStudioEnv();

            if (!this.isAndroidStudioInstalled()) {
                logger.info('Android Studio not found, starting installation...');
                
                if (!await this.downloadAndroidStudio()) {
                    logger.error('Failed to download Android Studio');
                    return false;
                }

                if (!await this.installAndroidStudio()) {
                    logger.error('Failed to install Android Studio');
                    return false;
                }
            } else {
                logger.info('Android Studio is already installed');
            }

            await this.printVersionInfo();
            return true;
        } catch (error) {
            logger.error('Error in Android Studio setup:', error);
            return false;
        }
    }
}

module.exports = new GetAndroidStudioWin(); 