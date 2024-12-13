import os from 'os';
import path from 'path';
import fs from 'fs';
import Base from '#@/ncore/utils/dev_tool/lang_compiler_deploy/libs/base_utils.js';
import { gdir } from '#@globalvars'; 
import {bdir} from '#@/ncore/gvar/bdir.js';// Import com_bin from #@globalvars
import gconfig from '#@/ncore/gvar/gconfig.js';
const langdir = gconfig.DEV_LANG_DIR;

const tar = bdir.getTarExecutable(); // Get the tar executable path
const curl = bdir.getCurlExecutable(); // Get the curl executable path

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class GetBaseLibs extends Base {
    constructor() {
        super();
        this.libVersions = {
            environments: 'environments.zip'
        };
        this.libDirBase = langdir;
        this.defaultVersionKey = 'environments';
        this.installDir = path.join(langdir);
        this.tempDir = path.join(this.installDir, 'tmp');
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
            console.error(`Version key ${versionKey} is not supported.`);
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
        this.prepareDirectories();
        if (versionKey !== null) {
            this.setVersion(versionKey);
            this.installLib();
        } else {
            for (const key of Object.keys(this.libVersions)) {
                this.setVersion(key);
                this.installLib();
            }
        }
    }

    installLib() {
        if (this.checkLibInstalled()) {
            console.log(`Library ${this.versionKey} is already installed.`);
        } else {
            this.downloadAndExtractLib();
        }
        this.verifyInstallation();
        this.configureLib();
    }

    checkLibInstalled() {
        return fs.existsSync(this.installDir);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    downloadAndExtractLib() {
        console.log(`Downloading ${this.fileName}...`);
        const tempLibFile = path.join(this.tempDir, this.fileName);
        
        // Use curl with -L and -k parameters
        this.execCmd([curl, '-L', '-k', '-o', tempLibFile, this.url], true, null, true);

        console.log(`Extracting ${this.fileName}...`);
        this.execCmd([tar, '-xf', tempLibFile, '-C', langdir]);
    }

    verifyInstallation() {
        const versionPath = path.join(this.installDir, 'version.txt');
        if (fs.existsSync(versionPath)) {
            console.log(`${this.fileName} installed successfully.`);
            const version = this.readText(versionPath);
            console.log(`Version: ${version}`);
        } else {
            console.error(`${this.fileName} installation failed.`);
        }
    }

    configureLib() {
        const installedConfigPath = path.join(this.installDir, '.installed.json');
        let installedConfig = {};
        if (fs.existsSync(installedConfigPath)) {
            installedConfig = JSON.parse(fs.readFileSync(installedConfigPath, 'utf8'));
        } else {
            fs.writeFileSync(installedConfigPath, JSON.stringify(installedConfig, null, 2), 'utf8');
        }
        fs.writeFileSync(installedConfigPath, JSON.stringify(installedConfig, null, 2), 'utf8');
    }
}

export default new GetBaseLibs();
