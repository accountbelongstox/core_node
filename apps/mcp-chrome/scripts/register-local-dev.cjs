#!/usr/bin/env node

/**
 * Register local development version of mcp-chrome-bridge
 * This script registers the local compiled version instead of the globally installed one
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOST_NAME = 'com.chromemcp.nativehost';
const EXTENSION_ID = 'hbdgbgagpkpjffpklnamcljpakneikee';
const DESCRIPTION = 'Node.js Host for Browser Bridge Extension (Local Development)';

// Project root directory (this script is in apps/mcp-chrome/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const NATIVE_SERVER_DIST = path.join(PROJECT_ROOT, 'app', 'native-server', 'dist');

/**
 * Get real user home directory (handle sudo case)
 */
function getRealUserHome() {
  // If running as root via sudo, use the real user's home
  if (process.platform !== 'win32' && process.getuid && process.getuid() === 0) {
    const sudoUser = process.env.SUDO_USER;
    if (sudoUser && sudoUser !== 'root') {
      try {
        const userInfo = execSync(`getent passwd ${sudoUser}`, { encoding: 'utf8' }).trim();
        const homeDir = userInfo.split(':')[5];
        if (homeDir && homeDir !== '/root') {
          return homeDir;
        }
      } catch (err) {
        // Fallback to default
      }
    }
  }
  return os.homedir();
}

/**
 * Get user-level manifest file path
 */
function getUserManifestPath() {
  const userHome = getRealUserHome();

  if (os.platform() === 'win32') {
    // Windows: %APPDATA%\Google\Chrome\NativeMessagingHosts\
    return path.join(
      process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming'),
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
    return path.join(
      userHome,
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else {
    // Linux: ~/.config/google-chrome/NativeMessagingHosts/
    return path.join(
      userHome,
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  }
}

/**
 * Get Chromium user-level manifest path
 */
function getChromiumUserManifestPath() {
  const userHome = getRealUserHome();

  if (os.platform() === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming'),
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    return path.join(
      userHome,
      'Library',
      'Application Support',
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else {
    return path.join(
      userHome,
      '.config',
      'chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  }
}

/**
 * Get native host startup script path
 */
function getMainPath() {
  const wrapperScriptName = process.platform === 'win32' ? 'run_host.bat' : 'run_host.sh';
  return path.resolve(NATIVE_SERVER_DIST, wrapperScriptName);
}

/**
 * Create manifest content
 */
function createManifestContent() {
  const mainPath = getMainPath();

  return {
    name: HOST_NAME,
    description: DESCRIPTION,
    path: mainPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`]
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
 * Set execution permissions (Unix/Linux/macOS)
 */
function setExecutionPermissions() {
  if (os.platform() === 'win32') {
    return; // Windows doesn't need this
  }

  const filesToChmod = [
    path.join(NATIVE_SERVER_DIST, 'index.js'),
    path.join(NATIVE_SERVER_DIST, 'run_host.sh'),
    path.join(NATIVE_SERVER_DIST, 'cli.js')
  ];

  filesToChmod.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.chmodSync(filePath, '755');
        console.log(`[OK] Set execution permissions: ${path.basename(filePath)}`);
      } catch (err) {
        console.warn(`[WARN] Failed to set permissions for ${path.basename(filePath)}: ${err.message}`);
      }
    }
  });
}

/**
 * Fix file ownership for real user (when running as root/sudo)
 */
function fixOwnership(filePath) {
  if (os.platform() === 'win32') {
    return; // Windows doesn't need this
  }

  if (process.getuid && process.getuid() === 0) {
    const sudoUser = process.env.SUDO_USER;
    if (sudoUser && sudoUser !== 'root') {
      try {
        execSync(`chown ${sudoUser}:${sudoUser} "${filePath}"`, { stdio: 'pipe' });
        console.log(`[OK] Fixed ownership for: ${path.basename(filePath)}`);
      } catch (err) {
        console.warn(`[WARN] Failed to fix ownership for ${path.basename(filePath)}: ${err.message}`);
      }
    }
  }
}

/**
 * Register for a browser
 */
function registerForBrowser(manifestPath, browserName, registryKey = null) {
  try {
    // Ensure directory exists
    ensureDir(path.dirname(manifestPath));

    // Create manifest
    const manifest = createManifestContent();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[OK] Manifest written: ${manifestPath}`);

    // Fix file ownership if running as root
    fixOwnership(manifestPath);
    fixOwnership(path.dirname(manifestPath));

    // Windows registry entry
    if (os.platform() === 'win32' && registryKey) {
      try {
        const escapedPath = manifestPath.replace(/\\/g, '\\\\');
        const regCommand = `reg add "${registryKey}" /ve /t REG_SZ /d "${escapedPath}" /f`;
        execSync(regCommand, { stdio: 'pipe' });
        console.log(`[OK] Registry entry created for ${browserName}`);
      } catch (err) {
        console.warn(`[WARN] Registry entry failed for ${browserName}: ${err.message}`);
      }
    }

    console.log(`[SUCCESS] Successfully registered ${browserName}\n`);
    return true;
  } catch (err) {
    console.error(`[ERROR] Failed to register ${browserName}: ${err.message}\n`);
    return false;
  }
}

/**
 * Main registration function
 */
function main() {
  console.log('\n=================================================');
  console.log('  MCP Chrome Bridge - Local Development Setup');
  console.log('=================================================\n');

  console.log(`Project Root: ${PROJECT_ROOT}`);
  console.log(`Native Server Dist: ${NATIVE_SERVER_DIST}\n`);

  // Check if dist exists
  if (!fs.existsSync(NATIVE_SERVER_DIST)) {
    console.error(`[ERROR] Error: Dist folder not found at ${NATIVE_SERVER_DIST}`);
    console.error('Please build the native server first:');
    console.error('  cd apps/mcp-chrome');
    console.error('  pnpm run build:native\n');
    process.exit(1);
  }

  // Check if run_host script exists
  const runHostScript = getMainPath();
  if (!fs.existsSync(runHostScript)) {
    console.error(`[ERROR] Error: Run host script not found at ${runHostScript}`);
    console.error('Please build the native server first.\n');
    process.exit(1);
  }

  // Set execution permissions
  setExecutionPermissions();

  console.log('Registering local development version...\n');

  // Register for Chrome
  const chromeManifestPath = getUserManifestPath();
  const chromeRegistryKey = os.platform() === 'win32'
    ? `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`
    : null;

  const chromeSuccess = registerForBrowser(chromeManifestPath, 'Chrome', chromeRegistryKey);

  // Register for Chromium
  const chromiumManifestPath = getChromiumUserManifestPath();
  const chromiumRegistryKey = os.platform() === 'win32'
    ? `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`
    : null;

  const chromiumSuccess = registerForBrowser(chromiumManifestPath, 'Chromium', chromiumRegistryKey);

  // Summary
  console.log('=================================================');
  console.log('  Registration Summary');
  console.log('=================================================\n');

  if (chromeSuccess) {
    console.log(`[SUCCESS] Chrome: ${chromeManifestPath}`);
  } else {
    console.log(`[FAILED] Chrome: Failed`);
  }

  if (chromiumSuccess) {
    console.log(`[SUCCESS] Chromium: ${chromiumManifestPath}`);
  } else {
    console.log(`[FAILED] Chromium: Failed`);
  }

  console.log('\n=================================================');
  console.log('  Next Steps');
  console.log('=================================================\n');
  console.log('1. Restart Chrome/Chromium');
  console.log('2. Reload the extension (chrome://extensions)');
  console.log('3. Click "Connect" in the extension popup');
  console.log('4. The local development version should now be running\n');

  if (chromeSuccess || chromiumSuccess) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main };
