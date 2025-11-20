#!/usr/bin/env node

/**
 * Fix BasePanel prop issue: change :show to :model-value
 * This script updates all Vue components that use BasePanel to use the correct prop name
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'apps/app_pymatrix/components_app_pymatrix/SystemHealthMonitor.vue',
  'apps/app_pymatrix/components_app_pymatrix/ConnectionHistoryPanel.vue',
  'apps/app_pymatrix/components_app_pymatrix/TextInputPanel.vue',
  'apps/app_pymatrix/components_app_pymatrix/PyMatrixScriptManager.vue',
  'apps/app_pymatrix/components_app_pymatrix/GroupTreeView.vue',
  'apps/app_pymatrix/components_app_pymatrix/DeviceTagManager.vue',
  'apps/app_pymatrix/components_app_pymatrix/FilePushPanel.vue',
  'apps/app_pymatrix/components_app_pymatrix/ApkInstallPanel.vue',
  'apps/app_pymatrix/components_app_pymatrix/AudioStreamingPanel.vue'
];

let totalFixed = 0;

filesToFix.forEach(relPath => {
  const filePath = path.join(__dirname, relPath);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${relPath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;

  // Replace :show=" with :model-value="
  content = content.replace(/:show="/g, ':model-value="');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Fixed: ${relPath}`);
    totalFixed++;
  } else {
    console.log(`ℹ️  No changes needed: ${relPath}`);
  }
});

console.log(`\n🎉 Fixed ${totalFixed} files`);
