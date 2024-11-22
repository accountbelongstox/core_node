import Exception from '../exception/index.js';
import { env, appdir, pluginsdir } from '#@globalvars';
import { app } from 'electron';
import path from 'path';
import debug from 'debug';
import EeApp from './eeApp.js';
import Utils from '../utils/index.js';
import Ps from '../ps/index.js';
import EE from './index.js';

const logDebug = debug('ee-core:Appliaction');

class Appliaction extends EeApp {
  constructor() {
    Exception.start();
    const { env } = process;
    // initialize mode
    Ps.initMode();

    let options = {
      env: 'prod',
      serverScope: '',
      type: 'application',
      baseDir: appdir,
      homeDir: app.getAppPath(),
      framework: path.join(pluginsdir, 'egg-electron', 'ee-core'),
      appName: app.getName(),
      userHome: app.getPath('home'),
      appData: app.getPath('appData'),
      appUserData: app.getPath('userData'),
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      execDir: app.getAppPath(),
      isEncrypted: false
    };
    console.log(__dirname);

    // argv
    let hotReload = false;
    for (let i = 0; i < process.argv.length; i++) {
      const tmpArgv = process.argv[i];
      if (tmpArgv.indexOf('--env=') !== -1) {
        options.env = tmpArgv.substring(6);
      }
      if (tmpArgv.indexOf('--hot-reload=') !== -1) {
        hotReload = tmpArgv.substring(13) == 1 ? true : false;
      }
    }

    // exec directory (exe dmg dep) for prod
    if (options.env === 'prod' && app.isPackaged) {
      options.execDir = path.dirname(app.getPath('exe'));
    }

    // Todo app.getAppPath() ??? process.cwd()
    // Use encryption, base directory is public/electron
    if (options.env === 'prod' && Utils.isEncrypt(app.getAppPath())) {
      options.baseDir = Ps.getEncryptDir(app.getAppPath());
      options.isEncrypted = true;
    }

    // normalize env
    env.EE_APP_NAME = options.appName;
    env.EE_HOME = options.homeDir;
    env.EE_BASE_DIR = options.baseDir;
    env.EE_SERVER_ENV = options.env;
    env.EE_SERVER_SCOPE = options.serverScope;
    env.EE_USER_HOME = options.userHome;
    env.EE_APP_DATA = options.appData;
    env.EE_APP_USER_DATA = options.appUserData;
    env.HOT_RELOAD = hotReload;
    env.EE_EXEC_DIR = options.execDir;
    env.EE_IS_PACKAGED = options.isPackaged;
    env.EE_IS_ENCRYPTED = options.isEncrypted;
    env.EE_DATABASE_DIR = null;
    env.EE_MAIN_PORT = null;
    env.EE_SOCKET_PORT = null;
    env.EE_HTTP_PORT = null;
    logDebug('options:%j', options);

    super(options);

    // 设置全局this
    EE.CoreApp = this;

    this.initialize();
  }

  async initialize() {
    await this.createPorts();
    await this.startSocket();
    await this.ready();
    await this.createElectronApp();
    await this.InitModuleMode();
  }
}

export default Appliaction;
