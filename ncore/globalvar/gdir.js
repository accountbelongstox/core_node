import path from 'path';
import os from 'os';
import fs from 'fs';
import Base from '#@base';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Gdir extends Base {
  constructor() {
    super();
    const config = this.getBaseConfig();
    this.intranetIPAddress = config.intranetIPAddress;
    this.localStaticHttpsApiUrl = config.localStaticHttpsApiUrl;
    this.localStaticHttpApiUrl = config.localStaticHttpApiUrl;
    this.NCORE_DIR = config.NCORE_DIR;
    this.DEV_LANG_DIR = config.DEV_LANG_DIR;
    this.APP_INSTALL_DIR = config.APP_INSTALL_DIR;
    this.PROJECT_DIR = config.PROJECT_DIR;

    this.testAccessibleApi = null;
  }

  getDesktopFile(param) {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    return param ? path.join(desktopPath, param) : desktopPath;
  }

  localDownloadUrl(fp = '') {
    return `${this.localStaticHttpsApiUrl}/src/download.php?file=${fp}`;
  }

  getAppRoot(dir) {
    let dirs = ['node_modules', 'src'];
    let rootPath = this.getCwd();
    // let result = this.findDirectoryWithSubdirs(rootPath, dirs);
    let result = null;
    if (dir && result) {
      result = path.join(result, dir);
    }
    return result;
  }

  getCustomTempDir(subDir) {
    const unixStylePath = __filename.split(/\\+/).join('/');
    const Driver = unixStylePath[0] + ":/";
    const temp = path.join(Driver, '.tmp');
    const fullPath = subDir ? path.join(temp, subDir) : temp;
    this.ensureDirExists(fullPath);
    return fullPath;
  }

  getRelationRootDir(subDir, ensureDir = true) {
    const cwd = path.join(__dirname, '../../');
    const fullPath = subDir ? path.join(cwd, subDir) : cwd;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getUserProfileDir(subDir, ensureDir = true) {
    const userProfileDir = os.homedir();
    const fullPath = subDir ? path.join(userProfileDir, subDir) : userProfileDir;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getRootDir(subDir, ensureDir = true) {
    const cwd = this.getRelationRootDir(null, ensureDir);
    const fullPath = subDir ? path.join(cwd, subDir) : cwd;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getLocalStaticApiUrl(upath) {
    return upath ? this.localStaticHttpApiUrl + upath : this.localStaticHttpApiUrl;
  }

  async getLocalStaticApiTestUrl(upath) {
    return upath ? this.testAccessibleApi + upath : this.testAccessibleApi;
  }

  getLocalDir(subDir, ensureDir = true) {
    const fullPath = subDir ? path.join(this.NCORE_DIR, subDir) : this.NCORE_DIR;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getLocalInfoDir(subDir, ensureDir = true) {
    const homeDir = this.getLocalDir('.info', ensureDir);
    const fullPath = subDir ? path.join(homeDir, subDir) : homeDir;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getHomeDir(subDir, ensureDir = true) {
    const homeDir = os.homedir();
    const fullPath = subDir ? path.join(homeDir, subDir) : homeDir;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getTempDir(subDir, ensureDir = true) {
    const fullPath = subDir ? path.join(this.getLocalDir('tmp', ensureDir), subDir) : this.getLocalDir('tmp', ensureDir);
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getAppDataDir(subDir, ensureDir = true) {
    const homeDir = os.homedir();
    const fullPath = os.platform() === 'win32'
      ? subDir ? path.join(homeDir, 'AppData', subDir) : path.join(homeDir, 'AppData')
      : subDir ? path.join(homeDir, '.local', 'share', subDir) : path.join(homeDir, '.local', 'share');
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getDownloadDir(subDir, ensureDir = true) {
    const homeDir = os.homedir();
    const fullPath = os.platform() === 'win32'
      ? subDir ? path.join(homeDir, 'Downloads', subDir) : path.join(homeDir, 'Downloads')
      : subDir ? path.join(homeDir, 'Downloads', subDir) : path.join(homeDir, 'Downloads');
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getPublicDir(subDir, ensureDir = true) {
    const publicDir = this.getRootDir('public', ensureDir);
    const fullPath = subDir ? path.join(publicDir, subDir) : publicDir;
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getLibraryDir(subDir, ensureDir = true) {
    const platform = os.platform();
    return platform !== 'win32' ? this.getLibraryByLinuxDir(subDir, ensureDir) : this.getLibraryByWin32Dir(subDir, ensureDir);
  }

  getLibraryByLinuxDir(subDir, ensureDir = true) {
    const cwd = path.join(__dirname, '../');
    const fullPath = path.join(cwd, `base/library/linux/${subDir || ''}`);
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getLibraryByWin32Dir(subDir, ensureDir = true) {
    const cwd = path.join(__dirname, '../');
    const fullPath = path.join(cwd, `base/library/win32/${subDir || ''}`);
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getDevLangPath(subDir = '', ensureDir = true) {
    const fullPath = path.join(this.DEV_LANG_DIR, subDir);
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getAppInstallPath(subDir = '', ensureDir = true) {
    const fullPath = path.join(this.APP_INSTALL_DIR, subDir);
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  getProjectPath(subDir = '', ensureDir = true) {
    const fullPath = path.join(this.PROJECT_DIR, subDir);
    if (ensureDir) this.ensureDirExists(fullPath);
    return fullPath;
  }

  ensureDirExists(directoryPath, ensure = true) {
    if (ensure && !fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
  }
}

export default new Gdir();
