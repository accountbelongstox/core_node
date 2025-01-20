const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@globalvars');
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
const logger = require('#@logger');
const langdir = gconfig.DEV_LANG_DIR;

class GetGolang {
    constructor() {
        this.golangVersions = {
            1.22: "go1.22.5.windows-amd64.zip" // Latest version added
        };
        this.defaultVersionKey = 1.22;
        this.installDir = path.join(langdir);
        this.tempDir = path.join(this.installDir, 'tmp');
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

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async downloadAndExtractGolang() {
        logger.info(`Downloading Golang ${this.golangVersion} from ${this.golangUrl}...`);
        const tempGolangArchive = path.join(this.tempDir, this.golangVersions[this.golangVersionKey]);
        
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
}

const getGolang = new GetGolang();
module.exports = getGolang;
