import Base from '#@base';
import path from 'path';
import { sysarg, run } from '#@utils_native';
import { appentry, appentry_es, basedir } from './ncore/globalvars.js';
import BaseInstall from './ncore/base/base_install/main.js';
import autoInstall from '#@ncore/base/base_install/auto_install/main.js';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const role = sysarg.getArg('role');
const action = sysarg.getArg('action');
console.log(`role ${role}`)
console.log(`action ${action}`)
try {
  if (typeof ReadableStream === 'undefined') {
    const { ReadableStream } = await import('web-streams-polyfill');
    global.ReadableStream = ReadableStream;
  }
} catch (error) {
  console.log(error)
}
class ClientMain extends Base {
  // NCORE_DIR = './';
  constructor() {
    super();
  }
  async start() {
    // const entryModule = `${this.NCORE_DIR}${appentry}`;
    this.success('entryModule/appentry_es:' + appentry_es);
    const appMain = await import(appentry_es);
    
    if (!appMain.default || typeof appMain.default.start !== 'function') {
      throw new Error('Imported module does not have a start method');
    }
    
    await appMain.default.start();
  }
}
if (!run.isAdmin()) {
  console.error('\x1b[31m%s\x1b[0m', 'Please run as administrator to avoid potential issues: Unable to write to the registry, unable to enable system features, etc.');
  console.error('\x1b[31m%s\x1b[0m', 'To run as administrator, right-click the script and select "Run as administrator".');
}


if (action === 'auto_install') {
  const projectPath = __dirname;
  autoInstall.start(projectPath);
} else {
  if (role === 'client' && action === 'init') {
    const baseInstall = new BaseInstall();
    baseInstall.start()
  } else {
    if (action === 'server') {
      //
    } else {
      //
    }
    const clientMain = new ClientMain();
    clientMain.start();
  }
}


// const strapi = require('@strapi/strapi');
// const app = strapi({ distDir: './dist' });
// app.start();

// strapi_rc({
//     // Specify the path to your custom configuration files here
//     app: path.resolve(__dirname, 'path/to/your/custom/configuration')
// }).start();
