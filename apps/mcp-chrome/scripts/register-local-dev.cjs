#!/usr/bin/env node

/**
 * Register local development version of mcp-chrome-bridge
 * This script registers the local compiled version instead of the globally installed one
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { getExtensionIdFromManifest } = require('./extension-id-calculator.cjs');

const HOST_NAME = 'com.chromemcp.nativehost';
const DESCRIPTION = 'Node.js Host for Browser Bridge Extension (Local Development)';

// Project root directory (this script is in apps/mcp-chrome/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const NATIVE_SERVER_DIST = path.join(PROJECT_ROOT, 'app', 'native-server', 'dist');

/**
 * Get user-level manifest file path (for development, allows any extension ID)
 */
function getManifestPath() {
  const homeDir = os.homedir();
  if (os.platform() === 'win32') {
    // Windows: %USERPROFILE%\AppData\Roaming\Google\Chrome\NativeMessagingHosts\
    return path.join(
      homeDir,
      'AppData',
      'Roaming',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
    return path.join(
      homeDir,
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
      homeDir,
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
function getChromiumManifestPath() {
  const homeDir = os.homedir();
  if (os.platform() === 'win32') {
    return path.join(
      homeDir,
      'AppData',
      'Roaming',
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    return path.join(
      homeDir,
      'Library',
      'Application Support',
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else {
    // Linux: ~/.config/chromium/NativeMessagingHosts/
    return path.join(
      homeDir,
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
 * Create manifest content with extension ID from built manifest.json
 * @param {string} extensionId - Required extension ID (must be provided)
 */
function createManifestContent(extensionId) {
  if (!extensionId || typeof extensionId !== 'string' || extensionId.length !== 32) {
    throw new Error(`Invalid extension ID: ${extensionId}. Extension ID must be 32 characters.`);
  }

  const mainPath = getMainPath();
  const manifestPath = getManifestPath();
  
  // Read existing manifest to preserve other extension IDs if any
  let existingOrigins = [];
  
  if (fs.existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (existing.allowed_origins && Array.isArray(existing.allowed_origins)) {
        // Keep existing origins that are not from this extension
        existingOrigins = existing.allowed_origins.filter(
          origin => !origin.includes('chrome-extension://')
        );
      }
    } catch (err) {
      // If existing manifest is corrupted, we'll overwrite it
      console.log(`[WARN] Could not read existing manifest: ${err.message}`);
    }
  }

  // Add the calculated extension ID
  const newOrigin = `chrome-extension://${extensionId}/`;
  if (!existingOrigins.includes(newOrigin)) {
    existingOrigins.push(newOrigin);
  }

  return {
    name: HOST_NAME,
    description: DESCRIPTION,
    path: mainPath,
    type: 'stdio',
    allowed_origins: existingOrigins
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
 * Get Windows registry key for a browser (user-level HKCU)
 */
function getWindowsRegistryKey(browserName) {
  if (os.platform() !== 'win32') return null;
  if (browserName.toLowerCase() === 'chromium') {
    return `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`;
  }
  return `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
}

/**
 * Register for a browser
 */
function registerForBrowser(manifestPath, browserName, registryKey = null, extensionId = null) {
  try {
    // Ensure directory exists
    ensureDir(path.dirname(manifestPath));

    // Create manifest with extension ID (extensionId is required)
    if (!extensionId) {
      throw new Error(`Extension ID is required for ${browserName} registration`);
    }

    const manifest = createManifestContent(extensionId);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[OK] Manifest written: ${manifestPath}`);
    console.log(`[OK] Configured extension ID: ${extensionId}`);

    // Fix permissions for system directory
    fixSystemPermissions(path.dirname(manifestPath));

    // Windows requires HKCU registry entry for user-level native messaging host discovery
    const effectiveRegistryKey = registryKey || getWindowsRegistryKey(browserName);
    if (os.platform() === 'win32' && effectiveRegistryKey) {
      try {
        const escapedPath = manifestPath.replace(/\\/g, '\\\\');
        const regCommand = `reg add "${effectiveRegistryKey}" /ve /t REG_SZ /d "${escapedPath}" /f`;
        execSync(regCommand, { stdio: 'pipe' });
        console.log(`[OK] Registry entry created: ${effectiveRegistryKey}`);
      } catch (err) {
        console.warn(`[WARN] Registry entry failed for ${browserName}: ${err.message}`);
        console.warn(`[HINT] Try running as Administrator if this fails`);
      }
    }

    // Write node_path.txt for run_host.bat to find Node.js
    try {
      const nodePathFile = path.join(NATIVE_SERVER_DIST, 'node_path.txt');
      fs.writeFileSync(nodePathFile, process.execPath, 'utf8');
      console.log(`[OK] Node.js path written: ${process.execPath}`);
    } catch (err) {
      console.warn(`[WARN] Failed to write node_path.txt: ${err.message}`);
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

  console.log('Registering local development version (user-level)...\n');

  // Try to get extension ID from built manifest.json
  // Support the configured .output/build_extension, the legacy .output/chrome-mv3, and direct paths
  const possibleManifestPaths = [
    path.join(PROJECT_ROOT, '.output', 'build_extension', 'manifest.json'),
    path.join(PROJECT_ROOT, 'app', 'chrome-extension', '.output', 'chrome-mv3', 'manifest.json'),
    path.join(PROJECT_ROOT, 'app', 'chrome-extension', 'manifest.json'),
  ];
  
  let extensionId = null;
  let manifestPathFound = null;
  
  for (const manifestPath of possibleManifestPaths) {
    if (fs.existsSync(manifestPath)) {
      manifestPathFound = manifestPath;
      extensionId = getExtensionIdFromManifest(manifestPath);
      if (extensionId) {
        console.log(`[OK] Detected extension ID from manifest: ${extensionId}`);
        console.log(`[OK] Manifest location: ${manifestPath}\n`);
        break;
      } else {
        console.log(`[WARN] Could not calculate extension ID from: ${manifestPath}`);
        console.log('[INFO] Make sure manifest.json contains a "key" field\n');
      }
    }
  }
  
  if (!manifestPathFound) {
    console.error('[ERROR] Built manifest.json not found in any expected location.');
    console.error('[ERROR] The extension must be built before registering the native host.');
    console.error('[INFO] Searched paths:');
    possibleManifestPaths.forEach(p => console.error(`  - ${p}`));
    console.error('[INFO] Please run the build script first: .\\scripts\\start.ps1\n');
    process.exit(1);
  }
  
  if (!extensionId) {
    console.error('[ERROR] Extension ID could not be calculated from manifest.json.');
    console.error('[ERROR] The manifest.json must contain a "key" field for automatic ID calculation.');
    console.error(`[INFO] Manifest location: ${manifestPathFound}`);
    console.error('[INFO] Ensure wxt.config.ts includes the key field in manifest configuration.');
    console.error('[INFO] The key should be defined in config.cjs as CHROME_EXTENSION_KEY.\n');
    process.exit(1);
  }

  // Register for Chrome (user-level for development)
  const chromeManifestPath = getManifestPath();
  // User-level registration doesn't need registry key on Windows
  const chromeSuccess = registerForBrowser(chromeManifestPath, 'Chrome', null, extensionId);

  // Register for Chromium (user-level for development)
  const chromiumManifestPath = getChromiumManifestPath();
  const chromiumSuccess = registerForBrowser(chromiumManifestPath, 'Chromium', null, extensionId);

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
  
  console.log(`Extension ID: ${extensionId}`);
  console.log('The native host manifest has been automatically configured with this ID.\n');
  console.log('1. Restart Chrome/Chromium (required for native host changes to take effect)');
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
