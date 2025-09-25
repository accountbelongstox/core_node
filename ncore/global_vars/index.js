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

const encyclopedia = require('./gcommon/encyclopedia.js')


const path = require('path');
// const fs = require('fs');
const os = require('os');
const gdir = require('./global_dir/globaldir.js');
const env = require('./libs/env.js');
const { getAppName, getIsServer, getIsService, apps } = require('./libs/app_parameter.js');
const isServer = getIsServer()
const isService = getIsService()
const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isMac = os.platform() === 'darwin';
const systemName = os.platform()
const systemVersion = os.version()
const startTime = new Date()
let appname = getAppName()


const gfilename = __dirname;
const coredir = path.basename(gfilename);
const rootdir = gdir.rootdir;
const cwd = rootdir;

const appsdir = path.join(rootdir, 'apps');

const basedir = gdir.CWD;
const appdir = path.join(appsdir, appname);
env.addRootDir(appdir);
const appentry = path.join(appdir, 'main.js');
const appentry_es = `./apps/${appname}/main.js`
const pluginsdir = path.join(__dirname, 'plugins');
const localDir = gdir.LOCAL_DIR
const appConfDir = path.join(localDir, '.config');
const userDir = gdir.USER_DIR
const request_headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Host': 'windows.php.net',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
}
function isDebugEnabled() {
    const args = process.argv.slice(2); // Exclude node and script path
    for (const arg of args) {
        const [key, value] = arg.split('=').map(str => str.trim().toLowerCase());

        if (key === 'debug') {
            if (value != "false" || value != "0") {
                return true
            }
            return false;
        }

        if (key === 'debug=true') return true; // Handles cases like --DEBUG=true
        if (key == 'debug=false') return false;
    }

    return false; // Default is false if not found
}
const isDebug = isDebugEnabled()
const app = {
    appname,
    coredir,
    rootdir,
    appentry,
};

module.exports = {
    gdir,
    cwd,
    env,
    encyclopedia,
    localDir,
    appConfDir,
    appentry_es,
    coredir,
    rootdir,
    appdir,
    appsdir,
    basedir,
    appname,
    appentry,
    pluginsdir,
    app,
    request_headers,
    isWindows,
    isLinux,
    userDir,
    systemName,
    systemVersion,
    isMac,
    isDebug,
    isServer,
    isService,
    apps,
    startTime,

};