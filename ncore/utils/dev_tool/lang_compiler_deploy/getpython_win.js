const os = require('os');
const path = require('path');
const fs = require('fs');
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const langdir = gconfig.DEV_LANG_DIR;
const { gdir } = require('#@globalvars');
const { PYTHON_VERSIONS } = require('./config/index.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');

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
            await bdir.initializedBDir();
            this.tar = await bdir.getTarExecutable();
            this.curl = await bdir.getCurlExecutable();

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
            for (const pythonItem of pythonItems) {
                this.setPythonVersion(pythonItem);
                await this.installPython();
            }
            return true;
        } catch (error) {
            logger.error('Python installation process encountered an error:', error);
            return false;
        }
    }

    async installPython() {
        if (this.checkPythonInstalled()) {
            logger.info(`Python ${this.pythonVersionKey} is already installed.`);
        } else {
            logger.info(`Python ${this.pythonVersionKey} is not installed.`);
            logger.info(this.pythonVersionKey);
            await this.downloadAndExtractPython();
        }
        await this.verifyInstallation();
        await this.configurePython();
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

    async downloadAndExtractPython() {
        logger.info(`Downloading Python ${this.pythonVersionKey}...`);
        const tempPythonZip = path.join(this.tempDir, this.pythonFileName);
        if (!fs.existsSync(tempPythonZip)) {
            await pipeExecCmd(`${this.curl} -L -k -o "${tempPythonZip}" "${this.pythonUrl}"`);
        }
        await this.installPythonByExe(tempPythonZip);
    }

    async installPythonByExe(installFile) {
        logger.info(`Installing Python ${this.pythonVersionKey} from ${installFile}...`);
        if (!fs.existsSync(this.pythonInstallDir)) {
            fs.mkdirSync(this.pythonInstallDir, { recursive: true });
        }
        const installCmd = `${installFile} /quiet InstallAllUsers=1 TargetDir="${this.pythonInstallDir}"`;
        logger.info(installCmd);
        await pipeExecCmd(installCmd);
    }

    async verifyInstallation() {
        const pythonExePath = path.join(this.pythonInstallDir, 'python.exe');
        if (fs.existsSync(pythonExePath)) {
            logger.info(`Python ${this.pythonVersionKey} installed successfully.`);
            const version = await execCmdResultText(`"${pythonExePath}" --version`);
            logger.info(`Python version: ${version}`);
        } else {
            logger.error(`Python ${this.pythonVersionKey} installation failed.`);
        }
    }

    async configurePython() {
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
            await execCmd(`"${pipPath}" config set global.index-url https://mirrors.huaweicloud.com/repository/pypi/simple`);
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
                await pipeExecCmd(`"${pythonExePath}" -m pip install --upgrade pip`);
                await pipeExecCmd(`"${pythonExePath}" -m pip install ${packagesToInstall.join(' ')}`);
                installedConfig.installedPackages.push(...packagesToInstall);
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