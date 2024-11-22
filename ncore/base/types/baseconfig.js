import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalDir(subDir, ensureDir = true) {
  const locadir = os.platform() === 'win32' ? path.join(os.homedir(), '.ncore') : '/usr/local/.ncore';
  const fullPath = subDir ? path.join(locadir, subDir) : locadir;
  if (ensureDir) ensureDirExists(fullPath);
  return fullPath;
}

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function replaceUsername(str) {
  return str.replace('<USERNAME>', os.userInfo().username);
}

const rootDir = path.resolve(__dirname, '../../../');
const configFilePath = path.resolve(rootDir, 'base.config.json');
console.log(`configFilePath`,configFilePath)
let config;
try {
  config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
} catch (error) {
  console.error('Error reading base.config.json:', error);
  process.exit(1);
}

const platform = os.platform();
const commonSettings = config.common;
const osSpecificSettings = config[platform === 'win32' ? 'win32' : 'linux'];
const appBinDir = path.resolve(rootDir, '.bin');
const appPlatformBinDir = path.resolve(appBinDir, os.platform());

const mergedSettings = { ...commonSettings, ...osSpecificSettings,appBinDir,appPlatformBinDir };

for (const [key, value] of Object.entries(mergedSettings)) {
  if (typeof value === 'string') {
    mergedSettings[key] = replaceUsername(value);
    if (key.toLowerCase().endsWith('_dir') || key.toLowerCase().endsWith('_path')) {
      if (!path.isAbsolute(mergedSettings[key])) {
        mergedSettings[key] = getLocalDir(mergedSettings[key]);
      }
    }
  }
}

export default mergedSettings;
