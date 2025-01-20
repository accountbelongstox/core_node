const os = require('os');
const path = require('path');
const fs = require('fs');
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
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
        this.tempDir = path.join(this.installDir, 'tmp');
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

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async downloadAndExtractNode() {
        logger.info(`Downloading Node.js ${this.nodeVersion}...`);
        const tempNodeZip = path.join(this.tempDir, `${this.nodeDir}.zip`);
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
}

module.exports = new GetNodeWin();