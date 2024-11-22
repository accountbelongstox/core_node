import os from 'os';
import path from 'path';
import fs from 'fs';
import Base from '#@base';
import { gdir, com_bin } from '#@globalvars'; // Import com_bin

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Retrieve tar and curl executables
const tar = com_bin.getTarExecutable();
const curl = com_bin.getCurlExecutable();
const langdir = gdir.getDevLangPath();

class GetPythonWin extends Base {
    constructor() {
        super();
        this.pythonVersions = {
            // Anaconda3: "Anaconda3.zip",
            Python27: "Python27.zip",
            // Python310: "Python310.zip",
            Python311: "Python311.zip",
            // Python36: "Python36.zip",
            // Python38: "Python38.zip",
            Python39: "Python39.zip"
        };
        this.pythonDirBase = langdir;
        this.defaultVersionKey = 'Python39';
        this.installDir = path.join(langdir);
        this.tempDir = path.join(this.installDir, 'tmp');
        this.prepareDirectories();
    }

    getDefaultVersion() {
        const details = this.getVersionDetails(this.defaultVersionKey);
        const baseDir = new Set();
        if (details?.pythonPath) {
            const pythonBaseDir = path.dirname(details.pythonPath);
            baseDir.add(pythonBaseDir);
        }
        if (details?.pipPath) {
            const pipBaseDir = path.dirname(details.pipPath);
            baseDir.add(pipBaseDir);
        }
        if (details?.npmPath) {
            const npmBaseDir = path.dirname(details.npmPath);
            baseDir.add(npmBaseDir);
        }
        if (details?.path) {
            const pathBaseDir = path.dirname(details.path);
            baseDir.add(pathBaseDir);
        }
        return {
            versionKey: details?.pythonVersionKey || null,
            version: details?.pythonVersion || null,
            dir: details?.pythonFileName || null,
            url: details?.pythonUrl || null,
            installDir: details?.pythonInstallDir || null,
            path: details?.pythonPath || null,
            npmPath: null, // For Node.js specific, not applicable here
            pipPath: details?.pipPath || null,
            baseDir: Array.from(baseDir),
        };
    }

    getVersionDetails(versionKey) {
        if (!this.cachedVersionDetails) {
            this.cachedVersionDetails = {};
        }
        if (this.cachedVersionDetails[versionKey]) {
            return this.cachedVersionDetails[versionKey];
        }
        if (this.pythonVersions[versionKey]) {
            this.pythonVersionKey = versionKey;
            this.pythonFileName = this.pythonVersions[versionKey];
            this.pythonUrl = gdir.localDownloadUrl(
                `/softlist/lang_compiler/${this.pythonFileName}`
            );
            this.pythonInstallDir = path.join(this.installDir, versionKey);
            const pythonPath = path.join(this.pythonInstallDir, 'python.exe');
            const pipPath = path.join(
                this.pythonInstallDir,
                'Scripts',
                'pip.exe'
            );
            this.cachedVersionDetails[versionKey] = {
                pythonVersionKey: this.pythonVersionKey,
                pythonVersion: this.pythonVersions[versionKey],
                pythonFileName: this.pythonFileName,
                pythonUrl: this.pythonUrl,
                pythonInstallDir: this.pythonInstallDir,
                pythonPath: pythonPath,
                pipPath: pipPath,
            };
            return this.cachedVersionDetails[versionKey];
        } else {
            console.error(`Python version key ${versionKey} is not supported.`);
            return null;
        }
    }

    setPythonVersion(versionKey) {
        const versionDetails = this.getVersionDetails(versionKey);
        if (versionDetails) {
            this.pythonVersionKey = versionKey;
            this.pythonFileName = versionDetails.pythonFileName;
            this.pythonUrl = versionDetails.pythonUrl;
            this.pythonInstallDir = versionDetails.pythonInstallDir;
        }
    }

    start(versionKey = null) {
        if (versionKey !== null) {
            this.setPythonVersion(versionKey);
            this.installPython();
        } else {
            for (const key of Object.keys(this.pythonVersions)) {
                this.setPythonVersion(key);
                this.installPython();
            }
        }
    }

    installPython() {
        if (this.checkPythonInstalled()) {
            console.log(`Python ${this.pythonVersionKey} is already installed.`);
        } else {
            this.downloadAndExtractPython();
        }
        this.verifyInstallation();
        this.configurePython();
    }

    checkPythonInstalled() {
        return fs.existsSync(this.pythonInstallDir);
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
        
        // Use the curl executable with -L -k parameters
        this.pipeExecCmd(`${curl} -L -k -o "${tempPythonZip}" "${this.pythonUrl}"`);

        console.log(`Extracting Python ${this.pythonVersionKey}...`);
        
        // Use the tar executable path for extraction
        this.pipeExecCmd(`${tar} -xf "${tempPythonZip}" -C "${this.installDir}"`);
    }

    verifyInstallation() {
        const pythonExePath = path.join(this.pythonInstallDir, 'python.exe');
        if (fs.existsSync(pythonExePath)) {
            console.log(`Python ${this.pythonVersionKey} installed successfully.`);
            const version = this.execCmd([pythonExePath, '--version']);
            console.log(`Python version: ${version}`);
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
            this.execCmd([
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

            this.success(
                'Already installed packages:',
                installedConfig.installedPackages.join(' ')
            );

            if (packagesToInstall.length > 0) {
                this.pipeExecCmd([
                    pythonExePath,
                    '-m',
                    'pip',
                    'install',
                    '--upgrade',
                    'pip',
                ]);
                this.info('Packages to be installed:', packagesToInstall);
                packagesToInstall.forEach((pkg) => {
                    try {
                        this.pipeExecCmd([pipPath, 'install', pkg]);
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

export default new GetPythonWin();
