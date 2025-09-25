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
const { CURLDownload, ensureDir,} = require('#@downloader');


class GetFlutterWin {
    constructor() {
        this.flutterVersion = '3.29.1-stable';
        this.mirrorUrl = 'https://mirrors.tuna.tsinghua.edu.cn/flutter/';
        this.downloadUrl = this.getDownloadUrl()
        this.installDir = path.join(gconfig.DEV_LANG_DIR, 'flutter');

        this.downloadFile = path.join(gconfig.DOWNLOAD_DIR, 'flutter.zip');

        this.envVars = {
            'PUB_HOSTED_URL': 'https://mirrors.tuna.tsinghua.edu.cn/dart-pub',
            'FLUTTER_STORAGE_BASE_URL': 'https://mirrors.tuna.tsinghua.edu.cn/flutter'
        };
    }

    getDownloadUrl() {
        return `${this.mirrorUrl}flutter_infra_release/releases/stable/windows/flutter_windows_${this.flutterVersion}.zip`;
    }

    /**
     * Initialize required tools
     */
    async initTools() {
        await bdir.initializedBDir();
        this.curl = await bdir.getCurlExecutable();
        this.v7z = await bdir.get7zExecutable();
    }

    /**
     * Set up required directories
     */
    prepareDirectories() {
        fs.mkdirSync(gconfig.DOWNLOAD_DIR, { recursive: true });
    }

    /**
     * Check if Flutter is already installed
     */
    isFlutterInstalled() {
        return fs.existsSync(path.join(this.installDir, 'bin', 'flutter.bat'));
    }

    /**
     * Set Flutter-specific environment variables
     */
    async setFlutterEnv() {
        try {
            for (const [key, value] of Object.entries(this.envVars)) {
                process.env[key] = value;
                logger.info(`Set ${key}=${value}`);
            }
        } catch (error) {
            logger.error('Error setting Flutter environment variables:', error);
            throw error;
        }
    }

    /**
     * Download Flutter SDK using downloader
     */
    async downloadFlutterSDK() {
        try {
            logger.info('Downloading Flutter SDK...');

            // Ensure temp directory exists
            ensureDir(gconfig.DOWNLOAD_DIR);
            // Download the file
            const result = await CURLDownload(this.downloadUrl, this.downloadFile, {
                onComplete: () => {
                    logger.success('Flutter SDK download completed');
                },
                onError: (error) => {
                    logger.error('Flutter SDK download failed:', error);
                }
            });

            if (!result) {
                logger.error('Download failed');
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error downloading Flutter SDK:', error);
            return false;
        }
    }

    /**
     * Extract Flutter SDK using 7z
     */
    async extractFlutterSDK() {
        try {
            logger.info('Extracting Flutter SDK...');
            await pipeExecCmd(`"${this.v7z}" x "${this.downloadFile}" -o"${gconfig.DEV_LANG_DIR}" -y`);
            logger.success('Flutter SDK extracted successfully');
            return true;

        } catch (error) {
            logger.error('Error extracting Flutter SDK:', error);
            return false;
        }
    }

    /**
     * Check if Flutter installation is valid
     * @returns {boolean} True if Flutter is properly installed
     */
    isValidFlutterInstallation() {
        try {
            if (!fs.existsSync(this.installDir)) {
                return false;
            }

            // Check for essential Flutter directories and files
            const requiredPaths = [
                path.join(this.installDir, 'bin', 'flutter.bat'),
                path.join(this.installDir, 'bin', 'dart.bat'),
                path.join(this.installDir, 'packages'),
                path.join(this.installDir, 'bin', 'cache'),
                path.join(this.installDir, 'version')
            ];

            const missingPaths = requiredPaths.filter(p => !fs.existsSync(p));
            if (missingPaths.length > 0) {
                logger.warn('Missing Flutter components:', missingPaths);
                return false;
            }

            return true;
        } catch (error) {
            logger.error('Error checking Flutter installation:', error);
            return false;
        }
    }

    /**
     * Download and install Flutter
     */
    async installFlutter() {
        try {
            // Check if Flutter is already properly installed
            if (this.isValidFlutterInstallation()) {
                logger.info('Valid Flutter installation found, skipping installation');
                return true;
            }

            // Clean up any old downloads

            // Download Flutter SDK using downloader
            if (!await this.downloadFlutterSDK()) {
                logger.error('Failed to download Flutter SDK');
                return false;
            }

            // Remove existing installation if any
            if (fs.existsSync(this.installDir)) {
                logger.info('Removing existing Flutter installation...');
                fs.rmSync(this.installDir, { recursive: true, force: true });
            }

            // Extract Flutter SDK using 7z
            if (!await this.extractFlutterSDK()) {
                logger.error('Failed to extract Flutter SDK');
                return false;
            }

            // Clean up download file

            // Verify installation
            if (!this.isValidFlutterInstallation()) {
                logger.error('Flutter installation verification failed');
                return false;
            }

            logger.success('Flutter SDK installed successfully');
            return true;
        } catch (error) {
            logger.error('Error installing Flutter:', error);
            return false;
        }
    }

    /**
     * Get installation information
     */
    getInstallInfo() {
        try {
            if (!this.isFlutterInstalled()) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.flutterVersion,
                    installedVersions: 0
                };
            }

            const binPath = path.join(this.installDir, 'bin');
            const flutterExePath = path.join(binPath, 'flutter.bat');

            return {
                binPaths: [binPath],
                versionExePath: flutterExePath,
                defaultVersion: this.flutterVersion,
                installedVersions: 1
            };
        } catch (error) {
            logger.error('Error getting Flutter installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.flutterVersion,
                installedVersions: 0
            };
        }
    }

    /**
     * Print Flutter version information and run doctor
     */
    async printVersionInfo() {
        const { versionExePath } = this.getInstallInfo();
        if (versionExePath && fs.existsSync(versionExePath)) {
            try {
                // Print version information
                const version = await execCmd(`"${versionExePath}" --version`);
                logger.info('Flutter Version Information:');
                logger.info(version.trim());

                // Print environment variables
                logger.info('\nFlutter Environment Variables:');
                for (const [key, value] of Object.entries(this.envVars)) {
                    logger.info(`${key}=${value}`);
                }

                // Run Flutter doctor for system check
                logger.info('\nRunning Flutter Doctor...');
                const doctor = await execCmd(`"${versionExePath}" doctor --verbose`);

                // Format and display doctor output
                const doctorOutput = doctor.trim().split('\n');
                doctorOutput.forEach(line => {
                    if (line.includes('[✓]')) {
                        logger.success(line);
                    } else if (line.includes('[✗]') || line.includes('[!]')) {
                        logger.warn(line);
                    } else {
                        logger.info(line);
                    }
                });

                // Check for any issues
                if (doctor.includes('[✗]') || doctor.includes('[!]')) {
                    logger.warn('\nSome issues were detected with the Flutter installation.');
                    logger.info('Please review the doctor output above and resolve any issues.');
                } else {
                    logger.success('\nFlutter installation looks good! No issues detected.');
                }

            } catch (error) {
                logger.error('Error getting Flutter information:', error);
            }
        } else {
            logger.warn('Flutter is not properly installed');
        }
    }

    /**
     * Start the Flutter installation process
     */
    async start() {
        try {
            // Initialize tools first
            await this.initTools();
            this.prepareDirectories();

            // Set environment variables
            await this.setFlutterEnv();

            // Check if Flutter needs to be installed
            if (!this.isFlutterInstalled()) {
                logger.info('Flutter not found, starting installation...');
                const success = await this.installFlutter();
                if (!success) {
                    logger.error('Flutter installation failed');
                    return false;
                }
            } else {
                logger.info('Flutter is already installed');
            }

            await this.printVersionInfo();
            return true;
        } catch (error) {
            logger.error('Error in Flutter setup:', error);
            return false;
        }
    }
}

module.exports = new GetFlutterWin();