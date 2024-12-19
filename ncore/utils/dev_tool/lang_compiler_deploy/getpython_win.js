const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const { bdir } = require('#@/ncore/gvar/bdir.js');
    const gconfig = require('#@/ncore/gvar/gconfig.js');
    const langdir = gconfig.DEV_LANG_DIR;
    const { gdir } = require('#@globalvars');
    const { PYTHON_VERSIONS } = require('./config/index.js');
    const { pipeExecCmd, execCmd } = require('#@utils_commander');
    const logger = require('#@utils_logger');

    // Retrieve tar and curl executables
    const tar = bdir.getTarExecutable();
    const curl = bdir.getCurlExecutable();

    class GetPythonWin {
        constructor() {
            this.pythonDirBase = langdir;
            this.defaultVersionKey = '3.9.13';
            this.installDir = path.join(langdir);
            this.tempDir = path.join(this.installDir, 'tmp');
        }

        getDefaultVersion() {
            const details = this.getVersionDetails(this.defaultVersionKey);
            const baseDir = new Set();

            const pythonBaseDir = path.dirname(details.pythonPath);
            baseDir.add(pythonBaseDir);
            const pipBaseDir = path.dirname(details.pipPath);
            baseDir.add(pipBaseDir);
            return {
                versionKey: details?.pythonVersionKey || null,
                version: details?.pythonVersion || null,
                dir: details?.pythonFileName || null,
                url: details?.pythonUrl || null,
                installDir: details?.pythonInstallDir || null,
                path: details?.pythonPath || null,
                pipPath: pipBaseDir,
                baseDir: Array.from(baseDir),
            };
        }

        getVersionDetails(pythonItemOrVersionKey) {
            let pythonItem = null;
            if (typeof pythonItemOrVersionKey == "string") {
                pythonItem = PYTHON_VERSIONS.find(item =>
                    item.version.startsWith(pythonItemOrVersionKey)
                );
            } else {
                pythonItem = pythonItemOrVersionKey;
            }
            const versionKey = pythonItem.version;
            if (!this.cachedVersionDetails) {
                this.cachedVersionDetails = {};
            }
            if (this.cachedVersionDetails[versionKey]) {
                return this.cachedVersionDetails[versionKey];
            }

            this.pythonVersionKey = versionKey;
            this.pythonUrl = pythonItem.win64.url;
            this.pythonFileName = path.basename(this.pythonUrl);
            this.pythonInstallDir = path.join(this.installDir, `Python${versionKey}`);
            const pythonPath = path.join(this.pythonInstallDir, 'python.exe');
            const pipPath = path.join(
                this.pythonInstallDir,
                'Scripts',
                'pip.exe'
            );
            this.cachedVersionDetails[versionKey] = {
                pythonVersionKey: this.pythonVersionKey,
                pythonVersion: versionKey,
                pythonFileName: this.pythonFileName,
                pythonUrl: this.pythonUrl,
                pythonInstallDir: this.pythonInstallDir,
                pythonPath: pythonPath,
                pipPath: pipPath,
            };
            return this.cachedVersionDetails[versionKey];
        }

        setPythonVersion(pythonItem) {
            const versionDetails = this.getVersionDetails(pythonItem);
            if (versionDetails) {
                this.pythonVersionKey = versionDetails.pythonVersionKey;
                this.pythonFileName = versionDetails.pythonFileName;
                this.pythonUrl = versionDetails.pythonUrl;
                this.pythonInstallDir = versionDetails.pythonInstallDir;
            }
        }

        async start(versionKey = null) {
            try {
                const pythonItems = [];

                // Handle version selection
                if (versionKey) {
                    // Find matching version if specific version is requested
                    const matchVersion = PYTHON_VERSIONS.find(item =>
                        item.version.startsWith(versionKey)
                    );
                    if (matchVersion) {
                        pythonItems.push(matchVersion);
                    } else {
                        throw new Error(`Python version ${versionKey} not found in available versions`);
                    }
                } else {
                    pythonItems.push(...PYTHON_VERSIONS);
                }
                pythonItems.forEach((pythonItem) => {
                    this.setPythonVersion(pythonItem);
                    this.installPython();
                });
                return true;
            } catch (error) {
                console.error('Python installation process encountered an error:', error);
                return false;
            }
        }

        installPython() {
            if (this.checkPythonInstalled()) {
                console.log(`Python ${this.pythonVersionKey} is already installed.`);
            } else {
                console.log(`Python ${this.pythonVersionKey} is not installed.`);
                console.log(this.pythonVersionKey);
                this.downloadAndExtractPython();
            }
            this.verifyInstallation();
            this.configurePython();
        }

        checkPythonInstalled() {
            const pythonExePath = path.join(this.pythonInstallDir, 'python.exe');
            return fs.existsSync(pythonExePath);
        }

        prepareDirectories() {
            if (!fs.existsSync(this.installDir)) {
                fs.mkdirSync(this.installDir, { recursive: true });
            }

            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
        }

        downloadAndExtractPython() {
            console.log(`Downloading Python ${this.pythonVersionKey}...`);
            const tempPythonZip = path.join(this.tempDir, this.pythonFileName);
            if (!fs.existsSync(tempPythonZip)) {
                pipeExecCmd(`${curl} -L -k -o "${tempPythonZip}" "${this.pythonUrl}"`);
            }
            this.installPythonByExe(tempPythonZip);
        }

        installPythonByExe(installFile) {
            logger.info(`Installing Python ${this.pythonVersionKey} from ${installFile}...`);
            if (!fs.existsSync(this.pythonInstallDir)) {
                fs.mkdirSync(this.pythonInstallDir, { recursive: true });
            }
            const installCmd = `${installFile} /quiet InstallAllUsers=1 TargetDir="${this.pythonInstallDir}"`;
            logger.info(installCmd);
            pipeExecCmd(installCmd);
        }

        verifyInstallation() {
            const pythonExePath = path.join(this.pythonInstallDir, 'python.exe');
            if (fs.existsSync(pythonExePath)) {
                console.log(`Python ${this.pythonVersionKey} installed successfully.`);
                execCmd([pythonExePath, '--version']);
            } else {
                console.error(`Python ${this.pythonVersionKey} installation failed.`);
            }
        }

        configurePython() {
            const installedConfigPath = path.join(
                this.pythonInstallDir,
                '.installed.json'
            );
            let installedConfig = {};

            if (fs.existsSync(installedConfigPath)) {
                installedConfig = JSON.parse(
                    fs.readFileSync(installedConfigPath, 'utf8')
                );
            } else {
                fs.writeFileSync(
                    installedConfigPath,
                    JSON.stringify(installedConfig, null, 2),
                    'utf8'
                );
            }
            if (!installedConfig.installedPackages)
                installedConfig.installedPackages = [];

            const pipPath = path.join(
                this.pythonInstallDir,
                'Scripts',
                'pip.exe'
            );
            const pythonExePath = path.join(this.pythonInstallDir, 'python.exe');
            if (!installedConfig.pipConfigured) {
                execCmd([
                    pipPath,
                    'config',
                    'set',
                    'global.index-url',
                    'https://mirrors.huaweicloud.com/repository/pypi/simple',
                ]);
                installedConfig.pipConfigured = true;
            }
            installedConfig.installedPackages = installedConfig.installedPackages.map(
                (pkg) => pkg.trim().replace(/\r$/, '')
            );

            const requirementsFile = path.join(
                __dirname,
                '..',
                'provider',
                this.pythonVersionKey,
                os.platform() === 'linux'
                    ? '.requirements_linux.txt'
                    : '.requirements.txt'
            );
            if (fs.existsSync(requirementsFile)) {
                const packages = fs
                    .readFileSync(requirementsFile, 'utf8')
                    .split('\n')
                    .map((line) => line.trim().replace(/\r$/, ''))
                    .filter(Boolean);
                const packagesToInstall = packages.filter(
                    (pkg) => !installedConfig.installedPackages.includes(pkg)
                );

                logger.success(
                    'Already installed packages:',
                    installedConfig.installedPackages.join(' ')
                );

                if (packagesToInstall.length > 0) {
                    pipeExecCmd([
                        pythonExePath,
                        '-m',
                        'pip',
                        'install',
                        '--upgrade',
                        'pip',
                    ]);
                    logger.info('Packages to be installed:', packagesToInstall);
                    packagesToInstall.forEach((pkg) => {
                        try {
                            pipeExecCmd([pipPath, 'install', pkg]);
                            installedConfig.installedPackages.push(pkg);
                            fs.writeFileSync(
                                installedConfigPath,
                                JSON.stringify(installedConfig, null, 2),
                                'utf8'
                            );
                        } catch (e) {
                            console.log(e);
                        }
                    });
                }
            }

            fs.writeFileSync(
                installedConfigPath,
                JSON.stringify(installedConfig, null, 2),
                'utf8'
            );
        }
    }

    module.exports = new GetPythonWin();