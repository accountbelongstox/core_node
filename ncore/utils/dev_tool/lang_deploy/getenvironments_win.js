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

class GetBaseLibs {
    constructor() {
        this.libVersions = {
            environments: 'environments.zip'
        };
        this.libDirBase = langdir;
        this.defaultVersionKey = 'environments';
        this.installDir = path.join(langdir);
        
    }

    getDefaultVersion() {
        const details = this.getVersionDetails(this.defaultVersionKey);
        const baseDir = new Set();
        if (details?.installDir) {
            baseDir.add(details?.installDir);
        }
        return {
            versionKey: details?.versionKey || null,
            version: details?.version || null,
            fileName: details?.fileName || null,
            url: details?.url || null,
            installDir: details?.installDir || null,
            path: details?.path || null,
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

        if (this.libVersions[versionKey]) {
            this.versionKey = versionKey;
            this.fileName = this.libVersions[versionKey];
            this.url = gdir.localDownloadUrl(`/softlist/lang_compiler/${this.fileName}`);
            const libpath = this.installDir;
            this.installDir = path.join(this.installDir, versionKey);
            const filePath = path.join(this.installDir, this.fileName);

            this.cachedVersionDetails[versionKey] = {
                versionKey: this.versionKey,
                version: '1.0.0',
                fileName: this.fileName,
                url: this.url,
                installDir: this.installDir,
                path: filePath
            };

            return this.cachedVersionDetails[versionKey];
        } else {
            logger.error(`Version key ${versionKey} is not supported.`);
            return null;
        }
    }

    setVersion(versionKey) {
        const versionDetails = this.getVersionDetails(versionKey);
        if (versionDetails) {
            this.versionKey = versionKey;
            this.fileName = versionDetails.fileName;
            this.url = versionDetails.url;
            this.installDir = versionDetails.installDir;
        }
    }

    async start(versionKey = null) {
        await bdir.initializedBDir();
        this.tar = await bdir.getTarExecutable();
        this.curl = await bdir.getCurlExecutable();
        
        this.prepareDirectories();
        if (versionKey !== null) {
            this.setVersion(versionKey);
            await this.installLib();
        } else {
            for (const key of Object.keys(this.libVersions)) {
                this.setVersion(key);
                await this.installLib();
            }
        }
    }

    async installLib() {
        if (this.checkLibInstalled()) {
            logger.info(`Library ${this.versionKey} is already installed.`);
        } else {
            await this.downloadAndExtractLib();
        }
        await this.verifyInstallation();
        await this.configureLib();
    }

    checkLibInstalled() {
        return fs.existsSync(this.installDir);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(gconfig.DOWNLOAD_DIR)) {
            fs.mkdirSync(gconfig.DOWNLOAD_DIR, { recursive: true });
        }
    }

    async downloadAndExtractLib() {
        logger.info(`Downloading ${this.fileName}...`);
        const tempLibFile = path.join(gconfig.DOWNLOAD_DIR, this.fileName);

        // Use curl with -L and -k parameters
        await execCmd(`${this.curl} -L -k -o "${tempLibFile}" "${this.url}"`);

        logger.info(`Extracting ${this.fileName}...`);
        await execCmd(`${this.tar} -xf "${tempLibFile}" -C "${langdir}"`);
    }

    async verifyInstallation() {
        const versionPath = path.join(this.installDir, 'version.txt');
        if (fs.existsSync(versionPath)) {
            logger.info(`${this.fileName} installed successfully.`);
            const version = fs.readFileSync(versionPath, 'utf8');
            logger.info(`Version: ${version}`);
        } else {
            logger.error(`${this.fileName} installation failed.`);
        }
    }

    async configureLib() {
        const installedConfigPath = path.join(this.installDir, '.installed.json');
        let installedConfig = {};
        if (fs.existsSync(installedConfigPath)) {
            installedConfig = JSON.parse(fs.readFileSync(installedConfigPath, 'utf8'));
        }
        fs.writeFileSync(installedConfigPath, JSON.stringify(installedConfig, null, 2), 'utf8');
    }
}

module.exports = new GetBaseLibs();