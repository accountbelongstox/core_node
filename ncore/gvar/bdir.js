import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import gconfig from './gconfig.js';
import findBin from './libs/find_bin.js';
import ensure7zip from './libs/ensure_7zip.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    if (!executable) {
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
    return executable;
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


export {
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
