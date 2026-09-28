'use strict';
const os = require('os');
// const edgedriver = require('edgedriver');
const decompress = require('decompress');
const winreg = require('winreg');
const Util = require('../utils.js');
let config = {}

class Source  {
    setConfig() {
        config = conf
    }
    getDriverPathByChrome(driverType) {
        const chromePath = this.getBrowserDriverPath(driverType);
        const version = this.getDriverVersion(driverType);
        const driverPath = this.installDriver(version, driverType);

        const driverVersion = this.getRealDriverVersion(driverPath);
        if (version !== driverVersion) {
            console.log('The driver version may not match the browser version');
            console.log(`Browser version (${driverType})${version} <=> Driver version ${driverVersion}`);
        }

        const puppeteerInfo = `
        Puppeteer info:
        \tBrowser (${driverType})${version}
        \tDriver ${driverVersion}
        \tDriver name ${this.getDriverName()}
        \tChrome ${chromePath}
        \tDriver ${driverPath}`;
        console.log(puppeteerInfo);
        return driverPath;
    }
    getDefaultImageFile() {
        let icon = Util.file.get_stylesheet(`img/default_app.png`)
        return icon
    }
    getBrowserPath(browser) {
        const browserRegs = {
            IE: 'SOFTWARE\\Clients\\StartMenuInternet\\IEXPLORE.EXE\\DefaultIcon',
            chrome: 'SOFTWARE\\Clients\\StartMenuInternet\\Google Chrome\\DefaultIcon',
            edge: 'SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge\\DefaultIcon',
            firefox: 'SOFTWARE\\Clients\\StartMenuInternet\\FIREFOX.EXE\\DefaultIcon',
            '360': 'SOFTWARE\\Clients\\StartMenuInternet\\360Chrome\\DefaultIcon',
        };

        if (this.isWindows()) {
            try {
                const key = new winreg({
                    hive: winreg.HKLM,
                    key: browserRegs[browser],
                });
                key.get('', (err, item) => {
                    if (!err) {
                        const value = item.value.split(',')[0];
                        // 在这里使用 value（版本号）进行操作
                    }
                });
            } catch (err) {
                return null;
            }
        } else {
            // 在非 Windows 系统中获取浏览器路径
        }

        return null;
    }
    getBrowserDriverPath(driverType) {
        if (driverType === 'chrome') {
            return this.getChromePath();
        } else {
            return this.getEdgeInstallPath();
        }
    }
    getEdgeInstallPath() {
        // Windows 下的 Microsoft Edge 安装路径可能在以下两个位置
        const possiblePaths = [
            path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application'),
            path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application'),
        ];

        for (const path of possiblePaths) {
            const msedgeExe = path.join(path, 'msedge.exe');
            if (fs.existsSync(msedgeExe)) {
                return msedgeExe;
            }
        }

        return null;
    }
    async getEdgeVersion(edgeExePath) {
        try {
            const { stdout } = await exec(`${edgeExePath} --version`);
            return stdout.trim();
        } catch (error) {
            console.error(`获取版本号时出错: ${error.message}`);
            return null;
        }
    }
    getChromePath() {
        let chromePath = this.comConfig.getGlobal('chrome_path');

        if (!this.comFile.isAbsolutePath(chromePath)) {
            chromePath = path.join(this.comFile.getCwd(), chromePath);
        }

        if (!this.comFile.isPathFile(chromePath)) {
            chromePath = this.getBrowserPath('chrome');
            if (!chromePath) {
                chromePath = this.downloadChromeBinary();
            }
        }

        if (chromePath) {
            this.comConfig.setConfig('global', 'chrome_path', chromePath);
        }

        return chromePath;
    }
    isWindows() {
        return os.platform() === 'win32';
    }
    async downloadChromeBinary() {
        if (this.isWindows()) {
            const remoteUrl = this.comConfig.getGlobal('remote_url');
            const downUrl = {
                url: `${remoteUrl}/public/static/chrome_105.0.5195.52.zip`,
                extract: true,
            };

            const downObject = await this.comHttp.downFile(downUrl, { extract: true, overwrite: true });
            const saveFilename = downObject.save_filename;
            const chromePath = this.comFile.searchFile(saveFilename, 'chrome.exe');
            return chromePath;
        } else {
            execSync('wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -');
            execSync('sudo sh -c \'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list\'');
            execSync('sudo apt-get update');
            execSync('sudo apt-get install google-chrome-stable');
            const result = execSync('which google-chrome', { encoding: 'utf-8' });
            const chromePath = result.trim();
            return chromePath;
        }
    }
    async getChromeVersion() {
        const versionRe = /\d+\.\d+\.\d+\.\d+/;
        const isWindows = this.isWindows();

        if (isWindows) {
            const chromePath = this.getChromePath();
            const visualElementsManifest = path.join(path.dirname(chromePath), 'chrome.VisualElementsManifest.xml');
            const visualElementsManifestTmp = this.comFile.copyToTmp(visualElementsManifest);

            if (this.comFile.isPathFile(visualElementsManifestTmp.name)) {
                const content = this.comFile.readFile(visualElementsManifestTmp.name);
                const versionMatches = versionRe.exec(content);

                this.comFile.deleteTmp(visualElementsManifestTmp);

                if (versionMatches && versionMatches.length > 0) {
                    return versionMatches[0];
                }
                try {
                    const key = await this.getWindowsRegistryValue('Software\\Google\\Chrome\\BLBeacon', 'version');
                    const registryVersion = versionRe.exec(key);
                    return registryVersion ? registryVersion[0] : this.comConfig.getGlobal('chrome_version');
                } catch (error) {
                    Util.printWarn(error);
                    Util.printWarn('is windows platform, and get chrome version error, but getting a config version.');
                    return this.comConfig.getGlobal('chrome_version');
                }
            }
        } else {
            try {
                const { stdout } = await exec('google-chrome --version');
                const versionMatches = versionRe.exec(stdout);
                return versionMatches ? versionMatches[0] : this.comConfig.getGlobal('chrome_version');
            } catch (error) {
                Util.printWarn(error);
                Util.printWarn('is linux platform, and get chrome version error, but getting a config version.');
                return this.comConfig.getGlobal('chrome_version');
            }
        }
    }
    async getRealDriverVersion(driverType) {
        console.log('driverType', driverType);
        driverType = this.comFile.dirNormal(driverType);
        console.log('driverType', driverType);
        const cmd = `${driverType} --version`;
        try {
            const version = await Util.cmd(cmd);
            const versionRe = /\d+\.\d+\.\d+\.\d+/;
            const match = versionRe.exec(version);
            if (match) {
                return match[0];
            }
            return null;
        } catch (error) {
            console.error('Error while getting driver version:', error);
            return null;
        }
    }
    async getSupportedVersion(driverType) {
        const versionRe = /\d+\.\d+\.\d+\.\d+/;
        const remoteUrl = this.getDriverSupportUrl(driverType);
        try {
            const content = await this.comHttp.get(remoteUrl);
            const supportedVersions = content.match(versionRe) || [];
            const uniqueVersions = Util.uniqueList(supportedVersions);
            uniqueVersions.sort((a, b) => {
                const versionA = a.split('.').map(Number);
                const versionB = b.split('.').map(Number);
                for (let i = 0; i < versionA.length; i++) {
                    if (versionA[i] !== versionB[i]) {
                        return versionA[i] - versionB[i];
                    }
                }
                return 0;
            });
            return uniqueVersions;
        } catch (error) {
            console.error('Error while fetching supported versions:', error);
            return [];
        }
    }
    findVersion(versions, target) {
        const targetInt = Number(target.replace(/\./g, ''));
        const versionNumbers = versions.map(version => Number(version.replace(/\./g, '')));
        const index = this.binarySearch(versionNumbers, targetInt);
        if (index === 0) {
            return versions[0];
        } else if (index === versions.length) {
            return versions[versions.length - 1];
        } else {
            const previousVersionInt = versionNumbers[index - 1];
            const currentVersionInt = versionNumbers[index];

            if (currentVersionInt - targetInt < targetInt - previousVersionInt) {
                return versions[index];
            } else {
                return versions[index - 1];
            }
        }
    }
    binarySearch(arr, target) {//findVersion
        let left = 0;
        let right = arr.length - 1;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (arr[mid] === target) {
                return mid;
            } else if (arr[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return left;
    }
    isSupportedVersion(driverType, version) {
        const supportedVersions = this.getSupportedVersion(driverType);
        if (!supportedVersions.includes(version)) {
            console.warn('Supported versions:');
            console.log(supportedVersions);
            console.log('Current version:', version);
            console.warn(`The (${driverType}) ${version} is not supported.`);
            return false;
        } else {
            return true;
        }
    }
    installDriver(version, driverType = 'chrome') {
        const isSupport = this.isSupportedVersion(driverType, version);
        if (isSupport !== true) {
            console.warn(`The ${driverType} ${version} is Not supported.`);
            return null;
        }
        let driverPath = this.comConfig.getGlobal('driverPath');
        if (driverPath) {
            if (!path.isAbsolute(driverPath)) {
                const cwd = this.getCwd();
                driverPath = path.join(cwd, driverPath);
            }
            if (fs.existsSync(driverPath)) {
                return driverPath;
            }
        }
        driverPath = this.downDriver(version, driverType);
        return driverPath;
    }
    downDriver(version, driverType) {
        let fileName = 'chromedriver.exe';
        const remoteUrl = this.getDriverRemoteUrl(driverType);
        if (this.isWindows()) {
            if (driverType === 'chrome') {
                fileName = 'chromedriver.exe';
            }
            const url = `${remoteUrl}${version}/chromedriver_win32.zip`;
            return this.downloadAndExtract(url, fileName);
        } else {
            if (driverType === 'chrome') {
                fileName = 'chromedriver';
            }

            const url = `${remoteUrl}${version}/chromedriver_linux64.zip`;
            return this.downloadAndExtract(url, fileName);
        }
    }
    downloadAndExtract(url, fileName) {//downDriver
        const downloadDir = path.join(__dirname, 'downloads');
        const downloadPath = path.join(downloadDir, fileName);
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir);
        }
        return new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(downloadPath);
            const decompressDir = path.join(downloadDir, 'extracted');

            writeStream.on('finish', () => {
                decompress(downloadPath, decompressDir)
                    .then(() => {
                        const driverPath = path.join(decompressDir, fileName);
                        this.comConfig.setConfig('global', 'driverPath', driverPath);
                        resolve(driverPath);
                    })
                    .catch(reject);
            });
        });
    }
    getDriverRemoteUrl(driverType) {
        return this.driverRemoteUrl[driverType] || null;
    }
    getDriverSupportUrl(driverType) {
        return this.driverSupportUrl[driverType] || null;
    }
    getDriverDownloadUrl(driverType, version) {
        const remoteUrl = this.driverRemoteUrl[driverType];
        if (driverType === 'chrome') {
            const url = `${remoteUrl}${version}/`;
            if (this.isWindows()) {
                return `${url}chromedriver_win32.zip`;
            } else {
                return `${url}chromedriver_linux64.zip`;
            }
        } else if (driverType === 'edge') {
            const url = `${remoteUrl}${version}/`;
            if (this.isWindows()) {
                const edgeUrl = `${url}edgedriver_win64.zip`;
                console.warn('Edge Driver cannot download automatically, please download manually.');
                console.warn(edgeUrl);
                console.warn(edgeUrl);
                console.warn(edgeUrl);
                return edgeUrl;
            } else {
                return `${url}edgedriver_linux64.zip`;
            }
        }
        return null;
    }
    async getDriverFromDown(downloadUrl) {
        const downUrl = {
            url: downloadUrl,
            extract: true
        };
        try {
            const driverPath = await this.comHttp.downs(downUrl, { extract: true, overwrite: true });
            return driverPath;
        } catch (error) {
            console.error('Error while downloading driver:', error);
            return null;
        }
    }
    getDriverVersion(driverType) {
        if (driverType === 'chrome') {
            const version = this.getChromeVersion();
            this.comConfig.setConfig('global', 'chrome_version', version);
            return version;
        } else {
            const version = this.comConfig.getGlobal(`${driverType}_version`);
            return version;
        }
    }
    getDriverPathName(driverType) {
        if (this.isWindows()) {
            if (driverType === 'chrome') {
                return 'chromedriver.exe';
            } else {
                return 'msedgedriver.exe';
            }
        } else {
            if (driverType === 'chrome') {
                return 'chromedriver.exe';
            } else {
                return 'msedgedriver';
            }
        }
    }
}
Source.toString = () => '[class Source]';
module.exports = new Source();

