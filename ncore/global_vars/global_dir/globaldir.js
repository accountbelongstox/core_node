const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAppName } = require('../libs/app_parameter.js');
const systemPaths = require('../../foundation/common/system_paths.js');
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
// Per-OS directory tag from /etc/os-release ID + major VERSION_ID (win10/win11 on Windows), e.g. debian13, ubuntu24, kali2025
const osVersion = systemPaths.getOsVarTag().toLowerCase().replace(/_/g, '');
const LANG_COMPILER_DIRNAME = `.dev_${osVersion}`;
const APP_INSTALL_NAME = `applications_${osVersion}`

const WWW_BASE = isWinodws
    ? systemPaths.WINDOWS_WWW_BASE
    : systemPaths.getLinuxWwwBase();
function mapWebPath(sub = '') {
    return sub ? path.join(WWW_BASE, sub) : WWW_BASE;
}

let DATA_DRIVER, DATA_DIR;
if (os.platform() === 'win32') {
    // The drive of the resolved core_node data dir (D:\ normally, the user profile drive as fallback)
    DATA_DRIVER = path.parse(systemPaths.getSystemCacheDir()).root || systemPaths.WINDOWS_DATA_DRIVE_ROOT;
    DATA_DIR = path.join(DATA_DRIVER, `wwwroot`);
} else {
    DATA_DRIVER = fs.existsSync('/mnt/d') ? '/mnt/d' : null;
    DATA_DIR = DATA_DRIVER ? path.join(DATA_DRIVER, `wwwroot`) : null;
    if (!DATA_DRIVER) {
        DATA_DRIVER = fs.existsSync(systemPaths.LINUX_WWW_ROOT) ? systemPaths.LINUX_WWW_ROOT : null;
        // wwwroot sits under the NTFS-aware WWW base (/www/www on dual-boot).
        DATA_DIR = DATA_DRIVER ? mapWebPath('wwwroot') : null;
    }
    if (!DATA_DRIVER) {
        DATA_DRIVER = fs.existsSync('/usr/') ? '/usr/' : null;
        DATA_DIR = DATA_DRIVER ? path.join(DATA_DRIVER, `wwwroot`) : null;
    }
}

const BASEDIR = getCwd();
const CWD = BASEDIR;
const APPS_DIR = path.join(BASEDIR, 'apps');
const APP_DIR = path.join(BASEDIR, 'apps', effectiveAppName);
const LOCAL_DIR = systemPaths.getSystemCacheDir();
const USER_DIR = homeDir;
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, systemPaths.GLOBAL_VAR_DIR_NAME);
const COMMON_CACHE_DIR = path.join(LOCAL_DIR, systemPaths.CACHE_DIR_NAME, 'ncore');
const CACHE_DIR = COMMON_CACHE_DIR;
const APP_CACHE_DIR = path.join(CACHE_DIR, effectiveAppName);
const LOG_DIR = path.join(LOCAL_DIR, 'logs', 'ncore');
const LANG_COMPILER_DIR = DATA_DRIVER
    ? path.join(DATA_DRIVER, LANG_COMPILER_DIRNAME)
    : path.join(LOCAL_DIR, LANG_COMPILER_DIRNAME);

// Directory creation with permission handling
function mkdir(dirPath) {
    if (!dirPath) {
        return null;
    }
    try {
        return fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
        console.warn(`[GLOBAL_DIR] Cannot create directory ${dirPath}: ${error.code || error.message}`);
        return null;
    }
}

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
    WWW_BASE,
    mapWebPath,
    wwwDataRootMounted: systemPaths.wwwDataRootMounted,
    USER_DIR,
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
