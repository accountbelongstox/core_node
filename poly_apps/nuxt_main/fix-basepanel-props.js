#!/usr/bin/env node

/**
 * Fix BasePanel prop issue: change :show to :model-value
 * This script updates all Vue components that use BasePanel to use the correct prop name
 */

const fs = require('fs');
const path = require('path');

const filesToFix = [
  'app_pymatrix_pages/components/SystemHealthMonitor.vue',
  'app_pymatrix_pages/components/ConnectionHistoryPanel.vue',
  'app_pymatrix_pages/components/TextInputPanel.vue',
  'app_pymatrix_pages/components/PyMatrixScriptManager.vue',
  'app_pymatrix_pages/components/GroupTreeView.vue',
  'app_pymatrix_pages/components/DeviceTagManager.vue',
  'app_pymatrix_pages/components/FilePushPanel.vue',
  'app_pymatrix_pages/components/ApkInstallPanel.vue',
  'app_pymatrix_pages/components/AudioStreamingPanel.vue'
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
