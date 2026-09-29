/**
 * Matrix Application Configuration
 *
 * Centralized configuration management following ncore standards.
 * Ported from pyapps/matrix/matrix_config/config.py
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { gdir, appname } = require('#@global_vars');
const logger = require('#@logger');
const { resolveBindHost } = require('#@foundation/common/local_rpc_guard.js');

const {
    BASEDIR,
    APP_DIR,
    APP_LARGE_FILES_CACHE_DIR
} = gdir;

const APP_NAME = 'matrix';

const WEB_HOST = resolveBindHost();
const WEB_PORT = 48000;

const APP_RESOURCES_DIR = path.join(APP_DIR, 'resources');
const FRONTEND_DIR = path.join(BASEDIR, 'poly_apps', 'matrixui');
const FRONTEND_PORT = 38007;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const FRONTEND_MODE = 'dev';

const SCRCPY_SERVER_VERSION = '3.3.3';
const SCRCPY_SERVER_JAR = path.join(APP_RESOURCES_DIR, 'scrcpy-server.jar');

function findInPath(executable) {
    const pathEnv = process.env.PATH || '';
    const pathSep = os.platform() === 'win32' ? ';' : ':';
    const paths = pathEnv.split(pathSep);

    for (const dir of paths) {
        const fullPath = path.join(dir, executable);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }

    return null;
}

function getAdbPath() {
    const platform = os.platform();
    const adbExe = platform === 'win32' ? 'adb.exe' : 'adb';

    const systemAdbPath = findInPath(adbExe);
    if (systemAdbPath) {
        return systemAdbPath;
    }

    return adbExe;
}

const ADB_PATH = getAdbPath();

const config = {
    APP_NAME,
    PROJECT_ROOT: BASEDIR,
    APP_ROOT: APP_DIR,
    APP_RESOURCES_DIR,
    CACHE_DIR: APP_LARGE_FILES_CACHE_DIR,

    WEB_HOST,
    WEB_PORT,

    FRONTEND_DIR,
    FRONTEND_PORT,
    FRONTEND_URL,
    FRONTEND_MODE,

    SCRCPY_SERVER_VERSION,
    SCRCPY_SERVER_JAR,
    ADB_PATH,

    getRpcConfig() {
        return {
            port: this.WEB_PORT,
            host: this.WEB_HOST,
            basePath: '/rpc',
            staticPaths: []
        };
    }
};

module.exports = config;
