import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { HOST_NAME } from './constant';

export enum BrowserType {
  CHROME = 'chrome',
  CHROMIUM = 'chromium',
  FIREFOX = 'firefox',
}

export interface BrowserConfig {
  type: BrowserType;
  displayName: string;
  userManifestPath: string;
  systemManifestPath: string;
  registryKey?: string;
  systemRegistryKey?: string;
}

type PlatformFamily = 'win32' | 'darwin' | 'linux';

interface BrowserDefinition {
  displayName: string;
  userManifestSegments: Record<PlatformFamily, string[]>;
  systemManifestSegments: Record<PlatformFamily, string[]>;
  windowsRegistryPath: string;
  windowsDetectionRegistryPath: string;
  macApplicationPath: string;
  linuxCommands: string[];
}

const MANIFEST_FILE_NAME = `${HOST_NAME}.json`;
const BROWSER_DEFINITIONS: Record<BrowserType, BrowserDefinition> = {
  [BrowserType.CHROME]: {
    displayName: 'Chrome',
    userManifestSegments: {
      win32: ['Google', 'Chrome', 'NativeMessagingHosts'],
      darwin: ['Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'],
      linux: ['.config', 'google-chrome', 'NativeMessagingHosts'],
    },
    systemManifestSegments: {
      win32: ['Google', 'Chrome', 'NativeMessagingHosts'],
      darwin: ['Google', 'Chrome', 'NativeMessagingHosts'],
      linux: ['etc', 'opt', 'chrome', 'native-messaging-hosts'],
    },
    windowsRegistryPath: 'Google\\Chrome',
    windowsDetectionRegistryPath: 'HKLM\\SOFTWARE\\Google\\Chrome',
    macApplicationPath: '/Applications/Google Chrome.app',
    linuxCommands: ['google-chrome', 'google-chrome-stable'],
  },
  [BrowserType.CHROMIUM]: {
    displayName: 'Chromium',
    userManifestSegments: {
      win32: ['Chromium', 'NativeMessagingHosts'],
      darwin: ['Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'],
      linux: ['.config', 'chromium', 'NativeMessagingHosts'],
    },
    systemManifestSegments: {
      win32: ['Chromium', 'NativeMessagingHosts'],
      darwin: ['Application Support', 'Chromium', 'NativeMessagingHosts'],
      linux: ['etc', 'chromium', 'native-messaging-hosts'],
    },
    windowsRegistryPath: 'Chromium',
    windowsDetectionRegistryPath: 'HKLM\\SOFTWARE\\Chromium',
    macApplicationPath: '/Applications/Chromium.app',
    linuxCommands: ['chromium', 'chromium-browser'],
  },
  [BrowserType.FIREFOX]: {
    displayName: 'Firefox',
    userManifestSegments: {
      win32: ['Mozilla', 'NativeMessagingHosts'],
      darwin: ['Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts'],
      linux: ['.mozilla', 'native-messaging-hosts'],
    },
    systemManifestSegments: {
      win32: ['Mozilla', 'NativeMessagingHosts'],
      darwin: ['Application Support', 'Mozilla', 'NativeMessagingHosts'],
      linux: ['usr', 'lib', 'mozilla', 'native-messaging-hosts'],
    },
    windowsRegistryPath: 'Mozilla',
    windowsDetectionRegistryPath: 'HKLM\\SOFTWARE\\Mozilla\\Mozilla Firefox',
    macApplicationPath: '/Applications/Firefox.app',
    linuxCommands: ['firefox', 'firefox-esr'],
  },
};

function getPlatformFamily(): PlatformFamily {
  const platform = os.platform();
  return platform === 'win32' || platform === 'darwin' ? platform : 'linux';
}

function getUserManifestPath(browser: BrowserType, platform: PlatformFamily): string {
  const definition = BROWSER_DEFINITIONS[browser];
  const rootPath =
    platform === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : os.homedir();

  return path.join(rootPath, ...definition.userManifestSegments[platform], MANIFEST_FILE_NAME);
}

function getSystemManifestPath(browser: BrowserType, platform: PlatformFamily): string {
  const definition = BROWSER_DEFINITIONS[browser];
  const rootPath =
    platform === 'win32'
      ? process.env.ProgramFiles || 'C:\\Program Files'
      : platform === 'darwin'
        ? '/Library'
        : path.parse(process.cwd()).root;

  return path.join(rootPath, ...definition.systemManifestSegments[platform], MANIFEST_FILE_NAME);
}

function getRegistryKeys(
  browser: BrowserType,
  platform: PlatformFamily,
): { user: string; system: string } | undefined {
  const registryPath = BROWSER_DEFINITIONS[browser].windowsRegistryPath;

  if (platform !== 'win32') {
    return undefined;
  }

  return {
    user: `HKCU\\Software\\${registryPath}\\NativeMessagingHosts\\${HOST_NAME}`,
    system: `HKLM\\Software\\${registryPath}\\NativeMessagingHosts\\${HOST_NAME}`,
  };
}

export function getBrowserConfig(browser: BrowserType): BrowserConfig {
  const platform = getPlatformFamily();
  const definition = BROWSER_DEFINITIONS[browser];
  const registryKeys = getRegistryKeys(browser, platform);

  return {
    type: browser,
    displayName: definition.displayName,
    userManifestPath: getUserManifestPath(browser, platform),
    systemManifestPath: getSystemManifestPath(browser, platform),
    registryKey: registryKeys?.user,
    systemRegistryKey: registryKeys?.system,
  };
}

export function detectInstalledBrowsers(): BrowserType[] {
  const detectedBrowsers: BrowserType[] = [];
  const platform = getPlatformFamily();

  for (const browser of Object.values(BrowserType)) {
    const definition = BROWSER_DEFINITIONS[browser];

    if (platform === 'win32') {
      try {
        execSync(`reg query "${definition.windowsDetectionRegistryPath}" 2>nul`, {
          stdio: 'pipe',
        });
        detectedBrowsers.push(browser);
      } catch {
        continue;
      }
      continue;
    }

    if (platform === 'darwin') {
      if (fs.existsSync(definition.macApplicationPath)) {
        detectedBrowsers.push(browser);
      }
      continue;
    }

    for (const command of definition.linuxCommands) {
      try {
        execSync(`which ${command} 2>/dev/null`, { stdio: 'pipe' });
        detectedBrowsers.push(browser);
        break;
      } catch {
        continue;
      }
    }
  }

  return detectedBrowsers;
}

export function getAllBrowserConfigs(): BrowserConfig[] {
  return Object.values(BrowserType).map((browser) => getBrowserConfig(browser));
}

export function parseBrowserType(browserStr: string): BrowserType | undefined {
  const normalized = browserStr.toLowerCase();
  return Object.values(BrowserType).find((type) => type === normalized);
}
