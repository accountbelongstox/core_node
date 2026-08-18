#!/usr/bin/env node

/**
 * Shared native messaging host constants and helpers.
 * Single source for manifest paths and Windows registry keys used by the
 * local development scripts (register/unregister/update-extension-id).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const HOST_NAME = 'com.chromemcp.nativehost';

const BROWSER_CHROME = 'chrome';
const BROWSER_CHROMIUM = 'chromium';
const BROWSER_DEFINITIONS = Object.freeze({
  [BROWSER_CHROME]: Object.freeze({
    type: BROWSER_CHROME,
    displayName: 'Chrome',
    windowsPath: ['Google', 'Chrome', 'NativeMessagingHosts'],
    macPath: ['Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'],
    linuxPath: ['.config', 'google-chrome', 'NativeMessagingHosts'],
    windowsRegistryPath: 'Google\\Chrome',
  }),
  [BROWSER_CHROMIUM]: Object.freeze({
    type: BROWSER_CHROMIUM,
    displayName: 'Chromium',
    windowsPath: ['Chromium', 'NativeMessagingHosts'],
    macPath: ['Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'],
    linuxPath: ['.config', 'chromium', 'NativeMessagingHosts'],
    windowsRegistryPath: 'Chromium',
  }),
});
const SUPPORTED_BROWSERS = Object.freeze(Object.values(BROWSER_DEFINITIONS));

function getBrowserDefinition(browser) {
  return BROWSER_DEFINITIONS[browser] || BROWSER_DEFINITIONS[BROWSER_CHROME];
}

/**
 * Get the user-level native messaging host manifest path for a browser
 */
function getUserManifestPath(browser = BROWSER_CHROME) {
  const homeDir = os.homedir();
  const definition = getBrowserDefinition(browser);

  if (os.platform() === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, ...definition.windowsPath, `${HOST_NAME}.json`);
  }

  if (os.platform() === 'darwin') {
    return path.join(homeDir, ...definition.macPath, `${HOST_NAME}.json`);
  }

  return path.join(homeDir, ...definition.linuxPath, `${HOST_NAME}.json`);
}

/**
 * Get the Windows user-level (HKCU) registry key for a browser
 */
function getWindowsUserRegistryKey(browser = BROWSER_CHROME) {
  const definition = getBrowserDefinition(browser);

  if (os.platform() !== 'win32') {
    return null;
  }

  return `HKCU\\Software\\${definition.windowsRegistryPath}\\NativeMessagingHosts\\${HOST_NAME}`;
}

/**
 * Replace extension origins while preserving non-extension origins.
 */
function validateExtensionId(extensionId) {
  if (typeof extensionId !== 'string' || !/^[a-p]{32}$/.test(extensionId)) {
    throw new Error(
      `Invalid extension ID: ${extensionId}. Extension ID must contain 32 lowercase letters from a to p.`,
    );
  }
}

function buildAllowedOrigins(existingOrigins, extensionId) {
  validateExtensionId(extensionId);

  const allowedOrigins = Array.isArray(existingOrigins)
    ? existingOrigins.filter(
        origin => typeof origin === 'string' && !origin.startsWith('chrome-extension://'),
      )
    : [];

  allowedOrigins.push(`chrome-extension://${extensionId}/`);
  return allowedOrigins;
}

/**
 * Get the native host wrapper script path inside a built dist directory
 */
function getRunHostPath(nativeServerDist) {
  const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
  return path.resolve(nativeServerDist, wrapperScriptName);
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[OK] Created directory: ${dirPath}`);
  }
}

/**
 * Add a Windows registry entry pointing at the manifest (throws on failure)
 */
function addWindowsRegistryKey(registryKey, manifestPath) {
  const escapedPath = manifestPath.replace(/\\/g, '\\\\');
  execSync(`reg add "${registryKey}" /ve /t REG_SZ /d "${escapedPath}" /f`, { stdio: 'pipe' });
}

/**
 * Remove a Windows registry entry (throws on failure)
 */
function removeWindowsRegistryKey(registryKey) {
  execSync(`reg delete "${registryKey}" /f`, { stdio: 'pipe' });
}

module.exports = {
  HOST_NAME,
  BROWSER_CHROME,
  BROWSER_CHROMIUM,
  SUPPORTED_BROWSERS,
  getUserManifestPath,
  getWindowsUserRegistryKey,
  validateExtensionId,
  buildAllowedOrigins,
  getRunHostPath,
  ensureDir,
  addWindowsRegistryKey,
  removeWindowsRegistryKey,
};
