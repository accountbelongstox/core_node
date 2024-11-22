import os from 'os';
import path from 'path';
import fs from 'fs';
import Base from '#@base';
import { gdir, com_bin } from '#@globalvars';

const tar = com_bin.getTarExecutable(); // Get the tar executable path
const curl = com_bin.getCurlExecutable(); // Get the curl executable path
const langdir = gdir.getDevLangPath();

class GetPHPWin extends Base {
    constructor() {
        super();
        this.phpVersions = {
            '7.4': 'php-7.4.33-nts-Win32-vc15-x64.zip',
            '8.3': 'php-8.3.10-nts-Win32-vs16-x64.zip'
        };
        this.defaultVersionKey = '8.3'; // Set PHP 8.3 as the default version
        this.installDir = path.join(langdir);
        this.tempDir = path.join(this.installDir, 'tmp');
        this.prepareDirectories();
    }

    getDefaultVersion() {
        const details = this.getVersionDetails(this.defaultVersionKey);
        const baseDir = new Set();

        if (details?.phpPath) {
            const phpBaseDir = path.dirname(details.phpPath);
            baseDir.add(phpBaseDir);
        }

        return {
            versionKey: details?.phpVersionKey || null,
            version: details?.phpVersion || null,
            dir: details?.phpFileName || null,
            url: details?.phpUrl || null,
            installDir: details?.phpInstallDir || null,
            path: details?.phpPath || null,
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
        if (this.phpVersions[versionKey]) {
            this.phpVersionKey = versionKey;
            this.phpFileName = this.phpVersions[versionKey];
            this.phpUrl = this.getPHPDownloadUrl(versionKey);
            this.phpInstallDir = path.join(this.installDir, `php-${versionKey}`);
            this.mkdir(this.phpInstallDir);
            this.phpPath = path.join(this.phpInstallDir, 'php.exe');
            this.cachedVersionDetails[versionKey] = {
                phpVersionKey: this.phpVersionKey,
                phpVersion: this.phpVersions[versionKey],
                phpFileName: this.phpFileName,
                phpUrl: this.phpUrl,
                phpInstallDir: this.phpInstallDir,
                phpPath: this.phpPath
            };
            return this.cachedVersionDetails[versionKey];
        } else {
            this.error(`PHP version key ${versionKey} is not supported.`);
            return null;
        }
    }

    getPHPDownloadUrl(versionKey) {
        if (versionKey === '8.3') {
            return 'https://windows.php.net/downloads/releases/php-8.3.10-nts-Win32-vs16-x64.zip';
        } else if (versionKey === '7.4') {
            return 'https://windows.php.net/downloads/releases/php-7.4.33-nts-Win32-vc15-x64.zip';
        }
        return null;
    }

    setPHPVersion(versionKey) {
        const versionDetails = this.getVersionDetails(versionKey);
        if (versionDetails) {
            this.phpVersionKey = versionDetails.phpVersionKey;
            this.phpFileName = versionDetails.phpFileName;
            this.phpUrl = versionDetails.phpUrl;
            this.phpInstallDir = versionDetails.phpInstallDir;
        }
    }

    start(versionKey = null) {
        if (versionKey !== null) {
            this.setPHPVersion(versionKey);
            this.installPHP();
        } else {
            for (const key of Object.keys(this.phpVersions)) {
                this.setPHPVersion(key);
                this.installPHP();
            }
        }
    }

    installPHP() {
        if (this.checkPHPInstalled()) {
            this.info(`PHP ${this.phpVersionKey} is already installed.`);
        } else {
            this.downloadAndExtractPHP();
        }
        this.verifyInstallation();
        this.configurePHP();
    }

    checkPHPInstalled() {
        return fs.existsSync(this.phpPath);
    }

    prepareDirectories() {
        if (!fs.existsSync(this.installDir)) {
            fs.mkdirSync(this.installDir, { recursive: true });
        }

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    downloadAndExtractPHP() {
        this.info(`Downloading PHP ${this.phpVersionKey} from ${this.phpUrl}...`);
        const tempPHPZip = path.join(this.tempDir, this.phpFileName);

        // Disable SSL verification with the -k option
        const command = `${curl} -k -L -o "${tempPHPZip}" "${this.phpUrl}"`;
        try {
            this.execCmd(command);
        } catch (error) {
            this.error(`Error downloading PHP: ${error}`);
        }

        this.info(`Extracting PHP ${this.phpVersionKey}...`);
        try {
            this.execCmd([tar, '-xf', tempPHPZip, '-C', this.phpInstallDir]);
        } catch (error) {
            this.error(`Error extracting PHP: ${error}`);
        }
    }

    verifyInstallation() {
        const phpExePath = path.join(this.phpInstallDir, 'php.exe');
        if (fs.existsSync(phpExePath)) {
            this.success(`PHP ${this.phpVersionKey} installed successfully.`);
            const version = this.execCmd([phpExePath, '--version']);
            this.info(`PHP version: ${version}`);
        } else {
            this.error(`PHP ${this.phpVersionKey} installation failed.`);
        }
    }

    configurePHP() {
        const phpIniPath = path.join(this.phpInstallDir, 'php.ini');
        if (!fs.existsSync(phpIniPath)) {
            fs.copyFileSync(path.join(this.phpInstallDir, 'php.ini-development'), phpIniPath);
            this.info(`Default php.ini configuration copied.`);
        } else {
            this.info(`php.ini configuration already exists.`);
        }

        // Update php.ini with necessary configurations
        try {
            let phpIniContent = fs.readFileSync(phpIniPath, 'utf8');
            
            // Update configurations
            phpIniContent = phpIniContent.replace(/upload_max_filesize\s*=\s*\d+M/g, 'upload_max_filesize = 10240M'); // 10GB
            phpIniContent = phpIniContent.replace(/post_max_size\s*=\s*\d+M/g, 'post_max_size = 10240M'); // 10GB
            phpIniContent = phpIniContent.replace(/display_errors\s*=\s*Off/g, 'display_errors = On');
            phpIniContent = phpIniContent.replace(/max_execution_time\s*=\s*\d+/g, 'max_execution_time = 300'); // 5 minutes
            phpIniContent = phpIniContent.replace(/max_input_time\s*=\s*\d+/g, 'max_input_time = 300'); // 5 minutes
            phpIniContent = phpIniContent.replace(/memory_limit\s*=\s*\d+M/g, 'memory_limit = 512M');
            phpIniContent = phpIniContent.replace(/max_input_vars\s*=\s*\d+/g, 'max_input_vars = 10000');
            phpIniContent = phpIniContent.replace(/;date\.timezone\s*=/g, 'date.timezone = UTC');
            phpIniContent = phpIniContent.replace(/;error_log\s*=\s*syslog/g, 'error_log = "error.log"');
            phpIniContent = phpIniContent.replace(/file_uploads\s*=\s*Off/g, 'file_uploads = On');

            // Write the updated configuration back to php.ini
            fs.writeFileSync(phpIniPath, phpIniContent, 'utf8');
            this.success(`PHP configuration updated successfully.`);
        } catch (error) {
            this.error(`Failed to update php.ini: ${error}`);
        }
    }
}

export default new GetPHPWin();
