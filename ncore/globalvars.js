import path from 'path';
// import fs from 'fs';
import * as gdir from './gvar/gdir.js';
import env from './gvar/env.js';
import {getAppName} from './gvar/libs/appname.js';
let appname = getAppName()

// import com_bin from './gvar/com_bin.js';
import encyclopedia from './gvar/encyclopedia.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gfilename = __dirname;
const coredir = path.basename(gfilename);
const rootdir = path.resolve(gfilename, '..');

const appsdir = path.join(rootdir, 'apps');

const basedir = gdir.CWD;
const appdir = path.join(appsdir, appname);
env.addRootDir(appdir);
const appentry = path.join(appdir, 'main.js');
const appentry_es = `./apps/${appname}/main.js`
const pluginsdir = path.join(__dirname, 'plugins');
const localDir = gdir.LOCAL_DIR
const appConfDir = path.join(localDir, '.config');

const app = {
  appname,
  coredir,
  rootdir,
  appentry,
};

const currentFileUrl = import.meta.url;
const currentFilePath = fileURLToPath(currentFileUrl);
const processFilePath = path.resolve(process.argv[1]);

if (currentFilePath === processFilePath) {
    env.printAllEnvs();
}

export {
  gdir,
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
};
