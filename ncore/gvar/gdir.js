const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAppName } = require('./libs/appname.js');
let appname = getAppName();
const homeDir = os.homedir();

function getCwd() {
    return path.join(__dirname, '..', '..');
}

const BASEDIR = getCwd();
const CWD = BASEDIR;
const APPS_DIR = path.join(BASEDIR, 'apps');
const APP_DIR = path.join(BASEDIR, 'apps', appname);
const CACHE_DIR = path.join(BASEDIR, '.cache');
const LOG_DIR = path.join(CACHE_DIR, '.logs');
const SCRIPT_NAME = `core_node`
const LOCAL_DIR = os.platform() === 'win32'
    ? path.join(homeDir, `.${SCRIPT_NAME}`)
    : `/usr/${SCRIPT_NAME}`;
const GLOBAL_VAR_DIR = path.join(LOCAL_DIR, 'global_var');

const COMMON_CACHE_DIR = path.join(LOCAL_DIR, '.cache');

const PUBLIC_DIR = path.join(BASEDIR, 'public');
const APP_PUBLIC_DIR = path.join(PUBLIC_DIR, appname);
const APP_DATA_DIR = path.join(APP_PUBLIC_DIR, 'data');
const APP_METADATA_DIR = path.join(APP_PUBLIC_DIR, 'metadata');
const APP_METADATA_SQLITE_DIR = path.join(APP_PUBLIC_DIR, 'sqlitemate');
const APP_DATA_CACHE_DIR = path.join(APP_PUBLIC_DIR, '.cache');
const APP_TMP_DIR = path.join(APP_PUBLIC_DIR, '.tmp');
const APP_STATIC_DIR = path.join(APP_PUBLIC_DIR, 'static');
const APP_OUTPUT_DIR = path.join(APP_PUBLIC_DIR, 'output');
const APP_TEMPLATE_DIR = path.join(APP_DIR, `template`);
const APP_TEMPLATE_STATIC_DIR = path.join(APP_TEMPLATE_DIR, `static`);


// Create essential directories
mkdir(CACHE_DIR);
mkdir(LOG_DIR);
mkdir(LOCAL_DIR);
mkdir(GLOBAL_VAR_DIR);
mkdir(PUBLIC_DIR);
mkdir(APP_PUBLIC_DIR);
mkdir(APP_DATA_DIR);
mkdir(APP_DATA_CACHE_DIR);
mkdir(APP_STATIC_DIR);
mkdir(APP_OUTPUT_DIR);
mkdir(APP_METADATA_DIR);
mkdir(APP_TEMPLATE_STATIC_DIR);
mkdir(APP_TMP_DIR);
mkdir(APP_METADATA_SQLITE_DIR)
mkdir(COMMON_CACHE_DIR);

// Directory creation
function mkdir(path) {
    return fs.mkdirSync(path, { recursive: true });
}


module.exports = {
    // Basic directory functions
    getCwd,
    // Directory constants
    BASEDIR,
    CWD,
    APP_DIR,
    APPS_DIR,
    CACHE_DIR,
    LOG_DIR,
    LOCAL_DIR,
    GLOBAL_VAR_DIR,
    PUBLIC_DIR,
    APP_PUBLIC_DIR,
    APP_DATA_DIR,
    APP_DATA_CACHE_DIR,
    APP_METADATA_DIR,
    APP_TMP_DIR,
    APP_STATIC_DIR,
    APP_TEMPLATE_DIR,
    APP_TEMPLATE_STATIC_DIR,
    APP_OUTPUT_DIR,
    APP_METADATA_SQLITE_DIR,
    COMMON_CACHE_DIR,
};