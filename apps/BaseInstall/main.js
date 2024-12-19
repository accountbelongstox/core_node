const path = require('path');
    const { sysarg, run } = require('#@utils_native');
    const { appentry, appentry_es, basedir } = require('./ncore/globalvars.js');
    const BaseInstall = require('./ncore/base/base_install/main.js');
    const autoInstall = require('#@ncore/base/base_install/auto_install/main.js');
    const printer = require('#@/ncore/base/printer.js');
    
    const __filename = __filename;
    const __dirname = path.dirname(__filename);
    const role = sysarg.getArg('role');
    const action = sysarg.getArg('action');
    
    console.log(`role ${role}`);
    console.log(`action ${action}`);
    
    try {
      if (typeof ReadableStream === 'undefined') {
        const { ReadableStream } = require('web-streams-polyfill');
        global.ReadableStream = ReadableStream;
      }
    } catch (error) {
      console.log(error);
    }
    
    class ClientMain {
      // NCORE_DIR = './';
      async start() {
        // const entryModule = `${this.NCORE_DIR}${appentry}`;
        printer.success('entryModule/appentry_es:' + appentry_es);
        const appMain = await require(appentry_es);
        
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
        baseInstall.start();
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