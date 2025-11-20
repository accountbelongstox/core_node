#!/usr/bin/env node

// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// ============================================================================
// MULTI-APP ENTRY POINT SWITCHER
// ============================================================================
//
// **CRITICAL FUNCTION**:
// This script is the CORE of the multi-app architecture. It physically replaces
// pages/index.vue with the target app's entry file BEFORE Nuxt build/dev starts.
//
// **WHY THIS APPROACH**:
// 1. **Physical Isolation**: Nuxt only sees ONE app's entry point at a time
// 2. **Zero Cross-Contamination**: Other apps' code is not even visible to Nuxt
// 3. **Optimal Tree-Shaking**: Only the active app is included in the build
// 4. **No Runtime Overhead**: No dynamic loading, no conditional imports
//
// **WORKFLOW**:
// 1. start.ps1 calls this script: node switch-app-entry.js ittools
// 2. Validate 'ittools' is in SUPPORTED_APPS
// 3. Backup current pages/index.vue → .app-backups/index.backup.{timestamp}.vue
// 4. Copy pages/index.ittools.vue → pages/index.vue (with metadata comment)
// 5. Nuxt dev/build starts → only sees pages/index.vue (which is ittools)
//
// **RESULT**:
// When you run 'yarn dev:ittools', the build ONLY includes:
// - pages/index.vue (= pages/index.ittools.vue content)
// - apps/app_ittools/** (imported by index.vue)
// - common/** (imported by ittools)
//
// Other apps (example, codemart, dev, admin, dashboard) are NOT included.
//
// **USAGE**:
//   node scripts/switch-app-entry.js [appname]
//   APP_ENTRY=dev node scripts/switch-app-entry.js
//
// **SUPPORTED APPS**: example, codemart, dev, admin, dashboard, ittools
//
// **COMMANDS**:
//   --current     Show currently active app
//   --list        List all backup files
//   --restore     Restore from backup
//   --help        Show help message
// ============================================================================

const fs = require('fs');
const path = require('path');

// Configuration
const APPS_DIR = path.join(__dirname, '../apps');
const PAGES_DIR = path.join(__dirname, '../pages');
const INDEX_FILE = path.join(PAGES_DIR, 'index.vue');
const BACKUP_DIR = path.join(__dirname, '../.app-backups');
const PLACEHOLDER_MARKER = '⚠️ DYNAMIC ENTRY PLACEHOLDER — DO NOT EDIT';
const ARCHITECTURE_GUIDE_PATH = 'poly_apps/nuxt_main/development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md';

// Automatically scan for available apps
function scanAvailableApps() {
  if (!fs.existsSync(APPS_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(APPS_DIR, { withFileTypes: true });
  const apps = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('app_'))
    .map(entry => entry.name.replace(/^app_/, ''))
    .sort();

  return apps;
}

const SUPPORTED_APPS = scanAvailableApps();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Get target app from command line argument or environment variable
function getTargetApp() {
  const argApp = process.argv[2];
  const envApp = process.env.APP_ENTRY;
  
  const targetApp = argApp || envApp || 'example';
  
  if (!SUPPORTED_APPS.includes(targetApp)) {
    error(`Unsupported app: ${targetApp}`);
    info(`Supported apps: ${SUPPORTED_APPS.join(', ')}`);
    process.exit(1);
  }
  
  return targetApp;
}

// Create backup directory if it doesn't exist
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    info(`Created backup directory: ${BACKUP_DIR}`);
  }
}

// Backup current index.vue if it exists and is not a placeholder
function backupCurrentIndex() {
  if (fs.existsSync(INDEX_FILE)) {
    const content = fs.readFileSync(INDEX_FILE, 'utf8');
    
    // Check if it's not a placeholder file
    if (!content.includes(PLACEHOLDER_MARKER)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `index.backup.${timestamp}.vue`);
      
      fs.writeFileSync(backupFile, content);
      info(`Backed up current index.vue to: ${backupFile}`);
    }
  }
}

function buildPlaceholderHeader(targetApp) {
  return `<!--
${PLACEHOLDER_MARKER}

This file is regenerated each time scripts/switch-app-entry.js runs.
True source file:
  poly_apps/nuxt_main/pages/index.${targetApp}.vue

AI/Developers: stop reading this placeholder and open the source file above.
Always review the architecture guide before editing app code:
  ${ARCHITECTURE_GUIDE_PATH}

All changes made here will be overwritten. Update the source file instead.
-->`;
}

function injectBlankLineWarnings(content, targetApp) {
  const lines = content.split('\n');
  const htmlComment = `<!-- AI WARNING (NOT CODE): Edit pages/index.${targetApp}.vue (see ${ARCHITECTURE_GUIDE_PATH}) -->`;
  const jsComment = `// AI WARNING (NOT CODE): Edit pages/index.${targetApp}.vue (see ${ARCHITECTURE_GUIDE_PATH})`;
  const cssComment = `/* AI WARNING (NOT CODE): Edit pages/index.${targetApp}.vue (see ${ARCHITECTURE_GUIDE_PATH}) */`;

  let inScript = false;
  let inStyle = false;

  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      result.push(line);
      if (inScript) {
        result.push(jsComment);
      } else if (inStyle) {
        result.push(cssComment);
      } else {
        result.push(htmlComment);
      }
      continue;
    }

    result.push(line);

    if (/^<script\b/i.test(trimmed)) {
      inScript = true;
    } else if (/^<\/script>/i.test(trimmed)) {
      inScript = false;
    } else if (/^<style\b/i.test(trimmed)) {
      inStyle = true;
    } else if (/^<\/style>/i.test(trimmed)) {
      inStyle = false;
    }
  }

  return result.join('\n');
}

// Switch to the target app
function switchToApp(targetApp) {
  const sourceFile = path.join(PAGES_DIR, `index.${targetApp}.vue`);
  
  // Check if source file exists
  if (!fs.existsSync(sourceFile)) {
    error(`Source file not found: ${sourceFile}`);
    info(`Please create the file: pages/index.${targetApp}.vue`);
    process.exit(1);
  }
  
  // Backup current index if needed
  backupCurrentIndex();
  
  // Copy the app-specific index to index.vue with safety guidance
  const sourceContent = fs.readFileSync(sourceFile, 'utf8');
  const safeguardedContent = injectBlankLineWarnings(sourceContent, targetApp);
  const header = buildPlaceholderHeader(targetApp);
  const metadataComment = `<!-- Generated at: ${new Date().toISOString()} | App Entry: ${targetApp} -->`;
  const generatedContent = `${header}\n${metadataComment}\n${safeguardedContent}`;
  
  fs.writeFileSync(INDEX_FILE, generatedContent);
  
  success(`Successfully switched to ${targetApp} app`);
  info(`Source: pages/index.${targetApp}.vue`);
  info(`Target: pages/index.vue`);
}

// Restore from backup
function restoreFromBackup(backupFile) {
  if (!fs.existsSync(backupFile)) {
    error(`Backup file not found: ${backupFile}`);
    process.exit(1);
  }
  
  const backupContent = fs.readFileSync(backupFile, 'utf8');
  fs.writeFileSync(INDEX_FILE, backupContent);
  
  success(`Restored index.vue from backup: ${backupFile}`);
}

// List available backups
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    info('No backups found');
    return;
  }
  
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(file => file.startsWith('index.backup.') && file.endsWith('.vue'))
    .sort()
    .reverse();
  
  if (backups.length === 0) {
    info('No backups found');
    return;
  }
  
  info('Available backups:');
  backups.forEach((backup, index) => {
    log(`  ${index + 1}. ${backup}`, 'cyan');
  });
}

// Show current app
function showCurrentApp() {
  if (!fs.existsSync(INDEX_FILE)) {
    warning('index.vue does not exist');
    return;
  }
  
  const content = fs.readFileSync(INDEX_FILE, 'utf8');
  const match = content.match(/App Entry: (\w+)/);
  
  if (match) {
    info(`Current app: ${match[1]}`);
  } else {
    warning('Cannot determine current app (may be manually edited)');
  }
}

// Show help
function showHelp() {
  log('\n📚 Multi-App Entry Switcher', 'bright');
  log('\nUsage:');
  log('  node scripts/switch-app-entry.js <appname>    Switch to specific app');
  log('  node scripts/switch-app-entry.js --current    Show current app');
  log('  node scripts/switch-app-entry.js --list       List available backups');
  log('  node scripts/switch-app-entry.js --help       Show this help');
  log('\nSupported apps:', 'yellow');
  SUPPORTED_APPS.forEach(app => {
    log(`  • ${app}`, 'cyan');
  });
  log('\nEnvironment variable:');
  log('  APP_ENTRY=dev node scripts/switch-app-entry.js');
  log('\nExamples:');
  log('  node scripts/switch-app-entry.js example');
  log('  node scripts/switch-app-entry.js dev');
  log('  APP_ENTRY=admin node scripts/switch-app-entry.js');
}

// Main execution
function main() {
  const arg = process.argv[2];
  
  // Handle special commands
  switch (arg) {
    case '--help':
    case '-h':
      showHelp();
      return;
      
    case '--current':
    case '-c':
      showCurrentApp();
      return;
      
    case '--list':
    case '-l':
      listBackups();
      return;
      
    case '--restore':
    case '-r':
      const backupFile = process.argv[3];
      if (!backupFile) {
        error('Please specify backup file to restore');
        listBackups();
        process.exit(1);
      }
      restoreFromBackup(path.join(BACKUP_DIR, backupFile));
      return;
  }
  
  // Normal app switching
  const targetApp = getTargetApp();
  
  log(`\n🚀 Switching to ${targetApp} app...`, 'bright');
  
  ensureBackupDir();
  switchToApp(targetApp);
  
  log(`\n🎉 Ready to start ${targetApp} app!`, 'green');
  log(`Run: yarn dev:${targetApp}`, 'cyan');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  switchToApp,
  getTargetApp,
  SUPPORTED_APPS
};
