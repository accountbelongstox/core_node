#!/usr/bin/env node

/**
 * Update Extension ID in Native Messaging Host Manifest
 * This script helps update the allowed_origins in the manifest file
 * with the current extension ID
 */

const fs = require('fs');
const {
  BROWSER_CHROME,
  buildAllowedOrigins,
  getUserManifestPath,
  validateExtensionId,
} = require('./native-host-common.cjs');

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

  try {
    validateExtensionId(extensionId);
  } catch (error) {
    console.error(`\n[ERROR] ${error.message}\n`);
    process.exit(1);
  }

  const manifestPath = getUserManifestPath(BROWSER_CHROME);

  if (!fs.existsSync(manifestPath)) {
    console.error(`\n[ERROR] Manifest file not found: ${manifestPath}`);
    console.error('Please run the registration script first: node register-local-dev.cjs\n');
    process.exit(1);
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.allowed_origins = buildAllowedOrigins(manifest.allowed_origins, extensionId);

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
