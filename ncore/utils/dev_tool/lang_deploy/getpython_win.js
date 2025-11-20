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
const langdir = gconfig.DEV_LANG_DIR;
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');

// Add langdir prefix to installation paths
const PYTHON_VERSIONS = gconfig.INSTALL_PYTHONS.map(version => ({
    ...version,
    finalInstallDir: path.join(langdir, version.finalInstallDir),
    tmpInstallDir: path.join(langdir, version.tmpInstallDir)
}));

class GetPythonWin {
    constructor() {
        this.defaultVersionKey = PYTHON_VERSIONS.find(v => v.isDefault)?.version || "3.9.13";
        this.installDir = path.join(langdir);
        
        this.cachedVersionDetails = new Map();

        // Prepare directories during initialization
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(gconfig.DOWNLOAD_DIR)) {
            fs.mkdirSync(gconfig.DOWNLOAD_DIR, { recursive: true });
        }

        // Initialize bdir tools
        this.initializeBDirTools().catch(error => {
            logger.error('Failed to initialize bdir tools:', error);
        });
    }

    /**
     * Initialize bdir tools (curl and tar)
     * @private
     */
    async initializeBDirTools() {
        await bdir.initializedBDir();
        this.tar = await bdir.getTarExecutable();
        this.curl = await bdir.getCurlExecutable();
    }

    getVersionInfo(versionKey = null) {
        // If no version specified, use default
        const version = versionKey ?
            PYTHON_VERSIONS.find(v => v.version.startsWith(versionKey)) :
            PYTHON_VERSIONS.find(v => v.isDefault);

        if (!version) {
            throw new Error(`Python version ${versionKey || 'default'} not found`);
        }

        // Return cached version if exists
        if (this.cachedVersionDetails.has(version.version)) {
            return this.cachedVersionDetails.get(version.version);
        }

        // Create version details with both temporary and final paths
        const versionDetails = {
            version: version.version,
            url: version.downloadUrl,
            fileName: path.basename(version.downloadUrl),
            isDefault: version.isDefault,
            // Use the paths defined in PYTHON_VERSIONS
            finalInstallDir: version.finalInstallDir,
            tmpInstallDir: version.tmpInstallDir
        };

        // Add derived paths for final installation
        versionDetails.finalPaths = {
            exePath: path.join(versionDetails.finalInstallDir, 'python.exe'),
            pipPath: path.join(versionDetails.finalInstallDir, 'Scripts', 'pip.exe'),
            scriptsPath: path.join(versionDetails.finalInstallDir, 'Scripts'),
            libPath: path.join(versionDetails.finalInstallDir, 'Lib')
        };

        // Add derived paths for temporary installation
        versionDetails.tmpPaths = {
            exePath: path.join(versionDetails.tmpInstallDir, 'python.exe'),
            pipPath: path.join(versionDetails.tmpInstallDir, 'Scripts', 'pip.exe'),
            scriptsPath: path.join(versionDetails.tmpInstallDir, 'Scripts'),
            libPath: path.join(versionDetails.tmpInstallDir, 'Lib')
        };

        // Cache the details
        this.cachedVersionDetails.set(version.version, versionDetails);
        return versionDetails;
    }

    /**
     * Verify if Python installation is complete and valid
     * @param {Object} versionInfo - Version information object
     * @returns {boolean} True if installation is valid
     */
    isValidPythonInstallation(versionInfo) {
        try {
            // Check main directory
            if (!fs.existsSync(versionInfo.installDir)) {
                return false;
            }

            // Check essential files and directories
            const requiredPaths = [
                versionInfo.exePath,              // python.exe
                versionInfo.pipPath,              // pip.exe
                versionInfo.scriptsPath,          // Scripts directory
                versionInfo.libPath,              // Lib directory
                path.join(versionInfo.libPath, 'site-packages')  // site-packages
            ];

            return requiredPaths.every(path => fs.existsSync(path));
        } catch (error) {
            logger.error(`Error checking Python installation for ${versionInfo.version}:`, error);
            return false;
        }
    }

    /**
     * Clean up invalid installation
     * @param {Object} version - Version object from PYTHON_VERSIONS
     */
    async cleanupInvalidInstallation(version) {
        try {
            // Try to uninstall from temporary directory if it exists
            if (fs.existsSync(version.tmpInstallDir)) {
                logger.info(`Found temporary installation at ${version.tmpInstallDir}, attempting to uninstall...`);
                await this.uninstallPython(version, true);
            }

            // Clean up final directory if it exists
            if (fs.existsSync(version.finalInstallDir)) {
                logger.info(`Cleaning up Python ${version.version} installation at ${version.finalInstallDir}...`);
                await fs.promises.rm(version.finalInstallDir, { recursive: true, force: true });
                logger.success(`Cleaned up directory: ${version.finalInstallDir}`);
            }
        } catch (error) {
            logger.error(`Error cleaning up Python ${version.version} installation:`, error);
            throw error;
        }
    }

    async start() {
        try {
            // Ensure bdir tools are initialized
            if (!this.curl) {
                await this.initializeBDirTools();
            }

            // Process each version
            for (const version of PYTHON_VERSIONS) {
                logger.info(`\nProcessing Python ${version.version}...`);

                // Check if installation is valid
                if (await this.verifyInstallation(version)) {
                    logger.success(`Python ${version.version} is already properly installed`);
                    continue;
                }

                // Clean up any invalid installation
                await this.cleanupInvalidInstallation(version);

                // Perform fresh installation
                logger.info(`Installing Python ${version.version}...`);
                await this.installPython(version);
                await this.configurePython(version);
            }

            logger.success('Python installation process completed');
            return true;

        } catch (error) {
            logger.error('Python installation process encountered an error:', error);
            return false;
        }
    }

    async installPython(version) {
        try {
            // Download Python installer
            const installerPath = await this.downloadPythonZip(version);

            // Install to temporary directory
            logger.info(`\nInstalling Python ${version.version} to temporary location...`);
            try {
                await this.installPythonByExe(installerPath, version);
            } catch (error) {
                logger.error(`Failed to install Python to temporary location: ${error.message}`);
                return false;
            }

            // Copy to final location
            logger.info(`\nCopying to final location: ${version.finalInstallDir}`);
            try {
                await fs.promises.cp(version.tmpInstallDir, version.finalInstallDir, {
                    recursive: true,
                    force: true
                });
            } catch (error) {
                logger.error(`Failed to copy Python installation to final location: ${error.message}`);
                // Try to continue anyway
            }

            // Verify final installation
            if (!await this.verifyInstallation(version)) {
                logger.error('Final installation verification failed');
                // Continue anyway
            }

            // Uninstall from Windows and clean up
            logger.info('\nCleaning up temporary installation...');
            try {
                await this.uninstallPython(version, true);
            } catch (error) {
                logger.error(`Failed to uninstall temporary Python installation: ${error.message}`);
                // Continue anyway
            }

            logger.success(`Python ${version.version} installation process completed`);
            return true;

        } catch (error) {
            logger.error(`Failed to install Python ${version.version}: ${error.message}`);
            return false;
        }
    }

    checkPythonInstalled(versionInfo) {
        const pythonExePath = versionInfo.exePath;
        logger.info(`pythonExePath`, pythonExePath);
        return fs.existsSync(pythonExePath);
    }

    /**
     * Get or download Python installer
     * @param {Object} version - Version object from PYTHON_VERSIONS
     * @param {boolean} [download=true] - Whether to actually download the file
     * @returns {Promise<string>} Path to the installer file
     */
    async downloadPythonZip(version, download = true) {
        const fileName = path.basename(version.downloadUrl);
        const tempPythonZip = path.join(gconfig.DOWNLOAD_DIR, fileName);
        
        if (download) {
            logger.info(`Downloading Python ${version.version}...`);
            if (!fs.existsSync(tempPythonZip)) {
                await pipeExecCmd(`${this.curl} -L -k -o "${tempPythonZip}" "${version.downloadUrl}"`);
            } else {
                logger.info(`Using existing installer file: ${tempPythonZip}`);
            }
        }
        
        return tempPythonZip;
    }

    async installPythonByExe(installFile, version) {
        logger.info(`Installing Python ${version.version} from ${installFile}...`);
        
        // Create installation directory if it doesn't exist
        if (!fs.existsSync(version.tmpInstallDir)) {
            fs.mkdirSync(version.tmpInstallDir, { recursive: true });
        }

        // Prepare log file
        const logFile = path.join(gconfig.DOWNLOAD_DIR, `install_python${version.version}.log`);

        // Build installation parameters
        const installParams = [
            '/quiet',                        // Installation mode
            'InstallAllUsers=1',            // Install for all users
            'Include_test=0',               // Don't install test suite
            'Include_doc=0',                // Don't install documentation
            'Include_launcher=1',           // Install Python launcher
            'InstallLauncherAllUsers=1',    // Install launcher for all users
            'CompileAll=1',                 // Compile all py files to pyc
            `TargetDir="${version.tmpInstallDir}"`
        ];

        // Only add to PATH if this is the default version
        if (version.isDefault) {
            // installParams.push('PrependPath=1');  // Add Python to PATH
            logger.info('This is the default Python version - will be added to PATH');
        } else {
            installParams.push('PrependPath=0');  // Don't add to PATH
            logger.info('This is not the default Python version - will not be added to PATH');
        }

        // Add log file parameter
        installParams.push(`/log "${logFile}"`);

        const installCmd = `${installFile} ${installParams.join(' ')}`;
        logger.info(`Running install command: ${installCmd}`);

        try {
        await pipeExecCmd(installCmd);
            
            // Wait for installation to complete
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Verify installation
            if (!await this.verifyInstallation({ ...version, finalInstallDir: version.tmpInstallDir })) {
                logger.error('Installation verification failed');
                return false;
            }

            logger.success(`Python ${version.version} installed successfully to ${version.tmpInstallDir}`);
            return true;
        } catch (error) {
            logger.error(`Installation failed: ${error.message}`);
            // Log file content for debugging
            if (fs.existsSync(logFile)) {
                const logContent = fs.readFileSync(logFile, 'utf8');
                logger.error('Installation log:', logContent);
            }
            return false;
        }
    }

    /**
     * Verify Python installation in the specified directory
     * @param {Object} version - Version object from PYTHON_VERSIONS
     * @returns {Promise<boolean>} True if installation is valid
     */
    async verifyInstallation(version) {
        try {
            const installDir = version.finalInstallDir;
            
            // Check only essential executable files
            const requiredPaths = [
                path.join(installDir, 'python.exe'),
                path.join(installDir, 'Scripts', 'pip.exe')
            ];

            return requiredPaths.every(p => fs.existsSync(p));
        } catch (error) {
            logger.error(`Error verifying Python installation in ${version.finalInstallDir}:`, error);
            return false;
        }
    }

    /**
     * Configure Python installation
     * @param {Object} version - Version object from PYTHON_VERSIONS
     */
    async configurePython(version) {
        try {
            const pythonExe = path.join(version.finalInstallDir, 'python.exe');
            const pipExe = path.join(version.finalInstallDir, 'Scripts', 'pip.exe');

            // Configure pip mirror
            logger.info('Configuring pip mirror...');
            await execCmd(`"${pipExe}" config set global.index-url https://mirrors.huaweicloud.com/repository/pypi/simple`);

            // Update pip itself
            logger.info('Updating pip...');
            await pipeExecCmd(`"${pythonExe}" -m pip install --upgrade pip`);

            // Install required packages
        const requirementsFile = path.join(
            __dirname,
            '..',
            'provider',
                version.version,
                os.platform() === 'linux' ? '.requirements_linux.txt' : '.requirements.txt'
            );

        if (fs.existsSync(requirementsFile)) {
                logger.info('Installing required packages...');
            const packages = fs
                .readFileSync(requirementsFile, 'utf8')
                .split('\n')
                    .map(line => line.trim())
                .filter(Boolean);

                if (packages.length > 0) {
                    // Get currently installed packages
                    const installedPackagesRaw = await execCmd(`"${pipExe}" list --format=freeze`);
                    const installedPackages = new Set(
                        installedPackagesRaw.split('\n')
                            .map(line => line.split('==')[0].trim())
                            .filter(Boolean)
                    );

                    // Filter out already installed packages
                    const packagesToInstall = packages.filter(pkg => !installedPackages.has(pkg));

            if (packagesToInstall.length > 0) {
                        logger.info('Installing new packages:', packagesToInstall.join(' '));
                        await pipeExecCmd(`"${pythonExe}" -m pip install ${packagesToInstall.join(' ')}`);
                    } else {
                        logger.info('All required packages are already installed');
                    }
                }
            }

            logger.success(`Python ${version.version} configuration completed`);
        } catch (error) {
            logger.error('Error configuring Python:', error);
            // Don't throw error, just log it
        }
    }

    /**
     * Get installation information for all Python versions
     * @returns {Object} Installation information for all versions
     */
    getInstallInfo() {
        try {
            const info = {
                versions: [],
                defaultVersion: null,
                binPaths: []
            };

            // Process each version
            for (const version of PYTHON_VERSIONS) {
                const installDir = version.finalInstallDir;
                const pythonExe = path.join(installDir, 'python.exe');
                const pipExe = path.join(installDir, 'Scripts', 'pip.exe');

                const versionInfo = {
                    version: version.version,
                    isDefault: version.isDefault,
                    installDir: installDir,
                    isInstalled: fs.existsSync(pythonExe) && fs.existsSync(pipExe),
                    exePath: pythonExe
                };

                info.versions.push(versionInfo);

                // If this is the default version and it's installed, collect its paths
                if (version.isDefault && versionInfo.isInstalled) {
                    info.defaultVersion = version.version;
                    
                    // Collect bin paths for default version
                    const binPaths = [installDir];  // Main directory

                    // Scripts directory
                    const scriptsPath = path.join(installDir, 'Scripts');
                    if (fs.existsSync(scriptsPath)) {
                        binPaths.push(scriptsPath);
                    }

                    // Lib directory
                    const libPath = path.join(installDir, 'Lib');
                    if (fs.existsSync(libPath)) {
                        binPaths.push(libPath);

                        const sitePackagesPath = path.join(libPath, 'site-packages');
                        if (fs.existsSync(sitePackagesPath)) {
                            binPaths.push(sitePackagesPath);
                        }
                    }

                    info.binPaths = binPaths;
                }
            }

            return info;

        } catch (error) {
            logger.error('Error getting Python installation info:', error);
            return {
                versions: [],
                defaultVersion: null,
                binPaths: []
            };
        }
    }

    /**
     * Print Python version information
     */
    async printVersionInfo() {
        const info = this.getInstallInfo();

        // Print summary of all versions
        logger.info('\nPython Versions Summary:');
        for (const version of info.versions) {
            const status = version.isInstalled ? 'Installed' : 'Not installed';
            const defaultMark = version.isDefault ? ' (Default)' : '';
            logger.info(`Python ${version.version}${defaultMark}: ${status}`);
            
            if (version.isInstalled) {
                try {
                    // Get Python version
                    const pythonVersion = await execCmd(`"${version.exePath}" --version`);
                    const pipPath = path.join(version.installDir, 'Scripts', 'pip.exe');
                    const pipVersion = await execCmd(`"${pipPath}" --version`);

                    logger.info(`  Python Version: ${pythonVersion.trim()}`);
                    logger.info(`  pip Version: ${pipVersion.trim()}`);
                    logger.info(`  Install Location: ${version.installDir}`);

                    // Show packages only for installed versions
                    logger.info('  Installed Packages:');
                    const packages = await execCmd(`"${pipPath}" list`);
                    packages.split('\n').forEach(line => {
                        if (line.trim() && !line.includes('Package') && !line.includes('---')) {
                            logger.info(`    ${line.trim()}`);
                        }
                    });
                } catch (error) {
                    logger.error(`  Error getting version details: ${error.message}`);
                }
            }
        }

        // Print default version paths if available
        if (info.defaultVersion) {
            logger.info('\nDefault Python Configuration:');
            logger.info(`Default Version: ${info.defaultVersion}`);
            logger.info('Environment Paths:');
            info.binPaths.forEach(path => {
                logger.info(`  ${path}`);
            });

            // Get system path information for default version
            const defaultVersion = info.versions.find(v => v.isDefault && v.isInstalled);
            if (defaultVersion) {
                try {
                    logger.info('\nPython System Paths:');
                    const sysPath = await execCmd(`"${defaultVersion.exePath}" -c "import sys; print('\\n'.join(sys.path))"`);
                    sysPath.split('\n').forEach(line => {
                        if (line.trim()) {
                            logger.info(`  ${line.trim()}`);
                        }
                    });

                    logger.info('\nPython Build Information:');
                    const buildInfo = await execCmd(`"${defaultVersion.exePath}" -c "import sys; print(sys.version)"`);
                    logger.info(`  ${buildInfo.trim()}`);
                } catch (error) {
                    logger.error('Error getting Python system information:', error);
                }
            }
        } else {
            logger.warn('No default Python version is installed');
        }
    }

    /**
     * Uninstall Python
     * @param {Object} version - Version object from PYTHON_VERSIONS
     * @param {boolean} [quiet=false] - Whether to run in quiet mode
     */
    async uninstallPython(version, quiet = false) {
        try {
            logger.info(`Uninstalling Python ${version.version}...`);
            const installFile = await this.downloadPythonZip(version, false);  // Get path without downloading
            const logFile = path.join(gconfig.DOWNLOAD_DIR, `uninstall_python${version.version}.log`);

            // Build uninstall command with appropriate parameters
            const uninstallParams = [
                quiet ? '/quiet' : '/passive',  // /quiet for silent, /passive for progress bar
                '/uninstall'                    // Uninstall mode
            ];

            if (fs.existsSync(logFile)) {
                uninstallParams.push(`/log "${logFile}"`);
            }

            const uninstallCmd = `${installFile} ${uninstallParams.join(' ')}`;

            if (!fs.existsSync(installFile)) {
                logger.warn(`Installation file not found: ${installFile}`);
                logger.info(`Would execute command: ${uninstallCmd}`);
                logger.info(`To perform uninstallation, please download the installer first using:`);
                logger.info(`await downloadPythonZip(version, true)`);
                return false;
            }

            logger.info(`Running uninstall command: ${uninstallCmd}`);
            await pipeExecCmd(uninstallCmd);
            logger.success(`Python ${version.version} uninstalled successfully`);
            try{
                fs.unlinkSync(version.tmpInstallDir);
            }catch(error){
                logger.error(`Failed to delete temporary installation directory: ${error.message}`);
            }
            return true;
        } catch (error) {
            logger.error(`Failed to uninstall Python ${version.version}:`, error);
            return false;
        }
    }
}

module.exports = new GetPythonWin();