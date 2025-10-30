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

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAppName } = require('../libs/app_parameter.js');
let appname = getAppName() || '';
const hasAppName = typeof appname === 'string' && appname.trim().length > 0;
const effectiveAppName = hasAppName ? appname : 'default_app';

if (!hasAppName) {
    console.warn('[GLOBAL_DIR] App name not detected, falling back to default_app context.');
}
const homeDir = os.homedir();
const isWinodws = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const rootdir = path.join(__dirname, '../../..');
function getCwd() {
    return rootdir;
}
const osVersion = (() => {
    const platform = os.platform();
    if (platform === 'win32') {
        const release = os.release();
        const [major, minor, build] = release.split('.').map(Number);

        if (major === 10 && build >= 22000) {
            return 'win11';
        }
        else if (major === 10) {
            return 'win10';
        }
    } else if (platform === 'linux') {
        const distro = os.type();
        const version = os.release();
        if (distro.includes('Ubuntu')) {
            return `ubuntu${version.split('.')[0]}`;
        } else if (distro.includes('Debian')) {
            return `debian${version.split('.')[0]}`;
        } else if (distro.includes('Arch')) {
            return `archlinux${version.split('.')[0]}`;
        } else if (distro.includes('Fedora')) {
            return `fedora${version.split('.')[0]}`;
        } else if (distro.includes('CentOS')) {
            return `centos${version.split('.')[0]}`;
        } else if (distro.includes('Red Hat')) {
            return `redhat${version.split('.')[0]}`;
        } else if (distro.includes('openSUSE')) {
            return `opensuse${version.split('.')[0]}`;
        } else if (distro.includes('Manjaro')) {
            return `manjaro${version.split('.')[0]}`;
        } else if (distro.includes('Linux Mint')) {
            return `linuxmint${version.split('.')[0]}`;
        } else {
            return platform;
        }
    }
    return platform;
})();
const LANG_COMPILER_DIRNAME = `.dev_${osVersion}`;
const APP_INSTALL_NAME = `applications_${osVersion}`
let DATA_DRIVER, DATA_DIR;
if (os.platform() === 'win32') {
    DATA_DRIVER = fs.existsSync('D:\\') ? 'D:\\' : 'C:\\';
    DATA_DIR = path.join(DATA_DRIVER, `wwwroot`);
} else {
    DATA_DRIVER = fs.existsSync('/mnt/d') ? '/mnt/d' : null;
    DATA_DIR = DATA_DRIVER ? path.join(DATA_DRIVER, `wwwroot`) : null;
    if (!DATA_DRIVER) {
        DATA_DRIVER = fs.existsSync('/www') ? '/www' : null;
        DATA_DIR = DATA_DRIVER ? path.join(DATA_DRIVER, `wwwroot`) : null;
    }
    if (!DATA_DRIVER) {
        DATA_DRIVER = fs.existsSync('/usr/') ? '/usr/' : null;
        DATA_DIR = DATA_DRIVER ? path.join(DATA_DRIVER, `wwwroot`) : null;
    }
}

const LANG_COMPILER_DIR = DATA_DRIVER
    ? path.join(DATA_DRIVER, LANG_COMPILER_DIRNAME)
    : path.join(LOCAL_DIR, LANG_COMPILER_DIRNAME);
const BASEDIR = getCwd();
const CWD = BASEDIR;
const APPS_DIR = path.join(BASEDIR, 'apps');
const APP_DIR = path.join(BASEDIR, 'apps', effectiveAppName);
const CACHE_DIR = path.join(BASEDIR, '.cache');
const APP_CACHE_DIR = path.join(CACHE_DIR, effectiveAppName);
const LOG_DIR = path.join(CACHE_DIR, '.logs');
const SCRIPT_NAME = `core_node`
const USER_DIR = isWinodws
    ? homeDir
    : `/var/`;
const PRIMARY_LOCAL_DIR = isWinodws
    ? path.join(USER_DIR, `.${SCRIPT_NAME}`)
    : `/var/_${SCRIPT_NAME}`;
const FALLBACK_LOCAL_DIR = path.join(homeDir, `.${SCRIPT_NAME}`);

// Directory creation with permission handling
function mkdir(dirPath) {
    if (!dirPath) {
        return null;
    }
    try {
        return fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            console.warn(`[GLOBAL_DIR] Permission denied creating directory: ${dirPath}`);
            return null;
        }
        throw error;
    }
}

// Try to create primary directory, fall back if permission denied
let LOCAL_DIR = PRIMARY_LOCAL_DIR;
if (!mkdir(PRIMARY_LOCAL_DIR)) {
    console.warn(`[GLOBAL_DIR] Cannot create ${PRIMARY_LOCAL_DIR}, using fallback: ${FALLBACK_LOCAL_DIR}`);
    LOCAL_DIR = FALLBACK_LOCAL_DIR;
    mkdir(LOCAL_DIR);
}

let GLOBAL_VAR_DIR = path.join(LOCAL_DIR, 'global_var');
const COMMON_CACHE_DIR = path.join(LOCAL_DIR, '.cache');

const PUBLIC_DIR = path.join(BASEDIR, 'public');
const ROOT_APP_STATIC_DIR = DATA_DRIVER ? path.join(DATA_DRIVER, `static_${effectiveAppName.toLowerCase()}`) : null;
const ROOT_APP_CACHE_DIR = ROOT_APP_STATIC_DIR ? path.join(ROOT_APP_STATIC_DIR, `cache`) : null;
const APP_PUBLIC_DIR = path.join(PUBLIC_DIR, effectiveAppName);
const APP_DATA_DIR = path.join(APP_PUBLIC_DIR, 'data');
const APP_METADATA_DIR = path.join(APP_PUBLIC_DIR, 'metadata');
const APP_METADATA_SQLITE_DIR = path.join(APP_METADATA_DIR, 'sqlite');
// Large file storage directories (for big files like downloads, media, etc.)
const APP_LARGE_FILES_CACHE_DIR = path.join(APP_PUBLIC_DIR, '.cache');
const APP_LARGE_FILES_TMP_DIR = path.join(APP_PUBLIC_DIR, '.tmp');

// Backward compatibility aliases for legacy code
const APP_DATA_CACHE_DIR = APP_LARGE_FILES_CACHE_DIR;
const APP_TMP_DIR = APP_LARGE_FILES_TMP_DIR;

// Runtime temporary directories (for small temporary files during execution)
const APP_RUNTIME_CACHE_DIR = path.join(APP_PUBLIC_DIR, '.runtime_cache');
const APP_RUNTIME_TMP_DIR = path.join(APP_PUBLIC_DIR, '.runtime_tmp');
const APP_STATIC_DIR = path.join(APP_PUBLIC_DIR, 'static');
const APP_OUTPUT_DIR = path.join(APP_PUBLIC_DIR, 'output');
const APP_TEMPLATE_DIR = path.join(APP_DIR, `template`);
const APP_TEMPLATE_STATIC_DIR = path.join(APP_TEMPLATE_DIR, `static`);

// Create essential directories
mkdir(CACHE_DIR);
mkdir(LOG_DIR);
mkdir(GLOBAL_VAR_DIR);
mkdir(APP_CACHE_DIR);
mkdir(PUBLIC_DIR);
mkdir(APP_PUBLIC_DIR);
mkdir(APP_LARGE_FILES_CACHE_DIR);
mkdir(APP_LARGE_FILES_TMP_DIR);
mkdir(APP_RUNTIME_CACHE_DIR);
mkdir(APP_RUNTIME_TMP_DIR);
mkdir(APP_STATIC_DIR);
mkdir(APP_OUTPUT_DIR);
mkdir(APP_METADATA_DIR);
mkdir(APP_TEMPLATE_STATIC_DIR);
mkdir(APP_METADATA_SQLITE_DIR);
mkdir(COMMON_CACHE_DIR);
mkdir(APP_DATA_DIR);
mkdir(ROOT_APP_STATIC_DIR);
mkdir(ROOT_APP_CACHE_DIR);
mkdir(LANG_COMPILER_DIR);


module.exports = {
    getCwd,
    rootdir,
    BASEDIR,
    CWD,
    appname,
    effectiveAppName,
    APP_DIR,
    APPS_DIR,
    CACHE_DIR,
    APP_CACHE_DIR,
    LOG_DIR,
    LOCAL_DIR,
    GLOBAL_VAR_DIR,
    PUBLIC_DIR,
    APP_PUBLIC_DIR,
    APP_LARGE_FILES_CACHE_DIR,
    APP_LARGE_FILES_TMP_DIR,
    APP_RUNTIME_CACHE_DIR,
    APP_RUNTIME_TMP_DIR,
    APP_METADATA_DIR,
    APP_STATIC_DIR,
    APP_TEMPLATE_DIR,
    APP_TEMPLATE_STATIC_DIR,
    APP_OUTPUT_DIR,
    APP_METADATA_SQLITE_DIR,
    COMMON_CACHE_DIR,
    DATA_DRIVER,
    APP_DATA_DIR,
    APP_DATA_CACHE_DIR,
    APP_TMP_DIR,
    ROOT_APP_STATIC_DIR,
    ROOT_APP_CACHE_DIR,
    LANG_COMPILER_DIRNAME,
    APP_INSTALL_NAME,
    LANG_COMPILER_DIR,
    DATA_DIR
};
