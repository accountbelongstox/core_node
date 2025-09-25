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
const langdir = gconfig.DEV_LANG_DIR;

class GetNodeWin {
    constructor() {
        this.nodeVersions = {
            18: "v18.20.4",
            20: "v20.16.0",
            22: "v22.5.1"
        };
        this.nodeDirBase = langdir;
        this.defaultVersionKey = 20;
        this.installDir = path.join(langdir);
        
    }

    getDefaultVersion() {
        const details = this.getVersionDetails(this.defaultVersionKey);
        const baseDir = new Set();
        if (details?.npmPath) {
            const npmBaseDir = path.dirname(details.npmPath);
            baseDir.add(npmBaseDir);
        }
        if (details?.path) {
            const pathBaseDir = path.dirname(details.path);
            baseDir.add(pathBaseDir);
        }
        return {
            versionKey: details?.nodeVersionKey || null,
            version: details?.nodeVersion || null,
            dir: details?.nodeDir || null,
            url: details?.nodeUrl || null,
            installDir: details?.nodeInstallDir || null,
            path: details?.nodePath || null,
            npmPath: null,                      // For Node.js specific, not applicable here
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

        if (this.nodeVersions[versionKey]) {
            const nodeVersion = this.nodeVersions[versionKey];
            const nodeDir = `node-${nodeVersion}-win-x64`;
            const nodeUrl = `https://nodejs.org/dist/${nodeVersion}/${nodeDir}.zip`;
            const nodeInstallDir = path.join(this.installDir, nodeDir);
            const nodePath = path.join(nodeInstallDir, 'node.exe');
            const npmPath = path.join(nodeInstallDir, 'npm.cmd');
            this.cachedVersionDetails[versionKey] = {
                nodeVersionKey: versionKey,
                nodeVersion,
                nodeDir,
                nodeUrl,
                nodeInstallDir,
                nodePath,
                npmPath
            };
            return this.cachedVersionDetails[versionKey];
        } else {
            logger.error(`Node.js version key ${versionKey} is not supported.`);
            return null;
        }
    }

    setNodeVersion(versionKey) {
        const versionDetails = this.getVersionDetails(versionKey);
        if (versionDetails) {
            this.nodeVersionKey = versionDetails.nodeVersionKey;
            this.nodeVersion = versionDetails.nodeVersion;
            this.nodeDir = versionDetails.nodeDir;
            this.nodeUrl = versionDetails.nodeUrl;
            this.nodeInstallDir = versionDetails.nodeInstallDir;
            this.nodePath = versionDetails.nodePath;
            this.npmPath = versionDetails.npmPath;
        }
    }

    async start(versionKey = null) {
        await bdir.initializedBDir();
        this.tar = await bdir.getTarExecutable();
        this.curl = await bdir.getCurlExecutable();

        this.prepareDirectories();
        if (versionKey !== null) {
            this.setNodeVersion(versionKey);
            await this.installNode();
        } else {
            for (const key of Object.keys(this.nodeVersions)) {
                this.setNodeVersion(key);
                await this.installNode();
            }
        }
    }

    async installNode() {
        if (this.checkNodeInstalled()) {
            logger.info(`Node.js ${this.nodeVersion} is already installed.`);
        } else {
            await this.downloadAndExtractNode();
        }
        await this.verifyInstallation();
        await this.configureNode();
    }

    checkNodeInstalled() {
        return fs.existsSync(this.nodePath);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(gconfig.DOWNLOAD_DIR)) {
            fs.mkdirSync(gconfig.DOWNLOAD_DIR, { recursive: true });
        }
    }

    async downloadAndExtractNode() {
        logger.info(`Downloading Node.js ${this.nodeVersion}...`);
        const tempNodeZip = path.join(gconfig.DOWNLOAD_DIR, `${this.nodeDir}.zip`);
        // Use the curl executable with -L -k parameters
        await execCmd(`${this.curl} -L -k -o "${tempNodeZip}" "${this.nodeUrl}"`);

        logger.info(`Extracting Node.js ${this.nodeVersion}...`);
        // Use the tar executable path for extraction
        await execCmd(`${this.tar} -xf "${tempNodeZip}" -C "${this.installDir}"`);
    }

    async verifyInstallation() {
        if (fs.existsSync(this.nodePath)) {
            logger.info(`Node.js ${this.nodeVersion} version:`);
            const version = await execCmdResultText(`"${this.nodePath}" -v`);
            logger.info(version);
        } else {
            logger.error(`Node.js ${this.nodeVersion} installation failed.`);
        }
    }

    async configureNode() {
        const installedConfigPath = path.join(path.dirname(this.nodePath), '.installed.json');
        let installedConfig = {};

        if (fs.existsSync(installedConfigPath)) {
            installedConfig = JSON.parse(fs.readFileSync(installedConfigPath, 'utf8'));
        }

        if (!installedConfig.npmConfigured) {
            await execCmd(`"${this.npmPath}" config delete proxy`);
            await execCmd(`"${this.npmPath}" config delete https-proxy`);

            await execCmd(`"${this.npmPath}" config set registry https://mirrors.huaweicloud.com/repository/npm/`);
            await execCmd(`"${this.npmPath}" config set prefix "${this.nodeInstallDir}"`);
            installedConfig.npmConfigured = true;
        }

        const globalPackages = ['yarn', 'pnpm', 'cnpm', 'pm2'];
        for (const pkg of globalPackages) {
            if (!installedConfig[pkg]) {
                await execCmd(`"${this.npmPath}" install -g ${pkg}`);
                installedConfig[pkg] = true;
            }
        }

        fs.writeFileSync(installedConfigPath, JSON.stringify(installedConfig, null, 2), 'utf8');
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
            const installDir = this.nodeInstallDir;
            if (!fs.existsSync(installDir)) {
                return {
                    binPaths: [],
                    versionExePath: null,
                    defaultVersion: this.nodeVersions[this.defaultVersionKey].version,
                    installedVersions: 0
                };
            }

            // 收集所有需要的路径
            const binPaths = [];
            
            // Node 主目录
            if (fs.existsSync(installDir)) {
                binPaths.push(installDir);
            }

            // npm 全局模块目录
            const npmGlobalPath = path.join(installDir, 'node_modules');
            if (fs.existsSync(npmGlobalPath)) {
                binPaths.push(npmGlobalPath);
                
                // npm 全局 bin 目录
                const npmBinPath = path.join(npmGlobalPath, '.bin');
                if (fs.existsSync(npmBinPath)) {
                    binPaths.push(npmBinPath);
                }
            }

            // 查找 node.exe
            const versionExePath = path.join(installDir, 'node.exe');
            const isValidInstall = fs.existsSync(versionExePath);

            // 获取已安装的版本数量
            let installedVersions = 0;
            if (isValidInstall) {
                // 检查关键文件是否存在
                const npmPath = path.join(installDir, 'npm.cmd');
                const npxPath = path.join(installDir, 'npx.cmd');
                if (fs.existsSync(npmPath) && fs.existsSync(npxPath)) {
                    installedVersions = 1; // Node.js 通常只安装一个版本
                }
            }

            return {
                binPaths,
                versionExePath: isValidInstall ? versionExePath : null,
                defaultVersion: this.nodeVersions[this.defaultVersionKey].version,
                installedVersions
            };
        } catch (error) {
            logger.error('Error getting Node.js installation info:', error);
            return {
                binPaths: [],
                versionExePath: null,
                defaultVersion: this.nodeVersions[this.defaultVersionKey].version,
                installedVersions: 0
            };
        }
    }

    /**
     * 打印 Node.js 版本信息
     */
    async printVersionInfo() {
        const { versionExePath, defaultVersion, installedVersions, binPaths } = this.getInstallInfo();
        
        if (versionExePath && installedVersions > 0) {
            try {
                // 获取 Node.js 版本
                const nodeVersion = await execCmd(`"${versionExePath}" --version`);
                logger.info(`Node.js Version: ${nodeVersion.trim()}`);
                
                // 获取 npm 版本
                const npmPath = path.join(path.dirname(versionExePath), 'npm.cmd');
                const npmVersion = await execCmd(`"${npmPath}" --version`);
                logger.info(`npm Version: ${npmVersion.trim()}`);

                logger.info(`Default Version: ${defaultVersion}`);
                logger.info(`Installed Versions: ${installedVersions}`);
                logger.info(`Executable Path: ${versionExePath}`);

                // 显示环境信息
                logger.info('Environment Information:');
                const nodeEnv = await execCmd(`"${versionExePath}" -p "process.versions"`);
                logger.info(nodeEnv.trim());

                // 显示配置信息
                logger.info('Node.js Configuration Paths:');
                binPaths.forEach(path => {
                    logger.info(`  ${path}`);
                });

                // 显示全局 npm 配置
                logger.info('npm Global Configuration:');
                const npmConfig = await execCmd(`"${npmPath}" config list`);
                npmConfig.split('\n').forEach(line => {
                    if (line.trim() && !line.includes('; ')) {
                        logger.info(`  ${line.trim()}`);
                    }
                });

                // 显示已安装的全局包
                logger.info('Global npm Packages:');
                const globalPackages = await execCmd(`"${npmPath}" list -g --depth=0`);
                globalPackages.split('\n').forEach(line => {
                    if (line.trim()) {
                        logger.info(`  ${line.trim()}`);
                    }
                });

            } catch (error) {
                logger.error('Error getting Node.js version:', error);
            }
        } else {
            logger.warn('Node.js is not properly installed');
        }
    }
}

module.exports = new GetNodeWin();