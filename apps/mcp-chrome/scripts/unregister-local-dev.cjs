#!/usr/bin/env node

/**
 * Unregister local development version of mcp-chrome-bridge
 */

const fs = require('fs');
const {
  SUPPORTED_BROWSERS,
  getUserManifestPath,
  getWindowsUserRegistryKey,
  removeWindowsRegistryKey,
} = require('./native-host-common.cjs');

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
  if (registryKey) {
    try {
      removeWindowsRegistryKey(registryKey);
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

  for (const browser of SUPPORTED_BROWSERS) {
    unregisterForBrowser(
      getUserManifestPath(browser.type),
      browser.displayName,
      getWindowsUserRegistryKey(browser.type),
    );
  }

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
