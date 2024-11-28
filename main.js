import { sysarg, run } from '#@utils_native';
import { appentry_es, } from './ncore/globalvars.js';
import printer from '#@/ncore/base/printer.js';
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
class ClientMain {
  // NCORE_DIR = './';
  async start() {
    // const entryModule = `${this.NCORE_DIR}${appentry}`;
    printer.success('entryModule/appentry_es:' + appentry_es);
    const appMain = await import(appentry_es);
    console.log(appMain)
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

const client = new ClientMain()
client.start()
