const os = require('os');
const path = require('path');
const fs = require('fs');
const { gdir } = require('#@globalvars');
const bdir = require('#@/ncore/gvar/bdir.js');
const gconfig = require('#@/ncore/gvar/gconfig.js');
const { execCmd, execCmdResultText, pipeExecCmd } = require('#@/ncore/basic/libs/commander.js');
const logger = require('#@logger');
const phpReleasesFetcher = require('./php_libs/get_releases.js');
const langdir = gconfig.DEV_LANG_DIR;

class GetPHPWin {
    constructor() {
        this.defaultVersionKey = "8.3"; // Set PHP 8.3 as the default version
        this.releases = null;
        this.excludeVersionKeys = ['8.4'];
        this.installDir = path.join(langdir);
        this.tempDir = path.join(this.installDir, 'tmp');
    }

    mkdir(dir) {
        fs.mkdirSync(dir, { recursive: true });
    }

    getDefaultVersion() {
        const php_release = this.releases.find(php_release => php_release.majorVersion === this.defaultVersionKey);
        const details = this.getVersionDetails(php_release);
        const baseDir = new Set();

        logger.info(`details`, details);
        const phpBaseDir = path.dirname(details.phpPath);
        baseDir.add(phpBaseDir);

        return {
            versionKey: details?.phpVersionKey || null,
            version: details?.phpVersion || null,
            dir: details?.phpFileName || null,
            url: details?.phpUrl || null,
            installDir: details?.phpInstallDir || null,
            path: details?.phpPath || null,
            baseDir: Array.from(baseDir),
        };
    }

    getVersionDetails(php_release) {
        const versionKey = php_release.majorVersion;
        const fullVersion = php_release.fullVersion;
        if (!this.cachedVersionDetails) {
            this.cachedVersionDetails = {};
        }
        if (this.cachedVersionDetails[versionKey]) {
            return this.cachedVersionDetails[versionKey];
        }

        this.phpVersionKey = versionKey;
        this.phpFileName = this.findDevelopmentVersion(php_release.fileNames);
        this.phpUrl = this.getPHPDownloadUrl(this.phpFileName);
        let phpFolderName = this.phpFileName.substring(0, this.phpFileName.lastIndexOf('.'));
        this.phpInstallDir = path.join(this.installDir, phpFolderName);
        this.mkdir(this.phpInstallDir);
        this.phpPath = path.join(this.phpInstallDir, 'php.exe');
        this.cachedVersionDetails[versionKey] = {
            phpVersionKey: this.phpVersionKey,
            phpVersion: versionKey,
            phpFileName: this.phpFileName,
            phpUrl: this.phpUrl,
            phpInstallDir: this.phpInstallDir,
            phpPath: this.phpPath,
        };
        logger.info(this.cachedVersionDetails[versionKey]);
        return this.cachedVersionDetails[versionKey];
    }

    findDevelopmentVersion(fileNames) {
        let developmentVersion = fileNames.find(
            fileName =>
                !fileName.includes('nts') &&
                !fileName.includes('dev') &&
                !fileName.includes('debug') &&
                !fileName.includes('test') &&
                fileName.includes('x64') &&
                fileName.includes('Win32')
        );
        if (developmentVersion.startsWith('/downloads/releases/')) {
            developmentVersion = developmentVersion.substring('/downloads/releases/'.length);
        }
        logger.info(`developmentVersion`, developmentVersion);
        return developmentVersion;
    }

    getPHPDownloadUrl(phpFileName) {
        return `https://windows.php.net/downloads/releases/${phpFileName}`;
    }

    setPHPVersion(php_release) {
        const versionDetails = this.getVersionDetails(php_release);
        if (versionDetails) {
            this.phpVersionKey = versionDetails.phpVersionKey;
            this.phpFileName = versionDetails.phpFileName;
            this.phpUrl = versionDetails.phpUrl;
            this.phpInstallDir = versionDetails.phpInstallDir;
        }
    }

    async start(versionKey = null) {
        await bdir.initializedBDir();
        this.tar = await bdir.getTarExecutable();
        this.v7z = await bdir.get7zExecutable();
        this.curl = await bdir.getCurlExecutable();

        this.prepareDirectories();
        let releases = await phpReleasesFetcher.fetchReleases();
        this.excludeVersionKeys.forEach(versionKey => {
            releases = releases.filter(php_release => php_release.majorVersion !== versionKey);
        });
        if (!this.releases) {
            this.releases = releases;
        }
        if (versionKey !== null) {
            const php_release = await phpReleasesFetcher.getVersionByMajor(versionKey);
            this.setPHPVersion(php_release);
            await this.installPHP();
        } else {
            for (const php_release of releases) {
                this.setPHPVersion(php_release);
                await this.installPHP();
            }
        }
    }

    async installPHP() {
        if (this.checkPHPInstalled()) {
            logger.info(`PHP ${this.phpVersionKey} is already installed.`);
        } else {
            await this.downloadAndExtractPHP();
        }
        await this.configurePHP();
        await this.verifyInstallation();
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

    async downloadAndExtractPHP() {
        logger.info(`Downloading PHP ${this.phpVersionKey} from ${this.phpUrl}...`);
        const tempPHPZip = path.join(this.tempDir, this.phpFileName);
        if (fs.existsSync(tempPHPZip)) {
            fs.unlinkSync(tempPHPZip);
        }

        const command = `${this.curl} -k -L -o "${tempPHPZip}" "${this.phpUrl}"`;
        logger.info(command);
        try {
            await execCmd(command);
        } catch (error) {
            logger.error(`Error downloading PHP: ${error}`);
        }

        logger.info(`Extracting PHP ${this.phpVersionKey} ${tempPHPZip} ...`);
        try {
            await execCmd(`${this.tar} -xf "${tempPHPZip}" -C "${this.phpInstallDir}"`);
        } catch (error) {
            logger.error(`Error extracting PHP: ${error}`);
        }
    }

    async verifyInstallation() {
        const phpExePath = path.join(this.phpInstallDir, 'php.exe');
        if (fs.existsSync(phpExePath)) {
            logger.success(`PHP ${this.phpVersionKey} installed successfully.`);
            const version = await execCmdResultText(`"${phpExePath}" --version`);
            logger.info(`PHP version: ${version}`);
        } else {
            logger.error(`PHP ${this.phpVersionKey} installation failed.`);
        }
    }

    async configurePHP() {
        const phpIniPath = path.join(this.phpInstallDir, 'php.ini');
        if (!fs.existsSync(phpIniPath)) {
            fs.copyFileSync(path.join(this.phpInstallDir, 'php.ini-development'), phpIniPath);
            logger.info(`Default php.ini configuration copied.`);
        } else {
            logger.info(`php.ini configuration already exists.`);
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
            logger.success(`PHP configuration updated successfully.`);
        } catch (error) {
            logger.error(`Failed to update php.ini: ${error}`);
        }
    }
}

module.exports = new GetPHPWin();
