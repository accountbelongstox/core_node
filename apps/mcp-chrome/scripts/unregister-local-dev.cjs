#!/usr/bin/env node

/**
 * Unregister local development version of mcp-chrome-bridge
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOST_NAME = 'com.chromemcp.nativehost';

function getUserManifestPath() {
  if (os.platform() === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else {
    return path.join(
      os.homedir(),
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  }
}

function getChromiumUserManifestPath() {
  if (os.platform() === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else if (os.platform() === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  } else {
    return path.join(
      os.homedir(),
      '.config',
      'chromium',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  }
}

function unregisterForBrowser(manifestPath, browserName, registryKey = null) {
  let success = true;

  // Remove manifest file
  if (fs.existsSync(manifestPath)) {
    try {
      fs.unlinkSync(manifestPath);
      console.log(`✓ Removed manifest: ${manifestPath}`);
    } catch (err) {
      console.error(`❌ Failed to remove manifest: ${err.message}`);
      success = false;
    }
  } else {
    console.log(`ℹ️  Manifest not found: ${manifestPath}`);
  }

  // Remove Windows registry entry
  if (os.platform() === 'win32' && registryKey) {
    try {
      execSync(`reg delete "${registryKey}" /f`, { stdio: 'pipe' });
      console.log(`✓ Removed registry entry for ${browserName}`);
    } catch (err) {
      console.warn(`⚠️  Registry entry removal failed for ${browserName} (may not exist)`);
    }
  }

  console.log(`${success ? '✅' : '⚠️ '} Unregistered ${browserName}\n`);
  return success;
}

function main() {
  console.log('\n=================================================');
  console.log('  MCP Chrome Bridge - Unregister Local Dev');
  console.log('=================================================\n');

  // Unregister Chrome
  const chromeManifestPath = getUserManifestPath();
  const chromeRegistryKey = os.platform() === 'win32'
    ? `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`
    : null;

  unregisterForBrowser(chromeManifestPath, 'Chrome', chromeRegistryKey);

  // Unregister Chromium
  const chromiumManifestPath = getChromiumUserManifestPath();
  const chromiumRegistryKey = os.platform() === 'win32'
    ? `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${HOST_NAME}`
    : null;

  unregisterForBrowser(chromiumManifestPath, 'Chromium', chromiumRegistryKey);

  console.log('=================================================');
  console.log('  Unregistration Complete');
  console.log('=================================================\n');
  console.log('To use the global version again, run:');
  console.log('  npm install -g mcp-chrome-bridge\n');
}

if (require.main === module) {
  main();
}

module.exports = { main };
