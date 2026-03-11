#!/usr/bin/env node

/**
 * Update Extension ID in Native Messaging Host Manifest
 * This script helps update the allowed_origins in the manifest file
 * with the current extension ID
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST_NAME = 'com.chromemcp.nativehost';

/**
 * Get user-level manifest file path
 */
function getManifestPath() {
  const homeDir = os.homedir();
  if (os.platform() === 'win32') {
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
    return path.join(
      homeDir,
      '.config',
      'google-chrome',
      'NativeMessagingHosts',
      `${HOST_NAME}.json`
    );
  }
}

function main() {
  const extensionId = process.argv[2];
  
  if (!extensionId) {
    console.error('\nUsage: node update-extension-id.cjs <extension-id>\n');
    console.error('Example: node update-extension-id.cjs lmngnnnghipjfcbbhpaknlnbjcbabblm\n');
    console.error('To find your extension ID:');
    console.error('1. Open Chrome and go to chrome://extensions/');
    console.error('2. Enable "Developer mode"');
    console.error('3. Find your extension and copy the ID\n');
    process.exit(1);
  }

  // Validate extension ID format (32 lowercase hex characters)
  if (!/^[a-f0-9]{32}$/.test(extensionId)) {
    console.error(`\n[ERROR] Invalid extension ID format: ${extensionId}`);
    console.error('Extension ID should be 32 lowercase hexadecimal characters\n');
    process.exit(1);
  }

  const manifestPath = getManifestPath();

  if (!fs.existsSync(manifestPath)) {
    console.error(`\n[ERROR] Manifest file not found: ${manifestPath}`);
    console.error('Please run the registration script first: node register-local-dev.cjs\n');
    process.exit(1);
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const newOrigin = `chrome-extension://${extensionId}/`;
    
    // Update allowed_origins
    if (!manifest.allowed_origins) {
      manifest.allowed_origins = [];
    }
    
    // Remove old origins and add new one
    manifest.allowed_origins = manifest.allowed_origins.filter(
      origin => !origin.includes('chrome-extension://')
    );
    manifest.allowed_origins.push(newOrigin);

    // Write updated manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    
    console.log('\n[SUCCESS] Manifest updated successfully!\n');
    console.log(`Extension ID: ${extensionId}`);
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Allowed origins: ${manifest.allowed_origins.join(', ')}\n`);
    console.log('Next steps:');
    console.log('1. Restart Chrome');
    console.log('2. Reload your extension');
    console.log('3. Try connecting again\n');
    
  } catch (error) {
    console.error(`\n[ERROR] Failed to update manifest: ${error.message}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
