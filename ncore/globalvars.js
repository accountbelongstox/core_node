const path = require('path');
// const fs = require('fs');
const gdir = require('./gvar/gdir.js');
const env = require('./gvar/env-lib/env.js');
const { getAppName } = require('./gvar/libs/appname.js');
let appname = getAppName()

// const com_bin = require('./gvar/com_bin.js');
const encyclopedia = require('./gvar/encyclopedia.js');

const gfilename = __dirname;
const coredir = path.basename(gfilename);
const rootdir = path.resolve(gfilename, '..');
const cwd = rootdir;

const appsdir = path.join(rootdir, 'apps');
// #Abcdeqf!23
const basedir = gdir.CWD;
const appdir = path.join(appsdir, appname);
env.addRootDir(appdir);
const appentry = path.join(appdir, 'main.js');
const appentry_es = `./apps/${appname}/main.js`
const pluginsdir = path.join(__dirname, 'plugins');
const localDir = gdir.LOCAL_DIR
const appConfDir = path.join(localDir, '.config');

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
};