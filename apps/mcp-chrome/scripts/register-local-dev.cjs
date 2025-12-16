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
const EXTENSION_ID = 'lmngnnnghipjfcbbhpaknlnbjcbabblm';
const DESCRIPTION = 'Node.js Host for Browser Bridge Extension (Local Development)';

// Project root directory (this script is in apps/mcp-chrome/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const NATIVE_SERVER_DIST = path.join(PROJECT_ROOT, 'app', 'native-server', 'dist');

/**
 * Get system-level manifest file path (accessible by all users)
 */
function getManifestPath() {
  if (os.platform() === 'win32') {
    // Windows: C:\Program Files\Google\Chrome\NativeMessagingHosts\
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    return path.join(
      programFiles,
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    // macOS: /Library/Google/Chrome/NativeMessagingHosts/
    return path.join(
      '/Library',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else {
    // Linux: /etc/opt/chrome/native-messaging-hosts/
    return path.join(
      '/etc',
      'opt',
      'chrome',
      'native-messaging-hosts',
      `${HOST_NAME}.json`
    );
  }
}

/**
 * Get Chromium system-level manifest path
 */
function getChromiumManifestPath() {
  if (os.platform() === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    return path.join(
      programFiles,
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    return `/Library/Application Support/Chromium/NativeMessagingHosts/${HOST_NAME}.json`;
  } else {
    // Linux: /etc/chromium/native-messaging-hosts/
    return `/etc/chromium/native-messaging-hosts/${HOST_NAME}.json`;
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
 * Fix permissions for system directory (readable by all users)
 */
function fixSystemPermissions(dirPath) {
  if (os.platform() === 'win32') {
    return; // Windows handles permissions differently
  }

  try {
    // Set directory and files to be readable by all users (755 for dirs, 644 for files)
    execSync(`chmod 755 "${dirPath}" 2>/dev/null`, { stdio: 'pipe' });
    execSync(`chmod 644 "${dirPath}"/*.json 2>/dev/null`, { stdio: 'pipe' });
    console.log(`[OK] Set permissions for system directory (755/644)`);
  } catch (err) {
    console.warn(`[WARN] Failed to set permissions: ${err.message}`);
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

    // Fix permissions for system directory
    fixSystemPermissions(path.dirname(manifestPath));

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

  // Register for Chrome (system-level)
  const chromeManifestPath = getManifestPath();
  const chromeRegistryKey = os.platform() === 'win32'
    ? `HKLM\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`
    : null;

  const chromeSuccess = registerForBrowser(chromeManifestPath, 'Chrome', chromeRegistryKey);

  // Register for Chromium (system-level)
  const chromiumManifestPath = getChromiumManifestPath();
  const chromiumRegistryKey = os.platform() === 'win32'
    ? `HKLM\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`
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
