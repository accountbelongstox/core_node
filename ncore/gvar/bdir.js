const os = require('os');
const path = require('path');
const fs = require('fs');
const gconfig = require('./gconfig.js');
const findBin = require('./libs/find_bin.js');
const ensure7zip = require('./libs/ensure_7zip.js');
const { getSoftwarePath } = require('./tool/soft-install/index.js');
const fileFinder = require('./tool/soft-install/common/ffinder.js');
const isWindows = os.platform() === 'win32';
let EXE_7Z_PATH = null
let CWD, BINARY_CACHE_DIR, TAR_EXECUTABLE, CURL_EXECUTABLE, GIT_EXECUTABLE, DDWIN_EXECUTABLE, PHP_EXECUTABLE, BASE_CONFIG
let initializedBDirToken = false
const initializedBDir = async () => {
    if(initializedBDirToken) return;
    EXE_7Z_PATH = await ensure7zip.ensure7zip();
    console.log(`EXE_7Z_PATH ${EXE_7Z_PATH}`);
    initializedBDirToken = true;
    CWD = getCwd();
    BINARY_CACHE_DIR = getBinaryCacheDir();
    TAR_EXECUTABLE = getTarExecutable();
    CURL_EXECUTABLE = getCurlExecutable();
    GIT_EXECUTABLE = getGitExecutable();
    DDWIN_EXECUTABLE = getDDwinExecutable();
    PHP_EXECUTABLE = getPhpExecutable();
    BASE_CONFIG = getBaseConfig();
}
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

const get7zExecutable = async () => {
    const exeBy7zName = isWindows ? '7z.exe' : '7z';
    if (fileFinder.isFinderCacheValid(exeBy7zName)) { 
        return fileFinder.getFinderCache(exeBy7zName);
    }
    console.log('search:', exeBy7zName);
    const executablePath = await ensure7zip.ensure7zip();
    if (ensure7zip.verify(executablePath)) {
        return executablePath;
    }
};

(async () => {
    await initializedBDir();
    console.log(`initializedBDir`);
    console.log(`EXE_7Z_PATH ${EXE_7Z_PATH}`);
})();

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