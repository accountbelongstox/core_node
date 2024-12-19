const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const gconfig = require('./gconfig.js');
    const findBin = require('./libs/find_bin.js');
    const ensure7zip = require('./libs/ensure_7zip.js');


    // Basic directory functions
    const getCwd = () => {
        return path.join(__dirname, '..', '..');
    };

    const getBinaryCacheDir = () => {
        const basedir = getCwd();
        return path.join(basedir, '.cache', 'bin');
    };

    const basedir = getCwd();
    const binaryCacheDir = getBinaryCacheDir();

    const mkdir = (path) => {
        return fs.mkdirSync(path, { recursive: true });
    };

    mkdir(binaryCacheDir);

    // Bin cache and config
    const binCache = {};
    const getBaseConfig = () => gconfig.getBaseConfig();

    // Executable finders
    const getTarExecutable = () => {
        return findBin.findBin('tar', [
            'C:\\Windows\\System32'
        ]);
    };

    const getCurlExecutable = () => {
        return findBin.findBin('curl', [
            'C:\\Windows\\System32'
        ]);
    };

    const getGitExecutable = () => {
        return findBin.findBin('git', [
            'D:\\applications\\Git\\cmd',
            'C:\\Program Files\\Git\\cmd',
            'C:\\Program Files (x86)\\Git\\cmd'
        ]);
    };

    const getDDwinExecutable = () => {
        return findBin.findBin('ddwin', []);
    };

    const getPhpExecutable = () => {
        return findBin.findBin('php');
    };

    const get7zExecutable = () => {
        const downloadDir = getBaseConfig().appPlatformBinDir;

        let executable = findBin.findBin('7z', [
            downloadDir,
            '/usr/bin',
            '/usr/local/bin',
            'C:\\Program Files\\7-Zip',
            'C:\\Program Files (x86)\\7-Zip'
        ]);
        let executable7zz = findBin.findBin('7zz', [
            downloadDir,
            '/usr/bin',
            '/usr/local/bin',
            'C:\\Program Files\\7-Zip',
            'C:\\Program Files (x86)\\7-Zip'
        ]);
        if (!executable && !executable7zz) {
            try {
                const executablePath = ensure7zip.downloadAndInstall(downloadDir);
                if (ensure7zip.verify(executablePath)) {
                    return executablePath;
                }
            } catch (error) {
                console.error('Failed to download 7z:', error);
                return '';
            }
        }
        return executable || executable7zz;
    };

    const bdir = {
        getCwd,
        getBinaryCacheDir,
        mkdir,
        getTarExecutable,
        getCurlExecutable,
        getGitExecutable,
        getDDwinExecutable,
        getPhpExecutable,
        get7zExecutable,
        getBaseConfig
    };

    module.exports = {
        getCwd,
        getBinaryCacheDir,
        mkdir,
        getTarExecutable,
        getCurlExecutable,
        getGitExecutable,
        getDDwinExecutable,
        getPhpExecutable,
        get7zExecutable,
        binCache,
        getBaseConfig,
        bdir
    };