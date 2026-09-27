import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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

interface NativeHostBrowserDefinition {
  type: BrowserType;
  displayName: string;
  windowsDetectionRegistryPath: string;
  macApplicationPath: string;
  linuxCommands: string[];
}

export interface NativeHostManifestOptions {
  description: string;
  extensionId?: string;
  nativeServerDist?: string;
  runHostPath?: string;
}

interface NativeHostCommon {
  getBrowserDefinition(browser: BrowserType): NativeHostBrowserDefinition;
  getUserManifestPath(browser: BrowserType): string;
  getSystemManifestPath(browser: BrowserType): string;
  getWindowsUserRegistryKey(browser: BrowserType): string | null;
  getWindowsSystemRegistryKey(browser: BrowserType): string | null;
  getRunHostPath(nativeServerDist: string): string;
  createManifestContent(
    manifestPath: string,
    browser: BrowserType,
    options: NativeHostManifestOptions,
  ): Record<string, unknown>;
  registerUserHost(browser: BrowserType, options: NativeHostManifestOptions): boolean;
  writeNodePath(nativeServerDist: string): string;
  buildWindowsRegistryAddCommand(registryKey: string, manifestPath: string): string;
}

// The browser table and user-level registration live once, in
// apps/mcp-chrome/scripts/native-host-common.cjs (same depth from src/ and dist/).
const NATIVE_HOST_COMMON_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'scripts',
  'native-host-common.cjs',
);
export const nativeHostCommon: NativeHostCommon = require(NATIVE_HOST_COMMON_PATH);

export function getBrowserConfig(browser: BrowserType): BrowserConfig {
  const definition = nativeHostCommon.getBrowserDefinition(browser);

  return {
    type: browser,
    displayName: definition.displayName,
    userManifestPath: nativeHostCommon.getUserManifestPath(browser),
    systemManifestPath: nativeHostCommon.getSystemManifestPath(browser),
    registryKey: nativeHostCommon.getWindowsUserRegistryKey(browser) ?? undefined,
    systemRegistryKey: nativeHostCommon.getWindowsSystemRegistryKey(browser) ?? undefined,
  };
}

export function detectInstalledBrowsers(): BrowserType[] {
  const detectedBrowsers: BrowserType[] = [];
  const platform = process.platform;

  for (const browser of Object.values(BrowserType)) {
    const definition = nativeHostCommon.getBrowserDefinition(browser);

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
