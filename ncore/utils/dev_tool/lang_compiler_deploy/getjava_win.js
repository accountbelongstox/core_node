const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@globalvars');
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
const logger = require('#@logger');
const langdir = gconfig.DEV_LANG_DIR;

class GetJavaWin {
    constructor() {
        this.javaVersions = {
            // 8: "jre-8u421-windows-x64.exe",
            22: "jdk-22_windows-x64_bin.zip"
        };
        this.defaultVersionKey = 22;
        this.installDir = path.join(langdir);
        this.tempDir = path.join(this.installDir, 'tmp');
        this.prepareDirectories();
    }

    getDefaultVersion() {
        const details = this.getVersionDetails(this.defaultVersionKey);
        const baseDir = new Set();

        if (details?.javaPath) {
            const javaBaseDir = path.dirname(details.javaPath);
            baseDir.add(javaBaseDir);
        }

        return {
            versionKey: details?.javaVersionKey || null,
            version: details?.javaVersion || null,
            dir: details?.javaDir || null,
            url: details?.javaUrl || null,
            installDir: details?.javaInstallDir || null,
            path: details?.javaPath || null,
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

        if (this.javaVersions[versionKey]) {
            const javaFileName = this.javaVersions[versionKey];
            const javaUrl = versionKey === 8
                ? `https://javadl.oracle.com/webapps/download/AutoDL?BundleId=250129_d8aa705069af427f9b83e66b34f5e380`
                : `https://download.oracle.com/java/22/latest/${javaFileName}`;
            
            const baseFileName = javaFileName.split('-')[0];
            const installDirName = `java-${baseFileName}-${versionKey}`;
            const javaInstallDir = path.join(this.installDir, installDirName);
            const javaPath = path.join(javaInstallDir, 'bin', 'java.exe');
            
            this.cachedVersionDetails[versionKey] = {
                javaVersionKey: versionKey,
                javaVersion: javaFileName,
                javaDir: installDirName,
                javaUrl,
                javaInstallDir,
                javaPath
            };
            return this.cachedVersionDetails[versionKey];
        } else {
            logger.error(`Java version key ${versionKey} is not supported.`);
            return null;
        }
    }

    setJavaVersion(versionKey) {
        const versionDetails = this.getVersionDetails(versionKey);
        if (versionDetails) {
            this.javaVersionKey = versionDetails.javaVersionKey;
            this.javaVersion = versionDetails.javaVersion;
            this.javaDir = versionDetails.javaDir;
            this.javaUrl = versionDetails.javaUrl;
            this.javaInstallDir = versionDetails.javaInstallDir;
            this.javaPath = versionDetails.javaPath;
        }
    }

    async start(versionKey = null) {
        await bdir.initializedBDir();
        this.tar = await bdir.getTarExecutable();
        this.curl = await bdir.getCurlExecutable();

        if (versionKey !== null) {
            this.setJavaVersion(versionKey);
            await this.installJava();
        } else {
            for (const key of Object.keys(this.javaVersions)) {
                this.setJavaVersion(key);
                await this.installJava();
            }
        }
    }

    async installJava() {
        if (this.checkJavaInstalled()) {
            logger.info(`Java ${this.javaVersion} is already installed.`);
        } else {
            await this.downloadAndExtractJava();
        }
        await this.verifyInstallation();
        await this.configureJava();
    }

    checkJavaInstalled() {
        return fs.existsSync(this.javaInstallDir);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async downloadAndExtractJava() {
        logger.info(`Downloading Java ${this.javaVersion} from ${this.javaUrl}...`);
        const tempJavaFile = path.join(this.tempDir, this.javaVersion);

        // Use curl with -L and -k parameters
        await execCmd(`${this.curl} -L -k -o "${tempJavaFile}" "${this.javaUrl}"`);

        logger.info(`Extracting Java ${this.javaVersion}...`);
        if (this.javaVersion.endsWith('.exe')) {
            await execCmd(`msiexec /a "${tempJavaFile}" /qb TARGETDIR="${this.javaInstallDir}"`);
        } else if (this.javaVersion.endsWith('.zip')) {
            await this.extractZip(tempJavaFile, this.installDir);
        } else {
            logger.error(`Unsupported file format for ${this.javaVersion}`);
        }
    }

    async extractZip(zipPath, targetDir) {
        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        logger.info(`Unzipping ${zipPath} to ${targetDir}...`);
        await execCmd(`${this.tar} -xf "${zipPath}" -C "${targetDir}"`);

        // Find the extracted directory and rename it to the installation directory name
        const extractedDirName = fs.readdirSync(targetDir).find(dir => dir.startsWith(`jdk-${this.javaVersionKey}`));
        const extractedDir = path.join(targetDir, extractedDirName);

        if (fs.existsSync(extractedDir)) {
            fs.renameSync(extractedDir, this.javaInstallDir);
        } else {
            logger.error(`Failed to locate extracted directory: ${extractedDirName}`);
        }
    }

    async verifyInstallation() {
        logger.info(`Verifying installation of Java at ${this.javaPath}...`);
        if (fs.existsSync(this.javaPath)) {
            logger.info(`Java ${this.javaVersion} installed successfully.`);
            const version = await execCmdResultText(`"${this.javaPath}" -version`);
            logger.info(`Java version: ${version}`);
        } else {
            logger.error(`Java ${this.javaVersion} installation failed.`);
        }
    }

    async configureJava() {
        const javaBin = path.join(this.javaInstallDir, 'bin');
        if (!process.env.PATH.includes(javaBin)) {
            process.env.PATH = `${javaBin}${path.delimiter}${process.env.PATH}`;
        }

        // Add any additional Java configuration here if needed
    }
}

module.exports = new GetJavaWin();