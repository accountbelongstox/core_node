const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@globalvars'); // Import com_bin
const { bdir } = require('#@/ncore/gvar/bdir.js'); // Import com_bin from #@globalvars
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd } = require('#@utils_commander');

const langdir = gconfig.DEV_LANG_DIR;

const tar = bdir.getTarExecutable(); // Get the tar executable path
const curl = bdir.getCurlExecutable(); // Get the curl executable path

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
            const golangDir = golangFileName.replace(/\.(zip|tar\.gz)$/, ''); // Remove file extension to get the directory name
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
            console.error(`Golang version key ${versionKey} is not supported.`);
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
        this.prepareDirectories();
        if (versionKey !== null) {
            this.setGolangVersion(versionKey);
            this.installGolang();
        } else {
            for (const key of Object.keys(this.golangVersions)) {
                this.setGolangVersion(key);
                this.installGolang();
            }
        }
    }

    installGolang() {
        if (this.checkGolangInstalled()) {
            console.log(`Golang ${this.golangVersion} is already installed.`);
        } else {
            this.downloadAndExtractGolang();
        }
        this.verifyInstallation();
        this.configureGolang();
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

    downloadAndExtractGolang() {
        console.log(`Downloading Golang ${this.golangVersion} from ${this.golangUrl}...`);
        const tempGolangArchive = path.join(this.tempDir, this.golangVersions[this.golangVersionKey]);
        
        // Use curl with -L and -k parameters
        execCmd(`${curl} -L -k -o "${tempGolangArchive}" "${this.golangUrl}"`);

        console.log(`Extracting Golang ${this.golangVersion}...`);
        if (os.platform() === 'win32') {
            execCmd(`${tar} -xf "${tempGolangArchive}" -C "${this.installDir}"`);
        } else {
            execCmd(`sudo ${tar} -C "${this.installDir}" -xzf "${tempGolangArchive}"`);
        }

        // Rename the extracted 'go' directory to golangInstallDir
        const extractedDir = path.join(this.installDir, 'go');
        if (fs.existsSync(extractedDir)) {
            fs.renameSync(extractedDir, this.golangInstallDir);
        }
    }

    verifyInstallation() {
        if (fs.existsSync(this.golangPath)) {
            console.log(`Golang ${this.golangVersion} installed successfully.`);
            const version = execCmd(`"${this.golangPath}" version`);
            console.log(`Golang version: ${version}`);
        } else {
            console.error(`Golang ${this.golangVersion} installation failed.`);
        }
    }

    configureGolang() {
        const goBin = path.join(this.golangInstallDir, 'bin');
        if (!process.env.PATH.includes(goBin)) {
            process.env.PATH = `${goBin}${path.delimiter}${process.env.PATH}`;
        }

        const proxyUrl = "https://goproxy.cn,direct";
        const goProxy = execCmd(`"${this.golangPath}" env GOPROXY`).trim();
        if (!goProxy.includes("goproxy.cn")) {
            console.log("Setting Go proxy settings...");
            execCmd(`"${this.golangPath}" env -w GO111MODULE=on`);
            execCmd(`"${this.golangPath}" env -w GOPROXY=${proxyUrl}`);
        } else {
            console.log(`GOPROXY is already set to ${proxyUrl}`);
        }
    }
}

const getGolang = new GetGolang();
module.exports = getGolang;
