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
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@commander');
const logger = require('#@logger');
const langdir = gconfig.DEV_LANG_DIR;

class GetGolang {
    constructor() {
        this.golangVersions = {
            1.22: "go1.22.5.windows-amd64.zip" // Latest version added
        };
        this.defaultVersionKey = 1.22;
        this.installDir = path.join(langdir);
        
    }

    getDefaultVersion() {
        const details = this.getVersionDetails(this.defaultVersionKey);
        const baseDir = new Set();

        if (details?.golangPath) {
            const golangBaseDir = path.dirname(details.golangPath);
            baseDir.add(golangBaseDir);
        }

        return {
            versionKey: details?.golangVersionKey || null,
            version: details?.golangVersion || null,
            dir: details?.golangDir || null,
            url: details?.golangUrl || null,
            installDir: details?.golangInstallDir || null,
            path: details?.golangPath || null,
            baseDir: Array.from(baseDir)
        };
    }

    getVersionDetails(versionKey) {
        if (!this.cachedVersionDetails) {
            this.cachedVersionDetails = {};
        }
        if (this.cachedVersionDetails[versionKey]) {
            return this.cachedVersionDetails[versionKey];
        }

        if (this.golangVersions[versionKey]) {
            const golangFileName = this.golangVersions[versionKey];
            const golangDir = golangFileName.replace(/\.(zip|tar\.gz)$/, '');
            const golangUrl = `https://go.dev/dl/${golangFileName}`;
            const golangInstallDir = path.join(this.installDir, golangDir);
            const golangPath = path.join(golangInstallDir, 'bin', os.platform() === 'win32' ? 'go.exe' : 'go');
            this.cachedVersionDetails[versionKey] = {
                golangVersionKey: versionKey,
                golangVersion: golangFileName,
                golangDir,
                golangUrl,
                golangInstallDir,
                golangPath
            };
            return this.cachedVersionDetails[versionKey];
        } else {
            logger.error(`Golang version key ${versionKey} is not supported.`);
            return null;
        }
    }

    setGolangVersion(versionKey) {
        const versionDetails = this.getVersionDetails(versionKey);
        if (versionDetails) {
            this.golangVersionKey = versionDetails.golangVersionKey;
            this.golangVersion = versionDetails.golangVersion;
            this.golangDir = versionDetails.golangDir;
            this.golangUrl = versionDetails.golangUrl;
            this.golangInstallDir = versionDetails.golangInstallDir;
            this.golangPath = versionDetails.golangPath;
        }
    }

    async start(versionKey = null) {
        await bdir.initializedBDir();
        this.tar = await bdir.getTarExecutable();
        this.curl = await bdir.getCurlExecutable();

        this.prepareDirectories();
        if (versionKey !== null) {
            this.setGolangVersion(versionKey);
            await this.installGolang();
        } else {
            for (const key of Object.keys(this.golangVersions)) {
                this.setGolangVersion(key);
                await this.installGolang();
            }
        }
    }

    async installGolang() {
        if (this.checkGolangInstalled()) {
            logger.info(`Golang ${this.golangVersion} is already installed.`);
        } else {
            await this.downloadAndExtractGolang();
        }
        await this.verifyInstallation();
        await this.configureGolang();
    }

    checkGolangInstalled() {
        return fs.existsSync(this.golangPath);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(gconfig.DOWNLOAD_DIR)) {
            fs.mkdirSync(gconfig.DOWNLOAD_DIR, { recursive: true });
        }
    }

    async downloadAndExtractGolang() {
        logger.info(`Downloading Golang ${this.golangVersion} from ${this.golangUrl}...`);
        const tempGolangArchive = path.join(gconfig.DOWNLOAD_DIR, this.golangVersions[this.golangVersionKey]);
        
        // Use curl with -L and -k parameters
        await execCmd(`${this.curl} -L -k -o "${tempGolangArchive}" "${this.golangUrl}"`);

        logger.info(`Extracting Golang ${this.golangVersion}...`);
        if (os.platform() === 'win32') {
            await execCmd(`${this.tar} -xf "${tempGolangArchive}" -C "${this.installDir}"`);
        } else {
            await execCmd(`sudo ${this.tar} -C "${this.installDir}" -xzf "${tempGolangArchive}"`);
        }

        // Rename the extracted 'go' directory to golangInstallDir
        const extractedDir = path.join(this.installDir, 'go');
        if (fs.existsSync(extractedDir)) {
            fs.renameSync(extractedDir, this.golangInstallDir);
        }
    }

    async verifyInstallation() {
        if (fs.existsSync(this.golangPath)) {
            logger.info(`Golang ${this.golangVersion} installed successfully.`);
            const version = await execCmdResultText(`"${this.golangPath}" version`);
            logger.info(`Golang version: ${version}`);
        } else {
            logger.error(`Golang ${this.golangVersion} installation failed.`);
        }
    }

    async configureGolang() {
        const goBin = path.join(this.golangInstallDir, 'bin');
        if (!process.env.PATH.includes(goBin)) {
            process.env.PATH = `${goBin}${path.delimiter}${process.env.PATH}`;
        }

        const proxyUrl = "https://goproxy.cn,direct";
        const goProxy = await execCmdResultText(`"${this.golangPath}" env GOPROXY`);
        if (!goProxy.trim().includes("goproxy.cn")) {
            logger.info("Setting Go proxy settings...");
            await execCmd(`"${this.golangPath}" env -w GO111MODULE=on`);
            await execCmd(`"${this.golangPath}" env -w GOPROXY=${proxyUrl}`);
        } else {
            logger.info(`GOPROXY is already set to ${proxyUrl}`);
        }
    }

    /**
     * 获取安装信息，包括环境变量路径和可执行文件路径
     * @returns {{
     *   binPaths: string[],      // 需要添加到环境变量的路径数组
     *   versionExePath: string,  // 用于检查版本的可执行文件完整路径
     *   defaultVersion: string,  // 默认版本号
     *   installedVersions: number // 已安装的版本数量
     * }}
     */
    getInstallInfo() {
        try {
            // 使用正确的安装目录属性
            const installDir = this.golangInstallDir;
            if (!fs.existsSync(installDir)) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.golangVersions[this.defaultVersionKey],
                    installedVersions: 0
                };
            }

            // 收集所有需要的路径
            const binPaths = [];
            
            // Go 主目录
            if (fs.existsSync(installDir)) {
                binPaths.push(installDir);
            }

            // bin 目录
            const binPath = path.join(installDir, 'bin');
            if (fs.existsSync(binPath)) {
                binPaths.push(binPath);
            }

            // pkg 目录
            const pkgPath = path.join(installDir, 'pkg');
            if (fs.existsSync(pkgPath)) {
                binPaths.push(pkgPath);
            }

            // 查找 go.exe
            const versionExePath = path.join(binPath, 'go.exe');
            const isValidInstall = fs.existsSync(versionExePath);

            // 获取已安装的版本数量
            let installedVersions = 0;
            if (isValidInstall) {
                installedVersions = 1; // Go 通常只安装一个版本
            }

            return {
                binPaths,
                versionExePath: isValidInstall ? versionExePath : null,
                defaultVersion: this.golangVersions[this.defaultVersionKey],
                installedVersions
            };
        } catch (error) {
            logger.error('Error getting Go installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.golangVersions[this.defaultVersionKey],
                installedVersions: 0
            };
        }
    }

    /**
     * 打印 Go 版本信息
     */
    async printVersionInfo() {
        const { versionExePath, defaultVersion, installedVersions } = this.getInstallInfo();
        
        if (versionExePath && installedVersions > 0) {
            try {
                const version = await execCmd(`"${versionExePath}" version`);
                logger.info(`Go Version: ${version.trim()}`);
                logger.info(`Default Version ID: ${defaultVersion}`);
                logger.info(`Installed Versions: ${installedVersions}`);
                logger.info(`Executable Path: ${versionExePath}`);

                // 额外显示 Go 环境信息
                const goEnv = await execCmd(`"${versionExePath}" env`);
                logger.info('Go Environment:');
                goEnv.split('\n').forEach(line => {
                    if (line.trim()) {
                        logger.info(`  ${line.trim()}`);
                    }
                });
            } catch (error) {
                logger.error('Error getting Go version:', error);
            }
        } else {
            logger.warn('Go is not properly installed');
        }
    }
}

const getGolang = new GetGolang();
module.exports = getGolang;
