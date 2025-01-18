const path = require('path');
const fs = require('fs');
const findBin = require('./libs/find_bin.js');
const ensure7zip = require('./libs/bdir-libs/ensure_7zip.js');
const { getSystemInfo } = require('./platform-constant/index.js');

let EXE_7Z_PATH = null
let CWD, LIUNX_SYSTEM_INFO,BINARY_CACHE_DIR, TAR_EXECUTABLE, CURL_EXECUTABLE, GIT_EXECUTABLE, DDWIN_EXECUTABLE, PHP_EXECUTABLE, BASE_CONFIG
let initializedBDirToken = false
const initializedBDir = async () => {
    if(initializedBDirToken) return;
    initializedBDirToken = true;
    console.log(`initializedBDir- exec`);
    LIUNX_SYSTEM_INFO = await getSystemInfo()
    console.log(`getSystemInfo`);
    console.log(LIUNX_SYSTEM_INFO)
    EXE_7Z_PATH = await ensure7zip.ensure7zip();
    console.log(`EXE_7Z_PATH ${EXE_7Z_PATH}`);
    CWD = getCwd();
    BINARY_CACHE_DIR = getBinaryCacheDir();
    TAR_EXECUTABLE = getTarExecutable();
    CURL_EXECUTABLE = getCurlExecutable();
    GIT_EXECUTABLE = getGitExecutable();
    DDWIN_EXECUTABLE = getDDwinExecutable();
    PHP_EXECUTABLE = getPhpExecutable();
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
    await initializedBDir()
    return EXE_7Z_PATH
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
    initializedBDir,
};