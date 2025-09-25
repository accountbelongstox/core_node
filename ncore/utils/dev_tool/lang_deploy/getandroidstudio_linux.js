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
const shortcut = require('#@/ncore/utils/linux/libs/shorcut.js');
const envManager = require('#@/ncore/utils/linux/libs/envlink.js');

class GetAndroidStudioLinux {
    constructor() {
        this.version = '2024.3.1.13';
        this.downloadFile = path.join(gconfig.DOWNLOAD_DIR, 'android-studio-linux.tar.gz');
        this.downloadUrl = 'https://redirector.gvt1.com/edgedl/android/studio/ide-zips/2024.3.1.13/android-studio-2024.3.1.13-linux.tar.gz';
        
        // Linux-specific paths
        this.defaultInstallPath = '/usr/local/android-studio';
        this.userInstallPath = path.join(os.homedir(), 'android-studio');
        
        // Environment variables
        this.envVars = {
            'ANDROID_HOME': path.join(os.homedir(), 'Android', 'Sdk'),
            'ANDROID_SDK_ROOT': path.join(os.homedir(), 'Android', 'Sdk')
        };

        // Desktop entry path
        this.desktopEntryPath = '/usr/share/applications/android-studio.desktop';
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
    async prepareDirectories() {
        ensureDir(gconfig.DOWNLOAD_DIR);
        
        try {
            // Try to create system-wide installation directory
            await execCmd(`sudo mkdir -p "${this.defaultInstallPath}"`);
        } catch (error) {
            logger.warn('Cannot create system-wide directory, falling back to user directory');
            this.defaultInstallPath = this.userInstallPath;
            ensureDir(this.defaultInstallPath);
        }

        // Create Android SDK directory
        ensureDir(this.envVars.ANDROID_HOME);
    }

    /**
     * Check if Android Studio is already installed
     */
    async isAndroidStudioInstalled() {
        const studioSh = path.join(this.defaultInstallPath, 'bin', 'studio.sh');
        return fs.existsSync(studioSh);
    }

    /**
     * Set Android Studio environment variables
     */
    async setAndroidStudioEnv() {
        try {
            logger.info('Setting up Android Studio environment...');

            // Paths to add to PATH
            const pathAdditions = [
                path.join(this.defaultInstallPath, 'bin'),
                path.join(this.envVars.ANDROID_HOME, 'platform-tools'),
                path.join(this.envVars.ANDROID_HOME, 'tools'),
                path.join(this.envVars.ANDROID_HOME, 'tools/bin')
            ];

            // Set environment variables using the envlink utility
            const result = await envManager.setEnvironmentVariables(this.envVars, pathAdditions);
            
            if (!result) {
                logger.error('Failed to set Android Studio environment variables');
                return false;
            }

            // Add binary links for executables
            const binaries = [
                path.join(this.defaultInstallPath, 'bin', 'studio.sh'),
                ...(fs.existsSync(path.join(this.envVars.ANDROID_HOME, 'platform-tools')) 
                    ? [path.join(this.envVars.ANDROID_HOME, 'platform-tools', 'adb')] 
                    : [])
            ];

            for (const binary of binaries) {
                if (fs.existsSync(binary)) {
                    await envManager.addPath(binary);
                }
            }

            logger.success('Android Studio environment setup completed');
            return true;
        } catch (error) {
            logger.error('Error setting Android Studio environment:', error);
            return false;
        }
    }

    /**
     * Download Android Studio
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

            // Extract the archive
            await execCmd(`sudo tar -xzf "${this.downloadFile}" -C /usr/local`);

            // Create desktop entry using the shortcut utility
            const desktopEntryOptions = {
                name: 'Android Studio',
                exec: path.join(this.defaultInstallPath, 'bin', 'studio.sh'),
                icon: path.join(this.defaultInstallPath, 'bin', 'studio.png'),
                comment: 'Android Development Environment',
                categories: 'Development;IDE',
                fileName: 'android-studio'
            };

            const shortcutCreated = await shortcut.createDesktopEntry(desktopEntryOptions);
            if (!shortcutCreated) {
                logger.warn('Failed to create desktop shortcut');
            }

            // Set permissions
            await execCmd(`sudo chown -R $USER:$USER "${this.defaultInstallPath}"`);
            await execCmd(`sudo chmod -R u+rw "${this.defaultInstallPath}"`);

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

            const studioSh = path.join(binDir, 'studio.sh');
            if (!fs.existsSync(studioSh)) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    version: null
                };
            }

            return {
                binPaths,
                versionExePath: studioSh,
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
     * Install required dependencies
     */
    async installDependencies() {
        try {
            logger.info('Installing required dependencies...');
            
            const dependencies = [
                'libc6:i386',
                'libncurses5:i386',
                'libstdc++6:i386',
                'lib32z1',
                'libbz2-1.0:i386',
                'libx11-6:i386',
                'libxext6:i386',
                'libxrender1:i386',
                'libxtst6:i386',
                'libxt6:i386',
                'libgl1-mesa-glx'
            ];

            await execCmd('sudo dpkg --add-architecture i386');
            await execCmd('sudo apt-get update');
            await execCmd(`sudo apt-get install -y ${dependencies.join(' ')}`);

            logger.success('Dependencies installed successfully');
            return true;
        } catch (error) {
            logger.error('Error installing dependencies:', error);
            return false;
        }
    }

    /**
     * Start the installation process
     */
    async start() {
        try {
            await this.initTools();
            await this.prepareDirectories();
            
            if (!await this.installDependencies()) {
                logger.error('Failed to install dependencies');
                return false;
            }

            await this.setAndroidStudioEnv();

            if (!await this.isAndroidStudioInstalled()) {
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

module.exports = new GetAndroidStudioLinux(); 