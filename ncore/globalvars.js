import path from 'path';
// import fs from 'fs';
import gdir from './globalvar/gdir.js';
import env from './globalvar/env.js';
import com_bin from './globalvar/com_bin.js';
import encyclopedia from './globalvar/encyclopedia.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gfilename = __dirname;
const coredir = path.basename(gfilename);
const rootdir = path.resolve(gfilename, '..');

// const app_parrent_dir = rootdir;
const appsdir = path.join(rootdir, 'apps');

const basedir = gdir.getCwd();
let appname = env.getArg('app') || env.getArg('appname') || env.getEnv('APP_NAME');
const appdir = path.join(appsdir, appname);
const appentry = path.join(appdir, 'main.js');
const appentry_es = `./apps/${appname}/main.js`
const appenv = env.load(appdir);
const pluginsdir = path.join(__dirname, 'plugins');
const appLocalDir = gdir.getLocalDir(appname)
const appConfDir = path.join(appLocalDir, '.config');

const app = {
  appname,
  coredir,
  rootdir,
  env: appenv,
  appentry,
};

export {
  gdir,
  com_bin,
  env,
  encyclopedia,
  appLocalDir,
  appConfDir,
  appenv,
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
