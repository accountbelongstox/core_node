#!/usr/bin/env node

/**
 * Register local development version of mcp-chrome-bridge
 * This script registers the local compiled version instead of the globally installed one
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getExtensionIdFromManifest } = require('./extension-id-calculator.cjs');
const {
  EXTENSION_BUILD_DIR,
  NATIVE_SERVER_DIST,
  SUPPORTED_BROWSERS,
  getUserManifestPath,
  getRunHostPath,
  registerUserHost,
} = require('./native-host-common.cjs');

const DESCRIPTION = 'Node.js Host for Browser Bridge Extension (Local Development)';

// Project root directory (this script is in apps/mcp-chrome/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '..');

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
    console.error('  bun run build:native\n');
    process.exit(1);
  }

  // Check if run_host script exists
  const runHostScript = getRunHostPath(NATIVE_SERVER_DIST);
  if (!fs.existsSync(runHostScript)) {
    console.error(`[ERROR] Error: Run host script not found at ${runHostScript}`);
    console.error('Please build the native server first.\n');
    process.exit(1);
  }

  // Set execution permissions
  setExecutionPermissions();

  console.log('Registering local development version (user-level)...\n');

  // Try to get extension ID from built manifest.json
  // The contract-named build folder first, then a source-tree manifest.
  const possibleManifestPaths = [
    path.join(EXTENSION_BUILD_DIR, 'manifest.json'),
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

  const registrationResults = SUPPORTED_BROWSERS.map(browser => {
    const manifestPath = getUserManifestPath(browser.type);
    const success = registerUserHost(browser.type, {
      extensionId,
      description: DESCRIPTION,
      nativeServerDist: NATIVE_SERVER_DIST,
    });
    return { ...browser, manifestPath, success };
  });

  // Summary
  console.log('=================================================');
  console.log('  Registration Summary');
  console.log('=================================================\n');

  for (const result of registrationResults) {
    console.log(
      result.success
        ? `[SUCCESS] ${result.displayName}: ${result.manifestPath}`
        : `[FAILED] ${result.displayName}: Failed`,
    );
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

  if (registrationResults.some(result => result.success)) {
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
