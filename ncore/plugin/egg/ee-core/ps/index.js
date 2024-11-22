import path from 'path';
import eis from '../utils/is.js';
import { basedir } from '#@globalvars';

export const initMode = (mode) => {
  if (process.env.EE_MODE !== undefined) return;
  process.env.EE_MODE = mode ? mode : 'framework';
};

export const mode = () => process.env.EE_MODE;

export const verifyMode = (mode) => ['framework', 'module'].includes(mode);

export const isFrameworkMode = () => process.env.EE_MODE === 'framework';

export const isModuleMode = () => process.env.EE_MODE === 'module';

export const allEnv = () => process.env;

export const env = () => process.env.EE_SERVER_ENV;

export const getEnv = () => process.env;

export const isProd = () => process.env.EE_SERVER_ENV === 'prod';

export const isDev = () => {
  const devEnvs = ['development', 'dev', 'local'];
  return devEnvs.includes(process.env.EE_SERVER_ENV) || devEnvs.includes(process.env.NODE_ENV);
};

export const isRenderer = () => typeof process === 'undefined' || !process || process.type === 'renderer';

export const isMain = () => typeof process !== 'undefined' && process.type === 'browser';

export const isForkedChild = () => Number(process.env.ELECTRON_RUN_AS_NODE) === 1;

export const processType = () => {
  if (isMain()) return 'browser';
  if (isRenderer()) return 'renderer';
  if (isForkedChild()) return 'child';
  return '';
};

export const appName = () => process.env.EE_APP_NAME;

export const getHomeDir = () => process.env.EE_HOME;

export const getStorageDir = () => path.join(getRootDir(), 'data');

export const getLogDir = () => path.join(getRootDir(), 'logs');

export const getEncryptDir = (basePath) => {
  const base = basePath || process.cwd();
  return path.join(base, 'public', 'electron');
};

export const getRootDir = () => basedir;

export const getBaseDir = () => process.env.EE_BASE_DIR;

export const getElectronDir = () => process.env.EE_BASE_DIR;

export const getPublicDir = () => path.join(process.env.EE_HOME, 'public');

export const getExtraResourcesDir = () => {
  const execDir = getExecDir();
  const isPackaged = isPackaged();

  let dir = '';
  if (isPackaged) {
    dir = path.join(execDir, 'resources', 'extraResources');
    if (eis.macOS()) {
      dir = path.join(execDir, '..', 'Resources', 'extraResources');
    }
  } else {
    dir = path.join(execDir, 'build', 'extraResources');
  }
  return dir;
};

export const getAppUserDataDir = () => process.env.EE_APP_USER_DATA;

export const getExecDir = () => process.env.EE_EXEC_DIR;

export const getUserHomeDir = () => process.env.EE_USER_HOME;

export const getUserHomeConfigDir = () => {
  const appname = appName();
  return path.join(getUserHomeDir(), '.config', appname);
};

export const getUserHomeAppFilePath = () => path.join(getUserHomeConfigDir(), 'app.json');

export const getMainPort = () => parseInt(process.env.EE_MAIN_PORT) || 0;

export const getSocketPort = () => parseInt(process.env.EE_SOCKET_PORT) || 0;

export const getHttpPort = () => parseInt(process.env.EE_HTTP_PORT) || 0;

export const isPackaged = () => process.env.EE_IS_PACKAGED === 'true';

export const isEncrypted = () => process.env.EE_IS_ENCRYPTED === 'true';

export const isHotReload = () => process.env.HOT_RELOAD === 'true';

export const exit = (code = 0) => process.exit(code);

export const makeMessage = (msg = {}) => {
  return {
    channel: '',
    event: '',
    data: {},
    ...msg
  };
};

export const exitChildJob = (code = 0) => {
  try {
    const args = JSON.parse(process.argv[2]);
    if (args.type === 'childJob') {
      process.exit(code);
    }
  } catch (e) {
    process.exit(code);
  }
};

export const isChildJob = () => {
  try {
    const args = JSON.parse(process.argv[2]);
    return args.type === 'childJob';
  } catch (e) {
    return false;
  }
};

export const isChildPoolJob = () => {
  try {
    const args = JSON.parse(process.argv[2]);
    return args.type === 'childPoolJob';
  } catch (e) {
    return false;
  }
};
