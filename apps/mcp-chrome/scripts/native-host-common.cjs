#!/usr/bin/env node

/**
 * Shared native messaging host constants and helpers.
 * Single source for the per-browser manifest paths, Windows registry keys and
 * the user-level registration used by the local development scripts
 * (register/unregister/update-extension-id) and the native-server CLI
 * (app/native-server/src/scripts/browser-config.ts loads this file).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVICE_CONTRACT = require(path.resolve(PROJECT_ROOT, '..', '..', 'config', 'service_contract.json'));
const MCP_CHROME_LAYOUT = SERVICE_CONTRACT.mcp_chrome;
const HOST_NAME = MCP_CHROME_LAYOUT.native_host_name;
const EXTENSION_ID = MCP_CHROME_LAYOUT.extension_id;
const FIREFOX_EXTENSION_ID = MCP_CHROME_LAYOUT.firefox_extension_id;
const EXTENSION_BUILD_DIR = path.join(
  PROJECT_ROOT,
  MCP_CHROME_LAYOUT.build_output_dir,
  MCP_CHROME_LAYOUT.extension_dir,
);
const NATIVE_SERVER_DIST = path.join(PROJECT_ROOT, 'app', 'native-server', 'dist');
const MANIFEST_FILE_NAME = `${HOST_NAME}.json`;
const NODE_PATH_FILE_NAME = 'node_path.txt';
const EXTENSION_ORIGIN_PREFIX = 'chrome-extension://';

const PLATFORM_WINDOWS = 'win32';
const PLATFORM_MAC = 'darwin';
const PLATFORM_LINUX = 'linux';
const WINDOWS_USER_HIVE = 'HKCU';
const WINDOWS_SYSTEM_HIVE = 'HKLM';

const BROWSER_CHROME = 'chrome';
const BROWSER_CHROMIUM = 'chromium';
const BROWSER_FIREFOX = 'firefox';
const BROWSER_DEFINITIONS = Object.freeze({
  [BROWSER_CHROME]: Object.freeze({
    type: BROWSER_CHROME,
    displayName: 'Chrome',
    userManifestSegments: {
      [PLATFORM_WINDOWS]: ['Google', 'Chrome', 'NativeMessagingHosts'],
      [PLATFORM_MAC]: ['Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'],
      [PLATFORM_LINUX]: ['.config', 'google-chrome', 'NativeMessagingHosts'],
    },
    systemManifestSegments: {
      [PLATFORM_WINDOWS]: ['Google', 'Chrome', 'NativeMessagingHosts'],
      [PLATFORM_MAC]: ['Google', 'Chrome', 'NativeMessagingHosts'],
      [PLATFORM_LINUX]: ['etc', 'opt', 'chrome', 'native-messaging-hosts'],
    },
    windowsRegistryPath: 'Google\\Chrome',
    windowsDetectionRegistryPath: 'HKLM\\SOFTWARE\\Google\\Chrome',
    macApplicationPath: '/Applications/Google Chrome.app',
    linuxCommands: ['google-chrome', 'google-chrome-stable'],
  }),
  [BROWSER_CHROMIUM]: Object.freeze({
    type: BROWSER_CHROMIUM,
    displayName: 'Chromium',
    userManifestSegments: {
      [PLATFORM_WINDOWS]: ['Chromium', 'NativeMessagingHosts'],
      [PLATFORM_MAC]: ['Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'],
      [PLATFORM_LINUX]: ['.config', 'chromium', 'NativeMessagingHosts'],
    },
    systemManifestSegments: {
      [PLATFORM_WINDOWS]: ['Chromium', 'NativeMessagingHosts'],
      [PLATFORM_MAC]: ['Application Support', 'Chromium', 'NativeMessagingHosts'],
      [PLATFORM_LINUX]: ['etc', 'chromium', 'native-messaging-hosts'],
    },
    windowsRegistryPath: 'Chromium',
    windowsDetectionRegistryPath: 'HKLM\\SOFTWARE\\Chromium',
    macApplicationPath: '/Applications/Chromium.app',
    linuxCommands: ['chromium', 'chromium-browser'],
  }),
  [BROWSER_FIREFOX]: Object.freeze({
    type: BROWSER_FIREFOX,
    displayName: 'Firefox',
    userManifestSegments: {
      [PLATFORM_WINDOWS]: ['Mozilla', 'NativeMessagingHosts'],
      [PLATFORM_MAC]: ['Library', 'Application Support', 'Mozilla', 'NativeMessagingHosts'],
      [PLATFORM_LINUX]: ['.mozilla', 'native-messaging-hosts'],
    },
    systemManifestSegments: {
      [PLATFORM_WINDOWS]: ['Mozilla', 'NativeMessagingHosts'],
      [PLATFORM_MAC]: ['Application Support', 'Mozilla', 'NativeMessagingHosts'],
      [PLATFORM_LINUX]: ['usr', 'lib', 'mozilla', 'native-messaging-hosts'],
    },
    windowsRegistryPath: 'Mozilla',
    windowsDetectionRegistryPath: 'HKLM\\SOFTWARE\\Mozilla\\Mozilla Firefox',
    macApplicationPath: '/Applications/Firefox.app',
    linuxCommands: ['firefox', 'firefox-esr'],
  }),
});
const ALL_BROWSERS = Object.freeze(Object.values(BROWSER_DEFINITIONS));
// Local development registers the Chromium-family hosts only.
const SUPPORTED_BROWSERS = Object.freeze([
  BROWSER_DEFINITIONS[BROWSER_CHROME],
  BROWSER_DEFINITIONS[BROWSER_CHROMIUM],
]);

function getBrowserDefinition(browser) {
  return BROWSER_DEFINITIONS[browser] || BROWSER_DEFINITIONS[BROWSER_CHROME];
}

function getPlatformFamily() {
  const platform = os.platform();
  return platform === PLATFORM_WINDOWS || platform === PLATFORM_MAC ? platform : PLATFORM_LINUX;
}

/**
 * Get the user-level native messaging host manifest path for a browser
 */
function getUserManifestPath(browser = BROWSER_CHROME) {
  const platform = getPlatformFamily();
  const definition = getBrowserDefinition(browser);
  const rootPath =
    platform === PLATFORM_WINDOWS
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : os.homedir();

  return path.join(rootPath, ...definition.userManifestSegments[platform], MANIFEST_FILE_NAME);
}

/**
 * Get the system-level native messaging host manifest path for a browser
 */
function getSystemManifestPath(browser = BROWSER_CHROME) {
  const platform = getPlatformFamily();
  const definition = getBrowserDefinition(browser);
  let rootPath = path.parse(process.cwd()).root;

  if (platform === PLATFORM_WINDOWS) {
    rootPath = process.env.ProgramFiles || 'C:\\Program Files';
  } else if (platform === PLATFORM_MAC) {
    rootPath = '/Library';
  }

  return path.join(rootPath, ...definition.systemManifestSegments[platform], MANIFEST_FILE_NAME);
}

function getWindowsRegistryKey(browser, hive) {
  const definition = getBrowserDefinition(browser);

  if (os.platform() !== PLATFORM_WINDOWS) {
    return null;
  }

  return `${hive}\\Software\\${definition.windowsRegistryPath}\\NativeMessagingHosts\\${HOST_NAME}`;
}

/**
 * Get the Windows user-level (HKCU) registry key for a browser
 */
function getWindowsUserRegistryKey(browser = BROWSER_CHROME) {
  return getWindowsRegistryKey(browser, WINDOWS_USER_HIVE);
}

/**
 * Get the Windows system-level (HKLM) registry key for a browser
 */
function getWindowsSystemRegistryKey(browser = BROWSER_CHROME) {
  return getWindowsRegistryKey(browser, WINDOWS_SYSTEM_HIVE);
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
        origin => typeof origin === 'string' && !origin.startsWith(EXTENSION_ORIGIN_PREFIX),
      )
    : [];

  allowedOrigins.push(`${EXTENSION_ORIGIN_PREFIX}${extensionId}/`);
  return allowedOrigins;
}

/**
 * Get the native host wrapper script path inside a built dist directory
 */
function getRunHostPath(nativeServerDist = NATIVE_SERVER_DIST) {
  const wrapperScriptName = process.platform === PLATFORM_WINDOWS ? 'run_host.bat' : 'run_host.sh';
  return path.resolve(nativeServerDist, wrapperScriptName);
}

/**
 * Build the host manifest for a browser. Chromium-family manifests keep the
 * non-extension origins already present in the target file; Firefox uses
 * allowed_extensions.
 */
function createManifestContent(manifestPath, browser, options) {
  const manifest = {
    name: HOST_NAME,
    description: options.description,
    path: options.runHostPath || getRunHostPath(options.nativeServerDist),
    type: 'stdio',
  };
  let existingOrigins = [];

  if (browser === BROWSER_FIREFOX) {
    return { ...manifest, allowed_extensions: [FIREFOX_EXTENSION_ID] };
  }

  if (fs.existsSync(manifestPath)) {
    try {
      existingOrigins = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).allowed_origins;
    } catch (err) {
      console.log(`[WARN] Could not read existing manifest: ${err.message}`);
    }
  }

  return {
    ...manifest,
    allowed_origins: buildAllowedOrigins(existingOrigins, options.extensionId || EXTENSION_ID),
  };
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
 * Make a manifest directory readable by all users (Unix/Linux/macOS)
 */
function fixManifestDirPermissions(dirPath) {
  if (os.platform() === PLATFORM_WINDOWS) {
    return;
  }

  try {
    execSync(`chmod 755 "${dirPath}" 2>/dev/null`, { stdio: 'pipe' });
    execSync(`chmod 644 "${dirPath}"/*.json 2>/dev/null`, { stdio: 'pipe' });
    console.log('[OK] Set permissions for manifest directory (755/644)');
  } catch (err) {
    console.warn(`[WARN] Failed to set permissions: ${err.message}`);
  }
}

/**
 * Write the Node.js path run_host scripts use to start the host
 */
function writeNodePath(nativeServerDist = NATIVE_SERVER_DIST) {
  const nodePathFile = path.join(nativeServerDist, NODE_PATH_FILE_NAME);
  fs.writeFileSync(nodePathFile, process.execPath, 'utf8');
  return nodePathFile;
}

function buildWindowsRegistryAddCommand(registryKey, manifestPath) {
  const escapedPath = manifestPath.replace(/\\/g, '\\\\');
  return `reg add "${registryKey}" /ve /t REG_SZ /d "${escapedPath}" /f`;
}

/**
 * Add a Windows registry entry pointing at the manifest (throws on failure)
 */
function addWindowsRegistryKey(registryKey, manifestPath) {
  execSync(buildWindowsRegistryAddCommand(registryKey, manifestPath), { stdio: 'pipe' });
}

/**
 * Remove a Windows registry entry (throws on failure)
 */
function removeWindowsRegistryKey(registryKey) {
  execSync(`reg delete "${registryKey}" /f`, { stdio: 'pipe' });
}

/**
 * Register the user-level host for one browser: manifest, directory
 * permissions, the Windows HKCU entry and node_path.txt. Returns success.
 */
function registerUserHost(browser, options) {
  const definition = getBrowserDefinition(browser);
  const manifestPath = getUserManifestPath(definition.type);
  const registryKey = getWindowsUserRegistryKey(definition.type);
  const nativeServerDist = options.nativeServerDist || NATIVE_SERVER_DIST;

  try {
    if (definition.type !== BROWSER_FIREFOX && !options.extensionId) {
      throw new Error(`Extension ID is required for ${definition.displayName} registration`);
    }

    ensureDir(path.dirname(manifestPath));
    const manifest = createManifestContent(manifestPath, definition.type, {
      ...options,
      nativeServerDist,
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[OK] Manifest written: ${manifestPath}`);
    if (options.extensionId) {
      console.log(`[OK] Configured extension ID: ${options.extensionId}`);
    }

    fixManifestDirPermissions(path.dirname(manifestPath));

    if (registryKey) {
      try {
        addWindowsRegistryKey(registryKey, manifestPath);
        console.log(`[OK] Registry entry created: ${registryKey}`);
      } catch (err) {
        console.warn(`[WARN] Registry entry failed for ${definition.displayName}: ${err.message}`);
        console.warn('[HINT] Try running as Administrator if this fails');
      }
    }

    try {
      writeNodePath(nativeServerDist);
      console.log(`[OK] Node.js path written: ${process.execPath}`);
    } catch (err) {
      console.warn(`[WARN] Failed to write ${NODE_PATH_FILE_NAME}: ${err.message}`);
    }

    console.log(`[SUCCESS] Successfully registered ${definition.displayName}\n`);
    return true;
  } catch (err) {
    console.error(`[ERROR] Failed to register ${definition.displayName}: ${err.message}\n`);
    return false;
  }
}

module.exports = {
  HOST_NAME,
  EXTENSION_ID,
  FIREFOX_EXTENSION_ID,
  EXTENSION_BUILD_DIR,
  NATIVE_SERVER_DIST,
  BROWSER_CHROME,
  BROWSER_CHROMIUM,
  BROWSER_FIREFOX,
  ALL_BROWSERS,
  SUPPORTED_BROWSERS,
  getBrowserDefinition,
  getUserManifestPath,
  getSystemManifestPath,
  getWindowsUserRegistryKey,
  getWindowsSystemRegistryKey,
  validateExtensionId,
  buildAllowedOrigins,
  getRunHostPath,
  createManifestContent,
  ensureDir,
  writeNodePath,
  buildWindowsRegistryAddCommand,
  addWindowsRegistryKey,
  removeWindowsRegistryKey,
  registerUserHost,
};
